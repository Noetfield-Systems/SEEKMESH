import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {CampaignMigration} from '../launch/migration.js';
import {AgentAtlas} from '../atlas/engine.js';
import {PaidProofAPI} from '../native/x402.js';
import {NativeMissions} from '../native/missions.js';

const dbFixture=()=>{
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE resources(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,url TEXT,description TEXT,category TEXT,tags TEXT,source TEXT,contributor TEXT,approved_at TEXT)");
 db.exec("CREATE TABLE autonomy_audits(resource_id INTEGER,status TEXT,http_status INTEGER,checked_at TEXT,reason TEXT,title TEXT)");
 db.prepare("INSERT INTO resources(name,url,description,category,tags,source,contributor,approved_at) VALUES(?,?,?,?,?,?,?,datetime('now'))").run('Sample MCP Tool','https://example.org','An original source-linked sample tool.','Agent Infrastructure','MCP','editorial','');
 return db;
};
test('Galxe migration: import verified-ownership DRAFT only; discard no identities or balances',()=>{
 const db=dbFixture(),flow=new CampaignMigration(db),member={id:11};
 const rows='title,description,action_url\n"Read, verify",Source linked project documentation,https://example.org/docs\nReview Protocol,Inspect open source protocol implementation,https://example.org/code';
 const out=flow.import(member,{project:'Project Test',campaignUrl:'https://app.galxe.com/quest/project-test',projectUrl:'https://example.org',csv:rows});
 assert.equal(out.ok,true);
 assert.equal(out.state,'draft');
 assert.equal(out.questCount,2);
 assert.match(out.ownerVerification.exactValue,/seekmesh-claim=/);
 assert.equal(out.migratedBalances,0);
 assert.equal(flow.public().length,0);
 assert.equal(flow.mine(member).length,1);
 assert.equal(flow.detail(out.id),null,'unverified campaign remains private');
 const duplicate=flow.import(member,{project:'Project Test',campaignUrl:'https://app.galxe.com/quest/project-test',projectUrl:'https://example.org',csv:rows});
 assert.ok(duplicate.error);
 const bad=flow.import(member,{project:'Bad',campaignUrl:'https://galxe.com/a',projectUrl:'https://galxe.com',csv:rows});
 assert.ok(bad.error,'cannot prove ownership by placing DNS on Galxe');
 db.close();
});
test('Agent Atlas: registry entries distinguish external catalog, self-report and independently verified wallet',()=>{
 const db=dbFixture(),atlas=new AgentAtlas(db);
 assert.equal(atlas.stats().total,0);
 atlas.record({kind:'mcp',external_id:'io.github.sample/tool',name:'Test MCP Tool',description:'A tool with useful capabilities and original source links.',homepage:'https://example.org',origin:'official_mcp_registry_v0.1',owner_proof:'registry_published_not_wallet_verified'});
 assert.equal(atlas.list({kind:'mcp'}).length,1);
 assert.equal(atlas.stats().verifiedWallets,0);
 assert.ok(atlas.register({id:1},{kind:'erc8004',name:'Example',description:'Unverified agent with public capability description.',homepage:'https://example.org',chainId:8453,tokenId:'3'},null).error);
 const wallet='0x000000000000000000000000000000000000dEaD';
 const out=atlas.register({id:1},{kind:'erc8004',name:'Source-based Agent',description:'A real public AI service with source-linked capabilities.',homepage:'https://example.org',chainId:8453,tokenId:'3'},wallet);
 assert.equal(out.state,'self_reported');
 assert.equal(atlas.stats().verifiedWallets,0);
 const id=atlas.list({kind:'erc8004'})[0].id;
 db.close();
});
function response(){return {status:null,headers:{},body:null,writeHead(status,headers){this.status=status;this.headers=headers},end(text){this.body=JSON.parse(text)}}}
test('x402 premium data never returned on unsigned request or absent receiving wallet',async()=>{
 const db=dbFixture(),paid=new PaidProofAPI(db,{baseURL:'https://seekmesh.example'});
 const saved=process.env.SEEKMESH_USDC_RECEIVER;
 try{
  delete process.env.SEEKMESH_USDC_RECEIVER;
  const disabled=response();await paid.serve({headers:{}},disabled,new URL('https://seekmesh.example/api/proof/premium?id=1'));
  assert.equal(disabled.status,503);
  assert.equal(paid.publicStatus().verifiedSettledRequests,0);
  process.env.SEEKMESH_USDC_RECEIVER='0x000000000000000000000000000000000000dEaD';
  paid.compatibility=async()=>({compatible:true,reason:'unit_test_facilitator_supported'});
  const challenge=response();await paid.serve({headers:{}},challenge,new URL('https://seekmesh.example/api/proof/premium?id=1'));
  assert.equal(challenge.status,402);
  assert.ok(challenge.headers['payment-required']);
  const payload=JSON.parse(Buffer.from(challenge.headers['payment-required'],'base64').toString());
  assert.equal(payload.x402Version,2);
  assert.equal(payload.accepts[0].network,'eip155:8453');
  assert.equal(payload.accepts[0].amount,'50000');
  const bogus=response();await paid.serve({headers:{'payment-signature':'not-a-signed-payment'}},bogus,new URL('https://seekmesh.example/api/proof/premium?id=1'));
  assert.equal(bogus.status,400);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM native_x402_receipts').get().n,0);
 }finally{if(saved===undefined)delete process.env.SEEKMESH_USDC_RECEIVER;else process.env.SEEKMESH_USDC_RECEIVER=saved;db.close()}
});
test('Mission settlements require a configured independently verified onchain escrow',async()=>{
 const db=dbFixture(),engine=new NativeMissions(db);
 assert.equal(engine.status().verifiedFundingTransactions,0);
 assert.equal(engine.status().fulfilledCampaigns,0);
 const fake=await engine.registerFunding('0x'+'a'.repeat(64));
 assert.ok(fake.error);
 assert.equal(engine.list().length,0);
 db.close();
});

test('Galxe URL-only path creates zero fabricated quests; imported descriptions attach later and verified project owns Guild',()=>{
 const db=dbFixture();
 db.exec("CREATE TABLE realm_guilds(id INTEGER PRIMARY KEY AUTOINCREMENT,slug TEXT UNIQUE,name TEXT,founder_id INTEGER)");
 const community={
  create(member,data){
   assert.equal(data.category,'Communities');
   const slug='verified-project-guild';
   db.prepare('INSERT INTO realm_guilds(slug,name,founder_id) VALUES(?,?,?)').run(slug,data.name,member.id);
   return {ok:true,slug};
  }
 };
 const flow=new CampaignMigration(db,{community}),owner={id:7};
 const out=flow.import(owner,{project:'Real Explorer Guild',campaignUrl:'https://app.galxe.com/quest/real-guild',projectUrl:'https://real-project.example'});
 assert.equal(out.ok,true);
 assert.equal(out.questCount,0);
 assert.equal(out.importMode,'campaign_link_only');
 assert.equal(flow.public().length,0);
 assert.ok(flow.linkGuild(owner,out.id).error,'ownership required before Guild linking');
 const added=flow.addQuests(owner,{id:out.id,csv:'title,description,action_url\nExplore Project,Read real project documentation,https://real-project.example/docs'});
 assert.equal(added.ok,true);assert.equal(added.added,1);
 assert.equal(flow.addQuests(owner,{id:out.id,csv:'title,description,action_url\nAnother Task,Another useful description,https://real-project.example/another'}).ok,undefined);
 db.prepare("UPDATE realm_imports SET state='verified',verified_at=datetime('now') WHERE id=?").run(out.id);
 const linked=flow.linkGuild(owner,out.id);
 assert.equal(linked.ok,true);
 assert.equal(linked.guildUrl,'/guilds?guild=verified-project-guild');
 assert.equal(flow.detail(out.id).guild_slug,'verified-project-guild');
 assert.equal(flow.public()[0].quests,1);
 assert.equal(flow.public()[0].guild_slug,'verified-project-guild');
 assert.equal(flow.linkGuild(owner,out.id).existing,true);
 db.close();
});

test('x402 refuses paid delivery from testnet-only facilitator for Base mainnet USDC',async()=>{
 const db=dbFixture(),paid=new PaidProofAPI(db,{baseURL:'https://seekmesh.example'});
 const saved=process.env.SEEKMESH_USDC_RECEIVER;
 try{
  process.env.SEEKMESH_USDC_RECEIVER='0x000000000000000000000000000000000000dEaD';
  paid.compatibility=async()=>({compatible:false,reason:'testnet_only_facilitator'});
  const res=response();
  await paid.serve({headers:{}},res,new URL('https://seekmesh.example/api/proof/premium?id=1'));
  assert.equal(res.status,503);
  assert.match(res.body.compatibility,/testnet_only/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM native_x402_receipts').get().n,0);
 }finally{if(saved===undefined)delete process.env.SEEKMESH_USDC_RECEIVER;else process.env.SEEKMESH_USDC_RECEIVER=saved;db.close();}
});
