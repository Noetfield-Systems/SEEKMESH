import crypto from 'node:crypto';
import {getAddress,JsonRpcProvider,Interface} from 'ethers';
const USDC_BASE='0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const sanitize=(x,n=100)=>String(x??'').replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,n);
const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64');
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
const error=(res,status,payload)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(payload))};
export class PaidProofAPI{
 constructor(db,{baseURL,facilitator}={}){
  this.db=db;this.baseURL=baseURL;
  this.facilitator=process.env.X402_FACILITATOR_URL||facilitator||'https://facilitator.meshgateway.co';
  this.supportCache={until:0,compatible:false,reason:'not_checked'};
  db.exec("CREATE TABLE IF NOT EXISTS native_x402_receipts(id INTEGER PRIMARY KEY AUTOINCREMENT,payment_hash TEXT NOT NULL UNIQUE,tx_hash TEXT NOT NULL UNIQUE,source_id INTEGER NOT NULL,chain TEXT NOT NULL,amount_micro_usdc INTEGER NOT NULL,facilitator TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')))");
  db.exec("CREATE TABLE IF NOT EXISTS native_x402_pending(payment_hash TEXT PRIMARY KEY,tx_hash TEXT NOT NULL UNIQUE,source_id INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')))");
  this.inflight=new Set();
 }
 receiver(){
  try{return getAddress(process.env.SEEKMESH_USDC_RECEIVER||'')}catch{return null}
 }
 publicStatus(){
  return {name:'SEEKMESH Proof Intelligence',protocol:'x402-v2',status:this.receiver()?'receiver_configured_settlement_not_yet_proven':'awaiting_independent_receiver_wallet',network:'eip155:8453',asset:USDC_BASE,priceUSDC:'0.05',priceMicroUSDC:50000,facilitator:this.facilitator,verifiedSettledRequests:this.db.prepare('SELECT COUNT(*) n FROM native_x402_receipts').get().n,note:'Only facilitator-confirmed settlements count; no simulated receipts.'};
 }
 preview(id){
  const source=this.db.prepare('SELECT id,name,url,category,source,approved_at FROM resources WHERE id=?').get(Number(id));
  return source?{source,proofType:'source_origin_reference',verifiedSafety:false,availablePaidReport:true}:null;
 }
 details(id){
  const source=this.db.prepare('SELECT id,name,url,description,category,tags,source,contributor,approved_at FROM resources WHERE id=?').get(Number(id));
  if(!source)return null;
  const audits=this.db.prepare('SELECT status,http_status,checked_at,reason,title FROM autonomy_audits WHERE resource_id=? ORDER BY checked_at DESC LIMIT 8').all(Number(id));
  return {schema:'seekmesh.proof.v1',source,audits,sourceStatus:audits.length?audits[0].status:'uninspected',evidenceLevel:audits.length?'observed_source_availability':'editorial_or_community_record',notInvestmentAdvice:true,notSecurityAudit:true,generatedAt:new Date().toISOString()};
 }
 async facilitatorCall(method,body){
  const target=new URL(this.facilitator);
  if(target.protocol!=='https:')throw Error('Facilitator must be HTTPS');
  const r=await fetch(target.toString().replace(/\/$/,'')+'/'+method,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(13000)});
  if(!r.ok)throw Error('Facilitator '+method+' returned HTTP '+r.status);
  const text=await r.text();if(text.length>15000)throw Error('Facilitator response too large');
  return JSON.parse(text);
 }
 async compatibility(){
  if(Date.now()<this.supportCache.until)return this.supportCache;
  const refresh=(compatible,reason)=>{
   this.supportCache={compatible,reason,until:Date.now()+((compatible?180:30)*1000)};
   return this.supportCache;
  };
  try{
   const u=new URL(this.facilitator);
   if(u.protocol!=='https:'||u.username||u.password)return refresh(false,'facilitator_https_required');
   const r=await fetch(u.origin+u.pathname.replace(/\/$/,'')+'/supported',{headers:{accept:'application/json'},signal:AbortSignal.timeout(6500)});
   if(!r.ok)return refresh(false,'facilitator_supported_http_'+r.status);
   const raw=await r.text();
   if(raw.length>50000)return refresh(false,'facilitator_supported_response_too_large');
   const supported=JSON.parse(raw);
   const compatible=Array.isArray(supported.kinds)&&supported.kinds.some(k=>k.x402Version===2&&k.scheme==='exact'&&k.network==='eip155:8453');
   return refresh(compatible,compatible?'confirmed_eip155_8453_exact_v2':'facilitator_does_not_support_base_mainnet_v2');
  }catch{return refresh(false,'facilitator_supported_lookup_failed')}
 }
 async readiness(){
  const v=this.publicStatus();
  if(!this.receiver())return {...v,facilitatorCompatible:false};
  const check=await this.compatibility();
  return {...v,status:check.compatible?'configured_facilitator_base_supported_no_paid_receipt_claim':'facilitator_unavailable_or_network_incompatible',facilitatorCompatible:check.compatible,facilitatorEvidence:check.reason,needs:['SEEKMESH_USDC_RECEIVER','compatible X402_FACILITATOR_URL','confirmed Base USDC settlement']};
 }
 async verifyChainTransfer(tx,payer,receiver){
  // A facilitator response is insufficient by itself: require a successful Base
  // transaction and exact USDC Transfer from payer to SEEKMESH.
  if(!/^0x[0-9a-fA-F]{64}$/.test(String(tx)))throw Error('Missing transaction hash');
  const who=getAddress(payer),to=getAddress(receiver);
  const rpc=process.env.BASE_RPC_URL||'https://mainnet.base.org';
  if(!rpc.startsWith('https://'))throw Error('BASE_RPC_URL must be HTTPS');
  const provider=new JsonRpcProvider(rpc,8453,{staticNetwork:true});
  const value=await Promise.race([
   Promise.all([provider.getTransactionReceipt(tx),provider.getBlockNumber()]),
   new Promise((_,fail)=>setTimeout(()=>fail(Error('Base RPC timeout')),10000))
  ]);
  const [receipt,latest]=value;
  if(!receipt||receipt.status!==1||latest<receipt.blockNumber+1)throw Error('Unconfirmed, missing or failed Base transaction');
  const iface=new Interface(['event Transfer(address indexed from,address indexed to,uint256 value)']);
  const matches=receipt.logs.filter(l=>{
   if(l.address.toLowerCase()!==USDC_BASE.toLowerCase())return false;
   try{
    const x=iface.parseLog(l);
    return x?.name==='Transfer'&&getAddress(x.args.from)===who&&getAddress(x.args.to)===to&&x.args.value===50000n;
   }catch{return false}
  });
  if(matches.length!==1)throw Error('No unique 0.05 USDC Transfer from verified payer to SEEKMESH wallet');
  return {ok:true,txHash:tx,block:receipt.blockNumber,confirmations:latest-receipt.blockNumber,usdcTransferLogs:matches.length};
 }
 complete(res,proof,paymentHash,tx,settlement){
  const chain='eip155:8453';
  try{
   this.db.prepare('INSERT INTO native_x402_receipts(payment_hash,tx_hash,source_id,chain,amount_micro_usdc,facilitator) VALUES(?,?,?,?,?,?)')
    .run(paymentHash,tx,proof.source.id,chain,50000,this.facilitator);
  }catch{
   return error(res,409,{error:'Transaction was already fulfilled. Existing payments cannot be replayed.'});
  }
  this.db.prepare('DELETE FROM native_x402_pending WHERE payment_hash=?').run(paymentHash);
  res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','payment-response':encode(settlement),'access-control-expose-headers':'PAYMENT-REQUIRED,PAYMENT-RESPONSE','x-content-type-options':'nosniff'});
  return res.end(JSON.stringify({...proof,paidWith:'USDC on Base via x402',settlement:{txHash:tx,network:chain,amountMicroUSDC:50000,verifiedOnchain:true,recorded:true}}));
 }
 async serve(req,res,url){
  const id=Number(url.searchParams.get('id'));
  if(!Number.isSafeInteger(id)||id<1)return error(res,422,{error:'Provide a positive integer source id.'});
  const proof=this.details(id);if(!proof)return error(res,404,{error:'Source missing.'});
  const receiver=this.receiver();
  if(!receiver)return error(res,503,{error:'Native Web3 receiver wallet not configured.',config:'SEEKMESH_USDC_RECEIVER',simulatedPayment:false,paidResultsDelivered:0});
  const supported=await this.compatibility();
  if(!supported.compatible)return error(res,503,{error:'Configured facilitator does not currently prove x402-v2 exact support for Base mainnet.',compatibility:supported.reason,settled:false});
  const uri=this.baseURL+'/api/proof/premium?id='+id;
  const accepted={scheme:'exact',network:'eip155:8453',amount:'50000',asset:USDC_BASE,payTo:receiver,maxTimeoutSeconds:60,extra:{name:'USD Coin',version:'2'}};
  const reqBody={x402Version:2,resource:{url:uri,description:'SEEKMESH source-grounded proof intelligence report #'+id,mimeType:'application/json'},accepts:[accepted]};
  const payment=req.headers['payment-signature'];
  if(!payment){
   res.writeHead(402,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','payment-required':encode(reqBody),'access-control-expose-headers':'PAYMENT-REQUIRED,PAYMENT-RESPONSE','x-content-type-options':'nosniff'});
   return res.end(JSON.stringify({status:402,message:'USDC payment required',price:'0.05 USDC',network:'Base',x402Version:2,requirements:reqBody}));
  }
  if(typeof payment!=='string'||payment.length>12000||!/^[A-Za-z0-9+/=]+$/.test(payment))return error(res,400,{error:'Invalid x402 PAYMENT-SIGNATURE format.'});
  const hash=digest(payment);
  if(this.db.prepare('SELECT 1 FROM native_x402_receipts WHERE payment_hash=?').get(hash)||this.inflight.has(hash))return error(res,409,{error:'This authorization was already fulfilled or is processing; no duplicate charges.'});
  let payload;
  try{payload=JSON.parse(Buffer.from(payment,'base64').toString('utf8'))}catch{return error(res,400,{error:'Malformed PAYMENT-SIGNATURE.'});}
  if(payload.x402Version!==2||payload.resource?.url!==uri||typeof payload.payload!=='object'||!payload.payload)
   return error(res,400,{error:'Invalid x402 version, exact resource URL or signed payload.'});
  // Never trust the payment requirements supplied by the buyer.
  for(const field of ['scheme','network','amount','asset','payTo','maxTimeoutSeconds']){
   if(payload.accepted?.[field]!==accepted[field])return error(res,400,{error:'Payment requirements do not match the SEEKMESH quoted price/asset/recipient.'});
  }
  if(JSON.stringify(payload.accepted?.extra||{})!==JSON.stringify(accepted.extra))
   return error(res,400,{error:'Invalid USDC payment scheme metadata.'});
  this.inflight.add(hash);
  try{
   const cached=this.db.prepare('SELECT tx_hash,source_id FROM native_x402_pending WHERE payment_hash=?').get(hash);
   if(cached){
    if(cached.source_id!==id)return error(res,409,{error:'Payment belongs to another report.'});
    const payer=payload.payload?.authorization?.from||payload.payload?.from;
    if(!payer)return error(res,422,{error:'Cannot recover payer from pending x402 payment; no duplicate settlement attempted.'});
    try{await this.verifyChainTransfer(cached.tx_hash,payer,receiver)}
    catch{return error(res,503,{error:'Settlement broadcast; chain evidence still pending. Retry with the SAME payment signature. Do not pay twice.',txHash:cached.tx_hash})}
    return this.complete(res,proof,hash,cached.tx_hash,{success:true,transaction:cached.tx_hash,network:'eip155:8453'});
   }
   const args={x402Version:2,paymentPayload:payload,paymentRequirements:accepted};
   const verified=await this.facilitatorCall('verify',args);
   if(verified.isValid!==true)return error(res,402,{error:'Facilitator rejected payment authorization.',paymentSettled:false});
   const settlement=await this.facilitatorCall('settle',args);
   const tx=settlement.transaction||'';
   if(settlement.success!==true||settlement.network!=='eip155:8453'||!/^0x[0-9a-fA-F]{64}$/.test(tx))
    return error(res,402,{error:'No Base mainnet USDC settlement receipt provided.',paymentSettled:false});
   const payer=settlement.payer||verified.payer||payload.payload?.authorization?.from;
   if(!payer)return error(res,502,{error:'Settled response did not contain verifiable payer identity.',txHash:tx,paymentStatus:'needs_reconciliation'});
   this.db.prepare('INSERT OR IGNORE INTO native_x402_pending(payment_hash,tx_hash,source_id) VALUES(?,?,?)').run(hash,tx,id);
   try{await this.verifyChainTransfer(tx,payer,receiver)}
   catch(e){return error(res,503,{error:'Settlement broadcast but Base USDC confirmation remains unverified. Retry with SAME authorization, do not pay again.',txHash:tx,detail:sanitize(e.message,100),paymentStatus:'pending_chain_evidence'})}
   return this.complete(res,proof,hash,tx,settlement);
  }catch(e){return error(res,502,{error:'Payment service unavailable or verification failed; premium result was not delivered.',detail:sanitize(e.message,110),paymentSettled:false})}
  finally{this.inflight.delete(hash)}

 }
}
