/**
 * SEEKMESH MCP 2026-07-28, stateless Streamable HTTP endpoint.
 * Public read-only tools; no wallet signing, payment simulation or private data.
 * Each JSON-RPC request is a separate POST with matching request metadata headers.
 */
const PROTOCOL='2026-07-28';
const noStore={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const tools=[
 {name:'search_sources',title:'Search Verified-Label Discovery Index',description:'Find source-linked Web3 and AI projects. Editorial entries are not independent security audits.',inputSchema:{type:'object',properties:{query:{type:'string',maxLength:100,description:'Search term'},category:{type:'string',maxLength:70},limit:{type:'integer',minimum:1,maximum:20}}}},
 {name:'search_agent_atlas',title:'Find MCP, ERC-8004 and x402 Agents',description:'Search source-labelled agent registry entries, separating self-reports, HTTP observations and real ERC-8004 ownership proofs.',inputSchema:{type:'object',properties:{query:{type:'string',maxLength:90},kind:{type:'string',enum:['mcp','erc8004','x402']},limit:{type:'integer',minimum:1,maximum:25}}}},
 {name:'get_live_expeditions',title:'List Live Discovery Expeditions',description:'Read actual accepted/pending source contributions and weekly categories; off-chain XP is not a token or USDC claim.',inputSchema:{type:'object',properties:{}}},
 {name:'get_guilds',title:'Find Real Builder Guilds',description:'See real Guild membership and verified public participation from the live Realm. No fabricated accounts.',inputSchema:{type:'object',properties:{}}},
 {name:'get_source_proof_quote',title:'Quote a Paid Proof Intelligence Report',description:'Read a public preview and exact 0.05 USDC x402 payment endpoint; does not unlock or execute the paid report.',inputSchema:{type:'object',properties:{source_id:{type:'integer',minimum:1}},required:['source_id']}},
 {name:'get_native_market_status',title:'Inspect USDC Escrow and x402 Market Evidence',description:'Show independently verified campaign-funding receipts, payout count, paid API settlement count and required activation conditions.',inputSchema:{type:'object',properties:{}}}
];
const strip=s=>String(s??'').replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,150);
const rpcError=(id,code,message,data)=>({jsonrpc:'2.0',id:id??null,error:{code,message,...(data?{data}:{})}});
const rpcResult=(id,result)=>({jsonrpc:'2.0',id,result});
const resultData=data=>({resultType:'complete',content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data,isError:false});
const toolError=reason=>({resultType:'complete',content:[{type:'text',text:String(reason)}],isError:true});
export class SeekmeshMCP{
 constructor({db,search,atlas,realmOS,community,paidProof,missions,baseURL}={}){
  Object.assign(this,{db,search,atlas,realmOS,community,paidProof,missions,baseURL});
  db.exec("CREATE TABLE IF NOT EXISTS realm_mcp_tool_calls(day TEXT NOT NULL,tool TEXT NOT NULL,outcome TEXT NOT NULL,n INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,tool,outcome))");
 }
 track(tool,outcome){
  const safeTool=String(tool||'unknown').replace(/[^a-z_]/g,'').slice(0,40)||'unknown';
  const success=outcome==='success'?'success':'error';
  this.db.prepare("INSERT INTO realm_mcp_tool_calls(day,tool,outcome,n) VALUES(date('now'),?,?,1) ON CONFLICT(day,tool,outcome) DO UPDATE SET n=n+1").run(safeTool,success);
 }
 usage(){
  const totals=this.db.prepare("SELECT tool,outcome,SUM(n) calls FROM realm_mcp_tool_calls WHERE day>=date('now','-6 days') GROUP BY tool,outcome ORDER BY calls DESC LIMIT 30").all();
  return {window:'last_7_utc_days',toolCalls:totals.reduce((a,v)=>a+v.calls,0),byTool:totals,uniqueAgentsMeasured:false,paidRequests:this.paidProof.publicStatus().verifiedSettledRequests,notRevenue:'MCP usage is unbilled unless a separate x402 settlement receipt exists.'};
 }
 discover(){
  return {resultType:'complete',protocolVersion:PROTOCOL,serverInfo:{name:'SEEKMESH Discovery Realm',version:'1.4.0',websiteUrl:this.baseURL},capabilities:{tools:{listChanged:false}},description:'Independent Web3-native source and Agent Trust Atlas; public read-only discovery plus separately paid x402 proof API'};
 }
 async call(name,input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))return toolError('Expected an argument object.');
  if(name==='search_sources'){
   const query=strip(input.query||''),category=strip(input.category||'');
   if(query.length>100)return toolError('Search query too long.');
   const n=Math.min(20,Math.max(1,Number(input.limit)||12));
   const rows=this.search(query,category).slice(0,n);
   return resultData({resources:rows,results:rows.length,provenance:'SEEKMESH SQLite sourced listings; entries are NOT financial endorsements or security audits.'});
  }
  if(name==='search_agent_atlas'){
   const rows=this.atlas.list({kind:input.kind,q:strip(input.query||''),limit:Math.min(25,Math.max(1,Number(input.limit)||15))});
   return resultData({agents:rows,returned:rows.length,proofLevels:'Registry listing, HTTP reachability and onchain ownerOf are separate evidence types, not an aggregate safety score.'});
  }
  if(name==='get_live_expeditions'){
   return resultData({expeditions:this.realmOS.expedition(),reward:'Existing offchain XP and Credits after source approval; no unissued token rewards or guaranteed USDC.'});
  }
  if(name==='get_guilds'){
   return resultData({guilds:this.community.list(null).slice(0,25),disclaimer:'Real persisted members and publicly visible approved activity only.'});
  }
  if(name==='get_source_proof_quote'){
   const id=Number(input.source_id);
   if(!Number.isSafeInteger(id)||id<1)return toolError('Provide a positive source_id.');
   const preview=this.paidProof.preview(id);
   if(!preview)return toolError('No such source.');
   const status=await this.paidProof.readiness();
   return resultData({preview,price:'0.05 USDC',network:'eip155:8453',settlement:'x402 v2 exact',paidEndpoint:this.baseURL+'/api/proof/premium?id='+id,paymentReady:status.facilitatorCompatible&&status.status!=='awaiting_independent_receiver_wallet',gatewayStatus:status.status,paymentDelivered:false});
  }
  if(name==='get_native_market_status'){
   return resultData({escrow:this.missions.status(),x402:this.paidProof.publicStatus(),verifiedCampaigns:this.missions.list().slice(0,15),note:'Only real chain-verified funding and payouts counted; no fake token or escrow amounts.'});
  }
  return null;
 }
 async handle(req,res,body,siteURL){
  const send=(status,obj)=>{res.writeHead(status,noStore);res.end(JSON.stringify(obj));};
  const id=body?.id??null,method=body?.method;
  if(!body||Array.isArray(body)||typeof body!=='object'||body.jsonrpc!=='2.0'||typeof method!=='string'){
   return send(400,rpcError(id,-32600,'InvalidRequest'));
  }
  const origin=req.headers.origin;
  if(origin){
   let expected;try{expected=new URL(siteURL).origin}catch{return send(500,rpcError(id,-32603,'Missing server URL'))}
   if(origin!==expected)return send(403,rpcError(id,-32600,'CrossOriginRequestBlocked'));
  }
  const accept=String(req.headers.accept||'');
  if(!accept.includes('application/json')||!accept.includes('text/event-stream'))
   return send(406,rpcError(id,-32020,'InvalidAcceptHeader',{required:'application/json, text/event-stream'}));
  const contentType=String(req.headers['content-type']||'');
  if(!/^application\/json\b/.test(contentType))return send(415,rpcError(id,-32600,'UnsupportedContentType'));
  const version=req.headers['mcp-protocol-version'];
  const metadata=body.params?._meta||{};
  const bodyVersion=metadata['io.modelcontextprotocol/protocolVersion'];
  if(version!==PROTOCOL||bodyVersion!==PROTOCOL)
   return send(400,rpcError(id,-32022,'UnsupportedProtocolVersionError',{supported:[PROTOCOL]}));
  if(req.headers['mcp-method']!==method)
   return send(400,rpcError(id,-32020,'HeaderMismatch',{header:'Mcp-Method'}));
  const name=body.params?.name;
  if(method==='tools/call'&&req.headers['mcp-name']!==name)
   return send(400,rpcError(id,-32020,'HeaderMismatch',{header:'Mcp-Name'}));
  if(!('id' in body)){res.writeHead(202,noStore);return res.end();}
  if(typeof id!=='number'&&typeof id!=='string')return send(400,rpcError(null,-32600,'InvalidRequestId'));
  if(method==='server/discover')return send(200,rpcResult(id,this.discover()));
  if(method==='tools/list'){
   if(body.params?.cursor)return send(200,rpcResult(id,{resultType:'complete',tools:[],ttlMs:300000,cacheScope:'public'}));
   return send(200,rpcResult(id,{resultType:'complete',tools,ttlMs:300000,cacheScope:'public'}));
  }
  if(method==='tools/call'){
   if(!tools.some(t=>t.name===name))return send(404,rpcError(id,-32601,'UnknownTool'));
   try{
    const out=await this.call(name,body.params?.arguments||{});
    this.track(name,out?.isError?'error':'success');
    return send(200,rpcResult(id,out||toolError('Tool is unavailable.')));
   }catch(e){this.track(name,'error');return send(200,rpcResult(id,toolError('Tool error: '+strip(e.message))))}
  }
  return send(404,rpcError(id,-32601,'MethodNotFound'));
 }
}
