// SEEKMESH Agent Trust Atlas: actual provenance, never invented trust ratings.
import {getAddress} from 'ethers';
const clean=(x,max=320)=>String(x??'').trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max);
const IDENTITY_REGISTRY={8453:'0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',84532:'0x8004A818BFB912233c491871b3d84c89A494BD9e'};
const sig='0x6352211e'; // ERC721 ownerOf(uint256)
const now=()=>new Date().toISOString();
function publicURL(input){try{const u=new URL(String(input));if(u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.')||u.hostname.endsWith('.local')||/^(localhost|127\.|10\.|192\.168\.)/.test(u.hostname))return null;return u.toString()}catch{return null}}
async function readJSON(url,{method='GET',body}={}){
 const r=await fetch(url,{method,headers:{'content-type':'application/json','user-agent':'SEEKMESH-Atlas/1.0'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(7000)});
 if(!r.ok)throw Error('Source replied '+r.status);
 const raw=await r.text();if(raw.length>220000)throw Error('Source response too large');
 return JSON.parse(raw);
}
export class AgentAtlas{
 constructor(db,{autonomy}={}){
  this.db=db;this.autonomy=autonomy;
  db.exec([
   "CREATE TABLE IF NOT EXISTS atlas_agents(id INTEGER PRIMARY KEY AUTOINCREMENT,kind TEXT NOT NULL,external_id TEXT NOT NULL,display_name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',homepage TEXT,source_url TEXT,endpoint TEXT,chain_id INTEGER,token_id TEXT,owner_wallet TEXT,origin TEXT NOT NULL,owner_proof TEXT NOT NULL DEFAULT 'unverified',endpoint_proof TEXT NOT NULL DEFAULT 'unmeasured',http_status INTEGER,latency_ms INTEGER,last_checked_at TEXT,created_at TEXT NOT NULL DEFAULT (datetime('now')),updated_at TEXT NOT NULL DEFAULT (datetime('now')),UNIQUE(kind,external_id))",
   "CREATE TABLE IF NOT EXISTS atlas_jobs(id INTEGER PRIMARY KEY AUTOINCREMENT,job_kind TEXT NOT NULL,source TEXT NOT NULL,items_seen INTEGER NOT NULL DEFAULT 0,items_added INTEGER NOT NULL DEFAULT 0,success INTEGER NOT NULL DEFAULT 0,note TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT (datetime('now')))"
  ].join(';')+';');
 }
 record(x){
  this.db.prepare("INSERT INTO atlas_agents(kind,external_id,display_name,description,homepage,source_url,endpoint,chain_id,token_id,owner_wallet,origin,owner_proof) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(kind,external_id) DO UPDATE SET display_name=excluded.display_name,description=excluded.description,homepage=excluded.homepage,source_url=excluded.source_url,endpoint=excluded.endpoint,updated_at=datetime('now')").run(x.kind,x.external_id,clean(x.name,100),clean(x.description,600),x.homepage||null,x.source_url||null,x.endpoint||null,x.chain_id||null,x.token_id||null,x.owner_wallet||null,x.origin,x.owner_proof||'unverified');
 }
 list({kind,q,limit=50}={}){
  const params=[],parts=['1=1'];
  if(['mcp','erc8004','x402'].includes(kind)){parts.push('kind=?');params.push(kind)}
  if(q){parts.push('(lower(display_name) LIKE ? OR lower(description) LIKE ?)');params.push('%'+clean(q,90).toLowerCase()+'%','%'+clean(q,90).toLowerCase()+'%')}
  params.push(Math.max(1,Math.min(75,Number(limit)||50)));
  return this.db.prepare('SELECT id,kind,external_id,display_name,description,homepage,source_url,endpoint,chain_id,token_id,owner_wallet,origin,owner_proof,endpoint_proof,http_status,latency_ms,last_checked_at,updated_at FROM atlas_agents WHERE '+parts.join(' AND ')+' ORDER BY CASE owner_proof WHEN \'eip155_verified\' THEN 0 ELSE 1 END, updated_at DESC,id DESC LIMIT ?').all(...params);
 }
 stats(){return {total:this.db.prepare('SELECT COUNT(*) n FROM atlas_agents').get().n,byKind:this.db.prepare('SELECT kind,COUNT(*) n FROM atlas_agents GROUP BY kind').all(),verifiedWallets:this.db.prepare("SELECT COUNT(*) n FROM atlas_agents WHERE owner_proof='eip155_verified'").get().n,claims:'Registry listing and onchain ownership are distinct from agent security audits.'};}
 async syncMCP(){
  if(this.db.prepare("SELECT 1 FROM atlas_jobs WHERE job_kind='mcp' AND success=1 AND created_at>=datetime('now','-45 minutes')").get())return {ok:true,skipped:'cooldown_45_minutes'};
  const address='https://registry.modelcontextprotocol.io/v0.1/servers?limit=50&version=latest';
  let d;try{d=await readJSON(address)}catch(e){return {error:'Official MCP Registry unavailable: '+clean(e.message,120)};}
  const rows=Array.isArray(d.servers)?d.servers:[];let added=0;
  for(const entry of rows.slice(0,50)){
   const row=entry.server||entry;const name=clean(row.name,150);if(name.length<3)continue;
   const website=publicURL(row.websiteUrl)||publicURL(row.repository?.url)||null;
   const desc=clean(row.description,600);
   const packages=Array.isArray(row.packages)?row.packages:[],remotes=Array.isArray(row.remotes)?row.remotes:[];
   const endpoint=publicURL(remotes.find(x=>x.type==='streamable-http'||x.type==='sse')?.url)||null;
   const external_id=name.toLowerCase();
   if(!this.db.prepare('SELECT 1 FROM atlas_agents WHERE kind=? AND external_id=?').get('mcp',external_id))added++;
   this.record({kind:'mcp',external_id,name,description:desc,homepage:website,source_url:address,endpoint,origin:'official_mcp_registry_v0.1',owner_proof:'registry_published_not_wallet_verified'});
  }
  this.db.prepare('INSERT INTO atlas_jobs(job_kind,source,items_seen,items_added,success,note) VALUES(?,?,?,?,1,?)').run('mcp',address,rows.length,added,'Official latest version metadata; registry listing is not independent safety validation');
  return {ok:true,seen:rows.length,added,source:address,verifiedSafety:false};
 }
 register(member,input,walletAddress){
  if(!walletAddress)return {error:'Verify a wallet in your account before claiming an agent.'};
  const kind=clean(input.kind,20);
  if(!['erc8004','x402'].includes(kind))return {error:'Only ERC-8004 and x402 self-declarations are supported; MCP is synced from the official registry.'};
  const homepage=publicURL(input.homepage),endpoint=input.endpoint?publicURL(input.endpoint):null;
  const name=clean(input.name,100),description=clean(input.description,600);
  if(!homepage||name.length<4||description.length<30||input.endpoint&&!endpoint)return {error:'Provide an HTTPS homepage, name, and 30+ character description.'};
  const chain=Number(input.chainId||8453),tokenId=String(input.tokenId||'');
  if(kind==='erc8004'&&(!IDENTITY_REGISTRY[chain]||!/^\d{1,40}$/.test(tokenId)))return {error:'ERC-8004 requires a Base or Base Sepolia token ID.'};
  const ext=kind==='erc8004'?chain+':'+tokenId:homepage;
  const existing=this.db.prepare('SELECT id FROM atlas_agents WHERE kind=? AND external_id=?').get(kind,ext);
  if(existing)return {error:'This agent is already listed; request a verified ownership update.'};
  this.record({kind,external_id:ext,name,description,homepage,endpoint,source_url:kind==='erc8004'?'https://github.com/erc-8004/erc-8004-contracts':'self-declared',origin:'member_proposal',chain_id:chain,token_id:tokenId,owner_wallet:walletAddress,owner_proof:'self_reported'});
  return {ok:true,kind,externalId:ext,state:'self_reported',warning:'Wallet session is not onchain registry ownership proof. Verification requires RPC ownerOf.'};
 }
 async verifyERC8004(member,input,walletAddress){
  if(!walletAddress)return {error:'Sign in and link the claimant wallet.'};
  const id=Number(input.id);
  const row=this.db.prepare("SELECT * FROM atlas_agents WHERE id=? AND kind='erc8004'").get(id);
  if(!row||row.owner_wallet?.toLowerCase()!==walletAddress.toLowerCase())return {error:'Agent claim not linked to this wallet.'};
  const rpc=row.chain_id===84532?process.env.BASE_SEPOLIA_RPC_URL:process.env.BASE_RPC_URL;
  if(!rpc||!/^https:\/\//.test(rpc))return {error:'Verified Base RPC not configured; cannot claim onchain ownership.'};
  const token=BigInt(row.token_id);
  const data=sig+token.toString(16).padStart(64,'0');
  let x;
  try{x=await readJSON(rpc,{method:'POST',body:{jsonrpc:'2.0',id:1,method:'eth_call',params:[{to:IDENTITY_REGISTRY[row.chain_id],data},'latest']}})}catch(e){return {error:'RPC owner lookup failed: '+clean(e.message,100)}}
  if(!/^0x[0-9a-fA-F]{64}$/.test(x.result||''))return {error:'No valid ERC-721 ownerOf response.'};
  let owner;try{owner=getAddress('0x'+x.result.slice(-40))}catch{return {error:'Malformed onchain owner result.'}}
  if(owner.toLowerCase()!==walletAddress.toLowerCase())return {error:'Onchain ownerOf does not match signed-in wallet.'};
  this.db.prepare("UPDATE atlas_agents SET owner_proof='eip155_verified',updated_at=datetime('now') WHERE id=?").run(id);
  return {ok:true,id,chainId:row.chain_id,owner,registry:IDENTITY_REGISTRY[row.chain_id],verification:'onchain_ownerOf',securityAudited:false};
 }
 async autoProbe(limit=1){
  if(process.env.ATLAS_AUTO_PROBE==='false')return {ok:true,measured:0,reason:'disabled'};
  if(!this.autonomy?.request)return {ok:false,measured:0,error:'Safe crawler unavailable'};
  // Never run a blanket network scanner or treat availability as an audit.
  const n=this.db.prepare("SELECT COUNT(*) n FROM atlas_agents WHERE origin='official_mcp_registry_v0.1' AND last_checked_at>=datetime('now','start of day')").get().n;
  const slots=Math.max(0,5-n);
  if(!slots)return {ok:true,measured:0,reason:'five_daily_http_observations_cap'};
  const rows=this.db.prepare("SELECT id,endpoint FROM atlas_agents WHERE kind='mcp' AND origin='official_mcp_registry_v0.1' AND endpoint IS NOT NULL AND (last_checked_at IS NULL OR last_checked_at<datetime('now','-7 days')) ORDER BY CASE WHEN last_checked_at IS NULL THEN 0 ELSE 1 END, id ASC LIMIT ?").all(Math.min(slots,Math.max(1,Math.min(2,Number(limit)||1))));
  const outputs=[];
  for(const row of rows){
   let checked;
   try{checked=await this.probe(row.id)}
   catch(e){checked={error:clean(e.message,100)};}
   if(checked.error){
    this.db.prepare("UPDATE atlas_agents SET endpoint_proof='probe_error',http_status=NULL,last_checked_at=datetime('now'),updated_at=datetime('now') WHERE id=?").run(row.id);
    outputs.push({id:row.id,status:'probe_error',evidence:'safe_fetch_error',detail:clean(checked.error,120)});
   }else{
    outputs.push({id:row.id,status:checked.status,latencyMs:checked.latencyMs,evidence:'actual_bounded_http_request_not_security_audit'});
   }
  }
  return {ok:true,measured:outputs.length,results:outputs,remainingToday:Math.max(0,slots-outputs.length),securityAudited:false};
 }
 async probe(id){
  const row=this.db.prepare('SELECT * FROM atlas_agents WHERE id=?').get(Number(id));if(!row)return {error:'Agent missing.'};
  if(!row.endpoint)return {error:'No declared endpoint.'};
  // Existing autonomy request enforces SSRF/robots/host rules and request budgets.
  if(!this.autonomy?.request)return {error:'Bounded network inspector unavailable.'};
  const start=Date.now();let result;
  try{result=await this.autonomy.request(row.endpoint,{kind:'audit',maxBytes:10000})}catch(e){return {error:'Safe-fetched probe failed: '+clean(e.message,100)}}
  const latency=Date.now()-start,code=Number(result.status||0);
  const state=code>=200&&code<500?'http_responded':'http_failed';
  this.db.prepare("UPDATE atlas_agents SET endpoint_proof=?,http_status=?,latency_ms=?,last_checked_at=datetime('now') WHERE id=?").run(state,code,latency,id);
  return {ok:true,id,status:code,latencyMs:latency,proof:'HTTP observation only; does not demonstrate correct tools, security, owner, or reliability'};
 }
}
