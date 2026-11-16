import crypto from 'node:crypto';
import {getAddress,verifyMessage} from 'ethers';

/**
 * EIP-4361 SIWE EOA login. Server builds the only accepted message and stores it once.
 * Domain/URI, nonce, chain ID, issued/expiration and signature are verified.
 * ERC-1271 / ERC-6492 smart account verification is NOT implemented.
 */
export class RealmSIWE{
 constructor(db,siteURL,mesh,realmOS){
  this.db=db;this.site=new URL(siteURL);this.mesh=mesh;this.realmOS=realmOS;
  db.exec("CREATE TABLE IF NOT EXISTS realm_siwe_challenges (id INTEGER PRIMARY KEY AUTOINCREMENT,nonce TEXT NOT NULL UNIQUE,address TEXT NOT NULL COLLATE NOCASE,chain_id INTEGER NOT NULL,message TEXT NOT NULL,expires_at TEXT NOT NULL,consumed INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT (datetime('now')))");
  db.exec("CREATE INDEX IF NOT EXISTS realm_siwe_lookup ON realm_siwe_challenges(address,expires_at,consumed)");
 }
 chain(id){const n=Number(id);return Number.isSafeInteger(n)&&[1,8453,10,42161,137,11155111,84532].includes(n)?n:null;}
 challenge(input,chainInput){
  let address;try{address=getAddress(String(input||''));}catch{return {error:'Provide a valid EVM wallet address.'};}
  const chainId=this.chain(chainInput);
  if(!chainId)return {error:'Unsupported chain. Select Ethereum, Base, Optimism, Arbitrum, Polygon or supported testnet.'};
  const nonce=crypto.randomBytes(16).toString('hex');
  const issuedAt=new Date(),expiresAt=new Date(issuedAt.getTime()+5*60000);
  const message=[
   this.site.host+' wants you to sign in with your Ethereum account:',
   address,
   '',
   'Enter SEEKMESH. A pseudonymous explorer node may be created. No transfer is authorized.',
   '',
   'URI: '+this.site.origin+'/app',
   'Version: 1',
   'Chain ID: '+chainId,
   'Nonce: '+nonce,
   'Issued At: '+issuedAt.toISOString(),
   'Expiration Time: '+expiresAt.toISOString()
  ].join('\n');
  const row=this.db.prepare("INSERT INTO realm_siwe_challenges(nonce,address,chain_id,message,expires_at) VALUES(?,?,?,?,datetime('now','+5 minutes'))").run(nonce,address,chainId,message);
  this.db.prepare("DELETE FROM realm_siwe_challenges WHERE created_at<datetime('now','-2 days')").run();
  return {ok:true,id:Number(row.lastInsertRowid),nonce,message,domain:this.site.host,uri:this.site.origin+'/app',address,chainId,expiresInSeconds:300,standard:'EIP-4361',accountTypes:['EOA'],signingDoesNotTransferFunds:true};
 }
 verify({id,signature,chainId,address,invite}={}){
  const key=Number(id),chain=this.chain(chainId);
  if(!Number.isSafeInteger(key)||key<=0||!chain)return {error:'Invalid sign-in challenge.'};
  const challenge=this.db.prepare("SELECT * FROM realm_siwe_challenges WHERE id=? AND consumed=0 AND expires_at>datetime('now')").get(key);
  if(!challenge||challenge.chain_id!==chain)return {error:'Sign-in challenge expired, consumed or wrong chain.'};
  let requested;try{requested=getAddress(String(address||''));}catch{return {error:'Invalid wallet address.'};}
  if(challenge.address!==requested)return {error:'Wallet address differs from challenge.'};
  if(!challenge.message.startsWith(this.site.host+' wants you to sign in with your Ethereum account:\n'+requested+'\n')||
     !challenge.message.includes('\nURI: '+this.site.origin+'/app\nVersion: 1\nChain ID: '+chain+'\nNonce: '+challenge.nonce+'\n'))
     return {error:'Invalid sign-in domain, URI or chain binding.'};
  let signer;try{signer=getAddress(verifyMessage(challenge.message,String(signature||'')));}catch{return {error:'Invalid EOA signature; smart-account login not yet supported.'};}
  if(signer!==requested)return {error:'Signature does not belong to this wallet.'};
  let memberId,newMember=false;
  this.db.exec('BEGIN IMMEDIATE');
  try{
   const used=this.db.prepare("UPDATE realm_siwe_challenges SET consumed=1 WHERE id=? AND consumed=0 AND expires_at>datetime('now')").run(key);
   if(!used.changes){this.db.exec('ROLLBACK');return {error:'Challenge already used.'};}
   const existing=this.db.prepare('SELECT member_id FROM mesh_wallet_links WHERE address=?').get(requested);
   if(existing)memberId=Number(existing.member_id);
   else{
    const invited=String(invite||'').trim().toUpperCase().slice(0,32);
    const ref=this.db.prepare('SELECT id FROM mesh_members WHERE referral_code=? AND is_synthetic=0').get(invited);
    const random=crypto.randomBytes(3).toString('hex');
    const handle='W_'+requested.slice(2,8).toLowerCase()+'_'+random;
    const salt=crypto.randomBytes(16).toString('hex');
    const sealed=crypto.scryptSync(crypto.randomBytes(32),salt,64).toString('hex');
    const referralCode=crypto.randomBytes(7).toString('hex').toUpperCase();
    memberId=Number(this.db.prepare('INSERT INTO mesh_members(handle,password_hash,salt,role,referral_code,referred_by) VALUES(?,?,?,?,?,?)').run(handle,sealed,salt,'Explorer',referralCode,ref?.id||null).lastInsertRowid);
    this.db.prepare('INSERT INTO mesh_wallet_links(member_id,address) VALUES(?,?)').run(memberId,requested);
    this.mesh.grant(memberId,25,5,'founding-node','join:'+memberId);
    newMember=true;
   }
   this.db.exec('COMMIT');
  }catch(e){this.db.exec('ROLLBACK');return {error:'Could not complete wallet sign-in.'};}
  const token=this.mesh.session(memberId);
  if(this.realmOS)try{this.realmOS.audit('growth','wallet.signin',{memberId,newMember,chainId:chain},'eip4361_eoa_signature');}catch{}
  return {ok:true,token,member:this.mesh.member(memberId),walletAddress:requested,chainId:chain,newMember,standard:'EIP-4361',accountTypes:['EOA'],walletAuthenticated:true,transactionPerformed:false};
 }
}
