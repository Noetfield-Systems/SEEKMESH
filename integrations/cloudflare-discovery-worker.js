/**
 * Optional Cloudflare Workers Free edge executor.
 * One Cron trigger performs a coordinator pulse and claims at most one public API discovery job.
 * Source payloads are never published without coordinator-side checks and human approval.
 * Set SEEKMESH_ORIGIN_URL as a variable, keys via `wrangler secret put`.
 */
function allowedEndpoint(raw,kind){
  try{const u=new URL(raw);if(u.protocol!=='https:')return false;
    return kind==='github'?u.hostname==='api.github.com'&&u.pathname==='/search/repositories':kind==='hn'&&u.hostname==='hn.algolia.com'&&u.pathname.startsWith('/api/v1/search');
  }catch{return false;}
}
function robotsAllowed(text,url){
  let selected=false,hadRules=false, best={length:-1,allowed:true};
  for(const raw of String(text).split(/\r?\n/)){
    const m=raw.split('#')[0].trim().match(/^([\w-]+)\s*:\s*(.*)$/);if(!m)continue;
    if(m[1].toLowerCase()==='user-agent'){
      if(hadRules){selected=false;hadRules=false;}
      if(['*','seekmeshbot'].includes(m[2].trim().toLowerCase()))selected=true;
    }else if(['allow','disallow'].includes(m[1].toLowerCase())){
      hadRules=true;if(!selected||!m[2])continue;
      const path=m[2].split('*')[0];if(new URL(url).pathname.startsWith(path)&&(path.length>best.length||path.length===best.length&&m[1].toLowerCase()==='allow'))best={length:path.length,allowed:m[1].toLowerCase()==='allow'};
    }
  }
  return best.allowed;
}
async function coordinator(base,route,secretName,secret,data){
  const u=new URL(route,base);const r=await fetch(u,{method:'POST',redirect:'error',headers:{'content-type':'application/json',[secretName]:secret},body:JSON.stringify(data),signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw new Error(`COORDINATOR_${r.status}`);
  return r.json();
}
async function discovery(job){
  if(!allowedEndpoint(job.endpoint,job.kind))throw new Error('SOURCE_NOT_ALLOWED');
  const u=new URL(job.endpoint);const robot=await fetch(`${u.origin}/robots.txt`,{redirect:'error',headers:{'user-agent':'SeekMeshBot/0.2'},signal:AbortSignal.timeout(7000)});
  if([401,403,429].includes(robot.status)||robot.status>=500)throw new Error('ROBOTS_DENIED');
  if(robot.ok&&!robotsAllowed((await robot.text()).slice(0,30000),u.toString()))throw new Error('ROBOTS_DISALLOW');
  const r=await fetch(u,{redirect:'error',headers:{'accept':'application/json','user-agent':'SeekMeshBot/0.2'},signal:AbortSignal.timeout(13000)});
  if(!r.ok)throw new Error(`SOURCE_HTTP_${r.status}`);
  const text=await r.text();if(text.length>160000)throw new Error('SOURCE_OVERSIZE');
  const data=JSON.parse(text);
  if(job.kind==='github'){
    return {items:(Array.isArray(data.items)?data.items:[]).slice(0,12).map(x=>({html_url:String(x.html_url||'').slice(0,350),full_name:String(x.full_name||'').slice(0,100),name:String(x.name||'').slice(0,100),description:String(x.description||'').slice(0,250),stargazers_count:Number(x.stargazers_count||0),updated_at:String(x.updated_at||'').slice(0,40),topics:(x.topics||[]).slice(0,8),archived:!!x.archived,disabled:!!x.disabled}))};
  }
  return {hits:(Array.isArray(data.hits)?data.hits:[]).slice(0,12).map(x=>({url:String(x.url||'').slice(0,350),title:String(x.title||'').slice(0,150),points:Number(x.points||0)}))};
}
export default {
  async fetch(){return new Response('SEEKMESH discovery worker is cron-only',{status:404});},
  async scheduled(_event,env,ctx){
    ctx.waitUntil((async()=>{
      const base=env.SEEKMESH_ORIGIN_URL,workerKey=env.SEEKMESH_WORKER_KEY,cronKey=env.SEEKMESH_CRON_KEY;
      if(!base||!workerKey||!cronKey)throw new Error('MISSING_CONFIGURATION');
      const workerId='cf-free-discovery-01';
      await coordinator(base,'/api/internal/autonomy/tick','x-cron-key',cronKey,{});
      const claim=await coordinator(base,'/api/internal/autonomy/claim','x-worker-key',workerKey,{workerId});
      if(!claim.job)return;
      let result;
      try{result={payload:await discovery(claim.job)};}catch(e){result={error:String(e.message||e).slice(0,100)};}
      await coordinator(base,'/api/internal/autonomy/report','x-worker-key',workerKey,{workerId,jobId:claim.job.id,token:claim.job.token,result});
    })());
  }
};
