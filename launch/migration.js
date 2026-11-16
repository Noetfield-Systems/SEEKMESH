import crypto from 'node:crypto';
import dns from 'node:dns/promises';
// Import drafts are NOT transferable legacy rewards and cannot be publicly featured without project proof.
const clean=(v,n=600)=>String(v??'').trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,n);
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
function csvRows(input){
 const src=String(input??'');if(src.length>13500)throw Error('CSV is too large (13.5k limit).');
 const records=[];let row=[],field='',quoted=false;
 for(let i=0;i<src.length;i++){
  const c=src[i];
  if(quoted){if(c==='"'&&src[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}
  else if(c==='"'){if(field.trim())throw Error('Malformed quoted field.');quoted=true;}
  else if(c===','){row.push(field.trim());field='';}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&src[i+1]==='\n')i++;row.push(field.trim());if(row.some(Boolean))records.push(row);row=[];field='';}
  else field+=c;
 }
 if(quoted)throw Error('Unterminated quoted field.');row.push(field.trim());if(row.some(Boolean))records.push(row);
 if(records.length<2||records.length>26)throw Error('Upload a header and 1–25 quest rows.');
 const header=records.shift().map(x=>x.trim().toLowerCase().replace(/[\s-]+/g,'_'));
 for(const key of ['title','description','action_url'])if(!header.includes(key))throw Error('Required CSV columns: title,description,action_url');
 return records.map((r,i)=>{
  if(r.length!==header.length)throw Error('CSV row '+(i+2)+' has a different column count.');
  const val=(k,n)=>clean(r[header.indexOf(k)],n);
  const title=val('title',100),description=val('description',600),action=val('action_url',400);
  if(title.length<4||description.length<12)throw Error('Quest row '+(i+2)+' needs an explanatory title and description.');
  let u;try{u=new URL(action)}catch{throw Error('Invalid quest action URL on row '+(i+2));}
  if(u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.')||u.hostname.endsWith('.local')||/^(localhost|127\.|10\.|192\.168\.)/.test(u.hostname))throw Error('Quest URLs must be public HTTPS sources.');
  return {title,description,action_url:u.toString()};
 });
}
const validURL=s=>{try{let u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password&&u.hostname.includes('.')?u:null}catch{return null}};
function domain(input){
 const u=validURL(input);if(!u)return null;
 const h=u.hostname.toLowerCase();
 if(h==='galxe.com'||h.endsWith('.galxe.com')||h==='github.com'||h.endsWith('.github.io')||h.endsWith('.railway.app')||h.endsWith('.up.railway.app')||h.endsWith('.local')||/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(h))return null;
 return h;
}
export class CampaignMigration{
 constructor(db,{community}={}){
  this.db=db;this.community=community;
  db.exec([
   "CREATE TABLE IF NOT EXISTS realm_imports(id INTEGER PRIMARY KEY AUTOINCREMENT,member_id INTEGER NOT NULL,project TEXT NOT NULL,origin_url TEXT NOT NULL,owner_domain TEXT NOT NULL,claim_hash TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'draft',created_at TEXT NOT NULL DEFAULT (datetime('now')),verified_at TEXT,UNIQUE(member_id,origin_url))",
   "CREATE TABLE IF NOT EXISTS realm_import_quests(id INTEGER PRIMARY KEY AUTOINCREMENT,import_id INTEGER NOT NULL,ord INTEGER NOT NULL,title TEXT NOT NULL,description TEXT NOT NULL,action_url TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'imported_unverified',UNIQUE(import_id,ord))"
  ].join(';')+';');
  const fields=new Set(db.prepare('PRAGMA table_info(realm_imports)').all().map(x=>x.name));
  if(!fields.has('guild_slug'))db.exec("ALTER TABLE realm_imports ADD COLUMN guild_slug TEXT");
 }
 import(member,b){
  const project=clean(b.project,80),u=validURL(b.campaignUrl),host=domain(b.projectUrl);
  if(!u||!(u.hostname==='galxe.com'||u.hostname.endsWith('.galxe.com'))||project.length<3||!host)return {error:'Provide a public Galxe campaign URL, project name, and separate project-owned HTTPS domain.'};
  let items;try{items=String(b.csv||'').trim()?csvRows(b.csv):[]}catch(e){return {error:e.message};}
  if(this.db.prepare('SELECT 1 FROM realm_imports WHERE member_id=? AND origin_url=?').get(member.id,u.toString()))return {error:'Already imported by this explorer.'};
  const token='seekmesh-claim='+crypto.randomBytes(18).toString('hex');
  this.db.exec('BEGIN IMMEDIATE');
  try{
   const id=Number(this.db.prepare('INSERT INTO realm_imports(member_id,project,origin_url,owner_domain,claim_hash) VALUES(?,?,?,?,?)').run(member.id,project,u.toString(),host,sha(token)).lastInsertRowid);
   const insert=this.db.prepare('INSERT INTO realm_import_quests(import_id,ord,title,description,action_url) VALUES(?,?,?,?,?)');
   items.forEach((x,i)=>insert.run(id,i,x.title,x.description,x.action_url));
   this.db.exec('COMMIT');
   return {ok:true,id,state:'draft',questCount:items.length,ownerVerification:{record:'_seekmesh.'+host,type:'DNS TXT',exactValue:token},migratedBalances:0,migratedClaims:0,public:false,importMode:items.length?'csv_and_link':'campaign_link_only',note:items.length?'Imported publicly described quest rows':'Campaign link saved; add public CSV quest descriptions when available. No fake tasks created.'};
  }catch(e){this.db.exec('ROLLBACK');return {error:'Import could not be saved.'};}
 }
 mine(member){return this.db.prepare('SELECT id,project,origin_url,owner_domain,guild_slug,state,created_at,verified_at,(SELECT COUNT(*) FROM realm_import_quests q WHERE q.import_id=i.id) quests FROM realm_imports i WHERE member_id=? ORDER BY id DESC LIMIT 30').all(member.id);}
 async verify(member,id){
  const r=this.db.prepare('SELECT * FROM realm_imports WHERE id=? AND member_id=?').get(Number(id),member.id);
  if(!r)return {error:'Import does not belong to this account.'};
  if(r.state==='verified')return {ok:true,id:r.id,state:'verified',alreadyVerified:true};
  let values;
  try{values=await Promise.race([dns.resolveTxt('_seekmesh.'+r.owner_domain),new Promise((_,fail)=>setTimeout(()=>fail(Error('timeout')),3500))]);}
  catch{return {error:'Project DNS TXT record not found yet; check propagation.'};}
  if(!values.map(parts=>parts.join('')).some(x=>sha(x.trim())===r.claim_hash))return {error:'Incorrect project-owner DNS challenge.'};
  this.db.prepare("UPDATE realm_imports SET state='verified',verified_at=datetime('now') WHERE id=? AND state='draft'").run(r.id);
  return {ok:true,id:r.id,state:'verified',ownerDomain:r.owner_domain,priorBalancesImported:false};
 }
 addQuests(member,input){
  const id=Number(input.id),row=this.db.prepare('SELECT * FROM realm_imports WHERE id=? AND member_id=?').get(id,member.id);
  if(!row)return {error:'Campaign must belong to the signed-in owner.'};
  const before=this.db.prepare('SELECT COUNT(*) n FROM realm_import_quests WHERE import_id=?').get(id).n;
  if(before>0)return {error:'This campaign already has imported quest descriptions. Create a distinct campaign draft for another export.'};
  let tasks;try{tasks=csvRows(input.csv)}catch(e){return {error:e.message};}
  this.db.exec('BEGIN IMMEDIATE');
  try{
   const ins=this.db.prepare('INSERT INTO realm_import_quests(import_id,ord,title,description,action_url) VALUES(?,?,?,?,?)');
   tasks.forEach((q,i)=>ins.run(id,i,q.title,q.description,q.action_url));
   this.db.exec('COMMIT');
   return {ok:true,id,added:tasks.length,public:row.state==='verified',fundedRewardsTransferred:false};
  }catch(e){this.db.exec('ROLLBACK');return {error:'Could not append quest descriptions.'};}
 }
 linkGuild(member,id){
  const r=this.db.prepare('SELECT * FROM realm_imports WHERE id=? AND member_id=?').get(Number(id),member.id);
  if(!r||r.state!=='verified')return {error:'Verify your project domain before linking a Guild.'};
  if(r.guild_slug)return {ok:true,slug:r.guild_slug,guildUrl:'/guilds?guild='+encodeURIComponent(r.guild_slug),existing:true};
  if(!this.community)return {error:'Guild system unavailable.'};
  let guild=this.db.prepare('SELECT slug,name FROM realm_guilds WHERE founder_id=?').get(member.id);
  if(!guild){
   const result=this.community.create(member,{name:r.project,about:'Owner-verified Guild for '+r.project+' — coordinate original quests, evidence, agent builders and trusted community discovery.',category:'Communities'});
   if(result.error)return {error:result.error};
   guild={slug:result.slug,name:r.project};
  }
  this.db.prepare("UPDATE realm_imports SET guild_slug=? WHERE id=? AND member_id=? AND state='verified' AND guild_slug IS NULL").run(guild.slug,r.id,member.id);
  return {ok:true,slug:guild.slug,guildUrl:'/guilds?guild='+encodeURIComponent(guild.slug),project:r.project,verifiedProjectDomain:r.owner_domain,membershipClaimed:false};
 }
 public(){return this.db.prepare("SELECT i.id,i.project,i.origin_url,i.owner_domain,i.guild_slug,i.verified_at,COUNT(q.id) quests FROM realm_imports i LEFT JOIN realm_import_quests q ON q.import_id=i.id WHERE i.state='verified' GROUP BY i.id ORDER BY i.verified_at DESC LIMIT 80").all();}
 detail(id){
  const r=this.db.prepare("SELECT id,project,origin_url,owner_domain,guild_slug,verified_at FROM realm_imports WHERE id=? AND state='verified'").get(Number(id));
  return r?{...r,quests:this.db.prepare('SELECT id,title,description,action_url,state FROM realm_import_quests WHERE import_id=? ORDER BY ord').all(r.id),note:'Historical descriptions only; no rewards, user identities, claims or funds transferred.'}:null;
 }
}
