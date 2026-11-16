import {JsonRpcProvider,Interface,getAddress,id as selectorId} from 'ethers';
const abi=new Interface([
 'event CampaignFunded(uint256 indexed id,address indexed sponsor,address verifier,uint256 rewardBudget,uint256 totalDeposited,uint64 deadline,uint16 feeBps)',
 'event MissionRewardPaid(uint256 indexed id,bytes32 indexed evidenceHash,address indexed recipient,uint256 amount,uint256 fee)',
 'event UnspentFundsReturned(uint256 indexed id,address indexed sponsor,uint256 refundedAmount)'
]);
const short=x=>String(x??'').slice(0,120);
export class NativeMissions{
 constructor(db){
  this.db=db;
  db.exec([
   "CREATE TABLE IF NOT EXISTS native_campaigns(id INTEGER PRIMARY KEY AUTOINCREMENT,chain_id INTEGER NOT NULL,escrow TEXT NOT NULL,campaign_id TEXT NOT NULL,sponsor TEXT NOT NULL,verifier TEXT NOT NULL,reward_budget TEXT NOT NULL,total_deposited TEXT NOT NULL,deadline INTEGER NOT NULL,fee_bps INTEGER NOT NULL,funding_txhash TEXT NOT NULL UNIQUE,funding_block INTEGER NOT NULL,state TEXT NOT NULL DEFAULT 'funded',created_at TEXT NOT NULL DEFAULT (datetime('now')),UNIQUE(chain_id,escrow,campaign_id))",
   "CREATE TABLE IF NOT EXISTS native_campaign_payouts(id INTEGER PRIMARY KEY AUTOINCREMENT,campaign_ref INTEGER NOT NULL,evidence_hash TEXT NOT NULL,recipient TEXT NOT NULL,amount TEXT NOT NULL,fee TEXT NOT NULL,tx_hash TEXT NOT NULL,log_index INTEGER NOT NULL,block_number INTEGER NOT NULL,UNIQUE(tx_hash,log_index),UNIQUE(campaign_ref,evidence_hash))"
  ].join(';')+';');
 }
 config(){
  let escrow=null;try{escrow=getAddress(process.env.SEEKMESH_ESCROW_CONTRACT||'')}catch{}
  const chain=Number(process.env.SEEKMESH_ESCROW_CHAIN_ID||84532),rpc=chain===8453?process.env.BASE_RPC_URL:process.env.BASE_SEPOLIA_RPC_URL;
  let verifier=null;try{verifier=getAddress(process.env.SEEKMESH_ESCROW_VERIFIER||'')}catch{}
  const token=chain===8453?'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913':'0x036CbD53842c5426634e7929541eC2318f3dCF7e';
  return {escrow,verifier,token,chainId:chain,rpcConfigured:!!rpc,mode:chain===84532?'testnet':'mainnet',ready:!!escrow&&!!verifier&&!!rpc&&[84532,8453].includes(chain)};
 }
 async receipt(tx){
  const c=this.config();
  if(!c.ready)return {error:'No SEEKMESH escrow address/RPC configured. Onchain funding cannot be verified.'};
  if(!/^0x[0-9a-fA-F]{64}$/.test(String(tx)))return {error:'Provide a valid transaction hash.'};
  const rpc=c.chainId===8453?process.env.BASE_RPC_URL:process.env.BASE_SEPOLIA_RPC_URL;
  const provider=new JsonRpcProvider(rpc,c.chainId,{staticNetwork:true});
  try{
   const receipt=await Promise.race([provider.getTransactionReceipt(tx),new Promise((_,reject)=>setTimeout(()=>reject(Error('timeout')),13000))]);
   if(!receipt||receipt.status!==1)return {error:'Transaction missing, reverted or unconfirmed.'};
   const confirmations=(await provider.getBlockNumber())-receipt.blockNumber;
   if(confirmations<1)return {error:'Awaiting at least one confirmation.'};
   return {ok:true,config:c,receipt,confirmations};
  }catch(e){return {error:'Chain receipt query failed: '+short(e.message)}}
 }
 async registerFunding(tx){
  const checked=await this.receipt(tx);if(checked.error)return checked;
  const {config:c,receipt}=checked;
  const events=receipt.logs.filter(l=>l.address.toLowerCase()===c.escrow.toLowerCase()).map(l=>{try{return abi.parseLog(l)}catch{return null}}).filter(x=>x?.name==='CampaignFunded');
  if(events.length!==1)return {error:'No unique CampaignFunded event from the configured SEEKMESH escrow.'};
  const v=events[0].args;
  try{
   this.db.prepare('INSERT OR IGNORE INTO native_campaigns(chain_id,escrow,campaign_id,sponsor,verifier,reward_budget,total_deposited,deadline,fee_bps,funding_txhash,funding_block) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(c.chainId,c.escrow,v.id.toString(),v.sponsor,v.verifier,v.rewardBudget.toString(),v.totalDeposited.toString(),Number(v.deadline),Number(v.feeBps),receipt.hash,receipt.blockNumber);
   return {ok:true,campaignId:v.id.toString(),txHash:receipt.hash,chainId:c.chainId,fundingVerified:true,rewardBudgetBaseUnits:v.rewardBudget.toString(),funding:'onchain_verified',fundedBy:v.sponsor};
  }catch(e){return {error:'Could not reconcile campaign id/transaction.'}}
 }
 async registerPayout(tx){
  const checked=await this.receipt(tx);if(checked.error)return checked;
  const {config:c,receipt}=checked;
  const logs=receipt.logs.filter(l=>l.address.toLowerCase()===c.escrow.toLowerCase()).map(l=>{try{return {parsed:abi.parseLog(l),index:l.index}}catch{return null}}).filter(x=>x?.parsed?.name==='MissionRewardPaid');
  if(!logs.length)return {error:'No MissionRewardPaid event from the configured escrow.'};
  let recorded=0;
  for(const l of logs){
   const e=l.parsed.args;
   const campaign=this.db.prepare('SELECT * FROM native_campaigns WHERE chain_id=? AND escrow=? AND campaign_id=?').get(c.chainId,c.escrow,e.id.toString());
   if(!campaign)continue;
   try{const r=this.db.prepare('INSERT OR IGNORE INTO native_campaign_payouts(campaign_ref,evidence_hash,recipient,amount,fee,tx_hash,log_index,block_number) VALUES(?,?,?,?,?,?,?,?)').run(campaign.id,e.evidenceHash,e.recipient,e.amount.toString(),e.fee.toString(),receipt.hash,l.index,receipt.blockNumber);recorded+=r.changes}catch{}
  }
  return {ok:true,txHash:receipt.hash,paidReceiptsRecorded:recorded,verifiedOnchain:true};
 }
 list(){
  return this.db.prepare("SELECT c.id,c.chain_id,c.escrow,c.campaign_id,c.sponsor,c.verifier,c.reward_budget,c.total_deposited,c.deadline,c.fee_bps,c.funding_txhash,c.state,(SELECT COUNT(*) FROM native_campaign_payouts p WHERE p.campaign_ref=c.id) verifiedPayouts FROM native_campaigns c ORDER BY id DESC LIMIT 60").all();
 }
 async verifiedStatus(){
  const out=this.status();
  if(!out.configured)return {...out,codeVerified:false,configurationNote:'Independent escrow, verifier and RPC required.'};
  try{
   const rpc=out.chainId===8453?process.env.BASE_RPC_URL:process.env.BASE_SEPOLIA_RPC_URL;
   const provider=new JsonRpcProvider(rpc,out.chainId,{staticNetwork:true});
   const [code,tokenCode]=await Promise.race([
    Promise.all([provider.getCode(out.escrow),provider.getCode(out.usdcToken)]),
    new Promise((_,reject)=>setTimeout(()=>reject(Error('RPC timeout')),9000))
   ]);
   const ready=code.length>100&&tokenCode.length>100;
   return {...out,configured:ready,codeVerified:ready,configurationNote:ready?'Escrow and USDC bytecode observed, contract still not security audited.':'Configured wallet address lacks verified contract or token bytecode.'};
  }catch{return {...out,configured:false,codeVerified:false,configurationNote:'RPC bytecode check could not be completed.'}}
 }
 status(){
  const c=this.config();
  return {escrow:c.escrow,verifier:c.verifier,usdcToken:c.token,fundSelector:selectorId('fund(uint256,uint16,uint64,address)').slice(0,10),feeBps:250,chainId:c.chainId,mode:c.mode,configured:c.ready,verifiedFundingTransactions:this.db.prepare('SELECT COUNT(*) n FROM native_campaigns').get().n,verifiedPayouts:this.db.prepare('SELECT COUNT(*) n FROM native_campaign_payouts').get().n,fulfilledCampaigns:this.db.prepare('SELECT COUNT(DISTINCT campaign_ref) n FROM native_campaign_payouts').get().n,tokenIssued:false};
 }
}
