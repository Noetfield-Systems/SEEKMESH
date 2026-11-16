import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const content=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Founder artwork is first-party and safely served',()=>{
 const server=content('server.js');
 assert.match(server,/^function safePublicFile\(pathname,res\)/m);
 assert.match(server,/asset=pathname\.slice/);
 assert.match(server,/image\/webp/);
 for(const asset of ['hero','avatar','missions','explore','guilds','build','rewards','market']){
  const p=path.join(root,'public/assets/realm-'+asset+'.webp');
  assert.ok(fs.existsSync(p),'Missing approved fantasy illustration '+asset);
  assert.ok(fs.statSync(p).size>1000,'Empty artwork '+asset);
 }
});
test('Reframed site matches the approved eight-view Web3 Realm',()=>{
 const html=content('public/terminal.html');
 const css=content('public/terminal.css');
 const js=content('public/terminal.js');
 for(const view of ['home','explore','missions','guilds','build','rewards','market','node'])
  assert.match(html,new RegExp('id="'+view+'"'),'Missing interactive section '+view);
 for(const route of ['home','explore','missions','guilds','build','rewards','market'])
  assert.match(html,new RegExp('data-nav="'+route+'"'),'Missing navigation '+route);
 for(const id of ['realm-stage','profile-handle','profile-credits','profile-xp','metric-nodes','metric-resources','metric-actions','metric-credits','redeem-source','resource-grid','guild-grid','guild-leaderboard','market-grid','mission-grid','node-profile','modal-overlay','modal-content'])
  assert.match(html,new RegExp('(?:id|class)="[^"]*'+id+'[^"]*"'),'Missing UI element '+id);
 assert.match(css,/realm-hero\.webp/);
 assert.match(css,/realm-gates/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.ok(js.includes("post('/api/mesh/'+state.authMode"),'Register and login must use the real member-auth API');
 assert.match(js,/api\/mesh\/checkin/);
 assert.match(js,/api\/mesh\/submit/);
 assert.match(js,/api\/mesh\/redeem/);
 assert.match(js,/api\/mesh\/leaderboard/);
 assert.match(js,/eth_requestAccounts/);
 assert.match(js,/action'\)==='join'/);
});
test('No fabricated explorer metrics or tradable-token promises',()=>{
 const html=content('public/terminal.html');
 const js=content('public/terminal.js');
 const backend=content('economy/core.js');
 assert.doesNotMatch(html,/48,320|6,940|213,460|12\.8M|4,850/);
 assert.match(html,/No tradable token/);
 assert.match(html,/no onchain asset trading|No onchain asset trading/i);
 assert.match(js,/metric-nodes/);
 assert.match(js,/api\/mesh\/stats/);
 assert.match(backend,/tokenIssued:false/);
});
test('All active scripts parse with Node 22',()=>{
 for(const file of ['public/terminal.js','public/operator.js','economy/core.js','community/engine.js','wallet/link.js','server.js']){
  const r=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'});
  assert.equal(r.status,0,file+' syntax error: '+r.stderr);
 }
});

test('Launch guild routes and controls are real, not just editorial community links',()=>{
 const html=content('public/terminal.html'),js=content('public/terminal.js'),server=content('server.js');
 assert.match(html,/data-action="guild-create"/);assert.match(html,/id="guild-detail"/);
 assert.match(js,/api\/guilds\/create/);assert.match(js,/api\/guilds\/join/);
 assert.match(js,/api\/guilds\/post/);assert.match(js,/api\/telemetry/);
 assert.match(server,/'\/guilds':'terminal.html'/);
 assert.match(server,/'\/market':'terminal.html'/);
 assert.match(server,/CommunityLayer/);
});

test('Visitors can flag a source and founder can resolve a report',()=>{
 const server=content('server.js'),html=content('public/terminal.html'),js=content('public/terminal.js');
 assert.match(server,/api\/mesh\/source-report/);assert.match(server,/api\/admin\/source-reports/);
 assert.match(js,/form-source-report/);assert.match(js,/data-report-source/);
 assert.match(content('public/operator.html'),/id="source-reports"/);
});

test('EIP-191 wallet linking is signed, replay resistant and optional',()=>{
 const js=content('public/terminal.js'),server=content('server.js');
 assert.match(js,/api\/mesh\/wallet-challenge/);
 assert.match(js,/personal_sign/);
 assert.match(js,/api\/mesh\/wallet-verify/);
 assert.match(js,/api\/mesh\/wallet-unlink/);
 assert.match(server,/WalletLink/);
 assert.match(content('wallet/link.js'),/verifyMessage/);
});

test('Web3 independent whitepaper and no unrelated SaaS pricing in active market',()=>{
 const html=content('public/terminal.html');
 const server=content('server.js');
 const paper=content('public/whitepaper.html');
 const ssot=JSON.parse(content('spec/seekmesh.ssot.json'));
 assert.doesNotMatch(html,/C\$149|Stripe|Noetfield Systems product/);
 assert.match(html,/WEB3-NATIVE ECONOMY/);
 assert.match(html,/x402/);
 assert.match(html,/href="\/whitepaper"/);
 assert.match(server,/'\/whitepaper':'whitepaper.html'/);
 assert.match(paper,/Independent Web3 initiative/);
 assert.match(ssot.identity.type,/independent_web3/);
 assert.equal(ssot.units.SEEK.status,'NOT_ISSUED');
 assert.equal(ssot.settlement.traditionalCheckoutDefault,false);
});


test('Release artifact includes every runtime module and the independent Web3 OS is a real route',()=>{
 const docker=content('Dockerfile');
 for(const folder of ['autonomy','economy','community','wallet','realm-os','public'])assert.ok(docker.includes('COPY '+folder+' ./'+folder),folder+' is omitted from shipping image');
 const server=content('server.js');
 assert.match(server,/new RealmOS\(db/);
 assert.match(server,/'\/os':'terminal.html'/);
 assert.match(server,/'\/api\/os\/status'/);
 assert.match(server,/'\/api\/siwe\/verify'/);
 const app=content('public/terminal.html'),client=content('public/terminal.js');
 assert.match(app,/id="os"/);
 assert.match(app,/id="os-signals"/);
 assert.match(client,/loadRealmOS/);
 assert.match(client,/signInWallet/);
});

test('Approved complete realm experience is a multi-section, honest and navigable launch product',()=>{
 const html=content('public/terminal.html'),css=content('public/experience.css'),js=content('public/experience.js'),server=content('server.js');
 for(const anchor of ['journey-title','destinations-title','home-leaderboard','home-guild-preview','realm-launch-title','realm-help-title','genesis','realm-stage','realm-scene','profile-handle','profile-drops']){
  assert.ok(html.includes(anchor),'Missing required experience anchor: '+anchor);
 }
 for(const section of ['realm-journey','journey-grid','launch-gates','realm-feature-grid','realm-launch','realm-live-grid','realm-help','help-faq'])
  assert.ok(html.includes(section),'Missing complete home page section '+section);
 for(const route of ['explore','missions','guilds','build','rewards','market','atlas','os','genesis'])
  assert.ok(html.includes('data-nav="'+route+'"'),'Unreachable path '+route);
 assert.match(html,/Genesis Drops are non-transferable|Drops and Credits are in-app units/);
 assert.doesNotMatch(html,/128,640|42,300|6,280|894,200|721,430/,'No fictitious hero or leaderboard statistics');
 assert.match(js,/api\/genesis\/leaderboard/);
 assert.match(js,/api\/guilds/);
 assert.match(js,/SeekmeshExperience/);
 assert.match(js,/data-experience-auth/);
 assert.match(js,/data-action="signout"/);
 assert.match(js,/data-action="siwe"/);
 assert.match(js,/aria-haspopup/);
 assert.match(js,/route-compass/);
 assert.match(js,/MCP Registry/);
 assert.match(css,/overflow-x:clip/);
 assert.match(css,/realm-journey/);
 assert.match(css,/realm-feature-grid/);
 assert.match(css,/subscreen-header:first-child/);
 assert.match(css,/@media\(max-width:520px\)/);
 assert.match(server,/'\/experience\.js':'experience\.js'/);
 assert.match(server,/'\/experience\.css':'experience\.css'/);
 for(const file of ['public/experience.js','public/terminal.js','public/genesis.js']){
  const r=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'});
  assert.equal(r.status,0,file+' syntax error: '+r.stderr);
 }
});
