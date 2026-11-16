import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { AutonomyEngine } from './autonomy/engine.js';
import { MeshEconomy } from './economy/core.js';
import { CommunityLayer } from './community/engine.js';
import { WalletLink } from './wallet/link.js';
import { RealmOS } from './realm-os/engine.js';
import { RealmSIWE } from './wallet/siwe.js';
import { CampaignMigration } from './launch/migration.js';
import { AgentAtlas } from './atlas/engine.js';
import { PaidProofAPI } from './native/x402.js';
import { NativeMissions } from './native/missions.js';
import { RealmExecutor } from './realm-os/executor.js';
import { SeekmeshMCP } from './integrations/mcp-server.js';

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
const mesh=new MeshEconomy(db);
const community=new CommunityLayer(db);
const wallet=new WalletLink(db,SITE_URL);
const realmOS=new RealmOS(db,{autonomy,mesh,community});
const siwe=new RealmSIWE(db,SITE_URL,mesh,realmOS);
const migration=new CampaignMigration(db,{community});
const atlas=new AgentAtlas(db,{autonomy});
const paidProof=new PaidProofAPI(db,{baseURL:SITE_URL});
const nativeMissions=new NativeMissions(db);
const executor=new RealmExecutor(db,{os:realmOS,autonomy,atlas,migration,paidProof});
realmOS.executor=executor;realmOS.paidProof=paidProof;realmOS.nativeMissions=nativeMissions;
const mcp=new SeekmeshMCP({search:searchResources,atlas,realmOS,community,paidProof,missions:nativeMissions,baseURL:SITE_URL});

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

function farcasterManifest(){
 const base=SITE_URL;
 const miniapp={version:'1',name:'SEEKMESH',subtitle:'The Web3 Discovery Realm',description:'Discover useful Web3 and AI projects, map real sources, explore guilds and native expeditions.',tagline:'Discover. Prove. Build.',iconUrl:base+'/assets/seekmesh-icon.png',homeUrl:base+'/',imageUrl:base+'/assets/seekmesh-social.png',heroImageUrl:base+'/assets/seekmesh-social.png',ogImageUrl:base+'/assets/seekmesh-social.png',ogTitle:'SEEKMESH Discovery Realm',ogDescription:'A living world of verified discovery.',buttonTitle:'Enter Realm',splashImageUrl:base+'/assets/seekmesh-splash.png',splashBackgroundColor:'#142c51',primaryCategory:'social',tags:['web3','discovery','quests','agents','guilds']};
 const manifest={miniapp};
 try{const a=JSON.parse(process.env.FARCASTER_ACCOUNT_ASSOCIATION||'null');if(a&&typeof a.header==='string'&&typeof a.payload==='string'&&typeof a.signature==='string'&&a.header.length>12&&a.payload.length>12&&a.signature.length>12)manifest.accountAssociation=a}catch{}
 return manifest;
}
function htmlEscape(text){return String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function guildSocialCard(slug){
 if(!/^[a-z0-9-]{3,80}$/.test(String(slug)))return null;
 const g=community.guild(slug);if(!g)return null;
 const title=htmlEscape(g.name+' — SEEKMESH Guild'),about=htmlEscape(g.about.slice(0,220));
 const link=SITE_URL+'/guilds?guild='+encodeURIComponent(slug);
 const embed={version:'1',imageUrl:SITE_URL+'/assets/seekmesh-social.png',button:{title:'Join Guild',action:{type:'launch_miniapp',name:'SEEKMESH',url:link}}};
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title><meta name="theme-color" content="#142c51"><meta property="og:title" content="'+title+'"><meta property="og:description" content="'+about+'"><meta property="og:image" content="'+SITE_URL+'/assets/seekmesh-social.png"><meta name="fc:miniapp" content="'+htmlEscape(JSON.stringify(embed))+'"><link rel="stylesheet" href="/whitepaper.css"></head><body><header class="bar"><div class="width header-inner"><a href="/">◇ SEEKMESH</a><a href="/whitepaper">Protocol ↗</a></div></header><main class="closing"><div class="width"><div class="kicker">REAL BUILDER COMMUNITY</div><h2>'+title+'</h2><p>'+about+'</p><p>'+Number(g.members)+' real members · '+Number(g.signals)+' public signals. No token or investment claims.</p><a class="gold" href="'+htmlEscape(link)+'">Enter this Guild ↗</a></div></main></body></html>';
}
function expeditionCard(id){
 const exp=realmOS.expedition().find(x=>Number(x.id)===Number(id));if(!exp)return null;
 const url=SITE_URL+'/expedition/'+exp.id,app=SITE_URL+'/os?expedition='+exp.id;
 const embed={version:'1',imageUrl:SITE_URL+'/assets/seekmesh-social.png',button:{title:'Enter Expedition',action:{type:'launch_miniapp',name:'SEEKMESH',url:app}}};
 const title=exp.category+' — SEEKMESH Expedition';
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#142c51"><title>'+htmlEscape(title)+'</title><meta property="og:title" content="'+htmlEscape(title)+'"><meta property="og:description" content="Help map real sources. Rewards only on accepted contributions. No unissued token claims."><meta property="og:image" content="'+SITE_URL+'/assets/seekmesh-social.png"><meta name="fc:miniapp" content="'+htmlEscape(JSON.stringify(embed))+'"><link rel="stylesheet" href="/whitepaper.css"></head><body><header class="bar"><div class="width header-inner"><a href="/">◇ SEEKMESH</a><a href="/whitepaper">Protocol ↗</a></div></header><main class="closing"><div class="width"><div class="kicker">SEASON ZERO · VERIFIED DISCOVERY</div><h2>'+htmlEscape(exp.category)+'<em> Expedition</em></h2><p>'+Number(exp.accepted)+' of '+Number(exp.target)+' reviewed contributions recorded. Reward: existing in-app XP and Credits after acceptance; no USDC or SEEK claim implied.</p><a class="gold" href="'+htmlEscape(app)+'">Join this Expedition ↗</a></div></main></body></html>';
}

function getStats() { return {resources: db.prepare('SELECT COUNT(*) n FROM resources').get().n, foundingMembers: db.prepare('SELECT COUNT(*) n FROM waitlist').get().n, communityApproved: db.prepare("SELECT COUNT(*) n FROM resources WHERE source='community'").get().n, earnedPoints: db.prepare('SELECT COALESCE(SUM(amount),0) n FROM points').get().n}; }
function referralCode(){return crypto.randomBytes(6).toString('hex').toUpperCase();}
function workerAuthenticate(req){const k=process.env.AUTONOMY_WORKER_KEY;if(!k||typeof req.headers['x-worker-key']!=='string')return false;const a=Buffer.from(k),b=Buffer.from(req.headers['x-worker-key']);return a.length===b.length&&crypto.timingSafeEqual(a,b);}
function cronAuthenticate(req){const k=process.env.AUTONOMY_CRON_KEY;if(!k||typeof req.headers['x-cron-key']!=='string')return false;const a=Buffer.from(k),b=Buffer.from(req.headers['x-cron-key']);return a.length===b.length&&crypto.timingSafeEqual(a,b);}
function authenticate(req){if(!ADMIN_KEY || typeof req.headers['x-admin-key']!=='string')return false;const expected=Buffer.from(ADMIN_KEY),actual=Buffer.from(req.headers['x-admin-key']);return expected.length===actual.length && crypto.timingSafeEqual(expected,actual);}
function searchResources(q, category){let sql='SELECT id,name,url,description,category,tags,source,approved_at FROM resources WHERE 1=1'; const params=[];if(category && category!=='All' && categories.includes(category)){sql+=' AND category=?';params.push(category);}if(q){const parts=q.toLowerCase().split(/\s+/).filter(Boolean).slice(0,8);for(const p of parts){sql+=' AND (lower(name) LIKE ? OR lower(description) LIKE ? OR lower(tags) LIKE ? OR lower(category) LIKE ?)';for(let i=0;i<4;i++)params.push(`%${p}%`);}}sql+=' ORDER BY CASE source WHEN \'community\' THEN 0 ELSE 1 END, name LIMIT 60';return db.prepare(sql).all(...params);}
function safePublicFile(pathname,res) {
  // Allowlist original artwork assets; no dynamic filesystem paths or directory traversal.
  if(pathname.startsWith('/assets/')){
    const asset=pathname.slice('/assets/'.length);
    if(!/^(?:realm-(?:hero|avatar|missions|explore|guilds|build|rewards|market)\.webp|seekmesh-(?:icon|splash|social)\.png)$/.test(asset))return false;
    const file=path.join(PUBLIC,'assets',asset);
    if(!fs.existsSync(file))return false;
    res.writeHead(200,{'content-type':asset.endsWith('.png')?'image/png':'image/webp','cache-control':'public, max-age=86400','x-content-type-options':'nosniff'});
    fs.createReadStream(file).pipe(res);return true;
  }
  const files={'/':'terminal.html','/migrate':'terminal.html','/atlas':'terminal.html','/os':'terminal.html','/app':'terminal.html','/missions':'terminal.html','/guilds':'terminal.html','/market':'terminal.html','/build':'terminal.html','/partners':'terminal.html','/rewards':'terminal.html','/leaderboard':'terminal.html','/explore':'terminal.html','/old-home':'index.html','/manifesto':'index.html','/whitepaper':'whitepaper.html','/whitepaper.css':'whitepaper.css','/start':'start.html','/start.css':'start.css','/privacy':'privacy.html','/terms':'terms.html','/favicon.svg':'favicon.svg','/styles.css':'styles.css','/legal.css':'legal.css','/app.js':'app.js','/privacy.js':'privacy.js','/openapi.json':'openapi.json','/operator':'operator.html','/operator.js':'operator.js','/operator.css':'operator.css','/terminal.js':'terminal.js','/launch-upgrades.js':'launch-upgrades.js','/terminal.css':'terminal.css'};const f=files[pathname];if(!f)return false;const ext=path.extname(f);const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8'}[ext];res.writeHead(200,{'content-type':mime,'cache-control':ext==='.html'?'no-store':'public, max-age=300','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",'referrer-policy':'strict-origin-when-cross-origin'});fs.createReadStream(path.join(PUBLIC,f)).pipe(res);return true;}
async function llmSummary(query,rows){const base=process.env.LLM_BASE_URL,token=process.env.LLM_API_KEY,model=process.env.LLM_MODEL;if(!base||!token||!model)return null;try{const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),8000);let response;try{response=await fetch(`${base.replace(/\/$/,'')}/chat/completions`,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${token}`},body:JSON.stringify({model,temperature:0.1,max_tokens:180,messages:[{role:'system',content:'You are a factual discovery assistant. Summarize ONLY the supplied sources. Refer to source IDs as [1],[2]. Never claim to have visited sites or verified claims. If insufficient, say so. Max 70 words.'},{role:'user',content:JSON.stringify({query,sources:rows.map((r,i)=>({id:i+1,name:r.name,description:r.description,url:r.url}))})}]}),signal:ctrl.signal});}finally{clearTimeout(t);}if(!response.ok)return null;const obj=await response.json();return clean(obj.choices?.[0]?.message?.content,1200)||null;}catch{return null;}}

export const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,`http://${req.headers.host||'localhost'}`),p=u.pathname;
  if(req.method==='GET'){
    if(p==='/mcp')return j(res,405,{error:'Use stateless Streamable HTTP POST with MCP-Protocol-Version 2026-07-28.'},{allow:'POST'});
    if(p==='/api/health')return j(res,200,{status:'ok',database:'sqlite',version:'0.5.0'});
    if(p==='/.well-known/farcaster.json')return j(res,200,farcasterManifest(),{'cache-control':'public,max-age=300'});
    if(p==='/api/farcaster/status')return j(res,200,{manifestUrl:SITE_URL+'/.well-known/farcaster.json',associated:!!farcasterManifest().accountAssociation,domain:new URL(SITE_URL).hostname,publishing:'account association must be signed by the domain owner; unsigned metadata alone does not publish a Mini App'});
    if(/^\/guild\/[a-z0-9-]{3,80}$/.test(p)){
      const page=guildSocialCard(p.split('/').pop());if(!page)return j(res,404,{error:'Guild not found.'});
      res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'public,max-age=60','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; style-src 'self'; img-src 'self'; script-src 'self'"});return res.end(page);
    }
    if(/^\/expedition\/\d+$/.test(p)){const card=expeditionCard(p.split('/').pop());if(!card)return j(res,404,{error:'Expedition not found'});res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'public,max-age=60','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; style-src 'self'; img-src 'self'; script-src 'self'"});return res.end(card);}

    if(p==='/api/stats')return j(res,200,getStats());
    if(p==='/api/autonomy/status')return j(res,200,autonomy.status());
    if(p==='/api/os/status')return j(res,200,realmOS.public());
    if(p==='/api/os/expeditions')return j(res,200,{expeditions:realmOS.expedition(),notes:'Accepted sources receive existing off-chain XP and credits; no token rewards.'});
    if(p==='/api/migrate')return j(res,200,{campaigns:migration.public(),ownerVerification:'DNS TXT',rewardBalancesImported:false});
    if(p==='/api/migrate/mine'){const user=mesh.auth(req.headers.authorization);return j(res,user?200:401,user?{imports:migration.mine(user)}:{error:'Sign in first.'});}
    if(/^\/api\/migrate\/\d+$/.test(p)){const detail=migration.detail(p.split('/').pop());return j(res,detail?200:404,detail||{error:'No publicly verified campaign.'});}
    if(p==='/api/atlas')return j(res,200,{agents:atlas.list({kind:clean(u.searchParams.get('kind'),16),q:clean(u.searchParams.get('q'),90)}),stats:atlas.stats()});
    if(p==='/api/native/x402/status')return j(res,200,await paidProof.readiness());
    if(p==='/api/native/campaigns')return j(res,200,{campaigns:nativeMissions.list(),status:await nativeMissions.verifiedStatus(),claims:'Only onchain-confirmed funding and payout events count.'});
    if(p==='/api/proof/preview'){const proof=paidProof.preview(u.searchParams.get('id'));return j(res,proof?200:404,proof||{error:'Source missing.'});}
    if(p==='/api/proof/premium')return paidProof.serve(req,res,u);
    if(p==='/api/admin/os'){if(!authenticate(req))return j(res,401,{error:'Unauthorized'});return j(res,200,realmOS.admin());}
    if(p==='/api/graph/summary')return j(res,200,{schema:'seekmesh.graph.v1',...getStats(),autonomy:autonomy.status(),categories:db.prepare('SELECT category,COUNT(*) AS count FROM resources GROUP BY category ORDER BY count DESC').all(),disclaimer:'Editorial seeds are not independent live verifications. Logical shards are not running server processes.'});
    if(p==='/api/graph/feed')return j(res,200,{schema:'seekmesh.discovery.v1',resources:db.prepare('SELECT name,url,description,category,tags,source,approved_at FROM resources ORDER BY approved_at DESC LIMIT 100').all(),disclaimer:'Descriptions are community/editorial; not financial endorsements.'});
    if(p==='/api/admin/autonomy'){if(!authenticate(req))return j(res,401,{error:'Unauthorized'});return j(res,200,autonomy.adminView());}
    if(p==='/api/admin/autonomy/workpackets'){if(!authenticate(req))return j(res,401,{error:'Unauthorized'});return j(res,200,autonomy.workpackets());}
    if(p==='/api/categories')return j(res,200,{categories});
    if(p==='/api/guilds')return j(res,200,{guilds:community.list(mesh.auth(req.headers.authorization)?.id||null)});
    if(p.startsWith('/api/guilds/')){const g=community.guild(p.slice('/api/guilds/'.length),mesh.auth(req.headers.authorization)?.id||null);return j(res,g?200:404,g?{guild:g}:{error:'Guild not found.'});}
    if(p==='/api/admin/mesh/workpackets'){if(!authenticate(req))return j(res,401,{error:'Unauthorized'});return j(res,200,mesh.partnerWorkPackets());}
    if(p==='/api/admin/source-reports'){if(!authenticate(req))return j(res,401,{error:'Unauthorized'});return j(res,200,{reports:community.sourceReports()});}
    if(p==='/api/admin/launch'){if(!authenticate(req))return j(res,401,{error:'Unauthorized'});return j(res,200,community.launchReport());}
    if(p==='/api/admin/guild-posts'){if(!authenticate(req))return j(res,401,{error:'Unauthorized'});return j(res,200,{posts:community.moderation()});}
    if(p==='/api/mesh/stats')return j(res,200,mesh.stats());
    if(p==='/api/mesh/leaderboard')return j(res,200,{members:mesh.leaderboard()});
    if(p==='/api/mesh/spotlights')return j(res,200,{spotlights:mesh.spotlights()});
    if(p==='/api/mesh/me'){const m=mesh.auth(req.headers.authorization);return j(res,m?200:401,m?{member:{...m,walletAddress:wallet.addressFor(m.id)}}:{error:'Sign in first.'});}
    if(p==='/api/mesh/quests')return j(res,200,{season:{name:'Season Zero',starts:'2026-11-15',ends:'2026-12-15'},quests:[
      {id:'join',name:'Activate your node',xp:25,credits:5,type:'once'},
      {id:'daily',name:'Daily discovery pulse',xp:4,credits:2,type:'daily'},
      {id:'orientation',name:'Source-quality primer',xp:20,credits:5,type:'once'},
      {id:'submit',name:'Map a useful source',xp:40,credits:20,type:'review'},
      {id:'invite',name:'Refer a contributor',xp:15,credits:5,type:'qualified'}
    ]});
    if(p==='/api/admin/mesh/sponsors'){if(!authenticate(req))return j(res,401,{error:'Unauthorized'});return j(res,200,{inquiries:mesh.partnerQueue()});}
    if(p==='/api/quests')return j(res,200,{quests});
    if(p==='/api/resources' || p==='/api/discover'){
      const q=clean(u.searchParams.get('q'),140),category=clean(u.searchParams.get('category'),80);
      const resources=searchResources(q,category);
      const out={query:q,category:category||'All',count:resources.length,resources};
      if(p==='/api/discover' && q){out.mode='source-grounded';out.answer=null;if(!limited(req,'llm-discover',15)){out.answer=await llmSummary(q,resources.slice(0,6));if(out.answer)out.mode='ai-synthesis';}else out.rateLimited=true;}
      return j(res,200,out);
    }
    if(p==='/api/leaderboard')return j(res,200,{contributors:db.prepare('SELECT handle, SUM(amount) points, COUNT(*) approvedContributions FROM points GROUP BY lower(email) ORDER BY points DESC, approvedContributions DESC LIMIT 20').all()});
    if(p==='/api/agent.json')return j(res,200,{name:'SEEKMESH',description:'Independent Web3 discovery and agent trust index',version:'1.4.0',api:{search:`${SITE_URL}/api/resources?q=`,categories:`${SITE_URL}/api/categories`,autonomy:`${SITE_URL}/api/autonomy/status`,version:'1.4.0'},mcp:{transport:'streamable-http',protocolVersion:'2026-07-28',url:`${SITE_URL}/mcp`,toolPolicy:'public_read_only'},payments:{protocol:'x402-v2',network:'eip155:8453',proofQuote:`${SITE_URL}/api/proof/preview?id=1`,premium:`${SITE_URL}/api/proof/premium?id=1`},note:'Listings are not audited. Paid reports require verified stablecoin settlement; do not infer a live payment from a 402 challenge.'});
    if(p==='/robots.txt'){res.writeHead(200,{'content-type':'text/plain; charset=utf-8'});return res.end(`User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);}
    if(p==='/sitemap.xml'){res.writeHead(200,{'content-type':'application/xml; charset=utf-8'});return res.end(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE_URL}/</loc></url><url><loc>${SITE_URL}/explore</loc></url><url><loc>${SITE_URL}/manifesto</loc></url><url><loc>${SITE_URL}/whitepaper</loc></url><url><loc>${SITE_URL}/start</loc></url><url><loc>${SITE_URL}/app</loc></url><url><loc>${SITE_URL}/missions</loc></url><url><loc>${SITE_URL}/guilds</loc></url><url><loc>${SITE_URL}/market</loc></url><url><loc>${SITE_URL}/build</loc></url><url><loc>${SITE_URL}/os</loc></url><url><loc>${SITE_URL}/migrate</loc></url><url><loc>${SITE_URL}/atlas</loc></url></urlset>`);}
    if(p==='/api/admin/submissions'){if(!authenticate(req))return j(res,401,{error:'Unauthorized'});return j(res,200,{submissions:db.prepare('SELECT * FROM submissions ORDER BY id DESC LIMIT 200').all()});}
    if(p==='/api/admin/privacy-requests'){if(!authenticate(req))return j(res,401,{error:'Unauthorized'});return j(res,200,{requests:db.prepare('SELECT * FROM privacy_requests ORDER BY id DESC LIMIT 200').all()});}
    if(p==='/api/admin/waitlist'){if(!authenticate(req))return j(res,401,{error:'Unauthorized'});return j(res,200,{waitlist:db.prepare('SELECT id,email,persona,code,referred_by,created_at FROM waitlist ORDER BY id DESC LIMIT 500').all()});}
    if(safePublicFile(p,res))return;return j(res,404,{error:'Not found'});
  }
  if(req.method!=='POST')return j(res,405,{error:'Method not allowed'});
  if(!['/mcp','/api/join','/api/submit','/api/privacy-request','/api/admin/review','/api/migrate/import','/api/migrate/quests','/api/migrate/guild','/api/migrate/verify','/api/atlas/register','/api/atlas/verify','/api/native/campaigns/funding-receipt','/api/native/campaigns/payout-receipt','/api/admin/os/execute','/api/admin/atlas/sync','/api/admin/atlas/probe','/api/admin/os/control','/api/internal/os/tick','/api/admin/autonomy/control','/api/admin/autonomy/source','/api/admin/autonomy/candidate','/api/siwe/challenge','/api/siwe/verify','/api/mesh/register','/api/mesh/login','/api/mesh/logout','/api/mesh/checkin','/api/mesh/orientation','/api/mesh/submit','/api/mesh/redeem','/api/mesh/sponsor','/api/guilds/create','/api/guilds/join','/api/guilds/leave','/api/guilds/post','/api/guilds/report','/api/admin/guild-post','/api/admin/source-report','/api/admin/mesh/sponsor-action','/api/mesh/source-report','/api/mesh/wallet-challenge','/api/mesh/wallet-verify','/api/mesh/wallet-unlink','/api/telemetry','/api/internal/autonomy/tick','/api/internal/autonomy/claim','/api/internal/autonomy/report'].includes(p))return j(res,404,{error:'Not found'});
  if(p.startsWith('/api/admin/')&&!authenticate(req))return j(res,401,{error:'Unauthorized'});
  if(['/api/internal/autonomy/tick','/api/internal/os/tick'].includes(p)&&!cronAuthenticate(req))return j(res,401,{error:'Unauthorized'});
  if(['/api/internal/autonomy/claim','/api/internal/autonomy/report'].includes(p)&&!workerAuthenticate(req))return j(res,401,{error:'Unauthorized'});
  if(!p.startsWith('/api/admin/')&&!p.startsWith('/api/internal/')&&p!=='/api/telemetry'&&limited(req,p,p==='/mcp'?60:8))return j(res,429,{error:'Too many submissions. Please try again later.'});
  try{
    const b=await body(req);
    if(p==='/mcp')return await mcp.handle(req,res,b,SITE_URL);
    if(b.website)return j(res,202,{ok:true,message:'Received.'});
    if(p==='/api/internal/autonomy/tick')return j(res,200,{ok:true,...autonomy.tick(),realmOS:realmOS.pulse()});
    if(p==='/api/internal/os/tick')return j(res,200,realmOS.pulse({force:true}));
    if(p==='/api/admin/os/control'){const out=realmOS.control(b);return j(res,out.error?422:200,out);}
    if(p==='/api/admin/os/execute'){const out=await executor.run(3);return j(res,200,out);}
    if(p==='/api/native/campaigns/funding-receipt'||p==='/api/native/campaigns/payout-receipt'){
      const member=mesh.auth(req.headers.authorization);if(!member)return j(res,401,{error:'Sign in to submit chain transaction proof.'});
      if(limited(req,'chain-tx-verification',8))return j(res,429,{error:'Chain proof rate limited.'});
      const out=p.endsWith('funding-receipt')?await nativeMissions.registerFunding(b.txHash):await nativeMissions.registerPayout(b.txHash);
      return j(res,out.error?422:200,out);
    }
    if(p==='/api/migrate/import'){const member=mesh.auth(req.headers.authorization);if(!member)return j(res,401,{error:'Sign in to import a campaign.'});const out=migration.import(member,b);return j(res,out.error?422:201,out);}
    if(p==='/api/migrate/quests'){const member=mesh.auth(req.headers.authorization);if(!member)return j(res,401,{error:'Sign in to attach quest descriptions.'});const out=migration.addQuests(member,b);return j(res,out.error?422:200,out);}
    if(p==='/api/migrate/guild'){const member=mesh.auth(req.headers.authorization);if(!member)return j(res,401,{error:'Sign in to link your verified project Guild.'});const out=migration.linkGuild(member,b.id);return j(res,out.error?422:200,out);}
    if(p==='/api/migrate/verify'){const member=mesh.auth(req.headers.authorization);if(!member)return j(res,401,{error:'Sign in to verify a project.'});const out=await migration.verify(member,b.id);return j(res,out.error?422:200,out);}
    if(p==='/api/atlas/register'){const member=mesh.auth(req.headers.authorization);if(!member)return j(res,401,{error:'Sign in to declare an agent.'});const out=atlas.register(member,b,wallet.addressFor(member.id));return j(res,out.error?422:201,out);}
    if(p==='/api/atlas/verify'){const member=mesh.auth(req.headers.authorization);if(!member)return j(res,401,{error:'Sign in to verify agent ownership.'});const out=await atlas.verifyERC8004(member,b,wallet.addressFor(member.id));return j(res,out.error?422:200,out);}
    if(p==='/api/admin/atlas/sync'){const out=await atlas.syncMCP();return j(res,out.error?502:200,out);}
    if(p==='/api/admin/atlas/probe'){const out=await atlas.probe(b.id);return j(res,out.error?422:200,out);}
    if(p==='/api/internal/autonomy/claim')return j(res,200,autonomy.claimRemote(clean(b.workerId,64)));
    if(p==='/api/internal/autonomy/report'){const r=autonomy.reportRemote(clean(b.workerId,64),Number(b.jobId),b.token,b.result);return j(res,r.error?409:200,r);}
    if(p==='/api/telemetry'){
      if(limited(req,'aggregate-events',80))return j(res,429,{error:'Telemetry rate limit.'});
      const r=community.track(clean(b.event,35),b.target);return j(res,r.error?422:202,r);
    }
    if(p==='/api/admin/mesh/sponsor-action'){
      const r=mesh.updateSponsor(b);return j(res,r.error?422:200,r);
    }
    if(p==='/api/admin/source-report'){
      const r=community.reviewSourceReport(b.reportId,clean(b.decision,18));return j(res,r.error?409:200,r);
    }
    if(p==='/api/mesh/source-report'){
      const member=mesh.auth(req.headers.authorization);if(!member)return j(res,401,{error:'Sign in to report a source.'});
      const r=community.reportSource(member,b.resourceId,b.reason,b.detail);return j(res,r.error?422:201,r);
    }
    if(p==='/api/admin/guild-post'){
      const r=community.moderatePost(Number(b.postId),clean(b.action,12));return j(res,r.error?422:200,r);
    }
    if(p.startsWith('/api/guilds/')){
      const member=mesh.auth(req.headers.authorization);
      if(!member)return j(res,401,{error:'Sign in to participate in a guild.'});
      const action=p.slice('/api/guilds/'.length);let r;
      if(action==='create')r=community.create(member,b);
      else if(action==='join')r=community.join(member,b.slug);
      else if(action==='leave')r=community.leave(member,b.slug);
      else if(action==='post')r=community.post(member,b.slug,b.body);
      else if(action==='report')r=community.report(member,Number(b.postId),clean(b.reason,30));
      else return j(res,404,{error:'Unknown guild action.'});
      return j(res,r.error?422:action==='create'?201:200,r);
    }
    if(p==='/api/siwe/challenge'){
      if(limited(req,'siwe-challenge',8))return j(res,429,{error:'Too many wallet sign-in challenges.'});
      const out=siwe.challenge(b.address,b.chainId);return j(res,out.error?422:201,out);
    }
    if(p==='/api/siwe/verify'){
      if(limited(req,'siwe-verify',10))return j(res,429,{error:'Too many wallet sign-in attempts.'});
      const out=siwe.verify(b);return j(res,out.error?422:200,out);
    }
    if(p==='/api/mesh/register'){if(limited(req,'mesh-register',4))return j(res,429,{error:'Account creation rate limit reached.'});const out=mesh.register(b);return j(res,out.error?422:201,out);}
    if(p==='/api/mesh/login'){if(limited(req,'mesh-login',12))return j(res,429,{error:'Too many sign-in attempts.'});const out=mesh.login(b);return j(res,out.error?401:200,out);}
    if(p==='/api/mesh/sponsor'){if(limited(req,'mesh-sponsor',3))return j(res,429,{error:'Too many inquiries.'});const out=mesh.sponsor(b);return j(res,out.error?422:201,out);}
    if(p.startsWith('/api/mesh/')){
      const member=mesh.auth(req.headers.authorization);if(!member)return j(res,401,{error:'Sign in to complete this action.'});
      if(p==='/api/mesh/wallet-challenge'){
        const r=wallet.challenge(member,b.address);return j(res,r.error?422:201,r);
      }
      if(p==='/api/mesh/wallet-verify'){
        const r=wallet.verify(member,b.challengeId,b.signature);return j(res,r.error?409:200,r);
      }
      if(p==='/api/mesh/wallet-unlink'){
        const r=wallet.unlink(member,b.password);return j(res,r.error?422:200,r);
      }
      if(p==='/api/mesh/logout')return j(res,200,mesh.logout(req.headers.authorization));
      if(p==='/api/mesh/checkin'){const out=mesh.checkin(member.id);return j(res,out.error?409:200,out);}
      if(p==='/api/mesh/orientation'){const out=mesh.orientation(member.id,b.answer);return j(res,out.error?409:200,out);}
      if(p==='/api/mesh/redeem'){if(b.type!=='spotlight')return j(res,422,{error:'Unknown redemption.'});const out=mesh.redeem(member.id,Number(b.submissionId));return j(res,out.error?409:200,out);}
      if(p==='/api/mesh/submit'){
        const name=clean(b.name,80),url=urlClean(b.url),description=clean(b.description,420),category=clean(b.category,80),tags=clean(b.tags,140);
        if(name.length<3||!url||description.length<25||!categories.includes(category)||category==='All')return j(res,422,{error:'Valid name, URL, category and 25+ character description required.'});
        if(db.prepare('SELECT 1 FROM resources WHERE url=?').get(url)||db.prepare("SELECT 1 FROM submissions WHERE url=? AND state='pending'").get(url))return j(res,409,{error:'Already listed or pending.'});
        const entry=db.prepare('INSERT INTO submissions(name,url,description,category,tags,email,handle) VALUES(?,?,?,?,?,?,?)').run(name,url,description,category,tags,'member-'+member.id+'@mesh.invalid',member.handle);
        const id=Number(entry.lastInsertRowid);db.prepare('INSERT INTO mesh_submission_links(submission_id,member_id) VALUES(?,?)').run(id,member.id);
        return j(res,201,{ok:true,submissionId:id,state:'pending',rewardAfterReview:{xp:40,credits:20}});
      }
    }
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
          mesh.approved(id);
        }
        db.exec('COMMIT');
      }catch(e){db.exec('ROLLBACK');throw e;}
      return j(res,200,{ok:true,id,decision,creditedPoints:decision==='approve'?20:0});
    }
  }catch(e){return j(res,e instanceof SyntaxError?400:e.message==='Payload too large'?413:500,{error:e instanceof SyntaxError?'Invalid JSON':e.message==='Payload too large'?'Payload too large':'Request failed.'});}
});
if(process.env.NODE_ENV!=='test')server.listen(PORT,'0.0.0.0',()=>{console.log(`SEEKMESH listening on ${PORT}`);autonomy.start();realmOS.start();executor.start();});
