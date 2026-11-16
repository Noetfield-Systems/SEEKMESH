import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {Wallet} from 'ethers';
import {MeshEconomy} from '../economy/core.js';
import {WalletLink} from '../wallet/link.js';
import {RealmSIWE} from '../wallet/siwe.js';

function fixture(){
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE submissions(id INTEGER PRIMARY KEY,name TEXT,url TEXT,state TEXT,created_at TEXT)");
 db.exec("CREATE TABLE resources(id INTEGER PRIMARY KEY,name TEXT,url TEXT)");
 const mesh=new MeshEconomy(db);
 new WalletLink(db,'https://seekmesh.example');
 const siwe=new RealmSIWE(db,'https://seekmesh.example',mesh,null);
 return {db,mesh,siwe};
}
test('EIP-4361: wallet-native onboarding issues one session; signature is domain-bound and replay-resistant',async()=>{
 const {db,mesh,siwe}=fixture();
 const w=Wallet.createRandom();
 const c=siwe.challenge(w.address,8453);
 assert.equal(c.ok,true);
 assert.equal(c.standard,'EIP-4361');
 assert.match(c.message,/seekmesh\.example wants you to sign in with your Ethereum account:/);
 assert.match(c.message,/URI: https:\/\/seekmesh\.example\/app/);
 assert.match(c.message,/Chain ID: 8453/);
 assert.match(c.message,/Nonce: [a-zA-Z0-9]{8,}/);
 const signature=await w.signMessage(c.message);
 assert.equal(siwe.verify({id:c.id,signature,chainId:1,address:w.address}).error.includes('wrong chain'),true);
 const wrong=Wallet.createRandom();
 assert.ok(siwe.verify({id:c.id,signature:await wrong.signMessage(c.message),chainId:8453,address:w.address}).error);
 const accepted=siwe.verify({id:c.id,signature,chainId:8453,address:w.address});
 assert.equal(accepted.ok,true);
 assert.equal(accepted.newMember,true);
 assert.equal(accepted.member.xp,25);
 assert.equal(accepted.member.credits,5);
 assert.equal(mesh.auth('Bearer '+accepted.token).id,accepted.member.id);
 assert.equal(accepted.transactionPerformed,false);
 assert.ok(siwe.verify({id:c.id,signature,chainId:8453,address:w.address}).error,'signature replay prevented');
 const second=siwe.challenge(w.address,8453);
 const back=siwe.verify({id:second.id,signature:await w.signMessage(second.message),chainId:8453,address:w.address});
 assert.equal(back.newMember,false);
 assert.equal(back.member.id,accepted.member.id);
 assert.equal(back.member.xp,25);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM mesh_members').get().n,1);
 db.close();
});
test('SIWE: wrong origin signature, unsupported chains and expired challenges fail without a login',async()=>{
 const {db,siwe}=fixture();const w=Wallet.createRandom();
 assert.ok(siwe.challenge(w.address,999999).error);
 const x=siwe.challenge(w.address,11155111);
 const changed=x.message.replace('seekmesh.example','wrong.example');
 assert.ok(siwe.verify({id:x.id,address:w.address,chainId:11155111,signature:await w.signMessage(changed)}).error);
 db.prepare("UPDATE realm_siwe_challenges SET expires_at=datetime('now','-1 minute') WHERE id=?").run(x.id);
 assert.ok(siwe.verify({id:x.id,address:w.address,chainId:11155111,signature:await w.signMessage(x.message)}).error);
 assert.equal(db.prepare('SELECT COUNT(*) n FROM mesh_members').get().n,0);
 db.close();
});
test('SIWE referral is qualified contribution-based, not paid for merely signing in',async()=>{
 const {db,mesh,siwe}=fixture();
 const inviter=mesh.register({handle:'TrustedScout',password:'long_password_for_scout123',role:'Builder'});
 assert.equal(inviter.ok,true);
 const w=Wallet.createRandom();const challenge=siwe.challenge(w.address,8453);
 const out=siwe.verify({id:challenge.id,signature:await w.signMessage(challenge.message),chainId:8453,address:w.address,invite:inviter.member.referral_code});
 assert.equal(out.ok,true);
 assert.equal(out.member.referred_by,inviter.member.id);
 assert.equal(mesh.member(inviter.member.id).xp,25,'no immediate referral XP without an approved source');
 db.close();
});
