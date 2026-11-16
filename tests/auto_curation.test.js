import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {AutonomyEngine} from '../autonomy/engine.js';
import {RealmOS} from '../realm-os/engine.js';

test('Realm OS auto-indexes only fresh high-signal GitHub repositories and never mints rewards',()=>{
 const db=new DatabaseSync(':memory:');
 db.exec("CREATE TABLE resources(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,url TEXT NOT NULL UNIQUE,description TEXT NOT NULL,category TEXT NOT NULL,tags TEXT NOT NULL DEFAULT '',source TEXT NOT NULL DEFAULT 'editorial',contributor TEXT NOT NULL DEFAULT '',approved_at TEXT NOT NULL DEFAULT (datetime('now')))");
 const autonomy=new AutonomyEngine(db,{enabled:false});
 const os=new RealmOS(db,{autonomy});
 const gh=db.prepare("SELECT id FROM autonomy_sources WHERE kind='github' LIMIT 1").get().id;
 const hn=db.prepare("SELECT id FROM autonomy_sources WHERE kind='hn' LIMIT 1").get().id;
 const now=new Date().toISOString();
 const evidence=(stars)=>JSON.stringify({discovered:{provenance:'github-public-api',stars,updatedAt:now},verification:{checkedAt:now,httpStatus:200,noindex:false,robotsAllowed:true,score:95}});
 const add=(url,sourceId,stars=500)=>db.prepare("INSERT INTO autonomy_candidates(url,name,description,category,origin,source_id,score,state,http_status,evidence) VALUES(?,?,?,?,?,?,?,?,?,?)").run(url,'example/repo','High-signal open source project with original README and useful public source links.','Builders','autonomous',sourceId,95,'ready',200,evidence(stars));
 for(let i=0;i<4;i++)add('https://github.com/acme/example'+i,gh);
 add('https://github.com/phishing/example',gh,4);
 add('https://evil.example.net/repo',gh);
 add('https://github.com/from-hacker-news/story',hn);
 const first=os.autoCurate();
 assert.equal(first.published,3);
 const indexed=db.prepare("SELECT COUNT(*) n FROM resources WHERE source='autonomous-reviewed'").get().n;
 assert.equal(indexed,3);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM resources WHERE source='community'").get().n,0);
 assert.equal(db.prepare("SELECT COUNT(*) n FROM autonomy_events WHERE actor='realm-os:trusted-source-policy'").get().n,3);
 assert.equal(os.autoCurate().published,0,'same-day capped at 3');
 assert.equal(db.prepare("SELECT COUNT(*) n FROM realm_os_receipts WHERE kind='source.auto_indexed'").get().n,3);
 const old=process.env.REALM_OS_AUTO_CURATE;process.env.REALM_OS_AUTO_CURATE='false';
 try{assert.equal(os.autoCurate().reason,'disabled');}finally{if(old===undefined)delete process.env.REALM_OS_AUTO_CURATE;else process.env.REALM_OS_AUTO_CURATE=old;}
 db.close();
});
