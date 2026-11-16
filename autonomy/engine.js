import crypto from 'node:crypto';
import {safeFetch,publicUrl,robotsAllowed,htmlMetadata} from './safe-fetch.js';

const ROLES=[
 ['Scout','discover','Identify new public resources from high-signal sources'],
 ['Crawler','inspect','Fetch bounded HTML metadata after robots checks'],
 ['Verifier','verify','Check uptime, provenance and indexability'],
 ['Ranker','score','Score relevance, recency and supporting evidence'],
 ['Curator','curate','Route qualified candidates for approval'],
 ['Freshness','audit','Revisit indexed resources without silently rewriting them'],
 ['Deduper','dedupe','Merge exact canonical URL candidates'],
 ['Taxonomist','classify','Assign relevant categories and tags'],
 ['Publisher','publish','Publish only after human-controlled approval'],
 ['Revenue','commercial','Identify opt-in ecosystem sponsorship opportunities'],
 ['Quality','qa','Monitor failures, drift, retries and false positives'],
 ['Operator','ops','Manage policy, backlog, budgets and receipts'],
 ['Web3 Scout','discover-web3','Source open Web3 projects and protocols'],
 ['Model Scout','discover-models','Track model, dataset, and inference providers'],
 ['Tool Scout','discover-tools','Identify MCP tools and developer APIs'],
 ['Community Scout','discover-community','Map projects and builders in public communities'],
 ['Security Researcher','review-safety','Flag suspicious URLs and security concerns'],
 ['License Analyst','review-licenses','Record public license metadata where present'],
 ['Graph Analyst','graph','Identify useful category connections'],
 ['Agent Registry','agent-discovery','Publish agent-readable verified discovery manifest']
];
const DEFAULTS={concurrency:2,dailyRequests:160,dailyDiscovery:36,hostDelaySeconds:45,shards:2048,tickMs:60000};
const SOURCES=[
 ['GitHub AI agents','github','https://api.github.com/search/repositories?q=topic%3Aai-agents+stars%3A%3E15&sort=updated&order=desc&per_page=12','Agent Infrastructure',24],
 ['GitHub Web3 tooling','github','https://api.github.com/search/repositories?q=topic%3Aweb3+stars%3A%3E25&sort=updated&order=desc&per_page=12','Builders',24],
 ['GitHub MCP servers','github','https://api.github.com/search/repositories?q=topic%3Amcp-server+stars%3A%3E10&sort=updated&order=desc&per_page=12','Agent Infrastructure',24],
 ['GitHub open-source LLMs','github','https://api.github.com/search/repositories?q=topic%3Allm+stars%3A%3E30&sort=updated&order=desc&per_page=12','AI & Models',24],
 ['GitHub agent frameworks','github','https://api.github.com/search/repositories?q=agent-framework+stars%3A%3E25&sort=updated&order=desc&per_page=12','Agent Infrastructure',24],
 ['Hacker News agent research','hn','https://hn.algolia.com/api/v1/search_by_date?query=ai%20agents&tags=story&hitsPerPage=12','AI & Models',24],
 ['Hacker News Web3 tools','hn','https://hn.algolia.com/api/v1/search_by_date?query=web3%20open%20source&tags=story&hitsPerPage=12','Protocols',24]
];
const iso=()=>new Date().toISOString();
const isoPlus=(ms)=>new Date(Date.now()+ms).toISOString();
const json=x=>JSON.stringify(x);
const clamp=(n,min,max)=>Math.min(max,Math.max(min,Number(n)||0));
const dateKey=()=>new Date().toISOString().slice(0,10);
function normalizeUrl(raw){try{const u=publicUrl(raw);if(!u)return null;u.hash='';u.searchParams.delete('utm_source');u.searchParams.delete('utm_medium');u.searchParams.delete('utm_campaign');u.searchParams.delete('utm_content');u.searchParams.delete('ref');u.searchParams.sort();if(u.pathname==='/'&&!u.search)u.pathname='/';return u.href;}catch{return null;}}
function short(x,n=280){return String(x||'').replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,n);}

export class AutonomyEngine {
  constructor(db,options={}){
    this.db=db;this.fetcher=options.fetcher||safeFetch;this.enabled=options.enabled??(process.env.AUTONOMY_ENABLED!=='false'&&process.env.NODE_ENV!=='test');
    this.tickMs=clamp(options.tickMs||process.env.AUTONOMY_TICK_MS||DEFAULTS.tickMs,5000,3600000);
    this.concurrency=clamp(options.concurrency||process.env.AUTONOMY_CONCURRENCY||DEFAULTS.concurrency,1,8);
    this.dailyRequests=clamp(options.dailyRequests||process.env.AUTONOMY_DAILY_REQUESTS||DEFAULTS.dailyRequests,1,10000);
    this.hostDelaySeconds=clamp(options.hostDelaySeconds||process.env.AUTONOMY_HOST_DELAY_SECONDS||DEFAULTS.hostDelaySeconds,5,3600);
    this.shards=clamp(options.shards||process.env.AUTONOMY_VIRTUAL_SHARDS||DEFAULTS.shards,12,20000);
    this.running=0;this.timer=null;this.busy=false;this.bootstrap();
  }
  bootstrap(){
    this.db.exec(`CREATE TABLE IF NOT EXISTS autonomy_workers(worker_id TEXT PRIMARY KEY,kind TEXT NOT NULL DEFAULT 'edge',first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),claims INTEGER NOT NULL DEFAULT 0,reports INTEGER NOT NULL DEFAULT 0,failures INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS autonomy_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS autonomy_sources(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,kind TEXT NOT NULL,endpoint TEXT NOT NULL UNIQUE,category TEXT NOT NULL,interval_hours INTEGER NOT NULL DEFAULT 24,enabled INTEGER NOT NULL DEFAULT 1,next_at TEXT NOT NULL DEFAULT (datetime('now')),last_run_at TEXT);
      CREATE TABLE IF NOT EXISTS autonomy_jobs(id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT NOT NULL,source_id INTEGER,target TEXT NOT NULL,payload TEXT NOT NULL DEFAULT '{}',priority INTEGER NOT NULL DEFAULT 50,status TEXT NOT NULL DEFAULT 'queued',attempt INTEGER NOT NULL DEFAULT 0,due_at TEXT NOT NULL DEFAULT (datetime('now')),lease_until TEXT,worker_id TEXT,lease_token_hash TEXT,unique_key TEXT NOT NULL UNIQUE,last_error TEXT,created_at TEXT NOT NULL DEFAULT (datetime('now')),updated_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE INDEX IF NOT EXISTS idx_autonomy_jobs_status ON autonomy_jobs(status,due_at,priority);
      CREATE TABLE IF NOT EXISTS autonomy_candidates(id INTEGER PRIMARY KEY AUTOINCREMENT,url TEXT NOT NULL UNIQUE,name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',category TEXT NOT NULL,origin TEXT NOT NULL,source_id INTEGER,score INTEGER NOT NULL DEFAULT 0,state TEXT NOT NULL DEFAULT 'discovered',http_status INTEGER,evidence TEXT NOT NULL DEFAULT '{}',first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),reviewed_at TEXT);
      CREATE INDEX IF NOT EXISTS idx_autonomy_candidates_state ON autonomy_candidates(state,score);
      CREATE TABLE IF NOT EXISTS autonomy_audits(id INTEGER PRIMARY KEY AUTOINCREMENT,resource_id INTEGER NOT NULL,status TEXT NOT NULL,http_status INTEGER,title TEXT,description TEXT,checked_at TEXT NOT NULL DEFAULT (datetime('now')),reason TEXT);
      CREATE TABLE IF NOT EXISTS autonomy_hosts(host TEXT PRIMARY KEY,last_fetch_at TEXT,robots_txt TEXT,robots_expires_at TEXT,blocked_until TEXT);
      CREATE TABLE IF NOT EXISTS autonomy_budget(date TEXT PRIMARY KEY,requests INTEGER NOT NULL DEFAULT 0,discovery INTEGER NOT NULL DEFAULT 0,ai_calls INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS autonomy_events(id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT NOT NULL,actor TEXT NOT NULL,detail TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE IF NOT EXISTS autonomy_pulses(id INTEGER PRIMARY KEY CHECK(id=1),last_tick_at TEXT,last_success_at TEXT,consecutive_errors INTEGER NOT NULL DEFAULT 0);
      INSERT OR IGNORE INTO autonomy_settings(key,value) VALUES('paused','false');
      INSERT OR IGNORE INTO autonomy_pulses(id) VALUES(1);`);
    if(!this.db.prepare('PRAGMA table_info(autonomy_jobs)').all().some(c=>c.name==='lease_token_hash'))this.db.exec('ALTER TABLE autonomy_jobs ADD COLUMN lease_token_hash TEXT');
    for(const s of SOURCES)this.db.prepare('INSERT OR IGNORE INTO autonomy_sources(name,kind,endpoint,category,interval_hours) VALUES(?,?,?,?,?)').run(...s);
  }
  log(kind,detail,actor='system'){
    this.db.prepare('INSERT INTO autonomy_events(kind,actor,detail) VALUES(?,?,?)').run(short(kind,60),short(actor,80),json(detail));
    this.db.prepare('DELETE FROM autonomy_events WHERE id < (SELECT COALESCE(MAX(id)-2500,0) FROM autonomy_events)').run();
  }
  paused(){return this.db.prepare("SELECT value FROM autonomy_settings WHERE key='paused'").get()?.value==='true';}
  setPaused(value){this.db.prepare("UPDATE autonomy_settings SET value=? WHERE key='paused'").run(value?'true':'false');this.log(value?'paused':'resumed',{by:'founder'},'admin');return this.status();}
  enqueue(kind,target,{sourceId=null,payload={},priority=50,key,dueAt}={}){
    const unique=key||crypto.createHash('sha256').update(`${kind}:${target}:${dateKey()}`).digest('hex');
    const result=this.db.prepare('INSERT OR IGNORE INTO autonomy_jobs(kind,source_id,target,payload,priority,unique_key,due_at) VALUES(?,?,?,?,?,?,?)').run(kind,sourceId,target,json(payload),priority,unique,(dueAt||iso()).replace('T',' ').slice(0,19));
    return {inserted:result.changes>0,id:Number(result.lastInsertRowid)};
  }
  seed(now=new Date()){
    if(!this.enabled||this.paused())return 0;
    let count=0;
    const threshold=now.toISOString().replace('T',' ').slice(0,19);
    const sources=this.db.prepare('SELECT * FROM autonomy_sources WHERE enabled=1 AND next_at<=?').all(threshold);
    for(const source of sources){
      const key=`discover:${source.id}:${dateKey()}`;
      if(this.enqueue('discover',source.endpoint,{sourceId:source.id,payload:{kind:source.kind,category:source.category},priority:90,key}).inserted)count++;
      const advance=new Date(now.getTime()+source.interval_hours*3600000).toISOString().replace('T',' ').slice(0,19);
      this.db.prepare('UPDATE autonomy_sources SET next_at=? WHERE id=?').run(advance,source.id);
    }
    // Every resource gets its own scheduled audit, but a bounded number each day.
    const records=this.db.prepare("SELECT r.id,r.url FROM resources r LEFT JOIN autonomy_audits a ON a.id=(SELECT MAX(id) FROM autonomy_audits WHERE resource_id=r.id) WHERE a.checked_at IS NULL OR a.checked_at<datetime('now','-7 days') ORDER BY COALESCE(a.checked_at,'') ASC LIMIT 12").all();
    for(const r of records){
      const pending=this.db.prepare("SELECT 1 FROM autonomy_jobs WHERE kind='audit' AND target=? AND status IN ('queued','leased') LIMIT 1").get(r.url);
      if(!pending&&this.enqueue('audit',r.url,{payload:{resourceId:r.id},priority:15,key:`audit:${r.id}:${dateKey()}`}).inserted)count++;
    }
    return count;
  }
  claim(){
    this.db.exec('BEGIN IMMEDIATE');
    try{
      const row=this.db.prepare("SELECT * FROM autonomy_jobs WHERE ((status='queued' AND due_at<=datetime('now')) OR (status='leased' AND lease_until<datetime('now'))) AND (?=0 OR kind!='discover') ORDER BY priority DESC,id ASC LIMIT 1").get(process.env.AUTONOMY_REMOTE_DISCOVERY_ONLY==='true'?1:0);
      if(!row){this.db.exec('COMMIT');return null;}
      this.db.prepare("UPDATE autonomy_jobs SET status='leased',attempt=attempt+1,lease_until=datetime('now','+90 seconds'),worker_id=?,lease_token_hash=NULL,updated_at=datetime('now') WHERE id=?").run(`local-${process.pid}`,row.id);
      this.db.exec('COMMIT');return {...row,attempt:row.attempt+1};
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  budget(kind='requests'){
    const today=dateKey();
    this.db.prepare('INSERT OR IGNORE INTO autonomy_budget(date) VALUES(?)').run(today);
    const row=this.db.prepare('SELECT * FROM autonomy_budget WHERE date=?').get(today);
    if(row.requests>=this.dailyRequests || (kind==='discovery'&&row.discovery>=DEFAULTS.dailyDiscovery))throw new Error('BUDGET_EXHAUSTED');
    this.db.prepare(`UPDATE autonomy_budget SET requests=requests+1${kind==='discovery'?',discovery=discovery+1':''} WHERE date=?`).run(today);
    return true;
  }
  async request(url,{kind='requests',maxBytes=262144,skipRobots=false}={}){
    const u=publicUrl(url);if(!u)throw new Error('URL_NOT_PUBLIC');
    const host=u.hostname;const row=this.db.prepare('SELECT * FROM autonomy_hosts WHERE host=?').get(host);
    const epoch=Math.floor(Date.now()/1000);
    if(row?.blocked_until&&Date.parse(row.blocked_until.replace(' ','T')+'Z')>Date.now())throw new Error('HOST_COOLDOWN');
    if(row?.last_fetch_at){const elapsed=(Date.now()-Date.parse(row.last_fetch_at.replace(' ','T')+'Z'))/1000;if(elapsed<this.hostDelaySeconds)throw new Error('HOST_COOLDOWN');}
    let rules=row?.robots_txt;
    if(!skipRobots&&(!row?.robots_expires_at||Date.parse(row.robots_expires_at.replace(' ','T')+'Z')<Date.now())){
      this.budget();
      const robots=await this.fetcher(`${u.origin}/robots.txt`,{maxBytes:32768,timeoutMs:5000});
      if(robots.status===401||robots.status===403)throw new Error('ROBOTS_DENIED');
      if(robots.status>=500||robots.status===429)throw new Error('ROBOTS_UNAVAILABLE');
      rules=robots.status===200?robots.body:'';
      this.db.prepare("INSERT INTO autonomy_hosts(host,robots_txt,robots_expires_at) VALUES(?,?,datetime('now','+24 hours')) ON CONFLICT(host) DO UPDATE SET robots_txt=excluded.robots_txt,robots_expires_at=excluded.robots_expires_at").run(host,rules);
    }
    const policy=skipRobots?{allowed:true,crawlDelaySeconds:0}:robotsAllowed(rules,u.toString());
    if(!policy.allowed)throw new Error('ROBOTS_DENIED');
    const delay=Math.max(this.hostDelaySeconds,policy.crawlDelaySeconds);
    // Durable per-host reservation before the outbound request prevents concurrent burst on same origin.
    const reserve=this.db.prepare('SELECT last_fetch_at FROM autonomy_hosts WHERE host=?').get(host);
    if(reserve?.last_fetch_at&&Date.now()-Date.parse(reserve.last_fetch_at.replace(' ','T')+'Z')<delay*1000)throw new Error('HOST_COOLDOWN');
    this.budget(kind);
    this.db.prepare("INSERT INTO autonomy_hosts(host,last_fetch_at) VALUES(?,datetime('now')) ON CONFLICT(host) DO UPDATE SET last_fetch_at=excluded.last_fetch_at").run(host);
    const result=await this.fetcher(u.toString(),{maxBytes});
    if([429,503].includes(result.status)){
      this.db.prepare("UPDATE autonomy_hosts SET blocked_until=datetime('now','+1 hour') WHERE host=?").run(host);
      throw new Error('REMOTE_THROTTLED');
    }
    return result;
  }
  discoverRecords(kind,parsed,category){
    if(kind==='github'){
      return (Array.isArray(parsed.items)?parsed.items:[]).filter(x=>!x.archived&&!x.disabled&&x.html_url&&x.stargazers_count>=10).slice(0,15).map(x=>({url:x.html_url,name:x.full_name||x.name,description:x.description||`Open-source ${category} project`,category,tags:(x.topics||[]).slice(0,8),signals:{stars:x.stargazers_count,updatedAt:x.updated_at,provenance:'github-public-api'}}));
    }
    if(kind==='hn'){
      return (Array.isArray(parsed.hits)?parsed.hits:[]).filter(x=>x.url&&x.title&&(x.points||0)>=5).slice(0,15).map(x=>({url:x.url,name:x.title,description:`Community-discussed source: ${x.title}`,category,tags:['HN','Community'],signals:{votes:x.points,provenance:'hackernews-algolia'}}));
    }
    return [];
  }
  upsertCandidate(item,sourceId){
    const url=normalizeUrl(item.url);if(!url)return false;
    if(this.db.prepare('SELECT 1 FROM resources WHERE url=?').get(url))return false;
    const name=short(item.name,100),description=short(item.description,400);
    if(name.length<3)return false;
    const score=clamp(Math.round(25+(item.signals?.stars?Math.log10(item.signals.stars+1)*9:8)+(description.length>=20?12:0)+(item.signals?.updatedAt?8:0)),0,75);
    const result=this.db.prepare("INSERT OR IGNORE INTO autonomy_candidates(url,name,description,category,origin,source_id,score,evidence) VALUES(?,?,?,?,?,?,?,?)").run(url,name,description,item.category,'autonomous',sourceId,score,json({discovered:item.signals||{},collectedAt:iso()}));
    if(result.changes){
      this.enqueue('inspect',url,{sourceId,payload:{},priority:45,key:`inspect:${crypto.createHash('sha1').update(url).digest('hex')}:${dateKey()}`});return true;
    }
    this.db.prepare("UPDATE autonomy_candidates SET last_seen_at=datetime('now') WHERE url=?").run(url);
    return false;
  }
  async perform(job){
    const payload=JSON.parse(job.payload||'{}');
    if(job.kind==='discover'){
      const source=this.db.prepare('SELECT * FROM autonomy_sources WHERE id=?').get(job.source_id);
      if(!source||!source.enabled)return {skipped:'disabled-source'};
      const result=await this.request(source.endpoint,{kind:'discovery',maxBytes:360000});
      if(result.status!==200)throw new Error(`HTTP_${result.status}`);
      let parsed;try{parsed=JSON.parse(result.body);}catch{throw new Error('BAD_JSON_SOURCE');}
      const found=this.discoverRecords(source.kind,parsed,source.category);
      let inserted=0;for(const item of found)if(this.upsertCandidate(item,source.id))inserted++;
      this.db.prepare("UPDATE autonomy_sources SET last_run_at=datetime('now') WHERE id=?").run(source.id);
      return {fetched:found.length,newCandidates:inserted,source:source.name};
    }
    if(job.kind==='inspect'){
      const c=this.db.prepare('SELECT * FROM autonomy_candidates WHERE url=?').get(job.target);
      if(!c||['approved','rejected'].includes(c.state))return {skipped:'already-reviewed'};
      const resp=await this.request(c.url,{maxBytes:200000});
      const contentType=String(resp.headers?.['content-type']||'');
      const isHtml=contentType.includes('text/html')||resp.body.slice(0,200).toLowerCase().includes('<html');
      const meta=isHtml?htmlMetadata(resp.body):{title:'',description:'',noindex:false};
      const noindex=meta.noindex||/noindex/i.test(String(resp.headers?.['x-robots-tag']||''));
      const ok=resp.status===200&&!noindex&&(isHtml||c.url.includes('github.com/'));
      const score=clamp(c.score+(ok?24:0)+(meta.title?8:0)+(meta.description?6:0),0,99);
      const state=noindex?'blocked':ok&&score>=55?'ready':'needs_review';
      const evidence={...JSON.parse(c.evidence||'{}'),verification:{checkedAt:iso(),httpStatus:resp.status,contentType,title:meta.title,description:meta.description,robotsAllowed:true,noindex,score}};
      this.db.prepare("UPDATE autonomy_candidates SET score=?,state=?,http_status=?,evidence=?,last_seen_at=datetime('now') WHERE id=?").run(score,state,resp.status,json(evidence),c.id);
      return {candidateId:c.id,state,score};
    }
    if(job.kind==='audit'){
      const id=Number(payload.resourceId);const r=this.db.prepare('SELECT * FROM resources WHERE id=?').get(id);
      if(!r)return {skipped:'resource-removed'};
      const response=await this.request(r.url,{maxBytes:100000});
      const m=htmlMetadata(response.body);
      const status=response.status===200?'healthy':response.status===404||response.status===410?'broken':'review';
      this.db.prepare('INSERT INTO autonomy_audits(resource_id,status,http_status,title,description,reason) VALUES(?,?,?,?,?,?)').run(id,status,response.status,m.title,m.description,status==='healthy'?null:`HTTP_${response.status}`);
      return {resourceId:id,status,httpStatus:response.status};
    }
    throw new Error('UNKNOWN_JOB');
  }
  complete(job,result){
    this.db.prepare("UPDATE autonomy_jobs SET status='done',lease_until=NULL,lease_token_hash=NULL,last_error=NULL,updated_at=datetime('now') WHERE id=?").run(job.id);
    this.db.prepare("UPDATE autonomy_pulses SET last_success_at=datetime('now'),consecutive_errors=0 WHERE id=1").run();
    this.log('job.done',{jobId:job.id,kind:job.kind,result});
  }
  fail(job,err){
    const reason=short(err?.message||err,150),isDefer=['BUDGET_EXHAUSTED','HOST_COOLDOWN','REMOTE_THROTTLED','ROBOTS_UNAVAILABLE'].includes(reason);
    const final=job.attempt>=4 || ['ROBOTS_DENIED','URL_NOT_PUBLIC','PRIVATE_NETWORK_BLOCKED'].includes(reason);
    const delay=reason==='BUDGET_EXHAUSTED'?24*3600:reason==='HOST_COOLDOWN'?90:isDefer?3600:Math.min(86400,Math.pow(2,job.attempt)*300);
    const due=new Date(Date.now()+delay*1000).toISOString().replace('T',' ').slice(0,19);
    this.db.prepare('UPDATE autonomy_jobs SET status=?,due_at=?,lease_until=NULL,lease_token_hash=NULL,last_error=?,updated_at=datetime(\'now\') WHERE id=?').run(final?'failed':'queued',due,reason,job.id);
    this.db.prepare("UPDATE autonomy_pulses SET consecutive_errors=consecutive_errors+1 WHERE id=1").run();
    this.log('job.failed',{jobId:job.id,kind:job.kind,reason,retry:!final});
    if(job.kind==='audit' && final){
      const payload=JSON.parse(job.payload||'{}');if(payload.resourceId)this.db.prepare('INSERT INTO autonomy_audits(resource_id,status,reason) VALUES(?,?,?)').run(payload.resourceId,'unavailable',reason);
    }
  }
  async execute(job){this.running++;try{const result=await this.perform(job);this.complete(job,result);}catch(e){this.fail(job,e);}finally{this.running--;}}
  tick(){
    if(!this.enabled||this.paused())return {started:0,enabled:this.enabled,paused:this.paused()};
    this.db.prepare("UPDATE autonomy_pulses SET last_tick_at=datetime('now') WHERE id=1").run();
    this.seed();let n=0;
    while(this.running<this.concurrency && n<this.concurrency){
      const job=this.claim();if(!job)break;
      this.execute(job);n++;
    }
    return {started:n,enabled:true,paused:false};
  }
  start(){if(!this.enabled||this.timer)return;this.timer=setInterval(()=>this.tick(),this.tickMs);this.timer.unref();setImmediate(()=>this.tick());}
  stop(){if(this.timer)clearInterval(this.timer);this.timer=null;}
  approveCandidate(id,decision,actor='admin'){
    if(!['approve','reject'].includes(decision))return {error:'INVALID_DECISION'};
    this.db.exec('BEGIN IMMEDIATE');
    try{
      const c=this.db.prepare('SELECT * FROM autonomy_candidates WHERE id=?').get(id);
      if(!c||c.state!=='ready'){this.db.exec('ROLLBACK');return {error:'NOT_REVIEWABLE'};}
      if(decision==='approve'){
        if(![200].includes(c.http_status)){this.db.exec('ROLLBACK');return {error:'NOT_VERIFIED'};}
        if(this.db.prepare('SELECT 1 FROM resources WHERE url=?').get(c.url)){this.db.exec('ROLLBACK');return {error:'ALREADY_INDEXED'};}
        this.db.prepare('INSERT INTO resources(name,url,description,category,tags,source,contributor) VALUES(?,?,?,?,?,?,?)').run(c.name,c.url,c.description||`Discovered via ${c.origin}`,c.category,'Autonomous discovery','autonomous-approved','');
      }
      this.db.prepare("UPDATE autonomy_candidates SET state=?,reviewed_at=datetime('now') WHERE id=?").run(decision==='approve'?'approved':'rejected',id);
      this.db.exec('COMMIT');this.log('candidate.reviewed',{id,decision},actor);return {ok:true,id,decision};
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  addSource(input){
    const kind=short(input.kind,10),url=normalizeUrl(input.endpoint),category=short(input.category,80),name=short(input.name,120),interval=clamp(input.intervalHours||24,6,168);
    if(!['github','hn'].includes(kind)||!url||name.length<3||!['AI & Models','Agent Infrastructure','Protocols','Communities','Builders','Search & Data'].includes(category))return {error:'INVALID_SOURCE'};
    const host=new URL(url).hostname;
    if((kind==='github'&&!(host==='api.github.com'&&new URL(url).pathname==='/search/repositories'))||(kind==='hn'&&!(host==='hn.algolia.com'&&new URL(url).pathname.startsWith('/api/v1/search'))))return {error:'UNSUPPORTED_ENDPOINT'};
    const r=this.db.prepare('INSERT OR IGNORE INTO autonomy_sources(name,kind,endpoint,category,interval_hours) VALUES(?,?,?,?,?)').run(name,kind,url,category,interval);
    return {ok:true,created:r.changes>0,id:Number(r.lastInsertRowid)};
  }
  claimRemote(workerId){
    if(process.env.AUTONOMY_ALLOW_REMOTE!=='true'||!this.enabled||this.paused())return {job:null,reason:'REMOTE_DISABLED'};
    if(!/^[a-zA-Z0-9_-]{3,64}$/.test(workerId))return {job:null,reason:'INVALID_WORKER_ID'};
    this.seed();
    this.db.exec('BEGIN IMMEDIATE');
    try{
      const inFlight=this.db.prepare("SELECT COUNT(*) n FROM autonomy_jobs WHERE status='leased' AND lease_token_hash IS NOT NULL AND lease_until>datetime('now')").get().n;
      if(inFlight>=2){this.db.exec('COMMIT');return {job:null,reason:'AT_CAPACITY'};}
      const row=this.db.prepare("SELECT j.*,s.kind source_kind,s.category source_category FROM autonomy_jobs j JOIN autonomy_sources s ON s.id=j.source_id WHERE j.kind='discover' AND j.status='queued' AND j.due_at<=datetime('now') AND s.enabled=1 ORDER BY j.priority DESC,j.id LIMIT 1").get();
      if(!row){this.db.exec('COMMIT');return {job:null,reason:'QUEUE_EMPTY'};}
      // Remote workers get narrow read-only public API jobs only; untrusted results require local inspection.
      this.budget('discovery');
      this.db.prepare("INSERT INTO autonomy_workers(worker_id,kind,claims) VALUES(?,'edge',1) ON CONFLICT(worker_id) DO UPDATE SET claims=claims+1,last_seen_at=datetime('now')").run(workerId);
      const token=crypto.randomBytes(24).toString('hex'),tokenHash=crypto.createHash('sha256').update(token).digest('hex');
      this.db.prepare("UPDATE autonomy_jobs SET status='leased',attempt=attempt+1,lease_until=datetime('now','+2 minutes'),worker_id=?,lease_token_hash=?,updated_at=datetime('now') WHERE id=?").run(workerId,tokenHash,row.id);
      this.db.exec('COMMIT');
      this.log('remote.claimed',{jobId:row.id,workerId,source:row.source_kind});
      return {job:{id:row.id,kind:row.source_kind,endpoint:row.target,category:row.source_category,token,leaseSeconds:120}};
    }catch(e){this.db.exec('ROLLBACK');if(e.message==='BUDGET_EXHAUSTED')return {job:null,reason:'DAILY_BUDGET'};throw e;}
  }
  reportRemote(workerId,id,token,result){
    const job=this.db.prepare('SELECT * FROM autonomy_jobs WHERE id=?').get(Number(id));
    const hash=crypto.createHash('sha256').update(String(token||'')).digest('hex');
    const tokenMatches=!!job?.lease_token_hash && crypto.timingSafeEqual(Buffer.from(job.lease_token_hash),Buffer.from(hash));
    if(!job||job.status!=='leased'||job.worker_id!==workerId||!tokenMatches||Date.parse(job.lease_until.replace(' ','T')+'Z')<Date.now())return {error:'INVALID_LEASE'};
    if(result?.error){this.db.prepare("UPDATE autonomy_workers SET failures=failures+1,last_seen_at=datetime('now') WHERE worker_id=?").run(workerId);this.fail({...job,attempt:job.attempt},new Error('REMOTE_'+short(result.error,60)));return {ok:true,accepted:false};}
    const source=this.db.prepare('SELECT * FROM autonomy_sources WHERE id=?').get(job.source_id);
    if(!source||!result||typeof result.payload!=='object'||result.payload===null)return {error:'INVALID_RESULT'};
    const arr=source.kind==='github'?result.payload.items:result.payload.hits;
    if(!Array.isArray(arr)||arr.length>20)return {error:'INVALID_RESULT'};
    const data={};data[source.kind==='github'?'items':'hits']=arr;
    const findings=this.discoverRecords(source.kind,data,source.category);
    let added=0;for(const f of findings)if(this.upsertCandidate(f,source.id))added++;
    this.db.prepare("UPDATE autonomy_sources SET last_run_at=datetime('now') WHERE id=?").run(source.id);
    this.db.prepare("UPDATE autonomy_workers SET reports=reports+1,last_seen_at=datetime('now') WHERE worker_id=?").run(workerId);
    this.complete(job,{remote:true,fetched:findings.length,newCandidates:added,workerId});
    return {ok:true,accepted:true,candidates:added};
  }
  status(){
    const jobs=this.db.prepare('SELECT status,COUNT(*) n FROM autonomy_jobs GROUP BY status').all();
    const candidates=this.db.prepare('SELECT state,COUNT(*) n FROM autonomy_candidates GROUP BY state').all();
    const today=this.db.prepare('SELECT requests,discovery,ai_calls FROM autonomy_budget WHERE date=?').get(dateKey())||{requests:0,discovery:0,ai_calls:0};
    const pulse=this.db.prepare('SELECT * FROM autonomy_pulses WHERE id=1').get();
    const audits=this.db.prepare('SELECT status,COUNT(*) n FROM autonomy_audits WHERE checked_at>=datetime(\'now\',\'-7 days\') GROUP BY status').all();
    const connectedWorkers=this.db.prepare("SELECT COUNT(*) n FROM autonomy_workers WHERE last_seen_at>=datetime('now','-24 hours')").get().n;
    const totalWork=this.db.prepare("SELECT COUNT(*) n FROM autonomy_events WHERE kind='job.done'").get().n;
    return {schema:'seekmesh.autonomy.status.v0.3',connectedWorkers24h:connectedWorkers,completedJobReceipts:totalWork,enabled:this.enabled,paused:this.paused(),schedulerRunning:Boolean(this.timer),activeExecutors:this.running,physicalExecutorLimit:this.concurrency,remoteDiscoveryEnabled:process.env.AUTONOMY_ALLOW_REMOTE==='true',remoteDiscoveryInFlight:this.db.prepare("SELECT COUNT(*) n FROM autonomy_jobs WHERE status='leased' AND lease_token_hash IS NOT NULL AND lease_until>datetime('now')").get().n,logicalWorkerShards:this.shards,logicalShardsNotProcesses:true,roles:ROLES.map(([name,task,mission])=>({name,task,mission})),sources:this.db.prepare('SELECT COUNT(*) n FROM autonomy_sources WHERE enabled=1').get().n,queues:Object.fromEntries(jobs.map(x=>[x.status,x.n])),candidates:Object.fromEntries(candidates.map(x=>[x.state,x.n])),auditsLast7Days:Object.fromEntries(audits.map(x=>[x.status,x.n])),budget:{date:dateKey(),requestsUsed:today.requests,requestsMax:this.dailyRequests,discoveryUsed:today.discovery,discoveryMax:DEFAULTS.dailyDiscovery,aiCalls:today.ai_calls},lastTick:pulse?.last_tick_at||null,lastSuccess:pulse?.last_success_at||null,consecutiveErrors:pulse?.consecutive_errors||0};
  }
  adminView(){return {status:this.status(),sources:this.db.prepare('SELECT * FROM autonomy_sources ORDER BY id').all(),workers:this.db.prepare('SELECT * FROM autonomy_workers ORDER BY last_seen_at DESC LIMIT 100').all(),candidates:this.db.prepare('SELECT * FROM autonomy_candidates ORDER BY CASE state WHEN \'ready\' THEN 0 ELSE 1 END,score DESC,id DESC LIMIT 100').all(),jobs:this.db.prepare('SELECT id,kind,source_id,target,status,attempt,priority,last_error,due_at,updated_at FROM autonomy_jobs ORDER BY id DESC LIMIT 100').all(),events:this.db.prepare('SELECT * FROM autonomy_events ORDER BY id DESC LIMIT 100').all()};}
  engineeringMissions(){
    const issues=[];
    for(const j of this.db.prepare("SELECT id,kind,target,last_error FROM autonomy_jobs WHERE status='failed' ORDER BY id DESC LIMIT 20").all())issues.push({id:`seekmesh-qa-${j.id}`,department:'Engineering/Quality',priority:'P1',issue:j.last_error,scope:j.target,acceptance:'Root cause reproduced, fix tested, independent verification receipt attached',requiresCodeReview:true});
    for(const a of this.db.prepare("SELECT a.resource_id,r.url,a.status,a.reason FROM autonomy_audits a JOIN resources r ON r.id=a.resource_id WHERE a.status IN ('broken','unavailable') ORDER BY a.id DESC LIMIT 20").all())issues.push({id:`seekmesh-freshness-${a.resource_id}`,department:'Discovery Quality',priority:'P2',issue:a.reason||a.status,scope:a.url,acceptance:'Canonical source reverified or flagged for review with evidence',requiresCodeReview:false});
    return issues;
  }
  workpackets(){return {schema:'seekmesh.workpacket.v1',mode:'read-only-feed',mission:'Maintain verifiable discoverable resource graph, quality and source freshness',roles:ROLES.map(([name,task,mission])=>({name,task,mission,requiresHumanApproval:task==='publish',receipt:'autonomy_events'})),jobs:this.db.prepare("SELECT id,kind,target,priority,status,attempt,updated_at FROM autonomy_jobs WHERE status IN ('queued','leased') ORDER BY priority DESC,id LIMIT 100").all(),engineeringMissions:this.engineeringMissions(),warning:'Logical worker shards are scheduling partitions, not deployed compute workers.'};}
}
