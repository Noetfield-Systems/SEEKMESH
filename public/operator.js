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
function renderLaunch(launch,submissions,sponsors,guilds,sourceReports){
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
 $('partner-inquiries').innerHTML=inquiries.slice(0,70).map(s=>`<div class="item"><div class="item-header"><span>${esc(s.plan)}</span><span class="tag">${esc(s.state)}</span></div><p>${esc(s.brief)}</p><p><a href="${esc(s.site)}" target="_blank" rel="noopener noreferrer">${esc(s.site)}</a></p><small>${esc(s.email)} · ${esc(s.created_at)} · ${esc(s.owner||'Unassigned')}</small><p>Next: ${esc(s.next_action||'Qualify this incoming project inquiry')} ${esc(s.due_date||'')}</p><div class="mini-actions"><button data-partner-action="update" data-partner-id="${s.id}" data-partner-state="${esc(s.state)}">RECORD NEXT ACTION ↗</button></div></div>`).join('')||'<div class="empty">No partner inquiries. No revenue claimed.</div>';
 const posts=(guilds?.posts||[]).filter(p=>p.reports>0||p.status!=='visible');
 $('guild-report-count').textContent=posts.length+' FLAGGED / HIDDEN';
 $('guild-reports').innerHTML=posts.slice(0,60).map(p=>`<div class="item"><div class="item-header"><span>${esc(p.guild)} · @${esc(p.author)}</span><span class="tag">${esc(p.status)} / ${p.reports} REPORTS</span></div><p>${esc(p.body)}</p><div class="mini-actions"><button data-guild-moderate="restore" data-post-id="${p.id}">RESTORE</button><button class="negative" data-guild-moderate="hide" data-post-id="${p.id}">HIDE</button></div></div>`).join('')||'<div class="empty">No flagged guild messages.</div>';
 const quality=(sourceReports?.reports||[]).filter(x=>x.state==='open');
 $('source-report-count').textContent=quality.length+' OPEN REPORTS';
 $('source-reports').innerHTML=quality.slice(0,80).map(r=>`<div class="item"><div class="item-header"><span>${esc(r.resource)} · ${esc(r.reason)}</span><span class="tag">OPEN</span></div><p><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.url)}</a></p><p>${esc(r.detail||'No additional details.')}</p><small>Reported by @${esc(r.reporter)} · ${esc(r.created_at)}</small><div class="mini-actions"><button data-report-decision="resolved" data-report-id="${r.id}">RESOLVED ✓</button><button class="negative" data-report-decision="dismissed" data-report-id="${r.id}">DISMISS ×</button></div></div>`).join('')||'<div class="empty">No open resource reports.</div>';
}

/* Embedded Realm OS: founder-only controls with evidence, no invented completed work. */
function renderRealmOS(payload){
 const st=payload.status||{};
 $('os-ops-state').textContent=st.enabled?(st.paused?'PAUSED':st.schedulerRunning?'SCHEDULING':'STARTING'):'DISABLED';
 $('os-pause').disabled=st.paused;$('os-resume').disabled=!st.paused;
 $('os-ops-stats').innerHTML=metric(st.logicalAgentRoles||0,'LOGICAL OS ROLES')+
  metric(st.physicalOSAgents||0,'INDEPENDENT OS PROCESSES')+
  metric(st.metrics?.resources||0,'SOURCE NODES')+
  metric(st.queues?.open||0,'OPEN PACKETS')+
  metric(st.completedPulses||0,'COMPLETED PULSES')+
  metric(st.lastPulse||'—','LAST OS PULSE')+
  metric(st.liveWeb3SettlementsVerified||0,'VERIFIED ONCHAIN SETTLEMENTS');
 $('os-ops-goals').innerHTML=(st.goals||[]).map(g=>'<div class="item"><div class="item-header"><span>'+esc(g.title)+'</span><span class="tag">'+esc(g.progress)+'%</span></div><p>'+esc(g.actual)+' / '+esc(g.target)+' · '+esc(g.metric)+'</p><small>Owner: '+esc(g.owner_agent)+' · Phase '+esc(g.phase)+'</small><div class="mini-actions"><button data-os-goal="'+esc(g.goal_id)+'" data-target="'+g.target+'">CHANGE TARGET ↗</button></div></div>').join('')||'<div class="empty">No goals defined</div>';
 $('os-ops-roles').innerHTML=(payload.agents||[]).map(a=>'<div class="item"><div class="item-header"><span>'+esc(a.display_name)+'</span><span class="tag">'+esc(a.state)+'</span></div><p>'+esc(a.mission)+'</p><small>'+esc(a.department)+' · '+esc(a.queuedPackets)+' active packets · '+(a.physicalProcess?'independent process':'logical role')+'</small></div>').join('')||'<div class="empty">No roles defined</div>';
 $('os-ops-packets').innerHTML=(payload.packets||[]).filter(p=>p.status==='open').slice(0,70).map(p=>'<div class="item"><div class="item-header"><span>#'+p.id+' · '+esc(p.kind)+'</span><span class="tag">P'+(100-p.priority)+'</span></div><p>'+esc(p.task)+'</p><small>'+esc(p.agent_id)+' · Accept: '+esc(p.acceptance)+'</small><div class="mini-actions"><button data-os-evidence="'+p.id+'">RECORD EVIDENCE ↗</button></div></div>').join('')||'<div class="empty">No open work packets. Scheduled monitoring remains active.</div>';
 $('os-ops-receipts').innerHTML=(payload.receipts||[]).slice(0,50).map(p=>'<div class="item"><div class="item-header"><span>'+esc(p.agent_id)+' / '+esc(p.kind)+'</span><small>'+esc(p.created_at)+'</small></div><p>'+esc(p.details)+'</p><small>VERIFICATION: '+esc(p.verification)+'</small></div>').join('')||'<div class="empty">No receipts yet. First OS pulse writes evidence.</div>';
}

async function refresh(){
 if(!key)return;
 try{render(await api('/api/admin/autonomy'));}catch(e){notice(e.message);return;}
 const extras=await Promise.allSettled([
  api('/api/admin/launch'),api('/api/admin/submissions'),
  api('/api/admin/mesh/sponsors'),api('/api/admin/guild-posts'),api('/api/admin/source-reports'),api('/api/admin/os')]);
 const val=extras.map(x=>x.status==='fulfilled'?x.value:null);
 renderLaunch(...val.slice(0,5));
 if(val[5])renderRealmOS(val[5]);
 await loadGenesisAdmin();
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

$('source-reports').addEventListener('click',async e=>{
 const button=e.target.closest('button[data-report-decision]');if(!button)return;
 const decision=button.dataset.reportDecision,reportId=Number(button.dataset.reportId);
 try{await api('/api/admin/source-report',{reportId,decision});await refresh();notice('Source quality report '+decision+'.');}
 catch(err){notice(err.message);}
});

$('partner-inquiries').addEventListener('click',async e=>{
 const b=e.target.closest('[data-partner-action]');if(!b)return;
 const id=Number(b.dataset.partnerId),current=b.dataset.partnerState;
 const state=prompt('Partner state: new / contacted / qualified / proposal_sent / agreed / closed',current);
 if(!state)return;
 const nextAction=prompt('Specific next action for this inquiry (minimum eight characters):','Follow up with the project owner regarding a scoped discovery pack');
 if(!nextAction)return;
 const dueDate=prompt('Next action date YYYY-MM-DD (blank if not scheduled):',new Date(Date.now()+86400000).toISOString().slice(0,10));
 if(dueDate===null)return;
 const owner=prompt('Responsible operator:', 'Revenue Agent');if(!owner)return;
 const evidence=prompt('Evidence note: what happened or what the inquiry demonstrates?','Initial buyer inquiry received in SEEKMESH public partnership form');
 if(!evidence)return;
 try{await api('/api/admin/mesh/sponsor-action',{id,state:state.trim(),nextAction:nextAction.trim(),dueDate:dueDate.trim(),owner:owner.trim(),evidence:evidence.trim()});
 await refresh();notice('Partner follow-up saved with an auditable next action.');}
 catch(err){notice(err.message);}
});

for(const action of ['pulse','pause','resume'])$('os-'+action).addEventListener('click',async()=>{
 try{await api('/api/admin/os/control',{action});await refresh();notice('Realm OS '+action+' recorded.');}
 catch(e){notice(e.message);}
});
$('os-ops-goals').addEventListener('click',async e=>{
 const target=e.target.closest('button[data-os-goal]');if(!target)return;
 const input=prompt('New measured goal target (1 to 1,000,000)',target.dataset.target);if(input===null)return;
 try{const n=Number(input);await api('/api/admin/os/control',{action:'goal',goalId:target.dataset.osGoal,target:n});await refresh();notice('Goal target updated.');}
 catch(err){notice(err.message);}
});
$('os-ops-packets').addEventListener('click',async e=>{
 const button=e.target.closest('button[data-os-evidence]');if(!button)return;
 const message=prompt('Evidence note (at least 30 characters). This is an OPERATOR ATTESTATION, not independent verification:');
 if(message===null)return;
 try{await api('/api/admin/os/control',{action:'evidence',packetId:Number(button.dataset.osEvidence),evidence:message});await refresh();notice('Work packet attested; verification is not claimed.');}
 catch(err){notice(err.message);}
});


function renderGenesisAdmin(payload){
 const real=payload.real||{},demo=payload.synthetic||{};
 $('genesis-admin-stats').innerHTML=
  metric(real.realMembers??0,'REAL EXPLORERS')+
  metric(real.realDropsCredited??0,'REAL GENESIS DROPS')+
  metric(real.qualifiedReferrals??0,'QUALIFIED REAL REFERRALS')+
  metric(demo.accounts??0,'SYNTHETIC PERSONAS · EXCLUDED')+
  metric((demo.runs||[]).length,'RECENT QA RUNS');
 $('genesis-admin-actions').innerHTML=(payload.realActions||[]).map(x=>'<div class="item"><div class="item-header"><span>'+esc(x.reason)+'</span><strong>'+x.n+'</strong></div></div>').join('')||'<div class="empty">No accepted real actions yet.</div>';
 $('genesis-admin-runs').innerHTML=(demo.runs||[]).map(x=>'<div class="item"><div class="item-header"><span>QA Run #'+x.id+'</span><b>'+x.agents+' demo personas</b></div><p>'+x.steps+' recorded scripted checkpoints</p><small>'+esc(x.created_at)+' · SYNTHETIC ONLY</small></div>').join('')||'<div class="empty">No QA runs yet.</div>';
 $('genesis-admin-personas').innerHTML=(demo.leaderboard||[]).map((x,i)=>'<div class="item"><div class="item-header"><span>#'+(i+1)+' '+esc(x.handle)+'</span><strong>'+x.drops+' TEST DROPS</strong></div><small>'+esc(x.role)+' · '+x.actions+' fictional reward events</small></div>').join('')||'<div class="empty">QA sandbox has no personas.</div>';
 $('genesis-admin-events').innerHTML=(demo.events||[]).slice(0,60).map(x=>'<div class="item"><div class="item-header"><span>'+esc(x.handle)+' · '+esc(x.step)+'</span><small>'+esc(x.created_at)+'</small></div><p>'+esc(x.result)+'</p></div>').join('')||'<div class="empty">No simulated checkpoints saved.</div>';
}
async function loadGenesisAdmin(){
 if(!key)return;
 try{renderGenesisAdmin(await api('/api/admin/genesis/dashboard'));}
 catch(e){notice('Genesis QA metrics unavailable: '+e.message);}
}
$('genesis-refresh').addEventListener('click',loadGenesisAdmin);
$('genesis-simulate').addEventListener('click',async()=>{
 try{const result=await api('/api/admin/genesis/simulate',{count:12});
  notice('Completed '+result.personas+' SYNTHETIC customer journeys, '+result.steps+' saved checkpoints; 0 real users added.');
  await loadGenesisAdmin();
 }catch(e){notice(e.message);}
});
