import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root=path.resolve(import.meta.dirname,'..');
const content=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Web3 terminal shipped as real root surface, original preserved',()=>{
 const server=content('server.js');
 const html=content('public/terminal.html');
 assert.match(server,/'\/':'terminal.html'/);
 assert.match(server,/'\/manifesto':'index.html'/);
 assert.match(html,/id="view-discover"/);
 for(const name of ['missions','leaderboard','rewards','node','partners'])assert.match(html,new RegExp('id="view-'+name+'"'));
 assert.match(html,/id="redeem-submission"/);
 assert.match(html,/id="leaderboard-rows"/);
 assert.match(html,/id="mission-list"/);
 assert.match(html,/id="spotlight-list"/);
});

test('Terminal controls reference existing DOM elements and scripts parse',()=>{
 const js=content('public/terminal.js'),html=content('public/terminal.html');
 const requested=[...js.matchAll(/\$\('([a-z][a-z0-9-]+)'\)/g)].map(x=>x[1]);
 const htmlIDs=new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(x=>x[1]));
 for(const id of requested)assert.ok(htmlIDs.has(id),'Missing UI element #'+id);
 for(const file of ['public/terminal.js','economy/core.js','server.js']){
  const r=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'});
  assert.equal(r.status,0,file+' syntax error: '+r.stderr);
 }
});

test('No invented financial token or fake leaderboards',()=>{
 const html=content('public/terminal.html');
 const backend=content('economy/core.js');
 assert.match(html,/NO CLAIM OPEN/);
 assert.match(html,/Not Active|NOT ACTIVE|NOT ISSUED/);
 assert.match(backend,/tokenIssued:false/);
 assert.match(backend,/FROM mesh_members/);
 assert.match(backend,/FROM mesh_ledger/);
 assert.match(backend,/mesh_spotlights/);
 assert.match(content('server.js'),/mesh\.approved\(id\)/);
});

test('Partner route and deep-link entrypoints are available',()=>{
 const server=content('server.js'),js=content('public/terminal.js');
 assert.match(server,/'\/partners':'terminal.html'/);
 assert.match(js,/'\/partners':'partners'/);
 assert.match(js,/action==='join'/);
 assert.match(js,/action==='submit'/);
 assert.match(js,/state\.pendingAction='submit'/);
});
