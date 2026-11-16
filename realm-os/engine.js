/**
 * SEEKMESH Realm OS v1 — embedded coordinator for an independent Web3 discovery realm.
 * Executes bounded deterministic work using the same SQLite volume as the existing autonomy,
 * community and economy engines. Logical agents are departments, not new physical processes.
 * No wallet custody, token minting, fiat billing, fake users or automatic financial claims.
 */
import crypto from 'node:crypto';

const NODES=[
 ['atlas','Discovery Scout','Discovery','source coverage, freshness and origin links'],
 ['proof','Evidence Keeper','Verification','review receipts and source integrity'],
 ['guild','Guild Steward','Community','guild signals, moderation and collective work'],
 ['quest','Quest Architect','Missions','valuable, verified Season missions'],
 ['growth','Growth Navigator','Growth','activation and genuine source-click engagement'],
 ['market','Marketplace Operator','Economy','qualified crypto-native project partnerships'],
 ['chain','Chain Sentinel','Web3','wallet proofs, settlement truth and funding readiness'],
 ['quality','Release Sentinel','Quality','production reliability and failed workload recovery'],
 ['compute','Worker Optimizer','Runtime','bounded crawling costs, retries and physical worker usage'],
 ['strategy','Realm Governor','Founder','goals, priorities and independent release proof']
];
const TARGETS=[
 ['discovery','Verified discoveries', 'accepted_sources',15,'proof',1],
 ['discovery','Fresh source checks','source_audits',30,'atlas',1],
 ['community','Builder guilds','guilds',3,'guild',2],
 ['community','Guild contributors','guild_members',20,'guild',2],
 ['community','Useful guild signals','guild_signals',15,'guild',2],
 ['distribution','Real member nodes','members',50,'growth',3],
 ['distribution','Source link interactions (7d)','source_clicks_7d',100,'growth',3],
 ['distribution','Qualified project inquiries','inquiries',3,'market',3],
 ['commerce','Verified funded missions','settled_campaigns',1,'chain',4],
 ['commerce','Paid agent API receipts','verified_x402_payments',1,'chain',4],
 ['scale','Approved community sources','accepted_sources',100,'proof',5]
];
const PHASES=[
 {id:'foundation',name:'Genesis — the Living Realm',objective:'functional realm and autonomous index',stage:0},
 {id:'discovery',name:'Proof of Useful Discovery',objective:'quality sources and recrawl receipts',stage:1},
 {id:'community',name:'Guilds and Repeated Contribution',objective:'active guilds, verified members and useful work',stage:2},
 {id:'distribution',name:'Authentic Growth and Native Demand',objective:'genuine participation and funding inquiries',stage:3},
 {id:'commerce',name:'Crypto-native Settlement',objective:'funded USDC mission and x402 transaction receipts',stage:4},
 {id:'scale',name:'Durable Discovery Network',objective:'large, accurate and economically sustainable graph',stage:5}
];
const s=(x,max=280)=>String(x??'').trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max);
const date=()=>new Date().toISOString().slice(0,10);
const week=()=>{const n=new Date();n.setUTCHours(0,0,0,0);n.setUTCDate(n.getUTCDate()-((n.getUTCDay()+6)%7));return n.toISOString().slice(0,10)};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||a));
const safeJSON=v=>JSON.stringify(v??{});
const num=(row)=>Number(row?.n||0);

export class RealmOS{
 constructor(db,{autonomy,community,mesh}={}){
  this.db=db;this.autonomy=autonomy;this.community=community;this.mesh=mesh;
  this.interval=clamp(process.env.REALM_OS_TICK_MS||300000,30000,3600000);
  this.enabled=process.env.REALM_OS_ENABLED!=='false';
  this.timer=null;this.inside=false;
  this.bootstrap();
 }
 bootstrap(){
  this.db.exec("CREATE TABLE IF NOT EXISTS realm_os_state (id INTEGER PRIMARY KEY CHECK(id=1),paused INTEGER NOT NULL DEFAULT 0,last_pulse TEXT,executions INTEGER NOT NULL DEFAULT 0,last_failure TEXT)");
  this.db.exec("INSERT OR IGNORE INTO realm_os_state(id) VALUES(1)");
  this.db.exec("CREATE TABLE IF NOT EXISTS realm_os_agents (agent_id TEXT PRIMARY KEY,display_name TEXT NOT NULL,department TEXT NOT NULL,mission TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT (datetime('now')))");
  this.db.exec("CREATE TABLE IF NOT EXISTS realm_os_goals (goal_id TEXT PRIMARY KEY,title TEXT NOT NULL,metric TEXT NOT NULL,target INTEGER NOT NULL,owner_agent TEXT NOT NULL,phase INTEGER NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL DEFAULT (datetime('now')))");
  this.db.exec("CREATE TABLE IF NOT EXISTS realm_os_packets (id INTEGER PRIMARY KEY AUTOINCREMENT,unique_key TEXT NOT NULL UNIQUE,kind TEXT NOT NULL,agent_id TEXT NOT NULL,goal_id TEXT,priority INTEGER NOT NULL DEFAULT 50,status TEXT NOT NULL DEFAULT 'open',task TEXT NOT NULL,acceptance TEXT NOT NULL,evidence TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL DEFAULT (datetime('now')),updated_at TEXT NOT NULL DEFAULT (datetime('now')),completed_at TEXT)");
  this.db.exec("CREATE INDEX IF NOT EXISTS realm_os_packets_status ON realm_os_packets(status,priority,created_at)");
  this.db.exec("CREATE TABLE IF NOT EXISTS realm_os_receipts (id INTEGER PRIMARY KEY AUTOINCREMENT,packet_id INTEGER,agent_id TEXT NOT NULL,kind TEXT NOT NULL,details TEXT NOT NULL,verification TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')))");
  this.db.exec("CREATE TABLE IF NOT EXISTS realm_os_expeditions (id INTEGER PRIMARY KEY AUTOINCREMENT,unique_key TEXT NOT NULL UNIQUE,category TEXT NOT NULL,target INTEGER NOT NULL DEFAULT 3,starts_at TEXT NOT NULL DEFAULT (datetime('now')),ends_at TEXT NOT NULL,created_by TEXT NOT NULL DEFAULT 'quest',state TEXT NOT NULL DEFAULT 'active')");
  for(const [id,name,department,mission] of NODES)this.db.prepare('INSERT OR IGNORE INTO realm_os_agents(agent_id,display_name,department,mission) VALUES(?,?,?,?)').run(id,name,department,mission);
  for(const [id,name,metric,target,owner,phase] of TARGETS)this.db.prepare('INSERT OR IGNORE INTO realm_os_goals(goal_id,title,metric,target,owner_agent,phase) VALUES(?,?,?,?,?,?)').run(id+':'+metric,name,metric,target,owner,phase);
 }
 paused(){return !!this.db.prepare('SELECT paused FROM realm_os_state WHERE id=1').get()?.paused}
 audit(agent,kind,details,verification='observed',packetId=null){
  this.db.prepare('INSERT INTO realm_os_receipts(packet_id,agent_id,kind,details,verification) VALUES(?,?,?,?,?)').run(packetId,s(agent,32),s(kind,80),safeJSON(details),s(verification,40));
  this.db.prepare('DELETE FROM realm_os_receipts WHERE id<(SELECT COALESCE(MAX(id)-1500,0) FROM realm_os_receipts)').run();
 }
 count(sql,...args){return num(this.db.prepare(sql).get(...args))}
 countOptional(sql){try{return this.count(sql)}catch(e){if(String(e.message).includes('no such table:'))return 0;throw e}}
 measures(){
  const a=this.autonomy?.status()||{};
  const report=this.community?.launchReport()||{};
  return {
   resources:this.count('SELECT COUNT(*) n FROM resources'),
   accepted_sources:this.count("SELECT COUNT(*) n FROM submissions WHERE state='approved'"),
   pending_sources:this.count("SELECT COUNT(*) n FROM submissions WHERE state='pending'"),
   source_audits:this.count("SELECT COUNT(*) n FROM autonomy_audits WHERE status='healthy'"),
   failed_jobs:this.count("SELECT COUNT(*) n FROM autonomy_jobs WHERE status='failed'"),
   review_candidates:this.count("SELECT COUNT(*) n FROM autonomy_candidates WHERE state='ready'"),
   guilds:this.count('SELECT COUNT(*) n FROM realm_guilds'),
   guild_members:this.count('SELECT COUNT(*) n FROM realm_guild_members'),
   guild_signals:this.count("SELECT COUNT(*) n FROM realm_guild_posts WHERE status='visible'"),
   flagged_signals:this.count("SELECT COUNT(*) n FROM realm_guild_reports"),
   members:this.count('SELECT COUNT(*) n FROM mesh_members'),
   linked_wallets:this.count('SELECT COUNT(*) n FROM mesh_wallet_links'),
   inquiries:this.count('SELECT COUNT(*) n FROM mesh_sponsors'),
   source_clicks_7d:this.count("SELECT COALESCE(SUM(count),0) n FROM realm_event_counts WHERE event='source_click' AND day>=date('now','-6 days')"),
   settled_campaigns:this.countOptional("SELECT COUNT(DISTINCT campaign_ref) n FROM native_campaign_payouts"),
   verified_x402_payments:this.countOptional("SELECT COUNT(*) n FROM native_x402_receipts"),
   imported_campaigns:this.countOptional("SELECT COUNT(*) n FROM realm_imports WHERE state='verified'"),
   atlas_entries:this.countOptional("SELECT COUNT(*) n FROM atlas_agents"),
   atlas_observed_endpoints:this.countOptional("SELECT COUNT(*) n FROM atlas_agents WHERE endpoint_proof='http_responded'"),
   mcp_tool_calls_7d:this.countOptional("SELECT COALESCE(SUM(n),0) n FROM realm_mcp_tool_calls WHERE day>=date('now','-6 days')"),
   workers_online:a.connectedWorkers24h||0,
   physical_executors:a.activeExecutors||0,
   logical_shards:a.logicalWorkerShards||0,
   crawler_requests_today:a.budget?.requestsUsed||0,
   crawler_daily_limit:a.budget?.requestsMax||0,
   scheduler_running:!!a.schedulerRunning,
   crawler_paused:!!a.paused,
   cron_last_tick:a.lastTick||null,
   crawler_errors:a.consecutiveErrors||0,
   telemetry_basis:'observed SQLite counts. No verified crypto settlements or unique-user analytics.'
  };
 }
 goals(){
  const m=this.measures();
  return this.db.prepare('SELECT * FROM realm_os_goals WHERE enabled=1 ORDER BY phase,goal_id').all().map(x=>{
   const actual=Number(m[x.metric]||0),target=Number(x.target);
   return {...x,actual,progress:Math.min(100,Math.round(actual/Math.max(1,target)*100)),reached:actual>=target,evidenceType:x.metric==='settled_campaigns'||x.metric==='verified_x402_payments'?'not_instrumented_no_contract':'database_observation'};
  });
 }
 phases(){
  const goals=this.goals();
  return PHASES.map(p=>{
   if(p.stage===0)return {...p,status:this.enabled?'operating':'disabled',progress:this.enabled?100:0,condition:'Persistent Web3 Realm OS and autonomy infrastructure present; does not imply token or settlement.'};
   const children=goals.filter(x=>x.phase===p.stage);
   const progress=children.length?Math.round(children.reduce((x,y)=>x+y.progress,0)/children.length):0;
   return {...p,status:children.length&&children.every(g=>g.reached)?'measured':'in_progress',progress,goals:children.map(g=>g.goal_id)};
  });
 }
 agents(){
  const m=this.measures();
  return this.db.prepare('SELECT * FROM realm_os_agents ORDER BY rowid').all().map(a=>{
   const queue=this.count("SELECT COUNT(*) n FROM realm_os_packets WHERE agent_id=? AND status='open'",a.agent_id);
   return {...a,queuedPackets:queue,state:a.enabled?(this.enabled&&!this.paused()?'scheduled':'paused'):'disabled',physicalProcess:false,executionNotes:a.agent_id==='atlas'?('Using autonomy engine, '+m.physical_executors+' physical active executors'):'Deterministic coordinator; not a separately deployed LLM'};
  });
 }
 expedition(){
  const rows=this.db.prepare("SELECT * FROM realm_os_expeditions WHERE state='active' ORDER BY id DESC LIMIT 4").all();
  return rows.map(e=>{
   const approved=this.count("SELECT COUNT(*) n FROM submissions WHERE state='approved' AND category=? AND reviewed_at>=? AND reviewed_at<=?",e.category,e.starts_at,e.ends_at);
   const pending=this.count("SELECT COUNT(*) n FROM submissions WHERE state='pending' AND category=? AND created_at>=?",e.category,e.starts_at);
   return {...e,accepted:approved,pending,progress:Math.min(100,Math.round(100*approved/Math.max(1,e.target))),reward:'Existing approved-source XP and MESH Credits only; no additional token emission.'};
  });
 }
 schedule(kind,agent,task,acceptance,{key,priority=50,goal=null,evidence={}}={}){
  const idKey=s(key||kind+':'+date(),160);
  const result=this.db.prepare('INSERT OR IGNORE INTO realm_os_packets(unique_key,kind,agent_id,goal_id,priority,task,acceptance,evidence) VALUES(?,?,?,?,?,?,?,?)').run(idKey,s(kind,64),s(agent,32),goal,clamp(priority,1,100),s(task,650),s(acceptance,650),safeJSON(evidence));
  if(result.changes)this.audit(agent,'packet.created',{key:idKey,kind,task},'scheduled',Number(result.lastInsertRowid));
  return {inserted:!!result.changes,id:Number(result.lastInsertRowid)};
 }
 close(packetId,evidence,verification='automated_observation'){
  this.db.prepare("UPDATE realm_os_packets SET status='observed',evidence=?,updated_at=datetime('now'),completed_at=datetime('now') WHERE id=? AND status IN ('open','running')").run(safeJSON(evidence),packetId);
  const row=this.db.prepare('SELECT * FROM realm_os_packets WHERE id=?').get(packetId);
  if(row?.status==='observed')this.audit(row.agent_id,'packet.observed',{kind:row.kind,...evidence},verification,packetId);
  return row;
 }
 autoCurate(){
  if(process.env.REALM_OS_AUTO_CURATE==='false')return {checked:0,published:0,reason:'disabled'};
  if(!this.autonomy?.approveCandidate)return {checked:0,published:0,reason:'unavailable'};
  const today=date(),used=this.count("SELECT COUNT(*) n FROM resources WHERE source='autonomous-reviewed' AND date(approved_at)=?",today);
  const remaining=Math.max(0,3-used);
  if(!remaining)return {checked:0,published:0,reason:'daily_cap'};
  const list=this.db.prepare("SELECT c.* FROM autonomy_candidates c JOIN autonomy_sources src ON src.id=c.source_id WHERE c.state='ready' AND c.http_status=200 AND c.score>=90 AND c.origin='autonomous' AND src.kind='github' AND src.enabled=1 ORDER BY c.score DESC,c.id DESC LIMIT 30").all();
  let checked=0,published=0;
  for(const c of list){
   if(published>=remaining)break;checked++;
   let u,e;try{u=new URL(c.url);e=JSON.parse(c.evidence||'{}')}catch{continue}
   if(u.protocol!=='https:'||u.hostname!=='github.com'||!/^\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/?$/.test(u.pathname)||u.search||u.hash)continue;
   if((c.name||'').length<5||(c.description||'').length<40)continue;
   const d=e.discovered||{},v=e.verification||{};
   if(d.provenance!=='github-public-api'||Number(d.stars)<50||v.httpStatus!==200||v.noindex!==false||v.robotsAllowed!==true||Number(v.score)<90)continue;
   const last=Date.parse(d.updatedAt||''),verified=Date.parse(v.checkedAt||'');
   if(!Number.isFinite(last)||last>Date.now()+86400000||Date.now()-last>180*86400000)continue;
   if(!Number.isFinite(verified)||verified>Date.now()+300000||Date.now()-verified>48*3600000)continue;
   if(this.db.prepare('SELECT 1 FROM resources WHERE url=?').get(c.url))continue;
   let approved;try{approved=this.autonomy.approveCandidate(c.id,'approve','realm-os:trusted-source-policy')}catch{continue}
   if(!approved?.ok)continue;
   this.db.prepare("UPDATE resources SET source='autonomous-reviewed' WHERE url=? AND source='autonomous-approved'").run(c.url);
   this.audit('proof','source.auto_indexed',{candidateId:c.id,url:c.url,score:c.score,stars:d.stars,verifiedAt:v.checkedAt},'github_api_and_http_only_not_security_audit');
   published++;
  }
  return {checked,published,policy:'github_only_recent_score90_stars50_http200_cap3',securityAudited:false};
 }
 chooseCategory(){
  const rows=this.db.prepare('SELECT category,COUNT(*) n FROM resources GROUP BY category').all();
  const map=new Map(rows.map(x=>[x.category,x.n]));
  const choices=['Agent Infrastructure','AI & Models','Protocols','Communities','Builders','Search & Data'];
  return choices.sort((a,b)=>(map.get(a)||0)-(map.get(b)||0)||a.localeCompare(b))[0];
 }
 pulse({force=false}={}){
  if(!this.enabled||this.paused())return {ok:true,executed:false,reason:'paused_or_disabled'};
  if(this.inside)return {ok:true,executed:false,reason:'already_running'};
  const before=this.db.prepare('SELECT last_pulse FROM realm_os_state WHERE id=1').get()?.last_pulse;
  if(!force&&before&&Date.now()-Date.parse(before.replace(' ','T')+'Z')<Math.min(120000,this.interval-1000))return {ok:true,executed:false,reason:'recent_pulse'};
  this.inside=true;
  try{
   const autoCurated=this.autoCurate();
   const m=this.measures();
   const out={packetsCreated:0,expeditionsCreated:0,autoIndexedSources:autoCurated.published,reviewCandidates:m.review_candidates,memberReviews:m.pending_sources,autonomyPhysicalExecutors:m.physical_executors};
   const enqueue=(kind,agent,task,accept,priority,goal,ev)=>{
    const r=this.schedule(kind,agent,task,accept,{key:kind+':'+date(),priority,goal,evidence:ev});
    if(r.inserted)out.packetsCreated++;return r;
   };
   const wk=week(),eKey='week:'+wk;
   if(!this.db.prepare('SELECT 1 FROM realm_os_expeditions WHERE unique_key=?').get(eKey)){
    const category=this.chooseCategory();
    const result=this.db.prepare("INSERT OR IGNORE INTO realm_os_expeditions(unique_key,category,target,ends_at) VALUES(?,?,3,datetime('now','+7 days'))").run(eKey,category);
    if(result.changes){
     out.expeditionsCreated++;
     const p=this.schedule('publish_expedition','quest','Publish a 7-day discovery focus on '+category,'Public expedition uses real reviewed sources and existing XP; no token claims.',{key:'expedition:'+eKey,priority:70,goal:'discovery:accepted_sources',evidence:{category}});
     if(p.inserted)this.close(p.id,{category,expeditionId:Number(result.lastInsertRowid),publiclyVisible:true},'sqlite_record');
    }
   }
   if(m.review_candidates>0)enqueue('review_discoveries','proof','Evaluate '+m.review_candidates+' autonomous candidates against source evidence','Publish only reviewed/corroborated sources; original links remain visible.',75,'discovery:accepted_sources',{queue:m.review_candidates});
   if(m.pending_sources>0)enqueue('review_member_sources','proof','Inspect '+m.pending_sources+' community submissions and their source links','Accept or reject with review receipt; only approved original contribution earns credits.',78,'discovery:accepted_sources',{queue:m.pending_sources});
   if(m.flagged_signals>0)enqueue('moderate_guild_signals','guild','Review reports on guild signals','Evidence-backed moderation outcome, no automatic arbitrary bans.',70,'community:guild_signals',{reports:m.flagged_signals});
   if(m.failed_jobs>0||m.crawler_errors>0)enqueue('recover_discovery','quality','Diagnose '+m.failed_jobs+' failed source jobs and '+m.crawler_errors+' runtime errors','Retry only bounded eligible jobs, preserve crawl policy and error receipts.',90,'discovery:source_audits',{failed:m.failed_jobs,errors:m.crawler_errors});
   enqueue('sync_atlas_mcp','atlas','Synchronize verified metadata from the official MCP Registry','Persist source provenance, do not invent reliability or trading metrics.',43,null,{source:'official_registry'});
   if(m.atlas_entries>0)enqueue('probe_atlas_endpoints','quality','Perform robots-aware bounded HTTP checks of declared MCP endpoints','At most five endpoint probes daily, HTTP/latency measured, no security endorsement.',44,null,{eligible:m.atlas_entries});
   enqueue('daily_realm_report','strategy','Build today\'s auditable discovery and participation intelligence snapshot','Create database-backed aggregate artifact and hash receipt.',39,null,{date:date()});
   enqueue('publish_guild_expansion','guild','Report verified campaign imports and guild recruitment opportunities','Produce auditable import+guild report without fake migration rewards.',38,null,{date:date()});
   if(m.failed_jobs>0)enqueue('repair_discovery_runtime','quality','Trigger bounded autonomy recheck after observed failures','Only the existing budgeted crawler may be ticked.',88,null,{failures:m.failed_jobs});
   if(m.inquiries>0)enqueue('qualify_partner_requests','market','Qualify '+m.inquiries+' opt-in Web3 discovery partnership requests','Record real wallet-funded mission scope and next action; no payment claim without chain receipt.',70,'distribution:inquiries',{inquiries:m.inquiries});
   if(m.source_clicks_7d<100)enqueue('improve_discovery_activation','growth','Improve source usefulness and activation from real seven-day data','Measure real search-to-source clicks and qualified contributor actions, not vanity followers.',40,'distribution:source_clicks_7d',{clicks:m.source_clicks_7d});
   if(m.settled_campaigns===0)enqueue('build_stablecoin_mission','chain','Implement a reproducible sponsor-funded stablecoin mission test','Testnet funded escrow, single payout, refund and tx receipt; never claim mainnet settlement before verified.',65,'commerce:settled_campaigns',{status:'not_deployed'});
   if(m.verified_x402_payments===0)enqueue('enable_paid_agent_queries','chain','Implement x402 paid source evidence API','402 challenge, settled payment proof, replay-safe fulfilled request and response receipt.',58,'commerce:verified_x402_payments',{status:'not_deployed'});
   if(m.crawler_daily_limit>0&&m.crawler_requests_today/m.crawler_daily_limit>0.8)enqueue('protect_budget','compute','Audit crawler spend nearing daily request cap','Safe bounded backoff without breaking discovery search and existing jobs.',86,null,{used:m.crawler_requests_today,limit:m.crawler_daily_limit});
   this.db.prepare("UPDATE realm_os_state SET last_pulse=datetime('now'),executions=executions+1,last_failure=NULL WHERE id=1").run();
   this.audit('strategy','os.pulse',{...out,metrics:{resources:m.resources,agents:NODES.length,paidTransactionsVerified:0}},'observed_database');
   this.db.prepare("DELETE FROM realm_os_packets WHERE id<(SELECT COALESCE(MAX(id)-1200,0) FROM realm_os_packets) AND status='observed'").run();
   return {ok:true,executed:true,...out};
  }catch(e){
   this.db.prepare('UPDATE realm_os_state SET last_failure=? WHERE id=1').run(s(e.message,200));
   this.audit('quality','os.failed',{error:s(e.message,180)},'error');
   return {ok:false,executed:false,error:'Realm OS pulse failed'};
  }finally{this.inside=false;}
 }
 status(){
  const m=this.measures();
  const pulse=this.db.prepare('SELECT * FROM realm_os_state WHERE id=1').get();
  const packets=this.db.prepare('SELECT status,COUNT(*) n FROM realm_os_packets GROUP BY status').all();
  return {
   schema:'seekmesh.realm_os.v1',project:'SEEKMESH',independentWeb3:true,
   enabled:this.enabled,paused:!!pulse.paused,schedulerRunning:!!this.timer,
   logicalAgentRoles:NODES.length,physicalOSAgents:0,physicalDiscoveryExecutors:m.physical_executors,
   logicalShardsAreProcesses:false,liveWeb3SettlementsVerified:m.settled_campaigns+m.verified_x402_payments,tokenIssued:false,usdcEscrowLive:m.settled_campaigns>0&&this.nativeMissions?.config()?.chainId===8453,x402PaymentsLive:m.verified_x402_payments>0,execution:this.executor?.metrics()||{executed:0,queued:0},
   lastPulse:pulse.last_pulse,lastFailure:pulse.last_failure,completedPulses:pulse.executions,
   queues:Object.fromEntries(packets.map(x=>[x.status,x.n])),goals:this.goals(),phases:this.phases(),
   expeditions:this.expedition(),metrics:m
  };
 }
 signals(){
  return this.db.prepare("SELECT id,url,name,description,category,score,last_seen_at FROM autonomy_candidates WHERE state='ready' AND http_status=200 AND score>=50 ORDER BY score DESC,last_seen_at DESC LIMIT 12").all().map(x=>({...x,state:'candidate_not_independently_verified',credited:false}));
 }
 public(){const x=this.status();return {schema:x.schema,project:x.project,independentWeb3:true,enabled:x.enabled,paused:x.paused,schedulerRunning:x.schedulerRunning,logicalAgentRoles:x.logicalAgentRoles,physicalOSAgents:0,physicalDiscoveryExecutors:x.physicalDiscoveryExecutors,tokenIssued:false,usdcEscrowLive:x.usdcEscrowLive,x402PaymentsLive:x.x402PaymentsLive,execution:x.execution,lastPulse:x.lastPulse,goals:x.goals,phases:x.phases,expeditions:x.expeditions,metrics:x.metrics,signals:this.signals(),roles:this.agents().map(a=>({name:a.display_name,department:a.department,mission:a.mission,state:a.state,logicalRole:true}))};}
 admin(){
  return {status:this.status(),agents:this.agents(),packets:this.db.prepare("SELECT * FROM realm_os_packets ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END,priority DESC,id DESC LIMIT 100").all(),receipts:this.db.prepare('SELECT * FROM realm_os_receipts ORDER BY id DESC LIMIT 100').all(),expeditions:this.expedition(),execution:this.executor?.metrics()||null};
 }
 control(data){
  const act=s(data.action,32);
  if(act==='pause'||act==='resume'){
   this.db.prepare('UPDATE realm_os_state SET paused=? WHERE id=1').run(act==='pause'?1:0);
   this.audit('strategy','os.control',{action:act},'operator_control');
   return {ok:true,paused:this.paused()};
  }
  if(act==='pulse')return this.pulse({force:true});
  if(act==='goal'){
   const id=s(data.goalId,80),target=Number(data.target);
   const old=this.db.prepare('SELECT goal_id FROM realm_os_goals WHERE goal_id=?').get(id);
   if(!old||!Number.isSafeInteger(target)||target<1||target>1000000)return {error:'Choose an existing goal and positive target of at most one million.'};
   this.db.prepare("UPDATE realm_os_goals SET target=?,updated_at=datetime('now') WHERE goal_id=?").run(target,id);
   this.audit('strategy','goal.updated',{id,target},'operator_control');
   return {ok:true,goalId:id,target};
  }
  if(act==='evidence'){
   const id=Number(data.packetId),note=s(data.evidence,1000);
   if(!Number.isSafeInteger(id)||id<1||note.length<30)return {error:'Provide an existing packet ID and at least 30 characters of evidence.'};
   const row=this.db.prepare("SELECT id,status FROM realm_os_packets WHERE id=? AND status='open'").get(id);
   if(!row)return {error:'Packet not open or does not exist.'};
   const proof={operatorAttestation:note,verifiedExternally:false};
   this.close(id,proof,'operator_attested_not_independently_verified');
   return {ok:true,packetId:id,status:'observed',independentVerification:false};
  }
  return {error:'Supported: pulse, pause, resume, goal, evidence'};
 }
 start(){
  if(!this.enabled||this.timer)return;
  this.timer=setInterval(()=>this.pulse(),this.interval);
  this.timer.unref();
  setImmediate(()=>this.pulse());
 }
 stop(){if(this.timer)clearInterval(this.timer);this.timer=null;}
}
