import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {AutonomyEngine} from '../autonomy/engine.js';
import {publicIp,publicUrl,robotsAllowed,htmlMetadata} from '../autonomy/safe-fetch.js';

function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE resources(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,url TEXT UNIQUE,description TEXT,category TEXT,tags TEXT,source TEXT,contributor TEXT);");
 const fetched=[];
 const fetcher=async(url)=>{fetched.push(url);
   if(url.endsWith('/robots.txt'))return {status:404,body:'',headers:{}};
   if(url.startsWith('https://api.github.com/'))return {status:200,body:JSON.stringify({items:[{html_url:'https://github.com/example/agent',full_name:'example/agent',name:'agent',description:'Useful open-source agent framework and integrations',stargazers_count:75,updated_at:'2026-11-01T00:00:00Z',topics:['agent'],archived:false}]}),headers:{'content-type':'application/json'}};
   if(url==='https://github.com/example/agent')return {status:200,body:'<html><head><title>Example Agent</title><meta name="description" content="Useful framework for autonomous agents"></head><body>example</body></html>',headers:{'content-type':'text/html'}};
   return {status:404,body:'',headers:{}};
 };
 const engine=new AutonomyEngine(db,{enabled:true,fetcher,hostDelaySeconds:5,dailyRequests:20});
 return {db,engine,fetched};
}
test('Autonomy: honest logical shards, source scheduling and human-gated publishing',async()=>{
 const {db,engine,fetched}=fixture();
 assert.equal(engine.status().logicalWorkerShards,2048);
 assert.equal(engine.status().activeExecutors,0);
 assert.equal(engine.status().sources,7);
 assert.equal(engine.seed(),7);
 assert.equal(engine.seed(),0,'no duplicate daily work');
 const source=db.prepare("SELECT * FROM autonomy_sources WHERE name='GitHub AI agents'").get();
 const found=await engine.perform({kind:'discover',source_id:source.id,target:source.endpoint,payload:'{}'});
 assert.equal(found.newCandidates,1);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM resources').get().n,0);
 const checked=await engine.perform({kind:'inspect',target:'https://github.com/example/agent',payload:'{}'});
 assert.equal(checked.state,'ready');
 const candidate=db.prepare('SELECT * FROM autonomy_candidates').get();
 const approve=engine.approveCandidate(candidate.id,'approve');assert.equal(approve.ok,true);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM resources').get().n,1);
 assert.equal(engine.approveCandidate(candidate.id,'approve').error,'NOT_REVIEWABLE');
 const budget=engine.status().budget;
 assert.equal(budget.requestsUsed,4,'robots+document fetch charged for both origins');
 assert.equal(fetched.length,4);
 db.close();
});
test('Autonomy: controls and adapter allowlist',()=>{
 const {db,engine}=fixture();
 assert.equal(engine.addSource({kind:'hn',name:'Unsafe',endpoint:'https://example.com/evil',category:'Builders'}).error,'UNSUPPORTED_ENDPOINT');
 assert.equal(engine.addSource({kind:'github',name:'Safe',endpoint:'http://localhost:8000/a',category:'Builders'}).error,'INVALID_SOURCE');
 engine.setPaused(true);assert.equal(engine.tick().started,0);assert.equal(engine.status().paused,true);
 engine.setPaused(false);assert.equal(engine.status().paused,false);
 db.close();
});
test('Crawler policy: block private IPs and honor robots and noindex',()=>{
 for(const ip of ['127.0.0.1','10.12.0.1','169.254.169.254','192.168.1.1','172.16.1.1','198.18.0.1','::1','fc00::2','::ffff:127.0.0.1'])assert.equal(publicIp(ip),false,ip);
 assert.equal(publicIp('8.8.8.8'),true);
 assert.equal(publicUrl('http://127.0.0.1:80/'),null);
 assert.equal(publicUrl('https://user:pass@example.com/'),null);
 assert.equal(publicUrl('https://example.com:8443'),null);
 assert.equal(publicUrl('https://github.com/example/agent')?.hostname,'github.com');
 const robots='User-agent: *\nDisallow: /private\nAllow: /private/open\nCrawl-delay: 7';
 assert.equal(robotsAllowed(robots,'https://sample.com/private/secret').allowed,false);
 assert.equal(robotsAllowed(robots,'https://sample.com/private/open').allowed,true);
 assert.equal(robotsAllowed(robots,'https://sample.com/public').crawlDelaySeconds,7);
 assert.equal(htmlMetadata('<meta name="robots" content="noindex"><title>Do not index</title>').noindex,true);
});
test('Distributed discovery leases are scoped, expiring and untrusted until inspected',()=>{
 const {db,engine}=fixture();const before=process.env.AUTONOMY_ALLOW_REMOTE;process.env.AUTONOMY_ALLOW_REMOTE='true';
 try{
   engine.seed();
   const claim=engine.claimRemote('cloudflare-01');
   assert.ok(claim.job?.id);assert.equal(claim.job.kind,'github');
   const no=engine.reportRemote('malicious',claim.job.id,claim.job.token,{payload:{items:[]}});
   assert.equal(no.error,'INVALID_LEASE');
   const report=engine.reportRemote('cloudflare-01',claim.job.id,claim.job.token,{payload:{items:[{html_url:'https://github.com/example/agent',full_name:'example/agent',description:'Agent toolkit',stargazers_count:200,updated_at:'2026-11-01',topics:['web3']} ]}});
   assert.equal(report.ok,true);assert.equal(report.candidates,1);
   assert.equal(db.prepare('SELECT COUNT(*) n FROM resources').get().n,0,'remote worker cannot publish');
   assert.equal(engine.reportRemote('cloudflare-01',claim.job.id,claim.job.token,{payload:{items:[]}}).error,'INVALID_LEASE');
   const c=db.prepare('SELECT * FROM autonomy_candidates').get();assert.equal(c.state,'discovered');assert.equal(engine.approveCandidate(c.id,'approve').error,'NOT_REVIEWABLE');
 }finally{if(before===undefined)delete process.env.AUTONOMY_ALLOW_REMOTE;else process.env.AUTONOMY_ALLOW_REMOTE=before;db.close();}
});
