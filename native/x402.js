import crypto from 'node:crypto';
import {getAddress} from 'ethers';
const USDC_BASE='0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const sanitize=(x,n=100)=>String(x??'').replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,n);
const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64');
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
const error=(res,status,payload)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(payload))};
export class PaidProofAPI{
 constructor(db,{baseURL,facilitator}={}){
  this.db=db;this.baseURL=baseURL;
  this.facilitator=process.env.X402_FACILITATOR_URL||facilitator||'https://x402.org/facilitator';
  db.exec("CREATE TABLE IF NOT EXISTS native_x402_receipts(id INTEGER PRIMARY KEY AUTOINCREMENT,payment_hash TEXT NOT NULL UNIQUE,tx_hash TEXT NOT NULL UNIQUE,source_id INTEGER NOT NULL,chain TEXT NOT NULL,amount_micro_usdc INTEGER NOT NULL,facilitator TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT (datetime('now')))");
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
 async serve(req,res,url){
  const id=Number(url.searchParams.get('id'));
  if(!Number.isSafeInteger(id)||id<1)return error(res,422,{error:'Provide a positive integer source id.'});
  const proof=this.details(id);if(!proof)return error(res,404,{error:'Source missing.'});
  const receiver=this.receiver();
  if(!receiver)return error(res,503,{error:'Native Web3 receiver wallet not configured.',config:'SEEKMESH_USDC_RECEIVER',simulatedPayment:false,paidResultsDelivered:0});
  const uri=this.baseURL+'/api/proof/premium?id='+id;
  const accepted={scheme:'exact',network:'eip155:8453',amount:'50000',asset:USDC_BASE,payTo:receiver,maxTimeoutSeconds:60,extra:{name:'USD Coin',version:'2'}};
  const reqBody={x402Version:2,resource:{url:uri,description:'SEEKMESH source-grounded proof intelligence report #'+id,mimeType:'application/json'},accepts:[accepted]};
  const payment=req.headers['payment-signature'];
  if(!payment){
   res.writeHead(402,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','payment-required':encode(reqBody),'access-control-expose-headers':'PAYMENT-REQUIRED,PAYMENT-RESPONSE','x-content-type-options':'nosniff'});
   return res.end(JSON.stringify({status:402,message:'USDC payment required',price:'0.05 USDC',network:'Base',x402Version:2,requirements:reqBody}));
  }
  if(typeof payment!=='string'||payment.length>12000)return error(res,400,{error:'Invalid x402 payment header.'});
  const hash=digest(payment);
  if(this.db.prepare('SELECT 1 FROM native_x402_receipts WHERE payment_hash=?').get(hash)||this.inflight.has(hash))return error(res,409,{error:'Payment signature already spent or being processed. Generate a new payment.'});
  let payload;
  try{payload=JSON.parse(Buffer.from(payment,'base64').toString('utf8'))}catch{return error(res,400,{error:'Malformed PAYMENT-SIGNATURE.'});}
  if(payload.x402Version!==2||payload.accepted?.network!==accepted.network||payload.accepted?.scheme!==accepted.scheme)return error(res,400,{error:'Unsupported x402 version, network or scheme.'});
  this.inflight.add(hash);
  try{
   const body={paymentPayload:payload,paymentRequirements:accepted};
   const verified=await this.facilitatorCall('verify',body);
   if(verified.isValid!==true)return error(res,402,{error:'Facilitator rejected payment authorization.',paymentSettled:false});
   const settlement=await this.facilitatorCall('settle',body);
   const tx=settlement.transaction||settlement.transactionHash||'';
   if(settlement.success!==true||!/^0x[0-9a-fA-F]{64}$/.test(tx))return error(res,402,{error:'No confirmed x402 settlement receipt.',paymentSettled:false});
   try{this.db.prepare('INSERT INTO native_x402_receipts(payment_hash,tx_hash,source_id,chain,amount_micro_usdc,facilitator) VALUES(?,?,?,?,?,?)').run(hash,tx,id,'eip155:8453',50000,this.facilitator)}
   catch{return error(res,409,{error:'Payment or transaction already recorded; no duplicate fulfillment.'})}
   res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','payment-response':encode(settlement),'access-control-expose-headers':'PAYMENT-REQUIRED,PAYMENT-RESPONSE','x-content-type-options':'nosniff'});
   res.end(JSON.stringify({...proof,paidWith:'USDC on Base via x402',settlement:{txHash:tx,network:'eip155:8453',amountMicroUSDC:50000,recorded:true}}));
  }catch(e){return error(res,502,{error:'Facilitator verification or settlement failed; no paid response granted.',detail:sanitize(e.message,110),paymentSettled:false})}
  finally{this.inflight.delete(hash)}
 }
}
