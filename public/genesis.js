/* Genesis Season Zero: real persisted internal balances and separately marked synthetic QA. */
(()=>{
 const node=id=>document.getElementById(id);
 const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\u0027':'&#39;'}[c]));
 const num=v=>Number(v||0).toLocaleString();
 let busy=false;
 const rewardRows=items=>items.map(r=>'<div class="genesis-reward"><span>'+safe(r.label)+'</span><b>+'+num(r.drops)+' Drops</b></div>').join('');
 const ranking=(rows,scope)=>rows.length?rows.map((r,i)=>'<div class="genesis-rank"><span class="rank-position">'+String(i+1).padStart(2,'0')+'</span><span class="rank-name">@'+safe(r.handle)+'<small>'+safe(r.role)+'</small></span><strong>'+num(r.drops)+' Drops</strong></div>').join(''):'<p class="genesis-empty">No '+(scope==='simulation'?'synthetic QA personas':'real explorers')+' ranked yet. Join Season Zero to begin.</p>';
 async function load(){
  if(busy||!node('genesis-metrics'))return;busy=true;
  try{
   const [publicInfo,real,simulation]=await Promise.all([api('/api/genesis/status'),api('/api/genesis/leaderboard'),api('/api/genesis/leaderboard?scope=simulation')]);
   node('genesis-metrics').innerHTML='<div><b>'+num(publicInfo.realMembers)+'</b><small>REAL EXPLORERS</small></div><div><b>'+num(publicInfo.realDropsCredited)+'</b><small>IN-APP DROPS CREDITED</small></div><div><b>'+num(publicInfo.qualifiedReferrals)+'</b><small>QUALIFIED REFERRALS</small></div>';
   node('genesis-rewards').innerHTML=rewardRows(publicInfo.rewards);
   node('genesis-real-board').innerHTML=ranking(real.members,'real');
   node('genesis-demo-board').innerHTML=ranking(simulation.members,'simulation');
   node('genesis-state').textContent=publicInfo.status==='live'?'SEASON ZERO · NOW LIVE':'SEASON ZERO · ARCHIVED';
   const m=state.member;
   if(m){
    const data=await api('/api/genesis/me');
    const p=data.genesis;
    if(p){
     node('genesis-my-drops').textContent=num(p.drops);
     node('genesis-my-refs').textContent=p.referrals.registered+' invited · '+p.referrals.qualified+' qualified';
     node('genesis-invite-link').textContent=location.origin+p.inviteUrl;
     node('genesis-my-log').innerHTML=p.history.length?p.history.slice(0,12).map(h=>'<div class="genesis-ledger-row"><span>'+safe(h.reason.replaceAll('-',' '))+' <small>'+safe(h.origin_at)+'</small></span><b>+'+num(h.amount)+'</b></div>').join(''):'<p>Complete your first mission to unlock your in-app reward ledger.</p>';
     node('genesis-member').hidden=false;
     node('genesis-visitor').hidden=true;
    }
   }else{
    node('genesis-member').hidden=true;node('genesis-visitor').hidden=false;
   }
  }catch(e){node('genesis-metrics').textContent='Live Genesis records unavailable: '+e.message}
  finally{busy=false}
 }
 async function badge(){
  if(!node('profile-drops'))return;
  if(!state.member){node('profile-drops').textContent='—';return;}
  try{const response=await api('/api/genesis/me');node('profile-drops').textContent=num(response.genesis.drops);}
  catch{node('profile-drops').textContent='—'}
 }
 async function invite(){
  if(!state.member){state.authMode='register';openModal('auth');return;}
  const link=location.origin+'/?invite='+encodeURIComponent(state.member.referral_code);
  try{await navigator.clipboard.writeText(link);toast('Genesis referral link copied — rewards for verified contributions.');}
  catch{toast(link)}
 }
 document.addEventListener('click',event=>{
  const b=event.target.closest('[data-genesis-invite]');if(b){event.preventDefault();void invite();}
  const tabs=event.target.closest('[data-genesis-scope]');
  if(tabs){
   const isDemo=tabs.dataset.genesisScope==='simulation';
   node('genesis-real-board').hidden=isDemo;
   node('genesis-demo-board').hidden=!isDemo;
   document.querySelectorAll('[data-genesis-scope]').forEach(x=>{x.classList.toggle('is-selected',x===tabs);x.setAttribute('aria-pressed',String(x===tabs))});
  }
  const cast=event.target.closest('[data-genesis-share]');
  if(cast){
   const target=state.member?location.origin+'/?invite='+encodeURIComponent(state.member.referral_code):location.origin+'/genesis';
   const content='I joined SEEKMESH Season Zero. Explore useful Web3 and AI projects, complete verified missions, and earn saved in-app Genesis Drops (not tokens).';
   if(navigator.share)navigator.share({title:'SEEKMESH Season Zero',text:content,url:target}).catch(()=>{});
   else navigator.clipboard?.writeText(content+' '+target).then(()=>toast('Season Zero invitation copied.')).catch(()=>toast(target));
  }
 });
 window.SeekmeshGenesis={load,badge,invite};
 document.addEventListener('DOMContentLoaded',()=>{void badge();if(state.view==='genesis')void load()},{once:true});
})();
