import crypto from 'node:crypto';
/** Bounded, persisted, safe executor. No minting, wallet signing, funds movement or automatic external outreach. */
const safe=(x,n=300)=>String(x??'').trim().slice(0,n);
export class RealmExecutor{
 constructor(db,{os,autonomy,atlas,migration,paidProof}={}){
  this.db=db;this.os=os;this.autonomy=autonomy;this.atlas=atlas;this.migration=migration;this.paidProof=paidProof;
  this.timer=null;this.running=false;
  const columns=new Set(db.prepare('PRAGMA table_info(realm_os_packets)').all().map(x=>x.name));
  for(const [name,type] of [['executor_kind',"TEXT NOT NULL DEFAULT 'human_review'"],['attempts','INTEGER NOT NULL DEFAULT 0'],['max_attempts','INTEGER NOT NULL DEFAULT 3'],['due_at',"TEXT NOT NULL DEFAULT (datetime('now'))"],['budget_ms','INTEGER NOT NULL DEFAULT 8000'],['last_error',"TEXT NOT NULL DEFAULT ''"]]){
   if(!columns.has(name))db.exec('ALTER TABLE realm_os_packets ADD COLUMN '+name+' '+type.replace(" DEFAULT (datetime('now'))"," DEFAULT ''"));
  }
  db.exec([
   "CREATE TABLE IF NOT EXISTS realm_os_artifacts(id INTEGER PRIMARY KEY AUTOINCREMENT,packet_id INTEGER NOT NULL,kind TEXT NOT NULL,content TEXT NOT NULL,content_sha256 TEXT NOT NULL,verification TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')))",
   "CREATE INDEX IF NOT EXISTS realm_os_artifact_by_packet ON realm_os_artifacts(packet_id)"
  ].join(';')+';');
 }
 supported(){return ['sync_atlas_mcp','probe_atlas_endpoints','probe_atlas_endpoints','probe_atlas_endpoints','daily_realm_report','publish_guild_expansion','repair_discovery_runtime'];}
 metrics(){return {executed:this.db.prepare("SELECT COUNT(*) n FROM realm_os_packets WHERE status='observed' AND executor_kind='deterministic'").get().n,queued:this.db.prepare("SELECT COUNT(*) n FROM realm_os_packets WHERE status='open' AND kind IN ('sync_atlas_mcp','daily_realm_report','publish_guild_expansion','repair_discovery_runtime')").get().n,failed:this.db.prepare("SELECT COUNT(*) n FROM realm_os_packets WHERE status='failed' AND executor_kind='deterministic'").get().n,artifacts:this.db.prepare('SELECT COUNT(*) n FROM realm_os_artifacts').get().n,executorsPhysical:0,networkBudgetMS:8000};}
 _writeArtifact(packet,kind,data,verification){
  const content=JSON.stringify(data),hash=crypto.createHash('sha256').update(content).digest('hex');
  this.db.prepare('INSERT INTO realm_os_artifacts(packet_id,kind,content,content_sha256,verification) VALUES(?,?,?,?,?)').run(packet.id,kind,content,hash,verification);
  this.os.close(packet.id,{artifactHash:hash,type:kind,result:data},verification);
  return {kind,hash,verification};
 }
 async run(limit=2){
  if(this.running||this.os.paused()||!this.os.enabled)return {executed:0,reason:'busy_or_disabled'};
  this.running=true;
  let executed=0,errors=0;
  try{
   this.db.prepare("UPDATE realm_os_packets SET status='open',due_at=datetime('now','+30 seconds') WHERE status='running' AND updated_at<datetime('now','-5 minutes') AND executor_kind='deterministic'").run();
   const jobs=this.db.prepare("SELECT * FROM realm_os_packets WHERE kind IN ('sync_atlas_mcp','daily_realm_report','publish_guild_expansion','repair_discovery_runtime') AND status='open' AND attempts<max_attempts AND (due_at='' OR due_at<=datetime('now')) ORDER BY priority DESC,id ASC LIMIT ?").all(Math.max(1,Math.min(3,Number(limit)||2)));
   for(const row of jobs){
    this.db.prepare("UPDATE realm_os_packets SET status='running',attempts=attempts+1,executor_kind='deterministic',updated_at=datetime('now') WHERE id=? AND status='open'").run(row.id);
    try{
     let data,proof;
     if(row.kind==='sync_atlas_mcp'){
      data=await this.atlas.syncMCP();
      if(data.error)throw Error(data.error);
      proof=data.skipped?'official_registry_recently_synced':'official_mcp_registry_response_persisted';
     }else if(row.kind==='probe_atlas_endpoints'){
      data=await this.atlas.autoProbe(1);
      if(!data.ok)throw Error(data.error||'Atlas bounded probe failed');
      proof='bounded_robots_aware_http_observation_not_security_audit';
     }else if(row.kind==='daily_realm_report'){
      const m=this.os.measures();
      data={date:new Date().toISOString().slice(0,10),index:m.resources,approved:m.accepted_sources,pending:m.pending_sources,guilds:m.guilds,explorers:m.members,sourceClicks7d:m.source_clicks_7d,partnershipInquiries:m.inquiries,settledCampaigns:0,x402Payments:this.paidProof?.publicStatus()?.verifiedSettledRequests||0};
      proof='measured_sqlite_snapshot';
     }else if(row.kind==='publish_guild_expansion'){
      data={verifiedMigratedCampaigns:this.migration.public().length,guilds:this.os.measures().guilds,nextAction:'Invite real project owners to bring their campaigns and original source links',historicalRewardsTransferred:false};
      proof='measured_verified_migrations_and_guild_records';
     }else if(row.kind==='repair_discovery_runtime'){
      const before=this.autonomy.status();data={before:{errors:before.consecutiveErrors,queue:before.queues},started:this.autonomy.tick().started||0};
      proof='autonomy_tick_executed';
     }else throw Error('Executor not permitted');
     const artifact=this._writeArtifact(row,row.kind,data,proof);
     this.os.audit(row.agent_id,'executor.completed',{packetId:row.id,...artifact},proof,row.id);
     executed++;
    }catch(err){
     errors++;
     const note=safe(err.message,230),attempts=row.attempts+1;
     const next=attempts>=row.max_attempts?'failed':'open';
     const delay=Math.min(14400,60*Math.pow(2,attempts));
     this.db.prepare("UPDATE realm_os_packets SET status=?,due_at=datetime('now',?),last_error=?,updated_at=datetime('now') WHERE id=?").run(next,'+'+delay+' seconds',note,row.id);
     this.os.audit(row.agent_id,'executor.failed',{packetId:row.id,error:note,attempts,retry:next==='open'},'real_error',row.id);
    }
   }
   return {ok:true,executed,errors};
  }finally{this.running=false}
 }
 start(){if(this.timer)return;this.timer=setInterval(()=>{void this.run().catch(()=>{})},60000);this.timer.unref();setImmediate(()=>{void this.run().catch(()=>{})})}
 stop(){if(this.timer)clearInterval(this.timer);this.timer=null}
}
