/** Public-only bounded network reader. No credential forwarding, no private networks, no browser automation. */
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns/promises';
import net from 'node:net';

export const BOT='SeekMeshBot/0.2 (public metadata discovery; robots-aware)';
export function publicIp(ip){
  const version=net.isIP(ip);
  if(version===4){
    const [a,b,c]=ip.split('.').map(Number);
    if([0,10,127].includes(a) || a>=224 || a===169&&b===254 || a===172&&b>=16&&b<=31 || a===192&&(b===168 || b===0 && (c===0||c===2)) || a===100&&b>=64&&b<=127 || a===198&&(b===18||b===19||b===51&&c===100) || a===203&&b===0&&c===113) return false;
    return true;
  }
  if(version===6){
    const lower=ip.toLowerCase();
    if(lower.includes('.'))return false; // IPv4-mapped and translation forms: do not trust
    if(!/^[23][0-9a-f]{0,3}:/.test(lower))return false;
    if(lower.startsWith('2001:db8:')||lower.startsWith('2001:0:'))return false;
    return true;
  }
  return false;
}
export function publicUrl(raw){
  try {
    const u=new URL(raw);
    if(!['http:','https:'].includes(u.protocol)||u.username||u.password||!u.hostname.includes('.')||u.hash||u.hostname.length>253) return null;
    if(u.port && !['80','443'].includes(u.port))return null;
    if(net.isIP(u.hostname) || u.hostname.endsWith('.local') || u.hostname.endsWith('.internal') || u.hostname.endsWith('.localhost'))return null;
    if(u.href.length>1600)return null;
    return u;
  }catch{return null;}
}
export async function safeFetch(raw,opts={}){
  const maxBytes=opts.maxBytes??262144, timeoutMs=opts.timeoutMs??7000;
  let current=String(raw);
  for(let redirect=0;redirect<=2;redirect++){
    const u=publicUrl(current);
    if(!u)throw new Error('URL_NOT_PUBLIC');
    const resolved=await dns.lookup(u.hostname,{all:true,verbatim:true});
    if(!resolved.length || resolved.some(item=>!publicIp(item.address))) throw new Error('PRIVATE_NETWORK_BLOCKED');
    const chosen=resolved.find(x=>x.family===4)||resolved[0];
    const client=u.protocol==='https:'?https:http;
    const result=await new Promise((resolve,reject)=>{
      let size=0;const pieces=[];
      const req=client.request(u,{method:'GET',timeout:timeoutMs,
        lookup:(_host,_opts,cb)=>cb(null,chosen.address,chosen.family),
        headers:{'user-agent':BOT,'accept':opts.accept||'text/html,application/json,application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.1','accept-encoding':'identity'}},res=>{
        res.on('data',buf=>{size+=buf.length;if(size>maxBytes){req.destroy(new Error('BODY_LIMIT'));return;}pieces.push(buf);});
        res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(pieces).toString('utf8'),url:u.toString()}));
        res.on('error',reject);
      });
      req.on('timeout',()=>req.destroy(new Error('TIMEOUT')));
      req.on('error',reject);req.end();
    });
    if([301,302,303,307,308].includes(result.status)&&result.headers.location){
      if(!opts.allowRedirects)return result; // Default: never cross to a new origin without a fresh robots check.
      current=new URL(result.headers.location,u).toString();continue;
    }
    return result;
  }
  throw new Error('REDIRECT_LIMIT');
}
/** Basic RFC9309 longest matching path rule, grouping SeekMeshBot and '*' rules. */
export function robotsAllowed(text,url,userAgent='SeekMeshBot'){
  const rules=[];let agents=[];let started=false;let delay=0;
  for(const raw of String(text||'').split(/\r?\n/)){
    const line=raw.split('#')[0].trim();const m=line.match(/^([\w-]+)\s*:\s*(.*)$/);if(!m)continue;
    const key=m[1].toLowerCase(), val=m[2].trim();
    if(key==='user-agent'){
      if(started){agents=[];started=false;}
      agents.push(val.toLowerCase());
    }else if(['allow','disallow','crawl-delay'].includes(key)){
      started=true;
      if(agents.includes('*')||agents.some(a=>userAgent.toLowerCase().includes(a))){
        if(key==='crawl-delay'){delay=Math.max(delay,Math.min(3600,Number(val)||0));}
        else if(val)rules.push({path:val,allow:key==='allow'});
      }
    }
  }
  const pathname=new URL(url).pathname;
  let best=null;
  for(const r of rules){const plain=r.path.split('*')[0].replace(/\$$/,'');if(pathname.startsWith(plain)&&(!best||plain.length>best.length||plain.length===best.length&&r.allow)){best={length:plain.length,allow:r.allow};}}
  return {allowed:best?.allow??true,crawlDelaySeconds:delay};
}
export function htmlMetadata(html){
  const text=String(html).slice(0,120000);
  const title=text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'';
  const metaTags=[...text.matchAll(/<meta\s+[^>]*>/gi)].map(x=>x[0]);
  const attrs=(tag)=>Object.fromEntries([...tag.matchAll(/([a-z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)].map(m=>[m[1].toLowerCase(),m[2]??m[3]??m[4]??'']));
  let description='',noindex=false;
  for(const t of metaTags){const a=attrs(t);if(a.name?.toLowerCase()==='description'||a.property?.toLowerCase()==='og:description')description ||=a.content||'';if(a.name?.toLowerCase()==='robots'&&/noindex/i.test(a.content))noindex=true;}
  const tidy=x=>x.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim().slice(0,350);
  return {title:tidy(title).slice(0,120),description:tidy(description).slice(0,350),noindex};
}
