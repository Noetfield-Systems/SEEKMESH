/* SEEKMESH Launch Upgrade surfaces: owner-verified imports, native Agent Atlas, crypto receipts, live world. */
(()=>{
 const el=id=>document.getElementById(id);
 const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const load=(path)=>api(path);
 const card=(title,body,extras='')=>'<article class="realm-panel launch-card"><h3>'+safe(title)+'</h3><p>'+safe(body)+'</p>'+extras+'</article>';
 function shareLink(url,title){
  if(navigator.share)navigator.share({title,url}).catch(()=>navigator.clipboard?.writeText(url));
  else navigator.clipboard?.writeText(url).then(()=>toast('Share URL copied.')).catch(()=>toast(url));
 }
 const claimHTML=r=>'<div class="realm-panel claim-card"><span class="section-kicker">DOMAIN CLAIM · NOT PAID</span><p>Publish this TXT record in your project DNS:</p><code>'+safe(r.ownerVerification.record)+'</code><code>'+safe(r.ownerVerification.exactValue)+'</code><p>Once your record resolves, verify ownership. Old Galxe reward balances and personal user data do not migrate.</p><button class="btn btn-gold" data-migrate-verify="'+r.id+'">Verify DNS Ownership →</button></div>';
 async function migration(){
  if(!el('migrate-results'))return;
  try{
   const publicOut=await load('/api/migrate');
   el('migrate-results').innerHTML=publicOut.campaigns.length?publicOut.campaigns.map(c=>card(c.project,'Project domain verified: '+c.owner_domain+' · '+c.quests+' imported historical quest descriptions','<a href="/migrate?campaign='+Number(c.id)+'" class="small-link">View expedition →</a>')).join(''):'<div class="realm-panel">No verified imported campaigns yet. Be the first project owner to bring a real expedition.</div>';
   if(state.token){
    const mine=await load('/api/migrate/mine');
    el('migrate-mine').innerHTML=mine.imports.length?mine.imports.map(x=>card(x.project,x.state.toUpperCase()+' · '+x.quests+' tasks · '+x.owner_domain,x.state==='draft'?'<p class="tiny-note">If the verification challenge was lost, create a new import with a new campaign URL. Do not disclose your challenge publicly.</p>':'<span class="launch-status success">Verified domain</span>')).join(''):'<p class="tiny-note">Your imports will appear here.</p>';
   }else el('migrate-mine').innerHTML='<p>Sign in using a wallet or account to create a campaign draft.</p>';
   const campaign=new URLSearchParams(location.search).get('campaign');
   if(campaign&&/^\d+$/.test(campaign)){const found=await load('/api/migrate/'+campaign).catch(()=>null);if(found)el('migrate-detail').innerHTML=card(found.project,'Verified domain '+found.owner_domain+' · No legacy reward claims transferred.',found.quests.map(q=>'<div class="launch-row"><b>'+safe(q.title)+'</b><p>'+safe(q.description)+'</p><a href="'+safe(q.action_url)+'" target="_blank" rel="noopener noreferrer">Original task source ↗</a></div>').join(''));}
  }catch(e){el('migrate-results').textContent='Cannot load campaign index: '+e.message;}
 }
 async function agentAtlas(){
  const node=el('atlas-results');if(!node)return;
  const kind=el('atlas-kind')?.value||'';
  const query=el('atlas-query')?.value.trim()||'';
  try{
   const out=await load('/api/atlas?kind='+encodeURIComponent(kind)+'&q='+encodeURIComponent(query));
   el('atlas-count').textContent=Number(out.stats.total||0).toLocaleString()+' catalogued nodes · '+Number(out.stats.verifiedWallets||0)+' wallet verified';
   node.innerHTML=out.agents.length?out.agents.map(a=>'<article class="realm-panel atlas-entry"><div class="atlas-row"><span class="section-kicker">'+safe(a.kind.toUpperCase())+' · '+safe(a.origin)+'</span><span class="launch-status '+(a.owner_proof==='eip155_verified'?'success':'')+'">'+safe(a.owner_proof)+'</span></div><h3>'+safe(a.display_name)+'</h3><p>'+safe(a.description||'Registry entry without independent capability review.')+'</p><div class="atlas-tags"><span>Endpoint: '+safe(a.endpoint_proof)+'</span><span>'+safe(a.http_status===null?'Not probed':'HTTP '+a.http_status)+'</span><span>'+safe(a.last_checked_at||'No runtime audit')+'</span></div>'+(a.homepage?'<a href="'+safe(a.homepage)+'" target="_blank" rel="noopener noreferrer">Original source ↗</a>':'')+'</article>').join(''):'<div class="realm-panel">No matching agents indexed yet. The OS syncs official registry metadata; unverified status is shown explicitly.</div>';
  }catch(e){node.innerHTML=card('Atlas temporarily unavailable',e.message);}
 }
 async function commerce(){
  const elStatus=el('web3-payments'),mission=el('funded-expeditions');
  if(!elStatus||!mission)return;
  try{
   const [payments,campaigns]=await Promise.all([load('/api/native/x402/status'),load('/api/native/campaigns')]);
   const canFund=campaigns.status?.configured;
   const fundUI=el('fund-usdc-box');
   if(fundUI)fundUI.innerHTML=canFund?'<form id="form-fund-native" class="realm-panel launch-form"><span class="section-kicker">USDC / DIRECT FROM YOUR WALLET</span><h3>Fund an Onchain Expedition</h3><p>Contract: '+safe(campaigns.status.escrow)+' · '+safe(campaigns.status.mode)+' · Fee: '+Number(campaigns.status.feeBps)/100+'%. Sponsor deposits reward pool plus the disclosed capped fee reserve. Unused funds return after the campaign deadline by contract terms.</p><label>REWARD BUDGET, USDC<input name="amount" inputmode="decimal" required pattern="[0-9]+(\\.[0-9]{1,6})?" placeholder="5.00"></label><label><input type="checkbox" name="risk" required>I understand this requires two wallet transactions (approve, then fund) and may use real funds on mainnet.</label><button type="submit" class="btn btn-gold">Fund with Connected Wallet ↗</button><small>Only signed and chain-verified receipts are displayed as funded. Testnet uses test USDC, not real sale revenue.</small></form>':'<div class="realm-panel"><span class="section-kicker">ONCHAIN EXPEDITION FUNDING</span><h3>Escrow awaiting independent configuration</h3><p>No dedicated SEEKMESH escrow, verification signer and RPC are connected yet. The contract is tested, but funds cannot be requested until the real contract address and signer are verified.</p></div>';
   elStatus.innerHTML='<article class="realm-panel"><span class="section-kicker">x402 · NATIVE AGENT COMMERCE</span><h3>Proof Intelligence API</h3><p>Pay 0.05 USDC on Base for source-linked evidence. The response is delivered only after facilitator-confirmed payment; not from a mere signed request.</p><p class="tiny-note">Status: '+safe(payments.status)+' · Verified settlements: '+Number(payments.verifiedSettledRequests||0)+'</p><a class="small-link" href="/api/proof/premium?id=1">Inspect paid endpoint / HTTP 402 →</a></article>';
   mission.innerHTML=campaigns.campaigns.length?campaigns.campaigns.map(x=>card('Escrow expedition #'+x.campaign_id,'Onchain funding verified · '+x.reward_budget+' base units · '+x.verifiedPayouts+' payout receipts · '+(x.chain_id===84532?'Base Sepolia testnet':'Base mainnet'),'<a href="https://'+(x.chain_id===84532?'sepolia.':'')+'basescan.org/tx/'+safe(x.funding_txhash)+'" target="_blank" rel="noopener noreferrer">Funding transaction ↗</a>')).join(''):'<div class="realm-panel">No funded SEEKMESH expedition is verified onchain yet. A tested escrow contract exists, but the wallet/contract must be deployed and funded before payouts can be advertised.</div>';
  }catch(e){elStatus.textContent='Payment status not available: '+e.message;mission.textContent='Funding status unavailable.'}
 }
 async function living(){
  const box=el('realm-pulse-live');if(!box)return;
  try{
   const [os,atlas,migrated,pay]=await Promise.all([load('/api/os/status'),load('/api/atlas'),load('/api/migrate'),load('/api/native/x402/status')]);
   const e=os.expeditions?.[0];
   box.innerHTML='<div class="pulse-insignia">✧</div><div class="pulse-copy"><strong>The Realm is evolving</strong><span>'+Number(atlas.stats.total||0)+' agent nodes · '+Number(migrated.campaigns.length||0)+' verified imported expeditions · '+Number(os.metrics?.guilds||0)+' guilds</span>'+(e?'<small>This week: '+safe(e.category)+' · '+Number(e.accepted)+'/'+Number(e.target)+' accepted sources</small>':'<small>Exploration cycle starts with real contributions</small>')+'</div><div class="pulse-actions"><button data-nav="atlas" class="btn btn-glass">Agent Atlas ↗</button><button data-nav="migrate" class="btn btn-gold">Bring Your Quest ↗</button></div>';
   box.dataset.active=Number(os.metrics?.source_clicks_7d||0)>0?'true':'false';
  }catch{box.textContent='Realm status will appear when live records are available.'}
 }

 const delay=ms=>new Promise(ok=>setTimeout(ok,ms));
 const hexWord=n=>BigInt(n).toString(16).padStart(64,'0');
 function usdcMicros(value){
  const str=String(value||'').trim();
  if(!/^(?:[1-9]\d{0,3}|0)(?:\.\d{1,6})?$/.test(str))throw Error('Enter a positive USDC amount with at most six decimal places.');
  const [whole,frac='']=str.split('.');
  const raw=BigInt(whole)*1000000n+BigInt((frac+'000000').slice(0,6));
  if(raw<100000n||raw>250000000n)throw Error('Season 0 supports 0.10–250 USDC per campaign.');
  return raw;
 }
 async function confirmWalletTx(eth,hash){
  for(let n=0;n<25;n++){
   const r=await eth.request({method:'eth_getTransactionReceipt',params:[hash]});
   if(r){if(r.status!=='0x1')throw Error('Blockchain transaction reverted.');return r}
   await delay(2500);
  }
  throw Error('Transaction broadcast but confirmation timed out. Review your wallet before retrying.');
 }
 async function fundWalletExpedition(value){
  if(!state.member||!state.token)throw Error('Sign in with your explorer wallet before funding.');
  const eth=window.ethereum;
  if(!eth?.request)throw Error('Use a compatible EVM browser wallet.');
  const status=(await load('/api/native/campaigns')).status;
  if(!status.configured||!status.escrow||!status.verifier||!status.usdcToken)throw Error('Independent escrow or verifier is not configured.');
  const accounts=await eth.request({method:'eth_requestAccounts'}),account=accounts?.[0];
  if(!account)throw Error('Connect a sender wallet.');
  const selected=Number.parseInt(await eth.request({method:'eth_chainId'}),16);
  if(selected!==Number(status.chainId))await eth.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x'+Number(status.chainId).toString(16)}]});
  const budget=usdcMicros(value),fee=BigInt(status.feeBps),deposit=budget+budget*fee/10000n;
  if(Number(status.feeBps)>500)throw Error('Unacceptable escrow fee configuration.');
  const approveData='0x095ea7b3'+hexWord(status.escrow)+hexWord(deposit);
  const approve=await eth.request({method:'eth_sendTransaction',params:[{from:account,to:status.usdcToken,data:approveData}]});
  await confirmWalletTx(eth,approve);
  const deadline=Math.floor(Date.now()/1000)+7*86400;
  const data=status.fundSelector+hexWord(budget)+hexWord(fee)+hexWord(deadline)+hexWord(status.verifier);
  const hash=await eth.request({method:'eth_sendTransaction',params:[{from:account,to:status.escrow,data}]});
  await confirmWalletTx(eth,hash);
  const verified=await post('/api/native/campaigns/funding-receipt',{txHash:hash});
  if(verified.fundingVerified!==true)throw Error('Onchain funding not yet verified; see tx '+hash);
  return verified;
 }

 document.addEventListener('submit',async ev=>{
  if(ev.target.id==='form-fund-native'){
   ev.preventDefault();const form=ev.target,btn=form.querySelector('[type=submit]');
   if(btn)btn.disabled=true;
   try{const receipt=await fundWalletExpedition(new FormData(form).get('amount'));toast('USDC escrow funded and chain receipt verified: '+receipt.txHash.slice(0,12)+'…');form.reset();await commerce()}
   catch(e){toast(e.message)}
   finally{if(btn)btn.disabled=false}
  }
  if(ev.target.id==='form-migrate'){
   ev.preventDefault();if(!state.token){toast('Sign in with wallet to import a project.');return;}
   const form=ev.target,data=Object.fromEntries(new FormData(form));
   const button=form.querySelector('[type=submit]');if(button)button.disabled=true;
   try{const out=await post('/api/migrate/import',data);el('migrate-claim').innerHTML=claimHTML(out);form.reset();toast('Private import draft saved. Verify project domain to publish.');await migration()}
   catch(e){toast(e.message)}finally{if(button)button.disabled=false}
  }
  if(ev.target.id==='form-atlas-agent'){
   ev.preventDefault();if(!state.token){toast('Link and verify your wallet before claiming an agent.');return;}
   try{const out=await post('/api/atlas/register',Object.fromEntries(new FormData(ev.target)));toast('Agent recorded: '+out.state+'. No false security certification.');ev.target.reset();await agentAtlas()}
   catch(e){toast(e.message)}
  }
 });
 document.addEventListener('click',async ev=>{
  const verify=ev.target.closest('[data-migrate-verify]');
  if(verify){try{const out=await post('/api/migrate/verify',{id:Number(verify.dataset.migrateVerify)});toast(out.state==='verified'?'Project ownership verified. Expedition is now public.':'Verification pending.');await migration()}catch(e){toast(e.message)}}
  const share=ev.target.closest('[data-expedition-share]');
  if(share){const id=share.dataset.expeditionShare;shareLink(location.origin+'/expedition/'+encodeURIComponent(id),'SEEKMESH Discovery Expedition')}
  const query=ev.target.closest('[data-atlas-refresh]');if(query)agentAtlas();
 });
 el('migrate-csv-file')?.addEventListener('change',async e=>{
  const f=e.target.files?.[0];if(f&&f.size<=13500)el('migrate-csv').value=await f.text();else toast('Use a CSV file smaller than 13.5 KB.');
 });
 window.SeekmeshUpgrades={migration,agentAtlas,commerce,living};
 document.addEventListener('DOMContentLoaded',()=>{living();if(state.view==='migrate')migration();if(state.view==='atlas')agentAtlas();if(state.view==='market')commerce()},{once:true});
})();
