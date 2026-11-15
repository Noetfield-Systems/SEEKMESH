const $=id=>document.getElementById(id);let key='';let latest=null;let polling=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function notice(text){$('notice').textContent=text;$('notice').classList.add('show');setTimeout(()=>$('notice').classList.remove('show'),4000);}
async function api(path,data){const r=await fetch(path,{method:data===undefined?'GET':'POST',headers:{'content-type':'application/json','x-admin-key':key},body:data===undefined?undefined:JSON.stringify(data)});let j=await r.json();if(!r.ok)throw new Error(j.error||`HTTP ${r.status}`);return j;}
const metric=(number,label)=>`<div class="metric"><strong class="num">${esc(number)}</strong><small>${esc(label)}</small></div>`;
function render(x){latest=x;const s=x.status;$('operating-state').textContent=s.enabled?(s.paused?'PAUSED BY FOUNDER':'SCHEDULER '+(s.schedulerRunning?'ACTIVE':'NOT RUNNING')):'NOT ENABLED';$('last-tick').textContent='LAST PULSE '+(s.lastTick||'NOT YET');$('auth-state').textContent='AUTHENTICATED · OPERATOR';$('stats').innerHTML=metric(s.activeExecutors+'/'+s.physicalExecutorLimit,'EXECUTORS RUNNING / LIMIT')+metric(s.logicalWorkerShards,'LOGICAL SHARDS · NOT PROCESSES')+metric(s.connectedWorkers24h,'REMOTE WORKERS · 24H')+metric(s.completedJobReceipts,'JOB RECEIPTS')+metric(s.queues.queued||0,'QUEUED JOBS')+metric(s.candidates.ready||0,'READY FOR HUMAN REVIEW')+metric(s.budget.requestsUsed+'/'+s.budget.requestsMax,'DAILY NETWORK BUDGET');
$('source-count').textContent=x.sources.length+' CONFIGURED';$('sources').innerHTML=x.sources.map(o=>`<div class="item"><div class="item-header"><span>${esc(o.name)}</span><span class="tag">${o.enabled?'ACTIVE':'DISABLED'}</span></div><p>${esc(o.endpoint)}</p><small>${esc(o.kind)} · ${esc(o.category)} · Every ${o.interval_hours}h · Last ${esc(o.last_run_at||'NEVER')}</small></div>`).join('')||'<div class="empty">No sources configured.</div>';
const review=x.candidates.filter(c=>['ready','needs_review'].includes(c.state));$('candidate-count').textContent=review.length+' REQUIRING DECISION';$('candidates').innerHTML=review.slice(0,40).map(c=>`<div class="item"><div class="item-header"><span>${esc(c.name)}</span><span class="tag">${esc(c.state)} / ${c.score}</span></div><p><a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(c.url)}</a></p><p>${esc(c.description)}</p><small>HTTP ${esc(c.http_status??'UNTESTED')} · ${esc(c.category)}</small><div class="mini-actions"><button data-decision="approve" data-id="${c.id}" ${c.http_status!==200?'disabled':''}>APPROVE ↗</button><button class="negative" data-decision="reject" data-id="${c.id}">REJECT ×</button></div></div>`).join('')||'<div class="empty">No reviewable candidates. New discoveries will enter after scheduled scans.</div>';
$('jobs').innerHTML=x.jobs.slice(0,60).map(j=>`<div class="item"><div class="item-header"><span>#${j.id} · ${esc(j.kind.toUpperCase())}</span><span class="tag">${esc(j.status)}</span></div><p>${esc(j.target)}</p><small>ATTEMPT ${j.attempt} · PRIORITY ${j.priority} · ${esc(j.last_error||'NO ERROR')}</small></div>`).join('')||'<div class="empty">No jobs queued yet.</div>';
$('events').innerHTML=x.events.slice(0,60).map(e=>`<div class="item"><div class="item-header"><span>${esc(e.kind)}</span><small>${esc(e.created_at)}</small></div><p>${esc(e.detail)}</p><small>ACTOR ${esc(e.actor)}</small></div>`).join('')||'<div class="empty">No execution receipts yet.</div>';
$('pause').disabled=s.paused;$('resume').disabled=!s.paused;
}
function renderLaunch(launch,submissions,sponsors,guilds){
 const daily=launch?.sevenDay?.totals||{};
 $('launch-stats').innerHTML=metric(launch?.members??'—','REGISTERED EXPLORERS')+
 metric(launch?.guilds??'—','REAL GUILDS')+metric(launch?.guildMemberships??'—','GUILD MEMBERSHIPS')+
 metric(launch?.pendingSources??'—','PENDING RESOURCES')+metric(launch?.sponsorInquiries??'—','PARTNER INQUIRIES');
 const funnel=['page_home','page_explore','join_start','page_guilds','guild_join','submit_start','source_click','partner_start','page_market'];
 $('launch-funnel').innerHTML=funnel.map(e=>`<div class="item"><div class="item-header"><span>${esc(e.replaceAll('_',' ').toUpperCase())}</span><strong>${esc(daily[e]||0)}</strong></div></div>`).join('');
 $('launch-sources').innerHTML=(launch?.sevenDay?.mostClickedSources||[]).map(s=>`<div class="item"><div class="item-header"><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a><strong>${esc(s.clicks)} clicks</strong></div></div>`).join('')||'<div class="empty">No source click events recorded yet.</div>';
 const pending=(submissions?.submissions||[]).filter(s=>s.state==='pending');
 $('submission-count').textContent=pending.length+' PENDING';
 $('community-submissions').innerHTML=pending.slice(0,50).map(s=>`<div class="item"><div class="item-header"><span>${esc(s.name)}</span><span class="tag">${esc(s.category)}</span></div><p>${esc(s.description)}</p><p><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.url)}</a></p><small>@${esc(s.handle)} · ${esc(s.created_at)}</small><div class="mini-actions"><button data-subdecision="approve" data-id="${s.id}">APPROVE ↗</button><button class="negative" data-subdecision="reject" data-id="${s.id}">REJECT ×</button></div></div>`).join('')||'<div class="empty">Member source review queue is clear.</div>';
 const inquiries=sponsors?.inquiries||[];
 $('partner-count').textContent=inquiries.length+' RECEIVED';
 $('partner-inquiries').innerHTML=inquiries.slice(0,70).map(s=>`<div class="item"><div class="item-header"><span>${esc(s.plan)}</span><span class="tag">${esc(s.state)}</span></div><p>${esc(s.brief)}</p><p><a href="${esc(s.site)}" target="_blank" rel="noopener noreferrer">${esc(s.site)}</a></p><small>${esc(s.email)} · ${esc(s.created_at)}</small></div>`).join('')||'<div class="empty">No partner inquiries. No revenue claimed.</div>';
 const posts=(guilds?.posts||[]).filter(p=>p.reports>0||p.status!=='visible');
 $('guild-report-count').textContent=posts.length+' FLAGGED / HIDDEN';
 $('guild-reports').innerHTML=posts.slice(0,60).map(p=>`<div class="item"><div class="item-header"><span>${esc(p.guild)} · @${esc(p.author)}</span><span class="tag">${esc(p.status)} / ${p.reports} REPORTS</span></div><p>${esc(p.body)}</p><div class="mini-actions"><button data-guild-moderate="restore" data-post-id="${p.id}">RESTORE</button><button class="negative" data-guild-moderate="hide" data-post-id="${p.id}">HIDE</button></div></div>`).join('')||'<div class="empty">No flagged guild messages.</div>';
}
async function refresh(){
 if(!key)return;
 try{render(await api('/api/admin/autonomy'));}catch(e){notice(e.message);return;}
 const extras=await Promise.allSettled([
  api('/api/admin/launch'),api('/api/admin/submissions'),
  api('/api/admin/mesh/sponsors'),api('/api/admin/guild-posts')]);
 const val=extras.map(x=>x.status==='fulfilled'?x.value:null);
 renderLaunch(...val);
 if(extras.some(x=>x.status==='rejected'))notice('Launch detail partially unavailable; operational controls remain available.');
}
$('login').addEventListener('submit',async e=>{e.preventDefault();key=$('admin-key').value;try{await refresh();if(!latest)throw new Error('Authentication failed');$('login-panel').hidden=true;$('dashboard').hidden=false;$('admin-key').value='';polling=setInterval(refresh,30000);}catch(e){key='';notice(e.message);}});
for(const a of ['pause','resume','tick'])$(a).addEventListener('click',async()=>{try{await api('/api/admin/autonomy/control',{action:a});await refresh();notice(`Control ${a} submitted.`);}catch(e){notice(e.message);}});
$('refresh').addEventListener('click',refresh);
$('candidates').addEventListener('click',async e=>{const b=e.target.closest('button[data-decision]');if(!b)return;const decision=b.dataset.decision;if(!confirm(`${decision.toUpperCase()} candidate #${b.dataset.id}?`))return;try{await api('/api/admin/autonomy/candidate',{id:Number(b.dataset.id),decision});await refresh();notice('Candidate reviewed and receipt stored.');}catch(e){notice(e.message);}});
$('source-form').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget),data=Object.fromEntries(f.entries());try{const result=await api('/api/admin/autonomy/source',data);await refresh();notice(result.created?'Connector added.':'Connector already exists.');}catch(e){notice(e.message);}});
$('export').addEventListener('click',async()=>{try{const d=await api('/api/admin/autonomy/workpackets');const blob=new Blob([JSON.stringify(d,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='seekmesh-workpackets.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}catch(e){notice(e.message);}});

$('community-submissions').addEventListener('click',async e=>{
 const b=e.target.closest('button[data-subdecision]');if(!b)return;
 const decision=b.dataset.subdecision,id=Number(b.dataset.id);
 if(!confirm(decision.toUpperCase()+' source #'+id+'?'))return;
 try{await api('/api/admin/review',{id,decision});await refresh();notice('Member submission reviewed.');}catch(err){notice(err.message);}
});
$('guild-reports').addEventListener('click',async e=>{
 const b=e.target.closest('button[data-guild-moderate]');if(!b)return;
 const action=b.dataset.guildModerate,postId=Number(b.dataset.postId);
 try{await api('/api/admin/guild-post',{action,postId});await refresh();notice('Guild moderation updated.');}catch(err){notice(err.message);}
});
