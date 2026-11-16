/* SEEKMESH Realm UI — existing /api/mesh/* backend; no simulated members, balances, or crypto. */
const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toNum = x => Number(x || 0).toLocaleString();
function trackEvent(event,target=''){if(!navigator.onLine)return;fetch('/api/telemetry',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({event,target}),keepalive:true}).catch(()=>{});}
let guildSlug=null;
let reportResourceId=null;
let lastTrackedQuery='';

const state = {view:'home',member:null,token:localStorage.getItem('seekmesh-realm-session')||'',wallet:null,authMode:'register',invite:new URLSearchParams(location.search).get('invite')||'',pending:null,category:'All',query:'',filters:0,origin:location.origin};
const paths={home:'/',explore:'/explore',missions:'/missions',guilds:'/guilds',build:'/build',rewards:'/rewards',market:'/market',node:'/app',os:'/os'};
const routeViews={'/':'home','/explore':'explore','/missions':'missions','/rewards':'rewards','/app':'node','/partners':'build','/build':'build','/guilds':'guilds','/market':'market','/os':'os'};
const categories=['All','AI & Models','Agent Infrastructure','Protocols','Communities','Builders','Search & Data'];
const missions=[
 {id:'join',title:'Activate Your Explorer',desc:'Create your own pseudonymous account to track verified discovery progress.',xp:25,cr:5,action:'enter',reason:'founding-node'},
 {id:'daily',title:'Daily Discovery',desc:'Return each UTC day and claim your daily discovery participation reward.',xp:4,cr:2,action:'daily',reason:'daily-discovery'},
 {id:'orientation',title:'Proof Before Hype',desc:'Answer a source-quality question to unlock your verification badge progress.',xp:20,cr:5,action:'orientation',reason:'orientation'},
 {id:'submit',title:'Map a Useful Project',desc:'Submit an original, source-linked Web3 or AI resource. Earn after editorial acceptance.',xp:40,cr:20,action:'submit',reason:'approved-resource'},
 {id:'invite',title:'Bring a Qualified Builder',desc:'Invite someone whose original source is later approved; no points for empty referrals.',xp:15,cr:5,action:'invite',reason:'qualified-referral'}
];
let toastTimeout;
function toast(s){$('toast').textContent=s;$('toast').classList.add('is-visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').classList.remove('is-visible'),4000);}
async function api(path,options={}){const headers={'content-type':'application/json',...options.headers};if(state.token)headers.Authorization='Bearer '+state.token;const response=await fetch(path,{...options,headers});let data;try{data=await response.json()}catch{throw Error('The server returned an invalid response.')}if(!response.ok)throw Error(data.error||`HTTP ${response.status}`);return data;}
const post=(path,payload={})=>api(path,{method:'POST',body:JSON.stringify(payload)});
function openModal(kind='auth'){
 $('modal-overlay').hidden=false;document.body.style.overflow='hidden';$('modal-error').hidden=true;
 $('modal-kicker').textContent=kind==='submit'?'BUILD / SUBMIT SOURCE':kind==='sponsor'?'ECOSYSTEM / PARTNERS':kind==='wallet'?'WALLET / OPTIONAL':kind==='guild'?'GUILD / COMMUNITY':kind==='source'?'SOURCE QUALITY / COMMUNITY':'EXPLORER ACCOUNT';
 $('modal-heading').textContent={auth:state.authMode==='register'?'Enter the Discovery Realm':'Welcome Back, Explorer',submit:'Map a Real Discovery',sponsor:'Request a Partnership',wallet:'Verified Web3 Wallet',unlink:'Unlink Your Wallet',guild:'Found Your Builder Guild',source:'Report a Source'}[kind]||'SEEKMESH';
 $('modal-intro').textContent={auth:'Progress is stored in your account, not a speculative token balance.',submit:'The reward is credited only after a real moderator accepts your source.',sponsor:'No payment is collected from this inquiry.',wallet:'Sign one readable message to prove you control your wallet. No transfer or blockchain transaction is requested.',unlink:'Remove the verified wallet link using your explorer account password.',guild:'Create a real Guild for builders and explorers. Max one guild founded and three memberships per account.',source:'Help keep the discovery index useful. Reports go to the founder moderation queue and do not automatically delist a source.'}[kind]||'';
 const modal=$('modal-content');
 if(kind==='auth')modal.innerHTML=`<div class="auth-toggle"><button data-authmode="register" class="${state.authMode==='register'?'selected':''}">Create account</button><button data-authmode="login" class="${state.authMode==='login'?'selected':''}">Sign in</button></div><form id="form-auth"><label>EXPLORER HANDLE<input name="handle" required minlength="3" maxlength="24" pattern="[A-Za-z][A-Za-z0-9_]{2,23}" autocomplete="username" placeholder="e.g. SkySeeker"></label><label>PASSWORD<input name="password" type="password" required minlength="12" maxlength="128" autocomplete="${state.authMode==='register'?'new-password':'current-password'}" placeholder="12 or more characters"></label>${state.authMode==='register'?'<label>YOUR PATH<select name="role"><option>Explorer</option><option>Builder</option><option>Curator</option><option>Agent Developer</option><option>Community</option><option>Partner</option></select></label>':''}<button type="submit" class="btn btn-gold">${state.authMode==='register'?'Create Explorer':'Sign In'} →</button><p>No email required. Save your password; account recovery is not yet enabled.</p></form><button class="btn btn-glass" type="button" data-action="siwe">◇ Sign in with Ethereum Wallet ↗</button><p class="wallet-note">Sign a readable message. No password, deposit, gas fee or token claim. EOA wallets supported.</p>`;
 else if(kind==='submit')modal.innerHTML=`<form id="form-submit"><label>PROJECT NAME<input name="name" required minlength="3" maxlength="80"></label><label>PUBLIC PROJECT URL<input name="url" type="url" required placeholder="https://…"></label><label>WHAT MAKES THIS USEFUL?<textarea name="description" rows="4" minlength="25" maxlength="420" required placeholder="Describe actual features and evidence"></textarea></label><label>CATEGORY<select name="category">${categories.filter(x=>x!=='All').map(c=>`<option>${esc(c)}</option>`).join('')}</select></label><label>TAGS<input name="tags" maxlength="140" placeholder="Optional"></label><button class="btn btn-gold" type="submit">Submit for Review →</button><p>40 XP + 20 Credits after acceptance. Submission alone earns nothing.</p></form>`;
 else if(kind==='sponsor')modal.innerHTML=`<form id="form-sponsor"><label>CONTACT EMAIL<input name="email" type="email" required></label><label>YOUR PROJECT URL<input name="url" type="url" required></label><label>PARTNERSHIP TYPE<select name="plan"><option value="ecosystem">Ecosystem visibility</option><option value="spotlight">Sponsored placement inquiry</option><option value="research">Discovery research</option></select></label><label>PROJECT BRIEF<textarea name="brief" rows="4" minlength="15" maxlength="700" required></textarea></label><button class="btn btn-gold" type="submit">Send Partnership Inquiry →</button><p>Saved in the operator inbox; no paid checkout is enabled.</p></form>`;
 else if(kind==='guild')modal.innerHTML=`<form id="form-guild"><label>GUILD NAME<input name="name" maxlength="48" minlength="3" required placeholder="Agent Discovery Collective"></label><label>WHAT WILL YOUR GUILD DO?<textarea name="about" minlength="35" maxlength="420" rows="4" required placeholder="Describe the sources, tools or work your guild will collaborate on."></textarea></label><label>GUILD CATEGORY<select name="category">${categories.filter(x=>x!=='All').map(x=>`<option>${esc(x)}</option>`).join('')}</select></label><button class="btn btn-gold" type="submit">Found Guild →</button><p>New guilds start with one real founder. No invented members, airdrop entitlement or automatic XP.</p></form>`;
 else if(kind==='source')modal.innerHTML=`<form id="form-source-report"><input type="hidden" name="resourceId" value="${Number(reportResourceId)||0}"><label>ISSUE TYPE<select name="reason"><option value="broken-link">Broken link</option><option value="outdated">Outdated information</option><option value="misleading">Misleading listing</option><option value="suspicious">Suspicious or unsafe project</option><option value="duplicate">Duplicate source</option></select></label><label>DETAILS (OPTIONAL)<textarea name="detail" rows="3" maxlength="240" placeholder="What did you observe? Link-specific details help the review team."></textarea></label><button class="btn btn-gold" type="submit">Send Source Report →</button><p>One report per reason and member. No points for reporting.</p></form>`;
 else if(kind==='unlink')modal.innerHTML=`<form id="form-wallet-unlink"><label>EXPLORER ACCOUNT PASSWORD<input name="password" type="password" minlength="12" autocomplete="current-password" required></label><button class="btn btn-gold" type="submit">Unlink Wallet →</button><p>This does not change or move any onchain assets. It only removes the wallet proof from your SEEKMESH profile.</p></form>`;
 else if(kind==='wallet')modal.innerHTML=`<div class="realm-panel"><p id="wallet-modal-status">${state.wallet?`Connected address: ${esc(state.wallet)}`:'No wallet is connected.'}</p><button class="btn btn-gold" data-action="wallet">${state.wallet?'Refresh Wallet':'Connect Browser Wallet'} →</button><p>Wallet ownership is verified through a one-time EIP-191 signature. No transfer or token claim is authorized.</p></div>`;
}
function closeModal(){$('modal-overlay').hidden=true;document.body.style.overflow='';$('modal-error').hidden=true;}
function modalError(err){$('modal-error').textContent=err.message||String(err);$('modal-error').hidden=false;}
function navigate(name,push=true){if(!paths[name])name='home';state.view=name;document.querySelectorAll('.view').forEach(x=>x.classList.toggle('is-visible',x.id===name));document.querySelectorAll('[data-nav]').forEach(x=>x.classList.toggle('is-active',x.dataset.nav===name));if(push)history.pushState({view:name},'',paths[name]);window.scrollTo({top:0,behavior:'instant'});if(name==='explore')loadResources();if(name==='guilds'){loadGuilds();loadLeaderboard();}if(name==='missions')renderMissions();if(name==='rewards')renderRewards();if(name==='market')loadMarket();if(name==='node')renderNode();if(name==='os')loadRealmOS();if(name!=='os')trackEvent('page_'+name);}
function accountUI(){const m=state.member;$('profile-handle').textContent=m?`@${m.handle}`:'Your Explorer';$('profile-level').textContent=m?`Lv. ${m.level} · ${m.role}`:'Lv. 1 · Explorer';$('profile-credits').textContent=m?toNum(m.credits):'—';$('profile-xp').textContent=m?toNum(m.xp):'—';$('vault-credits').textContent=m?toNum(m.credits):'—';const levelXP=m?Number(m.xp)%80:0;$('profile-progress').style.width=m?`${Math.min(100,levelXP/80*100)}%`:'0%';$('profile-xp-text').textContent=m?`${levelXP} / 80 XP toward next milestone`:'Join to start collecting XP';$('wallet-short').textContent=state.wallet?`${state.wallet.slice(0,6)}…${state.wallet.slice(-4)}`:m?'Local explorer ID':'Not connected';$('daily-claim').textContent=m?'♕ Claim Daily Reward':'♕ Join to Claim Rewards';renderRewards();renderNode();}
async function refreshMe(){if(!state.token){state.member=null;accountUI();return;}try{state.member=(await api('/api/mesh/me')).member;state.wallet=state.member.walletAddress||null;}catch{state.member=null;state.token='';localStorage.removeItem('seekmesh-realm-session');}accountUI();}
async function stats(){try{const [main,mesh]=await Promise.all([api('/api/stats'),api('/api/mesh/stats')]);$('metric-nodes').textContent=toNum(mesh.nodes);$('metric-resources').textContent=toNum(main.resources);$('metric-actions').textContent=toNum(mesh.completedActions);$('metric-credits').textContent=toNum(mesh.creditsSpent);}catch{for(const id of ['metric-nodes','metric-resources','metric-actions','metric-credits'])$(id).textContent='—';}}
function resourceCard(r,spotlight=false){let host='Original source';try{host=new URL(r.url).hostname.replace(/^www\./,'')}catch{}return `<article class="resource-card"><span class="category">${spotlight?'EARNED COMMUNITY SPOTLIGHT':esc(r.category||'Source-linked resource')}</span><h3>${esc(r.name)}</h3><p>${esc(r.description)}</p><a href="${esc(r.url)}" data-source-id="${Number(r.id)||0}" rel="noopener noreferrer" target="_blank">${esc(host)} <span>↗</span></a><div class="source-proof"><span>${r.source==="community"?"Community-reviewed":"Editorial index"} · Source linked${r.approved_at?" · Added "+esc(r.approved_at.slice(0,10)):""}</span><button data-report-source="${Number(r.id)||0}" aria-label="Report an issue with this source">Report issue</button></div></article>`;}
let resourceSeq=0;
async function loadResources(){const seq=++resourceSeq;const q=new URLSearchParams();if(state.query)q.set('q',state.query);if(state.category!=='All')q.set('category',state.category);try{const out=await api('/api/resources?'+q);if(seq!==resourceSeq)return;if(state.query.length>=3&&state.query!==lastTrackedQuery){lastTrackedQuery=state.query;trackEvent('query_run');}$('resource-grid').innerHTML=out.resources.length?out.resources.map(r=>resourceCard(r)).join(''):'<article class="realm-panel">No matches. Map something worth finding.</article>';}catch(e){$('resource-grid').innerHTML=`<article class="realm-panel">${esc(e.message)}</article>`;}}
async function loadGuilds(){
 try{const out=await api('/api/guilds');
  $('guild-grid').innerHTML=out.guilds.length?out.guilds.map(g=>`<article class="realm-panel guild-card">
   <span class="section-kicker">${esc(g.category)} · GUILD</span>
   <h3>${esc(g.name)}</h3><p>${esc(g.about)}</p>
   <div class="guild-meta"><span>♧ ${toNum(g.members)} members</span><span>✧ ${toNum(g.guild_xp)} XP</span><span>✦ ${toNum(g.signals)} signals</span></div>
   <button class="btn btn-glass" data-guild-action="open" data-guild-slug="${esc(g.slug)}">Explore Guild →</button>
   </article>`).join(''):'<article class="realm-panel guild-empty"><h3>Found the first Guild.</h3><p>Gather AI builders, curators or Web3 explorers. This network starts with real people, not simulated players.</p><button class="btn btn-gold" data-action="guild-create">Create Genesis Guild →</button></article>';
 }catch(e){$('guild-grid').innerHTML=`<article class="realm-panel">${esc(e.message)}</article>`;}
}
async function openGuild(slug){
 guildSlug=slug;
 try{const out=await api('/api/guilds/'+encodeURIComponent(slug));const g=out.guild;
  const actions=state.member?(g.joined?`<button class="btn btn-glass" data-guild-action="leave" data-guild-slug="${esc(slug)}">Leave Guild</button>`:`<button class="btn btn-gold" data-guild-action="join" data-guild-slug="${esc(slug)}">Join Guild →</button>`):'<button class="btn btn-gold" data-action="enter">Create account to join →</button>';
  const signals=(g.posts||[]).map(p=>`<div class="guild-signal"><div><b>@${esc(p.author)}</b><small>${esc(p.created_at)}</small></div><p>${esc(p.body)}</p><button data-guild-action="report" data-post-id="${p.id}" class="report-btn" title="Report source-quality or conduct issue">Report</button></div>`).join('')||'<p class="guild-missing">No public signals yet. Members can start a source-quality discussion.</p>';
  const members=(g.membersList||[]).map(m=>`<span class="guild-person">✦ @${esc(m.handle)} · ${toNum(m.xp)} XP</span>`).join('');
  $('guild-detail').hidden=false;
  $('guild-detail').innerHTML=`<div class="guild-detail-head"><div><span class="section-kicker">LIVE GUILD · ${esc(g.category)}</span><h2>${esc(g.name)}</h2><p>${esc(g.about)}</p><div class="guild-meta">Founded by @${esc(g.founder)} · ${toNum(g.members)} members · ${toNum(g.signals)} signals</div></div><button class="icon-btn" data-guild-action="close" aria-label="Close guild">×</button></div>
   <div class="guild-actions">${actions}<button class="btn btn-glass" data-guild-action="share" data-guild-slug="${esc(slug)}">Copy Guild Invite ↗</button></div>
   <div class="guild-two-columns"><div><h3>Guild Signals</h3>${signals}${g.joined?'<form id="form-guild-post"><label>ADD A USEFUL SIGNAL<textarea name="body" maxlength="280" minlength="12" rows="3" placeholder="A verification observation, discovery note, or useful next step…" required></textarea></label><button type="submit" class="btn btn-gold">Publish Signal →</button><small>Plain-text only. No links, spam or XP farming.</small></form>':''}</div>
   <div><h3>Explorer Roster</h3><div class="guild-roster">${members}</div></div></div>`;
  $('guild-detail').scrollIntoView({behavior:'smooth',block:'nearest'});
 }catch(e){toast(e.message);}
}

async function loadLeaderboard(){try{const out=await api('/api/mesh/leaderboard');$('guild-leaderboard').innerHTML=out.members.length?out.members.map((m,i)=>`<div class="rank-row"><span>#${i+1}</span><b>@${esc(m.handle)}</b><small>${esc(m.role)}</small><strong>${toNum(m.xp)} XP</strong></div>`).join(''):'<p class="rank-empty">No ranked members yet. Real contributions will appear here.</p>';}catch(e){$('guild-leaderboard').innerHTML=`<p>${esc(e.message)}</p>`;}}
async function loadMarket(){try{const out=await api('/api/mesh/spotlights');$('market-grid').innerHTML=out.spotlights.length?out.spotlights.map(r=>resourceCard(r,true)).join(''):'<article class="realm-panel">No earned spotlights are active yet. Be among the first builders to contribute.</article>';}catch(e){$('market-grid').innerHTML=`<article class="realm-panel">${esc(e.message)}</article>`;}}
function renderMissions(){const m=state.member;const today=new Date().toISOString().slice(0,10);$('mission-grid').innerHTML=missions.map((q,i)=>{const done=q.id==='join'?!!m:q.id==='daily'?m?.history?.some(h=>h.reason==='daily-discovery'&&h.created_at?.slice(0,10)===today):q.id==='orientation'?m?.history?.some(h=>h.reason==='orientation'):false;return `<article class="mission-card"><span class="category">MISSION 0${i+1} · SEASON ZERO</span><h3>${esc(q.title)}</h3><p>${esc(q.desc)}</p><div class="reward-line">+${q.xp} XP &nbsp; ✧ +${q.cr} Credits</div><button data-action="${q.action}" class="btn ${done?'btn-glass':'btn-gold'}" ${done?'disabled':''}>${done?'✓ Completed':'Start Mission →'}</button></article>`}).join('');}
function renderRewards(){const m=state.member;$('vault-credits').textContent=m?toNum(m.credits):'—';$('redeem-source').innerHTML=m?'<option value="">Select approved source</option>'+m.submissions.filter(s=>s.state==='approved').map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join(''):'<option value="">Sign in to see your approved sources</option>';}

/* Real, public Realm OS telemetry; no simulated workers, member totals or token supply. */
async function loadRealmOS(){
 try{
  const os=await api('/api/os/status'),m=os.metrics||{};
  const cell=(n,label,sub)=>'<article class="os-metric"><b>'+esc(Number(n||0).toLocaleString())+'</b><strong>'+esc(label)+'</strong><small>'+esc(sub)+'</small></article>';
  $('os-metrics').innerHTML=cell(m.resources,'SOURCE NODES','Indexed links')+cell(m.members,'EXPLORERS','Registered accounts')+cell(m.guilds,'BUILDER GUILDS','Persisted communities')+cell(os.logicalAgentRoles,'OS ROLES','Logical, not processes')+cell(m.workers_online,'EDGE WORKERS','Connected in 24h');
  $('os-expeditions').innerHTML=os.expeditions?.length?os.expeditions.map(e=>'<article class="realm-panel os-expedition"><span class="section-kicker">WEEKLY / DISCOVERY MISSION</span><h3>'+esc(e.category)+'</h3><p>Find and submit useful original sources. +40 XP and +20 internal Credits are earned only when an original source is approved.</p><div class="os-bar"><i style="width:'+Math.min(100,Math.max(0,Number(e.progress)||0))+'%"></i></div><div class="os-stats-line">'+esc(e.accepted)+' / '+esc(e.target)+' accepted · '+esc(e.pending)+' pending</div><button data-action="submit" class="btn btn-gold">Map a Source ↗</button></article>').join(''):'<div class="realm-panel">A real expedition appears after the first scheduled OS pulse.</div>';
  $('os-signals').innerHTML=(os.signals||[]).length?os.signals.map(x=>'<article class="realm-panel os-signal"><div class="section-kicker">SCOUT CANDIDATE · SCORE '+esc(x.score)+'/100</div><h3>'+esc(x.name)+'</h3><p>'+esc(x.description)+'</p><small>'+esc(x.category)+' · SOURCE NOT INDEPENDENTLY VERIFIED</small><a href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer">Inspect original source ↗</a></article>').join(''):'<div class="realm-panel">No inspected candidates ready yet. Scheduled source scouting is operating within the configured budget.</div>';
  $('os-phases').innerHTML=(os.phases||[]).map((p,i)=>'<article class="os-phase"><div class="os-phase-num">0'+(i+1)+'</div><div><h3>'+esc(p.name)+'</h3><p>'+esc(p.objective)+'</p><div class="os-bar"><i style="width:'+Math.min(100,Math.max(0,Number(p.progress)||0))+'%"></i></div></div><div class="os-phase-state"><b>'+esc(p.progress)+'%</b><small>'+esc(p.status.replace(/_/g,' '))+'</small></div></article>').join('');
  $('os-roles').innerHTML=(os.roles||[]).map(a=>'<article class="os-role"><span class="os-role-icon">✧</span><div><small>'+esc(a.department)+'</small><h3>'+esc(a.name)+'</h3><p>'+esc(a.mission)+'</p><span class="os-role-state">'+esc(a.state)+' · logical role</span></div></article>').join('');
 }catch(e){$('os-metrics').innerHTML='<div class="realm-panel">Live OS data unavailable: '+esc(e.message)+'</div>';$('os-expeditions').innerHTML='';$('os-signals').innerHTML='';$('os-phases').innerHTML='';$('os-roles').innerHTML='';}
}

function renderNode(){const m=state.member;if(!m){$('node-profile').innerHTML='<h3>Your explorer awaits</h3><p>Create your account to track XP, submitted projects and the discovery economy.</p><button class="btn btn-gold" data-action="enter">Create Explorer →</button>';$('node-history').innerHTML='';return;}const invite=`${state.origin}/?invite=${encodeURIComponent(m.referral_code)}`;$('node-profile').innerHTML=`<div class="node-card"><img src="/assets/realm-avatar.webp" width="76" height="76" style="border-radius:50%" alt="Your Realm avatar"><div><strong>@${esc(m.handle)}</strong><p>${esc(m.role)} · Level ${m.level}</p></div><div class="node-credits">${toNum(m.xp)} XP<br>${toNum(m.credits)} Credits</div></div><div class="node-actions"><button data-action="invite">Copy Invite ↗</button><button data-action="submit">Submit a Source ↗</button><button data-action="signout">Sign Out</button>${m.walletAddress?'<button data-action="wallet-unlink">Unlink verified wallet</button>':'<button data-action="wallet">Verify wallet ownership ↗</button>'}</div><p style="overflow-wrap:anywhere">Referral: ${esc(invite)} · Earn only after the invitee submits an approved source.</p><h3>Your project submissions</h3>${m.submissions.length?m.submissions.map(s=>`<div class="history-row"><span>${esc(s.name)}</span><b>${esc(s.state)}</b></div>`).join(''):'<p>No submitted sources yet.</p>'}`;$('node-history').innerHTML=(m.history||[]).map(h=>`<div class="history-row"><span>${esc(h.reason.replaceAll('-',' '))} · ${esc(h.created_at)}</span><b>${h.xp>0?'+':''}${h.xp} XP · ${h.credits>0?'+':''}${h.credits} Credits</b></div>`).join('');}
async function action(name){
 if(name==='guild-create'){
  trackEvent('guild_join');
  if(!state.member){state.pending='guild-create';openModal('auth');}else openModal('guild');
  return;
 }
 if(name==='enter')trackEvent('join_start');
 if(name==='submit')trackEvent('submit_start');
 if(name==='sponsor')trackEvent('partner_start');
 switch(name){case'enter':if(state.member)navigate('node');else{state.authMode='register';openModal('auth');}break;case'learn':navigate('missions');break;case'daily':if(!state.member){state.pending='daily';openModal('auth');return;}try{const r=await post('/api/mesh/checkin');state.member=r.member;accountUI();renderMissions();stats();toast('Daily discovery complete: +4 XP, +2 Credits.');}catch(e){toast(e.message);}break;case'orientation':if(!state.member){state.pending='orientation';openModal('auth');return;}const choice=prompt('Which is reliable project evidence?\nA. Follower counts\nB. An inspectable original source link\nC. An unverified profit claim\nChoose A, B or C.');if(choice===null)return;try{const r=await post('/api/mesh/orientation',{answer:choice.trim().toUpperCase()==='B'?'source-linked':'incorrect'});state.member=r.member;accountUI();renderMissions();toast('Verification primer complete: +20 XP, +5 Credits.');}catch(e){toast(e.message);}break;case'submit':if(!state.member){state.pending='submit';openModal('auth');}else openModal('submit');break;case'wallet':if(state.member)await connectWallet();else await signInWallet();break;case'siwe':await signInWallet();break;case'wallet-unlink':if(!state.member){openModal('auth');return;}openModal('unlink');break;case'sponsor':openModal('sponsor');break;case'invite':if(!state.member){openModal('auth');return;}const url=`${state.origin}/?invite=${encodeURIComponent(state.member.referral_code)}`;try{await navigator.clipboard.writeText(url);toast('Qualified referral link copied.');}catch{toast(url);}break;case'redeem':if(!state.member){openModal('auth');return;}const subId=Number($('redeem-source').value);if(!subId){toast('Choose one of your approved sources.');return;}try{const out=await post('/api/mesh/redeem',{type:'spotlight',submissionId:subId});state.member=out.member;accountUI();loadMarket();stats();toast('Your 7-day community spotlight is now active.');}catch(e){toast(e.message);}break;case'signout':try{await post('/api/mesh/logout');}catch{}state.member=null;state.token='';localStorage.removeItem('seekmesh-realm-session');accountUI();navigate('home');toast('Signed out.');break;}}

/* EIP-4361 wallet-first entry. Never asks for seed phrases, funds or transactions. */
async function signInWallet(){
 if(!window.ethereum?.request){toast('Install a compatible Ethereum browser wallet for passwordless entry.');return;}
 try{
  const accounts=await window.ethereum.request({method:'eth_requestAccounts'}),address=accounts?.[0];
  if(!address)return;
  const chainRaw=await window.ethereum.request({method:'eth_chainId'});
  const chainId=Number.parseInt(chainRaw,16);
  if(!Number.isSafeInteger(chainId))throw Error('Unsupported wallet chain.');
  const issued=await post('/api/siwe/challenge',{address,chainId});
  const bytes=new TextEncoder().encode(issued.message);
  const hex='0x'+Array.from(bytes).map(n=>n.toString(16).padStart(2,'0')).join('');
  const signature=await window.ethereum.request({method:'personal_sign',params:[hex,address]});
  const out=await post('/api/siwe/verify',{id:issued.id,signature,chainId,address,invite:state.invite});
  state.token=out.token;state.member=out.member;state.wallet=out.walletAddress;
  localStorage.setItem('seekmesh-realm-session',out.token);
  closeModal();accountUI();renderMissions();stats();
  toast(out.newMember?'New wallet explorer activated; +25 XP and +5 Credits.':'Signed in with your verified wallet.');
  const pending=state.pending;state.pending=null;
  if(pending==='submit')openModal('submit');
  else if(pending==='daily')await action('daily');
  else if(pending==='orientation')await action('orientation');
  else if(pending==='guild-create')openModal('guild');
  else if(pending==='source-report')openModal('source');
  else navigate('node');
 }catch(e){toast(e.message||'Wallet signature was not verified.');}
}

async function connectWallet(){
 if(!state.member){state.pending='wallet-link';openModal('auth');return;}
 if(!window.ethereum?.request){toast('Install a compatible Ethereum browser wallet to link it.');return;}
 try{
  const accounts=await window.ethereum.request({method:'eth_requestAccounts'});
  const address=accounts?.[0];if(!address)return;
  const issued=await post('/api/mesh/wallet-challenge',{address});
  const bytes=new TextEncoder().encode(issued.message);
  const hex='0x'+Array.from(bytes).map(n=>n.toString(16).padStart(2,'0')).join('');
  const signature=await window.ethereum.request({method:'personal_sign',params:[hex,address]});
  const result=await post('/api/mesh/wallet-verify',{challengeId:issued.challengeId,signature});
  state.wallet=result.address;await refreshMe();accountUI();
  $('wallet-connect').textContent=state.wallet.slice(0,6)+'…'+state.wallet.slice(-4)+' ✓';
  toast('Wallet ownership verified by signature. No transaction required.');
  closeModal();
 }catch(e){toast(e.message||'Wallet signature not verified.');}
}
async function submitForm(form){const data=Object.fromEntries(new FormData(form).entries());const button=form.querySelector('button[type=submit]');if(button)button.disabled=true;try{if(form.id==='form-wallet-unlink'){
  await post('/api/mesh/wallet-unlink',{password:data.password});
  closeModal();form.reset();state.wallet=null;await refreshMe();accountUI();
  $('wallet-connect').textContent='Connect Wallet ▣';toast('Verified wallet link removed.');
 }else if(form.id==='form-source-report'){
  const r=await post('/api/mesh/source-report',data);closeModal();form.reset();
  toast(r.reportRecorded?'Report queued for review. Thank you.':'This issue is already reported by your account.');
 }else if(form.id==='form-guild'){
  const r=await post('/api/guilds/create',data);closeModal();form.reset();navigate('guilds');await loadGuilds();await openGuild(r.slug);toast('Your founder Guild is live.');
 }else if(form.id==='form-auth'){const result=await post('/api/mesh/'+state.authMode,{handle:data.handle,password:data.password,role:data.role||'Explorer',invite:state.invite});state.token=result.token;localStorage.setItem('seekmesh-realm-session',result.token);state.member=result.member;closeModal();accountUI();renderMissions();stats();toast('Explorer account activated.');const pending=state.pending;state.pending=null;if(pending==='submit')openModal('submit');else if(pending==='daily')await action('daily');else if(pending==='orientation')await action('orientation');else if(pending==='guild-create')openModal('guild');else if(pending==='source-report')openModal('source');else if(pending==='wallet-link')await action('wallet');else navigate('node');}else if(form.id==='form-submit'){const r=await post('/api/mesh/submit',data);closeModal();form.reset();await refreshMe();navigate('node');toast(`Source #${r.submissionId} is pending review.`);}else if(form.id==='form-sponsor'){const r=await post('/api/mesh/sponsor',data);closeModal();form.reset();toast(`Partnership inquiry #${r.inquiryId} recorded. No payment collected.`);}}catch(e){modalError(e);}finally{if(button)button.disabled=false;}}
document.addEventListener('click',e=>{const nav=e.target.closest('[data-nav]');if(nav){e.preventDefault();navigate(nav.dataset.nav);return;}const act=e.target.closest('[data-action]');if(act){e.preventDefault();action(act.dataset.action);return;}const mode=e.target.closest('[data-authmode]');if(mode){state.authMode=mode.dataset.authmode;openModal('auth');return;}});
document.addEventListener('submit',e=>{if(['form-auth','form-submit','form-sponsor','form-guild','form-source-report','form-wallet-unlink'].includes(e.target.id)){e.preventDefault();submitForm(e.target);}else if(e.target.id==='form-guild-post'){e.preventDefault();post('/api/guilds/post',{slug:guildSlug,body:new FormData(e.target).get('body')}).then(()=>{trackEvent('guild_post');return openGuild(guildSlug)}).catch(err=>toast(err.message));}});
$('wallet-connect').addEventListener('click',()=>action('wallet'));$('open-node').addEventListener('click',()=>navigate('node'));$('open-search').addEventListener('click',()=>{navigate('explore');$('resource-query').focus();});$('daily-claim').addEventListener('click',()=>action('daily'));$('close-modal').addEventListener('click',closeModal);$('modal-overlay').addEventListener('click',e=>{if(e.target===$('modal-overlay'))closeModal();});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
let searchTimer;$('resource-query').addEventListener('input',e=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.query=e.target.value.trim();loadResources();},270)});
$('category-chips').innerHTML=categories.map(c=>`<button data-category="${esc(c)}" class="${c==='All'?'selected':''}">${esc(c)}</button>`).join('');$('category-chips').addEventListener('click',e=>{const button=e.target.closest('[data-category]');if(!button)return;state.category=button.dataset.category;document.querySelectorAll('[data-category]').forEach(x=>x.classList.toggle('selected',x===button));loadResources();});
document.addEventListener('click',async e=>{
 const outbound=e.target.closest('a[data-source-id]');if(outbound&&Number(outbound.dataset.sourceId)>0)trackEvent('source_click',outbound.dataset.sourceId);
 const btn=e.target.closest('[data-guild-action]');if(!btn)return;e.preventDefault();
 const action=btn.dataset.guildAction,slug=btn.dataset.guildSlug||guildSlug;
 if(action==='open'){openGuild(slug);return;}
 if(action==='close'){$('guild-detail').hidden=true;guildSlug=null;return;}
 if(action==='share'){const url=location.origin+'/guilds?guild='+encodeURIComponent(slug);try{await navigator.clipboard.writeText(url);toast('Guild link copied.')}catch{toast(url)}return;}
 if(!state.member){state.pending='guild-create';openModal('auth');return;}
 try{
  if(action==='join'){await post('/api/guilds/join',{slug});trackEvent('guild_join');}
  if(action==='leave')await post('/api/guilds/leave',{slug});
  if(action==='report'){const why=prompt('Report reason: spam, abuse or misinformation');if(!why)return;await post('/api/guilds/report',{postId:Number(btn.dataset.postId),reason:why.trim().toLowerCase()});toast('Report delivered for moderation.');return;}
  await loadGuilds();await openGuild(slug);toast(action==='join'?'Guild joined.':'Guild membership updated.');
 }catch(err){toast(err.message);}
});
document.addEventListener('click',e=>{
 const button=e.target.closest('[data-report-source]');if(!button)return;
 e.preventDefault();reportResourceId=Number(button.dataset.reportSource);
 if(!reportResourceId)return;
 if(!state.member){state.pending='source-report';openModal('auth');}
 else openModal('source');
});
window.addEventListener('popstate',e=>{const path=location.pathname;const search=new URLSearchParams(location.search);const v=path==='/explore'&&search.get('category')==='Communities'?'guilds':path==='/partners'&&search.has('market')?'market':routeViews[path]||'home';navigate(v,false);});
(async()=>{await refreshMe();await stats();renderMissions();const q=new URLSearchParams(location.search);const p=location.pathname;const initial=p==='/explore'&&q.get('category')==='Communities'?'guilds':p==='/partners'&&q.has('market')?'market':routeViews[p]||'home';navigate(initial,false);if(initial==='guilds'&&q.get('guild'))openGuild(q.get('guild'));if(q.get('action')==='join'&&!state.member)openModal('auth');if(q.get('action')==='submit'){if(state.member)openModal('submit');else{state.pending='submit';openModal('auth');}}})();