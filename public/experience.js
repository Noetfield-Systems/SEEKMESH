/* SEEKMESH Realm Experience
 * A progressive layer on top of real member, Guild, Genesis, Explorer,
 * Mission and OS APIs. All shown metrics are fetched, never fabricated.
 */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const secure=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const n=v=>Number(v??0).toLocaleString('en-US');
 const guideCards=[
  {title:'Create a free Explorer ID',description:'Choose a unique handle and password or use Sign in with Ethereum. Your progress is stored in your account.',label:'Create Account',action:'auth'},
  {title:'Verify a wallet if you want',description:'Wallet sign-in uses a message signature; no purchase, token transfer or gas fee is required.',label:'Wallet Sign-in',action:'siwe'},
  {title:'Enter Genesis Season Zero',description:'Open your saved Vault. Internal Drops are credited only for qualified activity; they are not SEEK tokens.',label:'Open Genesis',nav:'genesis'},
  {title:'Complete useful work and grow',description:'Explore source-linked projects, finish missions, invite qualified contributors and join a real Guild.',label:'View Missions',nav:'missions'}
 ];
 const routeHelp={
  explore:{title:'Explore the Realm',steps:['Search a topic or category','Open the original source','Map a useful new project']},
  missions:{title:'Complete a Mission',steps:['Choose a real mission','Do the required work','Receive in-app points when accepted']},
  guilds:{title:'Find Your Guild',steps:['Browse real communities','Join or found one Guild','Collaborate and share source-backed work']},
  build:{title:'Become a Builder',steps:['Choose a useful project','Submit original evidence','Track acceptance in your profile']},
  rewards:{title:'Understand Your Rewards',steps:['Earn XP and Credits','Check the internal ledger','Redeem Credits for in-app visibility']},
  market:{title:'Explore the Web3 Market',steps:['Discover active projects','Check real funding evidence','Use native wallet features when available']},
  atlas:{title:'What Is Agent Atlas?',steps:['Find a real registry entry','Compare capability and provenance','Check ownership and endpoint evidence separately']},
  os:{title:'What Does Realm OS Do?',steps:['Discover candidate sources','Apply bounded quality checks','Record verified work as artifacts']},
  migrate:{title:'Bring Your Campaign',steps:['Provide a Galxe campaign URL','Verify your own project domain','Link original quests to a Guild']},
  genesis:{title:'Earn In-App Genesis Drops',steps:['Create or restore your identity','Check your personal reward ledger','Complete missions and qualify referrals']},
  node:{title:'Manage Your Explorer',steps:['Check your saved profile','Link or unlink your verified wallet','Review history and invite friends']}
 };
 function ensureMenu(){
  const parent=document.querySelector('.realm-header .header-tools');
  if(!parent||$('account-menu-toggle'))return;
  const button=document.createElement('button');
  button.className='account-menu-toggle';
  button.id='account-menu-toggle';
  button.type='button';
  button.setAttribute('aria-haspopup','true');
  button.setAttribute('aria-controls','account-dropdown');
  button.setAttribute('aria-expanded','false');
  button.innerHTML='<img src="/assets/realm-avatar.webp" alt=""><span><strong class="account-name" id="account-menu-name">Explorer Account</strong><small id="account-menu-state">Sign in / Create</small></span><span aria-hidden="true">⌄</span>';
  const menu=document.createElement('div');
  menu.className='account-dropdown';
  menu.id='account-dropdown';
  menu.setAttribute('role','menu');
  menu.hidden=true;
  parent.append(button,menu);
  button.addEventListener('click',event=>{event.stopPropagation();toggleMenu(menu.hidden)});
  document.addEventListener('click',event=>{
   if(!menu.hidden&&!event.target.closest('#account-dropdown'))toggleMenu(false);
   const option=event.target.closest('[data-experience-auth]');
   if(option){
    event.preventDefault();
    state.authMode=option.dataset.experienceAuth;
    toggleMenu(false);
    openModal('auth');
   }
   if(event.target.closest('#account-dropdown [data-action],#account-dropdown [data-nav]'))toggleMenu(false);
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape')toggleMenu(false)});
  syncAccount();
 }
 function toggleMenu(open){
  const menu=$('account-dropdown'),button=$('account-menu-toggle');
  if(!menu||!button)return;
  menu.hidden=!open;
  button.setAttribute('aria-expanded',String(open));
  if(open)syncAccount();
 }
 function syncAccount(){
  const menu=$('account-dropdown');if(!menu)return;
  const m=state.member;
  $('account-menu-name').textContent=m?'@'+m.handle:'Explorer Account';
  $('account-menu-state').textContent=state.wallet?'Wallet verified':m?'Progress saved':'Sign in / Create';
  const handle=m?'@'+secure(m.handle):'A new adventure awaits';
  const sub=m?(state.wallet?secure(state.wallet.slice(0,6)+'…'+state.wallet.slice(-4)):'Saved member ID'):'No account connected yet';
  const top='<div class="menu-status"><img src="/assets/realm-avatar.webp" alt="SEEKMESH companion"><div><strong>'+handle+'</strong><small>'+sub+'</small></div></div>';
  if(m){
   menu.innerHTML=top+
    '<button data-nav="node" role="menuitem">My Profile <span>♙</span></button>'+
    '<button data-nav="genesis" role="menuitem">My Genesis Vault <span>✦</span></button>'+
    '<button data-nav="missions" role="menuitem">My Missions <span>◎</span></button>'+
    '<button data-action="wallet" role="menuitem">'+(state.wallet?'Wallet Details':'Verify / Link Wallet')+' <span>◇</span></button>'+
    '<button data-action="invite" role="menuitem">Share My Referral <span>↗</span></button>'+
    '<button class="danger" data-action="signout" role="menuitem">Sign Out <span>⎋</span></button>'+
    '<div class="menu-truth">Only verified activity counts. In-app Drops are not issued tokens or a promise of cash.</div>';
  }else{
   menu.innerHTML=top+
    '<button data-experience-auth="register" role="menuitem">Create Free Account <span>✦</span></button>'+
    '<button data-experience-auth="login" role="menuitem">Sign In <span>↗</span></button>'+
    '<button data-action="siwe" role="menuitem">Sign In with Wallet <span>◇</span></button>'+
    '<button data-experience-guide role="menuitem">How to Start <span>?</span></button>'+
    '<div class="menu-truth">Connect a wallet by signing a readable message. No gas, deposit or token purchase is needed.</div>';
  }
 }
 function buildGuide(){
  if($('experience-guide-overlay'))return;
  const outer=document.createElement('div');
  outer.id='experience-guide-overlay';
  outer.className='experience-modal-overlay';
  outer.hidden=true;
  outer.innerHTML='<div class="experience-modal" role="dialog" aria-modal="true" aria-labelledby="experience-guide-title">'+
   '<button class="close-guide" data-experience-guide-close aria-label="Close walkthrough">×</button>'+
   '<div class="section-kicker">✦ WELCOME TO THE LIVING REALM</div>'+
   '<h2 id="experience-guide-title">Your adventure starts here.</h2>'+
   '<p>SEEKMESH is a real discovery and community app with a playful world on top. You can participate for free, save your activity, and grow your reputation through useful work.</p>'+
   '<div class="guide-steps">'+guideCards.map((step,i)=>'<div class="guide-step"><span>'+String(i+1).padStart(2,'0')+'</span><div><b>'+secure(step.title)+'</b><p>'+secure(step.description)+'</p></div></div>').join('')+'</div>'+
   '<div class="guide-actions"><button class="btn btn-gold" data-experience-auth="register">Create Account →</button><button class="btn btn-glass" data-nav="genesis">Explore Season Zero →</button><button class="btn btn-quiet" data-experience-guide-close>Maybe Later</button></div>'+
   '<p class="menu-truth">Genesis Drops are internal in-app activity points. No SEEK token has been issued and no future token claim is guaranteed.</p></div>';
  document.body.append(outer);
  document.addEventListener('click',event=>{
   if(event.target.closest('[data-experience-guide]')){
    event.preventDefault();
    toggleMenu(false);
    openGuide();
   }
   if(event.target.closest('[data-experience-guide-close]')||event.target===outer)closeGuide();
   if(outer.contains(event.target)&&event.target.closest('[data-nav],[data-experience-auth]'))closeGuide();
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!outer.hidden)closeGuide()});
  if(!$('experience-help-button')){
   const help=document.createElement('button');
   help.type='button';
   help.id='experience-help-button';
   help.className='experience-help-button';
   help.dataset.experienceGuide='';
   help.textContent='◇ Need help?';
   document.body.append(help);
  }
 }
 function openGuide(){
  const outer=$('experience-guide-overlay');if(!outer)return;
  outer.hidden=false;
  document.body.style.overflow='hidden';
  outer.querySelector('[data-experience-guide-close]')?.focus();
 }
 function closeGuide(){
  const outer=$('experience-guide-overlay');if(!outer)return;
  outer.hidden=true;
  document.body.style.overflow=$('modal-overlay')?.hidden===false?'hidden':'';
 }
 function chapterNav(){
  for(const [id,data] of Object.entries(routeHelp)){
   const section=$(id);
   if(!section||section.querySelector(':scope > .route-compass'))continue;
   const header=section.querySelector(':scope > .subscreen-header:first-child')||section.querySelector(':scope > .launch-hero')||section.querySelector(':scope > .os-hero')||section.querySelector(':scope > .genesis-hero');
   if(!header)continue;
   const guide=document.createElement('div');
   guide.className='route-compass';
   guide.innerHTML='<strong>✧ START HERE · '+secure(data.title)+'</strong><div class="route-guide-steps">'+data.steps.map((v,i)=>'<span>'+(i+1)+'. '+secure(v)+'</span>').join('')+'</div><button data-experience-guide type="button">Open Guide ↗</button>';
   header.insertAdjacentElement('afterend',guide);
  }
  const atlas=$('atlas');const status=atlas?.querySelector('#atlas-count');
  if(atlas&&!atlas.querySelector('.exp-explain')&&status){
   const explain=document.createElement('div');
   explain.className='exp-explain';
   explain.innerHTML='<article><b>1 · DISCOVER CAPABILITIES</b><p>Browse official MCP Registry entries plus community-proposed agent and API listings. Every entry links back to its source.</p></article>'+
    '<article><b>2 · CHECK OWNERSHIP</b><p>Self-reported claims are not verified. ERC-8004 wallet ownership can be checked against the registry onchain.</p></article>'+
    '<article><b>3 · REVIEW REAL OBSERVATIONS</b><p>See recorded HTTP response and latency observations when available. This is not an independent security or performance audit.</p></article>';
   const result=atlas.querySelector('#atlas-results');
   if(result)result.before(explain);
  }
  const os=$('os');
  if(os&&!os.querySelector('.exp-explain')){
   const expl=document.createElement('div');expl.className='exp-explain';
   expl.innerHTML='<article><b>REAL WORK</b><p>Source discovery, indexing and selected quality checks run through bounded executors rather than thousands of imaginary processes.</p></article>'+
    '<article><b>INDEPENDENT EVIDENCE</b><p>Follow persisted work packets, status and source-linked receipts; errors remain visible rather than being counted as successes.</p></article>'+
    '<article><b>JOIN THE LOOP</b><p>Explorers can submit a resource, join a Guild or complete the next mission. The OS does not award tokens for empty interactions.</p></article>';
   const metrics=os.querySelector('#os-metrics');if(metrics)metrics.before(expl);
  }
 }
 let loadingHome=false,homeLastLoad=0;
 async function loadHome(){
  if(!$('home-leaderboard')||loadingHome)return;
  if(Date.now()-homeLastLoad<12000)return;
  loadingHome=true;
  try{
   const result=await Promise.allSettled([api('/api/genesis/leaderboard'),api('/api/guilds')]);
   if(result[0].status==='fulfilled'){
    const records=result[0].value.members||[];
    $('home-leaderboard').innerHTML=records.length?records.slice(0,6).map((r,i)=>
     '<div class="home-board-row"><span class="board-place">'+(i+1)+'</span><img src="/assets/realm-avatar.webp" alt=""><span class="board-user">@'+secure(r.handle)+'</span><span class="board-score">'+n(r.drops)+' Drops</span></div>'
    ).join(''):'<p class="genesis-empty">The first Explorer can claim the top spot. No fabricated ranks.</p>';
   }else $('home-leaderboard').innerHTML='<p class="genesis-empty">The real leaderboard is temporarily unavailable.</p>';
   if(result[1].status==='fulfilled'){
    const guilds=result[1].value.guilds||[];
    $('home-guild-preview').innerHTML=guilds.length?guilds.slice(0,2).map(g=>
     '<p><strong>'+secure(g.name)+'</strong><br>'+secure(g.category||'Community')+' · '+n(g.members)+' real member'+(Number(g.members)===1?'':'s')+'</p>').join('')
     :'<p>Find your crew—or become the first Guild founder.</p>';
   }else $('home-guild-preview').textContent='Explore active Guilds and create your own.';
   homeLastLoad=Date.now();
  }catch(e){
   $('home-leaderboard').textContent='Live data could not be loaded.';
  }finally{loadingHome=false}
 }
 function onNavigate(name){
  toggleMenu(false);
  closeGuide();
  if(name==='home')void loadHome();
  if(name==='atlas'||name==='os'||name==='migrate')chapterNav();
 }
 function init(){
  ensureMenu();buildGuide();chapterNav();syncAccount();
  if(state.view==='home')void loadHome();
 }
 window.SeekmeshExperience={init,loadHome,syncAccount,onNavigate,openGuide,closeGuide};
 document.addEventListener('DOMContentLoaded',init,{once:true});
})();
