import crypto from 'node:crypto';

// Off-chain Genesis Drops. They are not transferable, claimable SEEK or money.
const rules={'founding-node':[3,'Activate explorer'],'orientation':[5,'Source-quality primer'],'daily-discovery':[1,'Daily pulse'],'approved-resource':[12,'Accepted source'],'qualified-referral':[8,'Qualified referral']};
const start='2026-11-15',end='2026-12-16';
export class GenesisSeason {
 constructor(db,mesh){
  this.db=db;this.mesh=mesh;
  if(!db.prepare("PRAGMA table_info(mesh_members)").all().some(x=>x.name==='is_synthetic'))db.exec("ALTER TABLE mesh_members ADD COLUMN is_synthetic INTEGER NOT NULL DEFAULT 0");
  db.exec("CREATE TABLE IF NOT EXISTS genesis_drops(id INTEGER PRIMARY KEY AUTOINCREMENT,member_id INTEGER NOT NULL,ledger_id INTEGER NOT NULL UNIQUE,amount INTEGER NOT NULL CHECK(amount>0),reason TEXT NOT NULL,origin_at TEXT NOT NULL,credited_at TEXT NOT NULL DEFAULT (datetime('now')))");
  db.exec("CREATE INDEX IF NOT EXISTS genesis_drop_member ON genesis_drops(member_id,credited_at)");
  db.exec("CREATE TABLE IF NOT EXISTS genesis_sim_runs(id INTEGER PRIMARY KEY AUTOINCREMENT,scenario TEXT NOT NULL,agents INTEGER NOT NULL,steps INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT (datetime('now')),label TEXT NOT NULL DEFAULT 'SYNTHETIC_TEST_ONLY')");
  db.exec("CREATE TABLE IF NOT EXISTS genesis_sim_events(id INTEGER PRIMARY KEY AUTOINCREMENT,run_id INTEGER NOT NULL,member_id INTEGER NOT NULL,step TEXT NOT NULL,result TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')))");
  this.reconcile();
 }
 reconcile(){
  for(const [reason,[amount]] of Object.entries(rules))this.db.prepare("INSERT OR IGNORE INTO genesis_drops(member_id,ledger_id,amount,reason,origin_at) SELECT l.member_id,l.id,?,l.reason,l.created_at FROM mesh_ledger l JOIN mesh_members m ON m.id=l.member_id WHERE l.reason=? AND l.created_at>=? AND l.created_at<?").run(amount,reason,start,end);
 }
 member(memberId){
  const m=this.db.prepare("SELECT id,handle,referral_code,is_synthetic FROM mesh_members WHERE id=?").get(Number(memberId));
  if(!m||m.is_synthetic)return null;
  this.reconcile();
  const score=this.db.prepare("SELECT COALESCE(SUM(amount),0) total,COUNT(*) actions FROM genesis_drops WHERE member_id=?").get(m.id);
  const registered=this.db.prepare("SELECT COUNT(*) n FROM mesh_members WHERE referred_by=? AND is_synthetic=0").get(m.id).n;
  const qualified=this.db.prepare("SELECT COUNT(*) n FROM mesh_ledger l JOIN mesh_members m ON m.id=l.member_id WHERE l.reason='qualified-referral' AND m.id=? AND l.created_at>=? AND l.created_at<?").get(m.id,start,end).n;
  return {handle:m.handle,drops:score.total,actions:score.actions,inviteCode:m.referral_code,inviteUrl:'/?invite='+m.referral_code,
   referrals:{registered,qualified},history:this.db.prepare("SELECT amount,reason,origin_at,credited_at FROM genesis_drops WHERE member_id=? ORDER BY id DESC LIMIT 30").all(m.id),
   persisted:true,synthetic:false,tokenClaimable:false};
 }
 board(scope='real',limit=30){
  this.reconcile();
  const synthetic=scope==='simulation'?1:0;
  const rows=this.db.prepare("SELECT m.handle,m.role,COALESCE(SUM(d.amount),0) drops,COALESCE((SELECT SUM(xp) FROM mesh_ledger x WHERE x.member_id=m.id),0) xp,COUNT(d.id) actions FROM mesh_members m LEFT JOIN genesis_drops d ON d.member_id=m.id WHERE m.is_synthetic=? GROUP BY m.id ORDER BY drops DESC,xp DESC,m.id ASC LIMIT ?").all(synthetic,Math.max(1,Math.min(50,Number(limit)||30)));
  return {scope:synthetic?'simulation':'real',label:synthetic?'SIMULATED QA PERSONAS / NOT REAL USERS':'REAL EXPLORERS / LEDGER RECORDS',members:rows,notFinancialAsset:true};
 }
 public(){
  this.reconcile();
  const realMembers=this.db.prepare('SELECT COUNT(*) n FROM mesh_members WHERE is_synthetic=0').get().n;
  const minted=this.db.prepare('SELECT COALESCE(SUM(d.amount),0) n FROM genesis_drops d JOIN mesh_members m ON m.id=d.member_id WHERE m.is_synthetic=0').get().n;
  const referrals=this.db.prepare("SELECT COUNT(*) n FROM mesh_ledger l JOIN mesh_members m ON m.id=l.member_id WHERE m.is_synthetic=0 AND l.reason='qualified-referral' AND l.created_at>=? AND l.created_at<?").get(start,end).n;
  return {schema:'seekmesh.genesis.v1',season:'Season Zero',starts:start,ends:'2026-12-15',status:new Date().toISOString().slice(0,10)<end?'live':'closed',
   currency:'GENESIS_DROPS_IN_APP',realMembers,realDropsCredited:minted,qualifiedReferrals:referrals,
   rewards:Object.entries(rules).map(([event,[drops,label]])=>({event,drops,label})),
   tokenIssued:false,tokenClaimable:false,guaranteedFutureAirdrop:false,withdrawable:false,transferable:false,
   referralRule:'An inviter earns 8 internal Drops only after a real invitee makes a first accepted source contribution.',
   note:'Credited automatically to saved in-app accounts. No SEEK token has been issued. Drops are not money or a guaranteed future token allocation.'};
 }
 dashboard(){
  return {real:this.public(),realActions:this.db.prepare("SELECT l.reason,COUNT(*) n FROM mesh_ledger l JOIN mesh_members m ON m.id=l.member_id WHERE m.is_synthetic=0 AND l.created_at>=? AND l.created_at<? GROUP BY l.reason").all(start,end),
   synthetic:{accounts:this.db.prepare('SELECT COUNT(*) n FROM mesh_members WHERE is_synthetic=1').get().n,
     runs:this.db.prepare('SELECT * FROM genesis_sim_runs ORDER BY id DESC LIMIT 15').all(),
     events:this.db.prepare('SELECT e.run_id,m.handle,e.step,e.result,e.created_at FROM genesis_sim_events e JOIN mesh_members m ON m.id=e.member_id ORDER BY e.id DESC LIMIT 70').all(),
     leaderboard:this.board('simulation').members},
   syntheticExcludedFromPublicMetrics:true,independentLLMWorkers:0,workerMode:'SCRIPTED_AI_CUSTOMER_PERSONAS_NOT_REAL_USERS'};
 }
 simulate(count=12){
  const n=Math.max(1,Math.min(16,Number(count)||12)),existing=this.db.prepare('SELECT COUNT(*) n FROM mesh_members WHERE is_synthetic=1').get().n;
  if(existing+n>300)return {error:'Synthetic QA account capacity reached (300).'};
  const personas=['Explorer','Builder','Curator','Agent Developer','Community','Partner'];
  const run=Number(this.db.prepare("INSERT INTO genesis_sim_runs(scenario,agents) VALUES('season_zero_persona_qa',?)").run(n).lastInsertRowid);
  const members=[];let steps=0;
  const log=(id,step,result)=>{this.db.prepare('INSERT INTO genesis_sim_events(run_id,member_id,step,result) VALUES(?,?,?,?)').run(run,id,step,result);steps++;};
  for(let i=0;i<n;i++){
   const id=Number(this.db.prepare('INSERT INTO mesh_members(handle,password_hash,salt,role,referral_code,referred_by,is_synthetic) VALUES(?,?,?,?,?,?,1)').run('SIM'+run+'_'+String(i).padStart(2,'0'),crypto.randomBytes(64).toString('hex'),crypto.randomBytes(16).toString('hex'),personas[i%personas.length],crypto.randomBytes(7).toString('hex').toUpperCase(),i>1&&i%3===0?members[0]:null).lastInsertRowid);
   members.push(id);log(id,'register','SYNTHETIC isolated account; no real session issued');
   this.mesh.grant(id,25,5,'founding-node','join:'+id);log(id,'signup_credit','Saved test ledger');
   if(i%4!==0){this.mesh.orientation(id,'source-linked');log(id,'primer','Simulated correct source evidence answer');}
   if(i%5!==0){this.mesh.checkin(id);log(id,'daily','Simulated daily login and completion');}
   if(i%2===0){
    this.mesh.grant(id,40,20,'approved-resource','sandbox-accepted:'+run+':'+i);
    log(id,'sample_review','SYNTHETIC SOURCE QA ONLY: no actual submission or public source indexed');
    const ref=i>1&&i%3===0?members[0]:null;
    if(ref){this.mesh.grant(ref,15,5,'qualified-referral','referral:'+id);log(ref,'sample_qualified_referral','SYNTHETIC-only reward, excluded from public totals');}
   }else log(id,'sample_review','Simulated pending approval / dropout');
   log(id,'resume_session','Saved account checkpoint; cannot authenticate into real customer product');
  }
  this.db.prepare('UPDATE genesis_sim_runs SET steps=? WHERE id=?').run(steps,run);this.reconcile();
  return {ok:true,runId:run,personas:n,steps,synthetic:true,realUsersAdded:0,realSubmissionsAdded:0,realPayments:0,board:this.board('simulation',20).members};
 }
 seedOnce(){
  return this.db.prepare('SELECT 1 FROM genesis_sim_runs LIMIT 1').get()?{created:false,reason:'existing_synthetic_cohort'}:this.simulate(12);
 }
}
