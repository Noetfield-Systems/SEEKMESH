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
 for(const file of ['public/terminal.js','economy/core.js','server.js']){
  const r=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'});
  assert.equal(r.status,0,file+' syntax error: '+r.stderr);
 }
});
