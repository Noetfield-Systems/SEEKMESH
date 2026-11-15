import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { AutonomyEngine } from './autonomy/engine.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const PORT = Number(process.env.PORT || 3000);
const SITE_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const LIMIT_WINDOW = 10 * 60 * 1000;
const rate = new Map();
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'seekmesh.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
CREATE TABLE IF NOT EXISTS resources (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, url TEXT NOT NULL UNIQUE,
 description TEXT NOT NULL, category TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '',
 source TEXT NOT NULL DEFAULT 'editorial', contributor TEXT NOT NULL DEFAULT '',
 approved_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS waitlist (
 id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, persona TEXT NOT NULL,
 code TEXT NOT NULL UNIQUE, referred_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
 verified_at TEXT
);
CREATE TABLE IF NOT EXISTS submissions (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, url TEXT NOT NULL,
 description TEXT NOT NULL, category TEXT NOT NULL, tags TEXT NOT NULL,
 email TEXT NOT NULL, handle TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending',
 created_at TEXT NOT NULL DEFAULT (datetime('now')), reviewed_at TEXT
);
CREATE TABLE IF NOT EXISTS privacy_requests (
 id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, request_type TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS points (
 id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, handle TEXT NOT NULL,
 amount INTEGER NOT NULL, reason TEXT NOT NULL, submission_id INTEGER NOT NULL UNIQUE,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_resources_cat ON resources(category);
CREATE INDEX IF NOT EXISTS idx_submissions_state ON submissions(state);
CREATE INDEX IF NOT EXISTS idx_points_email ON points(email);`);
const starter = [
  ['MCP Registry','https://registry.modelcontextprotocol.io/','The official open registry for discovering MCP servers and agent-connected tools.','Agent Infrastructure','MCP,Registry,Discovery'],
  ['Hugging Face','https://huggingface.co/','A collaborative hub for open AI models, datasets, and machine learning applications.','AI & Models','Models,Open Source,Community'],
  ['Ethereum','https://ethereum.org/','Public ecosystem documentation for Ethereum, smart contracts, and decentralized applications.','Protocols','Blockchain,Developers,EVM'],
  ['Base','https://www.base.org/','An Ethereum Layer 2 ecosystem for onchain applications and builders.','Protocols','Layer 2,Builders,Onchain'],
  ['GitHub','https://github.com/','Developer collaboration, repositories, code hosting, and open-source discovery.','Builders','Code,Open Source,Development'],
  ['Farcaster','https://www.farcaster.xyz/','An open social protocol and ecosystem for community-driven applications.','Communities','Social,Onchain,Creators'],
  ['Brave Search','https://search.brave.com/','A web search engine built around an independent index and privacy-focused discovery.','Search & Data','Search,Privacy,Index'],
  ['Kaito','https://kaito.ai/','AI-powered discovery, research, and intelligence for the Web3 information ecosystem.','Search & Data','Web3,Research,AI'],
  ['Dune','https://dune.com/','Community-built dashboards and SQL analytics for blockchain data.','Search & Data','Analytics,Onchain,Data'],
  ['Gitcoin','https://www.gitcoin.co/','Funding and community coordination for public goods in the Ethereum ecosystem.','Communities','Public Goods,Grants,Builders'],
  ['ENS','https://ens.domains/','Open naming infrastructure for Ethereum identities, names, and applications.','Protocols','Identity,Domains,Web3'],
  ['DefiLlama','https://defillama.com/','Open dashboards and data tools tracking activity across decentralized finance.','Search & Data','DeFi,Analytics,Markets'],
  ['Optimism','https://www.optimism.io/','An Ethereum scaling ecosystem and open-source development community.','Protocols','Scaling,Layer 2,Builders'],
  ['Arweave','https://www.arweave.org/','A decentralized data-storage network and permanent information ecosystem.','Protocols','Storage,Data,Web3'],
  ['Model Context Protocol','https://modelcontextprotocol.io/','Open standard for connecting AI applications to tools, data and capabilities.','Agent Infrastructure','Agents,MCP,Interoperability'],
  ['Uniswap','https://uniswap.org/','A decentralized trading protocol and open onchain developer ecosystem.','Protocols','DeFi,Exchange,Builders']
];
const insertStarter = db.prepare('INSERT OR IGNORE INTO resources (name,url,description,category,tags,source) VALUES (?,?,?,?,?,?)');
for (const item of starter) insertStarter.run(...item, 'editorial');
const autonomy=new AutonomyEngine(db);

const categories = ['All','AI & Models','Agent Infrastructure','Protocols','Communities','Builders','Search & Data'];
const quests = [
  {id:'submit', title:'Map the next internet', description:'Suggest a genuinely useful resource. Approved contributions receive reputation points.', points:20, status:'active'},
  {id:'founding', title:'Join the founding network', description:'Reserve your founding member profile and invite code. No token entitlement is implied.', points:0, status:'active'},
  {id:'review', title:'Verify what matters', description:'Peer source reviews and independent freshness checks.', points:10, status:'planned'},
  {id:'curate', title:'Build a discovery collection', description:'Create a public, reusable map of resources for a specific community.', points:25, status:'planned'}
];
function j(res, status, body, extra = {}) { res.writeHead(status, {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...extra});res.end(JSON.stringify(body)); }
function clientIp(req) { return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim().slice(0,80); }
function limited(req, kind, max=8) { const k=`${kind}:${clientIp(req)}`; const now=Date.now(); let v=rate.get(k); if(!v || v.until<now) v={n:0,until:now+LIMIT_WINDOW};v.n++;rate.set(k,v); if(rate.size>5000) for(const [key,obj] of rate) if(obj.until<now) rate.delete(key);return v.n>max; }
function clean(s, len=200) { return String(s || '').trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,len); }
function emailValid(s){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length < 255; }
function urlClean(s){try { const u=new URL(String(s)); if(!['http:','https:'].includes(u.protocol) || !u.hostname.includes('.') || u.username || u.password)return null;u.hash='';return u.toString();}catch{return null;} }
async function body(req) { let b=''; for await(const chunk of req){b+=chunk.toString();if(b.length>16000) throw new Error('Payload too large');}return JSON.parse(b||'{}'); }
function getStats() { return {resources: db.prepare('SELECT COUNT(*) n FROM resources').get().n, foundingMembers: db.prepare('SELECT COUNT(*) n FROM waitlist').get().n, communityApproved: db.prepare("SELECT COUNT(*) n FROM resources WHERE source='community'").get().n, earnedPoints: db.prepare('SELECT COALESCE(SUM(amount),0) n FROM points').get().n}; }
function referralCode(){return crypto.randomBytes(6).toString('hex').toUpperCase();}
function workerAuthenticate(req){const k=process.env.AUTONOMY_WORKER_KEY;if(!k||typeof req.headers['x-worker-key']!=='string')return false;const a=Buffer.from(k),b=Buffer.from(req.headers['x-worker-key']);return a.length===b.length&&crypto.timingSafeEqual(a,b);}
function cronAuthenticate(req){const k=process.env.AUTONOMY_CRON_KEY;if(!k||typeof req.headers['x-cron-key']!=='string')return false;const a=Buffer.from(k),b=Buffer.from(req.headers['x-cron-key']);return a.length===b.length&&crypto.timingSafeEqual(a,b);}
function authenticate(req){if(!ADMIN_KEY || typeof req.headers['x-admin-key']!=='string')return false;const expected=Buffer.from(ADMIN_KEY),actual=Buffer.from(req.headers['x-admin-key']);return expected.length===actual.length && crypto.timingSafeEqual(expected,actual);}
function searchResources(q, category){let sql='SELECT id,name,url,description,category,tags,source FROM resources WHERE 1=1'; const params=[];if(category && category!=='All' && categories.includes(category)){sql+=' AND category=?';params.push(category);}if(q){const parts=q.toLowerCase().split(/\s+/).filter(Boolean).slice(0,8);for(const p of parts){sql+=' AND (lower(name) LIKE ? OR lower(description) LIKE ? OR lower(tags) LIKE ? OR lower(category) LIKE ?)';for(let i=0;i<4;i++)params.push(`%${p}%`);}}sql+=' ORDER BY CASE source WHEN \'community\' THEN 0 ELSE 1 END, name LIMIT 60';return db.prepare(sql).all(...params);}
function safePublicFile(pathname,res) {const files={'/':'index.html','/explore':'index.html','/manifesto':'index.html','/start':'start.html','/start.css':'start.css','/privacy':'privacy.html','/terms':'terms.html','/favicon.svg':'favicon.svg','/styles.css':'styles.css','/legal.css':'legal.css','/app.js':'app.js','/privacy.js':'privacy.js','/openapi.json':'openapi.json','/operator':'operator.html','/operator.js':'operator.js','/operator.css':'operator.css'};const f=files[pathname];if(!f)return false;const ext=path.extname(f);const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8'}[ext];res.writeHead(200,{'content-type':mime,'cache-control':ext==='.html'?'no-store':'public, max-age=300','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",'referrer-policy':'strict-origin-when-cross-origin'});fs.createReadStream(path.join(PUBLIC,f)).pipe(res);return true;}
async function llmSummary(query,rows){const base=process.env.LLM_BASE_URL,token=process.env.LLM_API_KEY,model=process.env.LLM_MODEL;if(!base||!token||!model)return null;try{const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),8000);let response;try{response=await fetch(`${base.replace(/\/$/,'')}/chat/completions`,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${token}`},body:JSON.stringify({model,temperature:0.1,max_tokens:180,messages:[{role:'system',content:'You are a factual discovery assistant. Summarize ONLY the supplied sources. Refer to source IDs as [1],[2]. Never claim to have visited sites or verified claims. If insufficient, say so. Max 70 words.'},{role:'user',content:JSON.stringify({query,sources:rows.map((r,i)=>({id:i+1,name:r.name,description:r.description,url:r.url}))})}]}),signal:ctrl.signal});}finally{clearTimeout(t);}if(!response.ok)return null;const obj=await response.json();return clean(obj.choices?.[0]?.message?.content,1200)||null;}catch{return null;}}

export const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,`http://${req.headers.host||'localhost'}`),p=u.pathname;
  if(req.method==='GET'){
    if(p==='/api/health')return j(res,200,{status:'ok',database:'sqlite',version:'0.4.0'});
    if(p==='/api/stats')return j(res,200,getStats());
    if(p==='/api/autonomy/status')return j(res,200,autonomy.status());
    if(p==='/api/graph/summary')return j(res,200,{schema:'seekmesh.graph.v1',...getStats(),autonomy:autonomy.status(),categories:db.prepare('SELECT category,COUNT(*) AS count FROM resources GROUP BY category ORDER BY count DESC').all(),disclaimer:'Editorial seeds are not independent live verifications. Logical shards are not running server processes.'});
    if(p==='/api/graph/feed')return j(res,200,{schema:'seekmesh.discovery.v1',resources:db.prepare('SELECT name,url,description,category,tags,source,approved_at FROM resources ORDER BY approved_at DESC LIMIT 100').all(),disclaimer:'Descriptions are community/editorial; not financial endorsements.'});
    if(p==='/api/admin/autonomy'){if(!authenticate(req))return j(res,401,{error:'Unauthorized'});return j(res,200,autonomy.adminView());}
    if(p==='/api/admin/autonomy/workpackets'){if(!authenticate(req))return j(res,401,{error:'Unauthorized'});return j(res,200,autonomy.workpackets());}
    if(p==='/api/categories')return j(res,200,{categories});
    if(p==='/api/quests')return j(res,200,{quests});
    if(p==='/api/resources' || p==='/api/discover'){
      const q=clean(u.searchParams.get('q'),140),category=clean(u.searchParams.get('category'),80);
      const resources=searchResources(q,category);
      const out={query:q,category:category||'All',count:resources.length,resources};
      if(p==='/api/discover' && q){out.mode='source-grounded';out.answer=null;if(!limited(req,'llm-discover',15)){out.answer=await llmSummary(q,resources.slice(0,6));if(out.answer)out.mode='ai-synthesis';}else out.rateLimited=true;}
      return j(res,200,out);
    }
    if(p==='/api/leaderboard')return j(res,200,{contributors:db.prepare('SELECT handle, SUM(amount) points, COUNT(*) approvedContributions FROM points GROUP BY lower(email) ORDER BY points DESC, approvedContributions DESC LIMIT 20').all()});
    if(p==='/api/agent.json')return j(res,200,{name:'SeekMesh',description:'Community-curated discovery graph for humans and agents',api:{search:`${SITE_URL}/api/resources?q=`,categories:`${SITE_URL}/api/categories`,autonomy:`${SITE_URL}/api/autonomy/status`,version:'0.4.0'},note:'Source listings are descriptive and are not independently verified live.'});
    if(p==='/robots.txt'){res.writeHead(200,{'content-type':'text/plain; charset=utf-8'});return res.end(`User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);}
    if(p==='/sitemap.xml'){res.writeHead(200,{'content-type':'application/xml; charset=utf-8'});return res.end(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE_URL}/</loc></url><url><loc>${SITE_URL}/explore</loc></url><url><loc>${SITE_URL}/manifesto</loc></url><url><loc>${SITE_URL}/start</loc></url></urlset>`);}
    if(p==='/api/admin/submissions'){if(!authenticate(req))return j(res,401,{error:'Unauthorized'});return j(res,200,{submissions:db.prepare('SELECT * FROM submissions ORDER BY id DESC LIMIT 200').all()});}
    if(p==='/api/admin/privacy-requests'){if(!authenticate(req))return j(res,401,{error:'Unauthorized'});return j(res,200,{requests:db.prepare('SELECT * FROM privacy_requests ORDER BY id DESC LIMIT 200').all()});}
    if(p==='/api/admin/waitlist'){if(!authenticate(req))return j(res,401,{error:'Unauthorized'});return j(res,200,{waitlist:db.prepare('SELECT id,email,persona,code,referred_by,created_at FROM waitlist ORDER BY id DESC LIMIT 500').all()});}
    if(safePublicFile(p,res))return;return j(res,404,{error:'Not found'});
  }
  if(req.method!=='POST')return j(res,405,{error:'Method not allowed'});
  if(!['/api/join','/api/submit','/api/privacy-request','/api/admin/review','/api/admin/autonomy/control','/api/admin/autonomy/source','/api/admin/autonomy/candidate','/api/internal/autonomy/tick','/api/internal/autonomy/claim','/api/internal/autonomy/report'].includes(p))return j(res,404,{error:'Not found'});
  if(p.startsWith('/api/admin/')&&!authenticate(req))return j(res,401,{error:'Unauthorized'});
  if(p==='/api/internal/autonomy/tick'&&!cronAuthenticate(req))return j(res,401,{error:'Unauthorized'});
  if(['/api/internal/autonomy/claim','/api/internal/autonomy/report'].includes(p)&&!workerAuthenticate(req))return j(res,401,{error:'Unauthorized'});
  if(!p.startsWith('/api/admin/')&&!p.startsWith('/api/internal/')&&limited(req,p))return j(res,429,{error:'Too many submissions. Please try again later.'});
  try{
    const b=await body(req);if(b.website)return j(res,202,{ok:true,message:'Received.'});
    if(p==='/api/internal/autonomy/tick')return j(res,200,{ok:true,...autonomy.tick()});
    if(p==='/api/internal/autonomy/claim')return j(res,200,autonomy.claimRemote(clean(b.workerId,64)));
    if(p==='/api/internal/autonomy/report'){const r=autonomy.reportRemote(clean(b.workerId,64),Number(b.jobId),b.token,b.result);return j(res,r.error?409:200,r);}
    if(p==='/api/admin/autonomy/control'){
      if(b.action==='pause')return j(res,200,autonomy.setPaused(true));
      if(b.action==='resume')return j(res,200,autonomy.setPaused(false));
      if(b.action==='tick')return j(res,200,{ok:true,...autonomy.tick()});
      return j(res,422,{error:'Invalid control action'});
    }
    if(p==='/api/admin/autonomy/source'){const result=autonomy.addSource(b);return j(res,result.error?422:200,result);}
    if(p==='/api/admin/autonomy/candidate'){const result=autonomy.approveCandidate(Number(b.id),b.decision);return j(res,result.error?409:200,result);}
    if(p==='/api/privacy-request'){
      const email=clean(b.email,255).toLowerCase(), requestType=clean(b.requestType,20);
      if(!emailValid(email)||!['export','delete'].includes(requestType))return j(res,422,{error:'Enter a valid email and request type.'});
      const record=db.prepare('INSERT INTO privacy_requests(email,request_type) VALUES(?,?)').run(email,requestType);
      return j(res,201,{ok:true,requestId:Number(record.lastInsertRowid),notice:'Request recorded for identity verification and manual handling.'});
    }
    if(p==='/api/join'){
      const email=clean(b.email,255).toLowerCase(),persona=clean(b.persona,40)||'Explorer',ref=clean(b.ref,30).toUpperCase();
      if(!emailValid(email))return j(res,422,{error:'Enter a valid email address.'});
      if(b.consent!==true)return j(res,422,{error:'Consent to founding-network contact is required.'});
      if(!['Explorer','Builder','Curator','Agent Developer','Community','Partner'].includes(persona))return j(res,422,{error:'Choose a valid role.'});
      const existing=db.prepare('SELECT code FROM waitlist WHERE email=?').get(email);
      if(existing)return j(res,200,{ok:true,alreadyJoined:true,notice:'Email already registered. Invite-link recovery requires email verification.'});
      const inviter=ref?db.prepare('SELECT id,code FROM waitlist WHERE code=?').get(ref):null;
      const code=referralCode();db.prepare('INSERT INTO waitlist(email,persona,code,referred_by) VALUES (?,?,?,?)').run(email,persona,code,inviter?.code||null);
      return j(res,201,{ok:true,code,inviteUrl:`${SITE_URL}/?ref=${code}`,notice:'Founding registration recorded. Email verification and token rewards are not active.'});
    }
    if(p==='/api/submit'){
      const name=clean(b.name,80),url=urlClean(b.url),description=clean(b.description,420),category=clean(b.category,80),email=clean(b.email,255).toLowerCase(),handle=clean(b.handle,30).replace(/[<>]/g,''),tags=clean(b.tags,140);
      if(name.length<3||!url||description.length<25||!categories.includes(category)||category==='All'||!emailValid(email)||handle.length<2)return j(res,422,{error:'Complete all fields with a valid URL, email, category, and description (25+ characters).'});
      if(db.prepare('SELECT 1 FROM resources WHERE url=?').get(url))return j(res,409,{error:'This resource is already in the index.'});
      if(db.prepare("SELECT 1 FROM submissions WHERE url=? AND state='pending'").get(url))return j(res,409,{error:'This resource is already awaiting review.'});
      const r=db.prepare('INSERT INTO submissions(name,url,description,category,tags,email,handle) VALUES (?,?,?,?,?,?,?)').run(name,url,description,category,tags,email,handle);
      return j(res,201,{ok:true,submissionId:Number(r.lastInsertRowid),state:'pending',message:'Submitted for human review. Points are credited only if approved.'});
    }
    if(p==='/api/admin/review'){
      const id=Number(b.id),decision=clean(b.decision,20);
      if(!Number.isSafeInteger(id)||id<1||!['approve','reject'].includes(decision))return j(res,422,{error:'Valid id and decision required.'});
      const row=db.prepare('SELECT * FROM submissions WHERE id=?').get(id);
      if(!row||row.state!=='pending')return j(res,409,{error:'Submission not pending.'});
      if(decision==='approve'&&db.prepare('SELECT id FROM resources WHERE url=?').get(row.url))return j(res,409,{error:'Resource already indexed.'});
      db.exec('BEGIN IMMEDIATE');try{
        db.prepare('UPDATE submissions SET state=?,reviewed_at=datetime(\'now\') WHERE id=?').run(decision==='approve'?'approved':'rejected',id);
        if(decision==='approve'){
          db.prepare('INSERT INTO resources(name,url,description,category,tags,source,contributor) VALUES(?,?,?,?,?,?,?)').run(row.name,row.url,row.description,row.category,row.tags,'community',row.handle);
          db.prepare('INSERT INTO points(email,handle,amount,reason,submission_id) VALUES(?,?,?,?,?)').run(row.email,row.handle,20,'approved-resource',id);
        }
        db.exec('COMMIT');
      }catch(e){db.exec('ROLLBACK');throw e;}
      return j(res,200,{ok:true,id,decision,creditedPoints:decision==='approve'?20:0});
    }
  }catch(e){return j(res,e instanceof SyntaxError?400:e.message==='Payload too large'?413:500,{error:e instanceof SyntaxError?'Invalid JSON':e.message==='Payload too large'?'Payload too large':'Request failed.'});}
});
if(process.env.NODE_ENV!=='test')server.listen(PORT,'0.0.0.0',()=>{console.log(`SEEKMESH listening on ${PORT}`);autonomy.start();});
