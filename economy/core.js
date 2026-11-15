
import crypto from 'node:crypto';
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
const sanitize=(x,n=150)=>String(x??'').trim().slice(0,n);
const utcDay=()=>new Date().toISOString().slice(0,10);
export class MeshEconomy {
 constructor(db){
  this.db=db;
  db.exec(`CREATE TABLE IF NOT EXISTS mesh_members(id INTEGER PRIMARY KEY AUTOINCREMENT, handle TEXT NOT NULL UNIQUE COLLATE NOCASE,password_hash TEXT NOT NULL,salt TEXT NOT NULL,role TEXT NOT NULL,referral_code TEXT NOT NULL UNIQUE,referred_by INTEGER,joined_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS mesh_sessions(token_hash TEXT PRIMARY KEY,member_id INTEGER NOT NULL,expires_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS mesh_ledger(id INTEGER PRIMARY KEY AUTOINCREMENT,member_id INTEGER NOT NULL,xp INTEGER NOT NULL DEFAULT 0,credits INTEGER NOT NULL DEFAULT 0,reason TEXT NOT NULL,once_key TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS mesh_submission_links(submission_id INTEGER PRIMARY KEY,member_id INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS mesh_spotlights(id INTEGER PRIMARY KEY AUTOINCREMENT,member_id INTEGER NOT NULL,resource_id INTEGER NOT NULL,starts_at TEXT NOT NULL DEFAULT (datetime('now')),ends_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS mesh_sponsors(id INTEGER PRIMARY KEY AUTOINCREMENT,email TEXT NOT NULL,site TEXT NOT NULL,brief TEXT NOT NULL,plan TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'new',created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE IF NOT EXISTS mesh_partner_actions(id INTEGER PRIMARY KEY AUTOINCREMENT, sponsor_id INTEGER NOT NULL, state TEXT NOT NULL, next_action TEXT NOT NULL, due_date TEXT, owner TEXT NOT NULL, evidence TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE INDEX IF NOT EXISTS mesh_partner_actions_due ON mesh_partner_actions(sponsor_id,due_date);`);
 }
 grant(id,xp,credits,reason,key){return this.db.prepare('INSERT OR IGNORE INTO mesh_ledger(member_id,xp,credits,reason,once_key) VALUES(?,?,?,?,?)').run(id,xp,credits,reason,key).changes===1;}
 member(id){
  const m=this.db.prepare('SELECT id,handle,role,referral_code,referred_by,joined_at FROM mesh_members WHERE id=?').get(id);
  if(!m)return null;
  const x=this.db.prepare('SELECT COALESCE(SUM(xp),0) xp,COALESCE(SUM(credits),0) credits FROM mesh_ledger WHERE member_id=?').get(id);
  const own=this.db.prepare('SELECT s.id,s.name,s.url,s.state,s.created_at FROM submissions s JOIN mesh_submission_links l ON l.submission_id=s.id WHERE l.member_id=? ORDER BY s.id DESC LIMIT 30').all(id);
  const recent=this.db.prepare('SELECT reason,xp,credits,created_at FROM mesh_ledger WHERE member_id=? ORDER BY id DESC LIMIT 20').all(id);
  return {...m,xp:x.xp,credits:x.credits,level:1+Math.floor(Math.sqrt(Math.max(0,x.xp)/80)),submissions:own,history:recent,token:{issued:false,claimable:false}};
 }
 session(id){
  const token=crypto.randomBytes(32).toString('base64url');
  this.db.prepare("INSERT INTO mesh_sessions(token_hash,member_id,expires_at) VALUES(?,?,datetime('now','+30 days'))").run(digest(token),id);
  this.db.prepare("DELETE FROM mesh_sessions WHERE expires_at<datetime('now')").run();
  return token;
 }
 auth(header){
  const token=String(header||'').startsWith('Bearer ')?header.slice(7):'';
  if(token.length<30||token.length>100)return null;
  const m=this.db.prepare("SELECT member_id FROM mesh_sessions WHERE token_hash=? AND expires_at>datetime('now')").get(digest(token));
  return m?this.member(m.member_id):null;
 }
 register(b){
  const handle=sanitize(b.handle,60),password=String(b.password||''),role=sanitize(b.role,40);
  if(!/^[a-zA-Z][a-zA-Z0-9_]{2,23}$/.test(handle))return {error:'Handle must contain 3–24 Latin letters, digits or underscores.'};
  if(password.length<12||password.length>128)return {error:'Use a 12–128 character password.'};
  if(!['Builder','Curator','Explorer','Agent Developer','Community','Partner'].includes(role))return {error:'Select a valid role.'};
  if(this.db.prepare('SELECT id FROM mesh_members WHERE handle=?').get(handle))return {error:'Handle taken.'};
  const inviter=this.db.prepare('SELECT id FROM mesh_members WHERE referral_code=?').get(sanitize(b.invite,32).toUpperCase());
  const salt=crypto.randomBytes(16).toString('hex');
  const passHash=crypto.scryptSync(password,salt,64).toString('hex');
  try{
   const id=Number(this.db.prepare('INSERT INTO mesh_members(handle,password_hash,salt,role,referral_code,referred_by) VALUES(?,?,?,?,?,?)').run(handle,passHash,salt,role,crypto.randomBytes(7).toString('hex').toUpperCase(),inviter?.id||null).lastInsertRowid);
   this.grant(id,25,5,'founding-node','join:'+id);
   return {ok:true,member:this.member(id),token:this.session(id)};
  }catch(e){if(e.message.includes('UNIQUE'))return {error:'Handle taken.'};throw e;}
 }
 login(b){
  const m=this.db.prepare('SELECT id,password_hash,salt FROM mesh_members WHERE handle=?').get(sanitize(b.handle,60));
  const attempt=crypto.scryptSync(String(b.password||'').slice(0,128),m?.salt||'0'.repeat(32),64).toString('hex');
  if(!m||!crypto.timingSafeEqual(Buffer.from(attempt,'hex'),Buffer.from(m.password_hash,'hex')))return {error:'Invalid credentials.'};
  return {ok:true,member:this.member(m.id),token:this.session(m.id)};
 }
 logout(header){
  const token=String(header||'').replace(/^Bearer /,'');
  if(token)this.db.prepare('DELETE FROM mesh_sessions WHERE token_hash=?').run(digest(token));
  return {ok:true};
 }
 checkin(id){
  if(!this.grant(id,4,2,'daily-discovery','daily:'+id+':'+utcDay()))return {error:'Already checked in today (UTC).'};
  return {ok:true,xp:4,credits:2,member:this.member(id)};
 }
 orientation(id,answer){
  if(answer!=='source-linked')return {error:'Correct answer: evidence must link to an inspectable original source.'};
  if(!this.grant(id,20,5,'orientation','primer:'+id))return {error:'Primer already completed.'};
  return {ok:true,xp:20,credits:5,member:this.member(id)};
 }
 approved(subId){
  const link=this.db.prepare('SELECT member_id FROM mesh_submission_links WHERE submission_id=?').get(subId);if(!link)return;
  this.grant(link.member_id,40,20,'approved-resource','source:'+subId);
  const member=this.db.prepare('SELECT referred_by FROM mesh_members WHERE id=?').get(link.member_id);
  if(member?.referred_by!==null&&member?.referred_by!==undefined&&member.referred_by!==link.member_id)this.grant(member.referred_by,15,5,'qualified-referral','referral:'+link.member_id);
 }
 spotlights(){return this.db.prepare("SELECT r.id,r.name,r.url,r.description,r.category,s.ends_at FROM mesh_spotlights s JOIN resources r ON r.id=s.resource_id WHERE s.ends_at>datetime('now') ORDER BY s.starts_at DESC LIMIT 6").all();}
 redeem(id,subId){
  const own=this.db.prepare('SELECT r.id resource_id FROM submissions s JOIN mesh_submission_links l ON l.submission_id=s.id JOIN resources r ON r.url=s.url WHERE s.id=? AND s.state=? AND l.member_id=?').get(subId,'approved',id);
  if(!own)return {error:'Choose one of your approved submissions.'};
  if(this.db.prepare("SELECT 1 FROM mesh_spotlights WHERE member_id=? AND ends_at>datetime('now')").get(id))return {error:'You already have a spotlight active.'};
  if(this.spotlights().length>=6)return {error:'All six spotlight slots are in use.'};
  if(this.member(id).credits<20)return {error:'20 credits required. Earn them with an approved resource.'};
  this.db.exec('BEGIN IMMEDIATE');
  try{
   this.grant(id,0,-20,'spotlight-redemption','spotlight:'+crypto.randomUUID());
   this.db.prepare("INSERT INTO mesh_spotlights(member_id,resource_id,ends_at) VALUES(?,?,datetime('now','+7 days'))").run(id,own.resource_id);
   this.db.exec('COMMIT');
   return {ok:true,member:this.member(id)};
  }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 leaderboard(){return this.db.prepare('SELECT m.handle,m.role,COALESCE(SUM(l.xp),0) xp FROM mesh_members m LEFT JOIN mesh_ledger l ON l.member_id=m.id GROUP BY m.id ORDER BY xp DESC,m.id ASC LIMIT 30').all();}
 stats(){return {nodes:this.db.prepare('SELECT COUNT(*) n FROM mesh_members').get().n,completedActions:this.db.prepare('SELECT COUNT(*) n FROM mesh_ledger WHERE xp>0').get().n,creditsIssued:this.db.prepare('SELECT COALESCE(SUM(credits),0) n FROM mesh_ledger WHERE credits>0').get().n,creditsSpent:-this.db.prepare('SELECT COALESCE(SUM(credits),0) n FROM mesh_ledger WHERE credits<0').get().n,spotlights:this.spotlights().length,tokenIssued:false};}

 partnerQueue(){
   return this.db.prepare(`SELECT s.*,
     (SELECT a.next_action FROM mesh_partner_actions a WHERE a.sponsor_id=s.id ORDER BY a.id DESC LIMIT 1) next_action,
     (SELECT a.due_date FROM mesh_partner_actions a WHERE a.sponsor_id=s.id ORDER BY a.id DESC LIMIT 1) due_date,
     (SELECT a.owner FROM mesh_partner_actions a WHERE a.sponsor_id=s.id ORDER BY a.id DESC LIMIT 1) owner,
     (SELECT a.created_at FROM mesh_partner_actions a WHERE a.sponsor_id=s.id ORDER BY a.id DESC LIMIT 1) last_action_at
     FROM mesh_sponsors s ORDER BY CASE s.state WHEN 'new' THEN 0 WHEN 'contacted' THEN 1 WHEN 'qualified' THEN 2 WHEN 'proposal_sent' THEN 3 ELSE 4 END,s.id DESC LIMIT 100`).all();
 }
 partnerActions(sponsorId){
   return this.db.prepare('SELECT id,state,next_action,due_date,owner,evidence,created_at FROM mesh_partner_actions WHERE sponsor_id=? ORDER BY id DESC LIMIT 60').all(sponsorId);
 }
 updateSponsor(b){
   const id=Number(b.id),state=sanitize(b.state,30),next=sanitize(b.nextAction,250),owner=sanitize(b.owner||'Founder',40),evidence=sanitize(b.evidence,450),due=sanitize(b.dueDate,10);
   const valid=['new','contacted','qualified','proposal_sent','agreed','closed'];
   if(!Number.isSafeInteger(id)||id<=0||!valid.includes(state)||next.length<8||owner.length<2||evidence.length<10)return {error:'Valid status, specific next action, owner and evidence note required.'};
   if(due&&!/^\d{4}-\d{2}-\d{2}$/.test(due))return {error:'Due date must be YYYY-MM-DD.'};
   const item=this.db.prepare('SELECT id,email,site,state FROM mesh_sponsors WHERE id=?').get(id);if(!item)return {error:'Sponsor inquiry not found.'};
   this.db.exec('BEGIN IMMEDIATE');
   try{
     this.db.prepare('UPDATE mesh_sponsors SET state=? WHERE id=?').run(state,id);
     this.db.prepare('INSERT INTO mesh_partner_actions(sponsor_id,state,next_action,due_date,owner,evidence) VALUES(?,?,?,?,?,?)').run(id,state,next,due||null,owner,evidence);
     this.db.exec('COMMIT');
     return {ok:true,id,state,nextAction:next,dueDate:due||null,owner,paymentConfirmed:false,history:this.partnerActions(id)};
   }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 partnerWorkPackets(){
   const rows=this.partnerQueue().filter(r=>!['closed'].includes(r.state));
   return {source:'seekmesh.revenue',schema:'workpacket.v1',workpackets:rows.map(r=>({
     id:'seekmesh-partner-'+r.id,project:'SEEKMESH',type:'partner_followup',status:r.state,
     owner:r.owner||'Revenue Agent',nextAction:r.next_action||'Qualify inquiry and propose scoped offer',dueDate:r.due_date||null,
     target:{inquiryId:r.id,email:r.email,projectUrl:r.site,brief:r.brief,plan:r.plan},
     requires:{send:'connected outbound channel',money:'Stripe checkout separately confirmed'},
     evidence:{lastActionAt:r.last_action_at||null,source:'real sponsor inquiry'},
     paymentsCollected:false
   }))};
 }
 sponsor(b){
  const email=sanitize(b.email,254).toLowerCase(),brief=sanitize(b.brief,700),plan=sanitize(b.plan,30);
  let url;try{url=new URL(sanitize(b.url,500));}catch{return {error:'Valid project URL required.'};}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['http:','https:'].includes(url.protocol)||url.username||url.password||!url.hostname.includes('.')||brief.length<15||!['ecosystem','spotlight','research'].includes(plan))return {error:'Provide email, public URL and a specific project brief.'};
  const id=Number(this.db.prepare('INSERT INTO mesh_sponsors(email,site,brief,plan) VALUES(?,?,?,?)').run(email,url.href,brief,plan).lastInsertRowid);
  return {ok:true,inquiryId:id,paymentCollected:false};
 }
}