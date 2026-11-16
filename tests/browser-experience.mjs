import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const BASE=process.env.SEEKMESH_URL||'https://seekmesh-web-production.up.railway.app';
fs.mkdirSync('artifacts', {recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const failures=[];
async function scenario(name,fn){
 try{await fn();console.log('PASS '+name)}catch(e){failures.push(name+' :: '+e.stack);console.error('FAIL '+name+' :: '+e.message)}
}
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
page.on('pageerror',e=>{failures.push('Browser uncaught JS: '+e.message);console.error('PAGE ERROR '+e.message)});
await scenario('Desktop multi-section home is tall, not one cropped hero',async()=>{
 const r=await page.goto(BASE+'/',{waitUntil:'domcontentloaded',timeout:60000});assert.equal(r.status(),200);
 await page.locator('#journey-title').waitFor();
 await page.locator('#account-menu-toggle').waitFor({timeout:15000});
 await page.locator('#home-leaderboard').waitFor({state:'visible'});
 const pos=await page.evaluate(()=>({height:document.documentElement.scrollHeight,view:innerHeight,fullWidth:document.documentElement.scrollWidth,viewport:innerWidth,sections:document.querySelectorAll('#home .realm-content-wrap>section').length}));
 assert.ok(pos.height>pos.view*2,'Home must scroll beyond hero '+JSON.stringify(pos));
 assert.ok(pos.sections>=5,'Onboarding, destinations, engine, launch, community and FAQ missing');
 assert.ok(pos.fullWidth<=pos.viewport+10,'Horizontal overflow: '+JSON.stringify(pos));
 await page.screenshot({path:'artifacts/seekmesh-desktop-full.png',fullPage:true,animations:'disabled'});
});
await scenario('Account menu opens without clipping and shows real login choices',async()=>{
 await page.locator('#account-menu-toggle').click();
 await page.locator('#account-dropdown').waitFor({state:'visible'});
 const box=await page.locator('#account-dropdown').boundingBox();
 assert.ok(box.x>=-2&&box.x+box.width<1442,'Menu clipped on desktop '+JSON.stringify(box));
 await page.locator('#account-dropdown [data-experience-auth="register"]').click();
 await page.locator('#modal-overlay').waitFor({state:'visible'});
 await page.locator('#form-auth').waitFor({state:'visible'});
 await page.locator('#close-modal').click();
});
await scenario('Interactive walkthrough helps users begin',async()=>{
 await page.locator('#home [data-experience-guide]').first().click();
 await page.locator('#experience-guide-overlay').waitFor({state:'visible'});
 assert.match(await page.locator('#experience-guide-title').innerText(),/adventure/);
 await page.locator('[data-experience-guide-close]').first().click();
 await page.locator('#experience-guide-overlay').waitFor({state:'hidden'});
});
await scenario('Atlas, OS and campaign onboarding have real subpage guidance',async()=>{
 for(const [route,id] of [['/atlas','atlas'],['/os','os'],['/migrate','migrate'],['/missions','missions'],['/rewards','rewards']]){
  await page.goto(BASE+route,{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('#'+id+'.is-visible').waitFor({timeout:15000});
  await page.locator('#'+id+' .route-compass').waitFor();
  if(id==='atlas')await page.locator('#atlas .exp-explain').waitFor();
 }
});
await scenario('Season Zero still clearly separates real users from synthetic QA',async()=>{
 await page.goto(BASE+'/genesis',{waitUntil:'domcontentloaded'});
 await page.locator('#genesis.is-visible').waitFor();
 await page.locator('#genesis-real-board').waitFor({state:'visible'});
 assert.equal(await page.locator('#genesis-demo-board').isVisible(),false);
 await page.locator('[data-genesis-scope="simulation"]').click();
 assert.equal(await page.locator('#genesis-demo-board').isVisible(),true);
 assert.ok((await page.locator('#genesis').innerText()).includes('not SEEK tokens'));
});
const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
mobile.on('pageerror',e=>failures.push('Mobile uncaught JS: '+e.message));
await scenario('Mobile homepage fits screen with no horizontal overflow and all sections scroll',async()=>{
 await mobile.goto(BASE+'/',{waitUntil:'domcontentloaded',timeout:30000});
 await mobile.locator('#account-menu-toggle').waitFor();
 const pos=await mobile.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth,height:document.documentElement.scrollHeight,sections:document.querySelectorAll('#home .realm-content-wrap>section').length}));
 assert.ok(pos.width<=pos.viewport+8,'Mobile horizontal overflow '+JSON.stringify(pos));
 assert.ok(pos.height>2600,'Mobile vertical experience clipped '+JSON.stringify(pos));
 assert.ok(pos.sections>=5);
 await mobile.screenshot({path:'artifacts/seekmesh-mobile-full.png',fullPage:true,animations:'disabled'});
 await mobile.locator('#account-menu-toggle').click();
 await mobile.locator('#account-dropdown').waitFor({state:'visible'});
 const box=await mobile.locator('#account-dropdown').boundingBox();
 assert.ok(box.x>=-2&&box.x+box.width<=pos.viewport+3,'Mobile account menu clipped '+JSON.stringify(box));
});
await page.close();await mobile.close();await browser.close();
if(failures.length){console.error('\nBROWSER QA FAILURES\n'+failures.join('\n\n'));process.exitCode=1;}
else console.log('All SEEKMESH desktop/mobile and live-guidance browser checks passed.');
