import crypto from 'node:crypto';
import {getAddress,verifyMessage} from 'ethers';

// Signed EIP-191 proof linking to an existing member. Never transfers or requests custody.
export class WalletLink {
 constructor(db,publicURL){this.db=db;this.origin=new URL(publicURL).host;this.init();}
 init(){this.db.exec(`CREATE TABLE IF NOT EXISTS mesh_wallet_links(
   member_id INTEGER PRIMARY KEY,address TEXT NOT NULL UNIQUE COLLATE NOCASE,
   linked_at TEXT NOT NULL DEFAULT(datetime('now')));
   CREATE TABLE IF NOT EXISTS mesh_wallet_challenges(
    id INTEGER PRIMARY KEY AUTOINCREMENT,member_id INTEGER NOT NULL,address TEXT NOT NULL,
    message TEXT NOT NULL,nonce TEXT NOT NULL,expires_at TEXT NOT NULL,consumed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT(datetime('now')));
   CREATE INDEX IF NOT EXISTS mesh_wallet_challenges_member ON mesh_wallet_challenges(member_id,expires_at);`);}
 addressFor(memberId){return this.db.prepare('SELECT address FROM mesh_wallet_links WHERE member_id=?').get(memberId)?.address||null;}
 challenge(member,input){
   let address;try{address=getAddress(String(input||''));}catch{return {error:'Enter an Ethereum wallet address.'};}
   this.db.prepare("DELETE FROM mesh_wallet_challenges WHERE expires_at<datetime('now','-1 day')").run();
   const nonce=crypto.randomBytes(16).toString('hex'),now=new Date(),exp=new Date(now.getTime()+5*60*1000);
   const message=['SEEKMESH — Verify wallet ownership',
    'Site: '+this.origin,'Explorer: @'+member.handle,'Wallet: '+address,'Nonce: '+nonce,
    'Issued: '+now.toISOString(),'Expires: '+exp.toISOString(),
    'Action: Link this wallet to your existing SEEKMESH explorer account.',
    'Signing this message does not authorize payments, token transfers, or airdrops.'].join('\n');
   const id=Number(this.db.prepare("INSERT INTO mesh_wallet_challenges(member_id,address,message,nonce,expires_at) VALUES(?,?,?,?,datetime('now','+5 minutes'))").run(member.id,address,message,nonce).lastInsertRowid);
   return {ok:true,challengeId:id,message,address,expiresInSeconds:300,purpose:'wallet-link',signingStandard:'EIP-191'};
 }
 verify(member,id,signature){
   const challenge=this.db.prepare("SELECT * FROM mesh_wallet_challenges WHERE id=? AND member_id=? AND consumed=0 AND expires_at>datetime('now')").get(Number(id),member.id);
   if(!challenge)return {error:'Challenge missing, expired, or already used.'};
   let recovered;try{recovered=getAddress(verifyMessage(challenge.message,String(signature||'')));}catch{return {error:'Invalid wallet signature.'};}
   if(recovered!==challenge.address)return {error:'Signature belongs to a different wallet.'};
   const existing=this.db.prepare('SELECT member_id FROM mesh_wallet_links WHERE address=?').get(challenge.address);
   if(existing&&existing.member_id!==member.id)return {error:'Wallet already linked to another explorer.'};
   this.db.exec('BEGIN IMMEDIATE');
   try{
     const used=this.db.prepare("UPDATE mesh_wallet_challenges SET consumed=1 WHERE id=? AND member_id=? AND consumed=0 AND expires_at>datetime('now')").run(challenge.id,member.id);
     if(!used.changes){this.db.exec('ROLLBACK');return {error:'Wallet challenge already used or expired.'};}
     this.db.prepare('DELETE FROM mesh_wallet_links WHERE member_id=?').run(member.id);
     this.db.prepare('INSERT INTO mesh_wallet_links(member_id,address) VALUES(?,?)').run(member.id,challenge.address);
     this.db.exec('COMMIT');
     return {ok:true,verified:true,address:challenge.address,chain:'EVM',walletAuthentication:false,tokenClaim:false};
   }catch(e){this.db.exec('ROLLBACK');if(String(e.message).includes('UNIQUE'))return {error:'Wallet already linked.'};throw e;}
 }
 unlink(member,password){
   const row=this.db.prepare('SELECT salt,password_hash FROM mesh_members WHERE id=?').get(member.id);
   if(!row)return {error:'Account missing.'};
   const input=String(password||'').slice(0,128);
   const got=crypto.scryptSync(input,row.salt,64).toString('hex');
   if(!crypto.timingSafeEqual(Buffer.from(got,'hex'),Buffer.from(row.password_hash,'hex')))return {error:'Invalid account password.'};
   const r=this.db.prepare('DELETE FROM mesh_wallet_links WHERE member_id=?').run(member.id);
   return {ok:true,unlinked:r.changes===1};
 }
}