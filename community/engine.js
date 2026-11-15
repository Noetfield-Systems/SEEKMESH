import crypto from 'node:crypto';
const clean=(x,max=420)=>String(x??'').trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max);
const themes=['AI & Models','Agent Infrastructure','Protocols','Communities','Builders','Search & Data'];
const events=new Set(['page_home','page_explore','page_missions','page_guilds','page_build','page_rewards','page_market','page_node','source_click','query_run','join_start','submit_start','partner_start','guild_join','guild_post']);
const today=()=>new Date().toISOString().slice(0,10);
export class CommunityLayer {
  constructor(db){this.db=db;this.init();}
  init(){this.db.exec(`CREATE TABLE IF NOT EXISTS realm_guilds(
    id INTEGER PRIMARY KEY AUTOINCREMENT,slug TEXT NOT NULL UNIQUE COLLATE NOCASE,name TEXT NOT NULL,about TEXT NOT NULL,
    category TEXT NOT NULL,founder_id INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT(datetime('now')));
    CREATE TABLE IF NOT EXISTS realm_guild_members(
    guild_id INTEGER NOT NULL,member_id INTEGER NOT NULL,role TEXT NOT NULL DEFAULT 'member',
    joined_at TEXT NOT NULL DEFAULT(datetime('now')),PRIMARY KEY(guild_id,member_id));
    CREATE INDEX IF NOT EXISTS realm_guild_member_by_user ON realm_guild_members(member_id);
    CREATE TABLE IF NOT EXISTS realm_guild_posts(id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id INTEGER NOT NULL,author_id INTEGER NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'visible',
    created_at TEXT NOT NULL DEFAULT(datetime('now')));
    CREATE INDEX IF NOT EXISTS realm_guild_posts_by_guild ON realm_guild_posts(guild_id,created_at);
    CREATE TABLE IF NOT EXISTS realm_guild_reports(post_id INTEGER NOT NULL,reporter_id INTEGER NOT NULL,
    reason TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT(datetime('now')),PRIMARY KEY(post_id,reporter_id));
    CREATE TABLE IF NOT EXISTS realm_event_counts(day TEXT NOT NULL,event TEXT NOT NULL,target TEXT NOT NULL DEFAULT '',
    count INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,event,target));`);}
  list(memberId=null){
    const rows=this.db.prepare(`SELECT g.id,g.slug,g.name,g.about,g.category,g.created_at,
      m.handle founder,
      (SELECT COUNT(*) FROM realm_guild_members WHERE guild_id=g.id) members,
      (SELECT COUNT(*) FROM realm_guild_posts WHERE guild_id=g.id AND status='visible') signals,
      (SELECT COALESCE(SUM(l.xp),0) FROM realm_guild_members gm LEFT JOIN mesh_ledger l ON l.member_id=gm.member_id WHERE gm.guild_id=g.id) guild_xp
      FROM realm_guilds g JOIN mesh_members m ON m.id=g.founder_id
      ORDER BY members DESC,g.id ASC LIMIT 100`).all();
    if(memberId){const mine=new Set(this.db.prepare('SELECT guild_id FROM realm_guild_members WHERE member_id=?').all(memberId).map(r=>r.guild_id));for(const g of rows)g.joined=mine.has(g.id);}
    return rows;
  }
  create(member,b){
    const name=clean(b.name,48),about=clean(b.about,420),category=clean(b.category,80);
    if(name.length<3||about.length<35||!themes.includes(category))return {error:'Name (3+), description (35+) and valid category required.'};
    if(this.db.prepare('SELECT 1 FROM realm_guilds WHERE founder_id=?').get(member.id))return {error:'One founder guild per member for Season 0.'};
    if(this.db.prepare('SELECT COUNT(*) n FROM realm_guild_members WHERE member_id=?').get(member.id).n>=3)return {error:'Leave a guild before founding another (max 3 memberships).'};
    const base=name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,45);
    const slug=base.length>=3?base:'guild-'+crypto.randomBytes(4).toString('hex');
    if(this.db.prepare('SELECT 1 FROM realm_guilds WHERE slug=?').get(slug))return {error:'Guild name already taken. Choose a distinctive name.'};
    this.db.exec('BEGIN IMMEDIATE');
    try{const id=Number(this.db.prepare('INSERT INTO realm_guilds(slug,name,about,category,founder_id) VALUES(?,?,?,?,?)').run(slug,name,about,category,member.id).lastInsertRowid);
      this.db.prepare("INSERT INTO realm_guild_members(guild_id,member_id,role) VALUES(?,?,'founder')").run(id,member.id);
      this.db.exec('COMMIT');return {ok:true,slug,id,joined:true};
    }catch(e){this.db.exec('ROLLBACK');if(String(e.message).includes('UNIQUE'))return {error:'This guild name is already taken.'};throw e;}
  }
  join(member,slug){
    const g=this.db.prepare('SELECT id,slug FROM realm_guilds WHERE slug=?').get(clean(slug,80));if(!g)return {error:'Guild not found.'};
    if(this.db.prepare('SELECT 1 FROM realm_guild_members WHERE guild_id=? AND member_id=?').get(g.id,member.id))return {ok:true,joined:true,alreadyMember:true,slug:g.slug};
    if(this.db.prepare('SELECT COUNT(*) n FROM realm_guild_members WHERE member_id=?').get(member.id).n>=3)return {error:'Season 0 allows up to three guild memberships.'};
    this.db.prepare('INSERT INTO realm_guild_members(guild_id,member_id) VALUES(?,?)').run(g.id,member.id);
    return {ok:true,joined:true,slug:g.slug};
  }
  leave(member,slug){
    const g=this.db.prepare('SELECT id,founder_id FROM realm_guilds WHERE slug=?').get(clean(slug,80));if(!g)return {error:'Guild not found.'};
    if(g.founder_id===member.id)return {error:'Guild founder cannot leave without transferring ownership.'};
    const r=this.db.prepare('DELETE FROM realm_guild_members WHERE guild_id=? AND member_id=?').run(g.id,member.id);return {ok:true,left:r.changes===1};
  }
  guild(slug,memberId=null){
    const row=this.list(memberId).find(g=>g.slug===clean(slug,80));if(!row)return null;
    const posts=this.db.prepare(`SELECT p.id,p.body,p.created_at,m.handle author FROM realm_guild_posts p JOIN mesh_members m ON m.id=p.author_id
      WHERE p.guild_id=? AND p.status='visible' ORDER BY p.id DESC LIMIT 30`).all(row.id);
    const members=this.db.prepare(`SELECT m.handle,gm.role,gm.joined_at,COALESCE((SELECT SUM(l.xp) FROM mesh_ledger l WHERE l.member_id=m.id),0) xp
      FROM realm_guild_members gm JOIN mesh_members m ON m.id=gm.member_id WHERE gm.guild_id=? ORDER BY xp DESC,m.handle LIMIT 30`).all(row.id);
    return {...row,posts,membersList:members};
  }
  post(member,slug,body){
    const g=this.db.prepare('SELECT id FROM realm_guilds WHERE slug=?').get(clean(slug,80));if(!g)return {error:'Guild not found.'};
    if(!this.db.prepare('SELECT 1 FROM realm_guild_members WHERE guild_id=? AND member_id=?').get(g.id,member.id))return {error:'Join the guild before posting.'};
    const content=clean(body,280);if(content.length<12||content.length>280)return {error:'Share a useful signal (12–280 characters).'};
    if(/https?:\/\/|www\.|[^\s@]+@[^\s@]+\.[^\s@]+/i.test(content))return {error:'Post a source in the Discovery index; guild signals do not accept links or contact information.'};
    const last=this.db.prepare('SELECT created_at FROM realm_guild_posts WHERE guild_id=? AND author_id=? ORDER BY id DESC LIMIT 1').get(g.id,member.id);
    if(last && Date.now()-Date.parse(last.created_at.replace(' ','T')+'Z')<120000)return {error:'One guild signal every two minutes.'};
    if(this.db.prepare("SELECT COUNT(*) n FROM realm_guild_posts WHERE author_id=? AND created_at>=datetime('now','-1 day')").get(member.id).n>=12)return {error:'Daily guild signal limit reached.'};
    const id=Number(this.db.prepare('INSERT INTO realm_guild_posts(guild_id,author_id,body) VALUES(?,?,?)').run(g.id,member.id,content).lastInsertRowid);
    return {ok:true,postId:id,slug:clean(slug,80),rewardIssued:false};
  }
  report(member,id,reason){
    const post=this.db.prepare("SELECT id FROM realm_guild_posts WHERE id=? AND status='visible'").get(id);if(!post)return {error:'Post not available.'};
    if(!['spam','abuse','misinformation'].includes(reason))return {error:'Invalid report reason.'};
    const r=this.db.prepare('INSERT OR IGNORE INTO realm_guild_reports(post_id,reporter_id,reason) VALUES(?,?,?)').run(id,member.id,reason);
    return {ok:true,reported:r.changes===1};
  }
  moderation(){return this.db.prepare(`SELECT p.id,p.body,p.status,p.created_at,g.name guild,m.handle author,
    (SELECT COUNT(*) FROM realm_guild_reports r WHERE r.post_id=p.id) reports
    FROM realm_guild_posts p JOIN realm_guilds g ON g.id=p.guild_id JOIN mesh_members m ON m.id=p.author_id
    ORDER BY reports DESC,p.id DESC LIMIT 150`).all();}
  moderatePost(postId,action){
    if(!['hide','restore'].includes(action))return {error:'Invalid moderation action.'};
    const r=this.db.prepare('UPDATE realm_guild_posts SET status=? WHERE id=?').run(action==='hide'?'hidden':'visible',postId);
    return r.changes?{ok:true,id:postId,state:action==='hide'?'hidden':'visible'}:{error:'Post not found.'};
  }
  track(event,target=''){
    if(!events.has(event))return {error:'Unsupported analytics event.'};
    const t=event==='source_click'?(/^[1-9]\d{0,8}$/.test(String(target))?String(target):''):event==='page_explore'&&themes.includes(target)?target:'';
    this.db.prepare(`INSERT INTO realm_event_counts(day,event,target,count) VALUES(?,?,?,1)
      ON CONFLICT(day,event,target) DO UPDATE SET count=count+1`).run(today(),event,t);
    return {ok:true,storedAs:'aggregate',personallyIdentifyingData:false};
  }
  metrics(days=7){
    const n=Math.max(1,Math.min(30,Number(days)||7));
    const rows=this.db.prepare("SELECT day,event,SUM(count) count FROM realm_event_counts WHERE day>=date('now',?) GROUP BY day,event ORDER BY day DESC,event").all('-'+(n-1)+' days');
    const totals={};for(const r of rows)totals[r.event]=(totals[r.event]||0)+r.count;
    const projects=this.db.prepare(`SELECT r.id,r.name,r.url,SUM(e.count) clicks
      FROM realm_event_counts e JOIN resources r ON r.id=CAST(e.target AS INTEGER)
      WHERE e.event='source_click' AND e.day>=date('now',?) GROUP BY r.id ORDER BY clicks DESC LIMIT 12`).all('-'+(n-1)+' days');
    return {days:n,totals,daily:rows,mostClickedSources:projects,measurement:'aggregate events, not unique users, authenticated humans, conversions, or revenue'};
  }
  launchReport(){
    return {guilds:this.db.prepare('SELECT COUNT(*) n FROM realm_guilds').get().n,
      guildMemberships:this.db.prepare('SELECT COUNT(*) n FROM realm_guild_members').get().n,
      guildSignals:this.db.prepare("SELECT COUNT(*) n FROM realm_guild_posts WHERE status='visible'").get().n,
      members:this.db.prepare('SELECT COUNT(*) n FROM mesh_members').get().n,
      pendingSources:this.db.prepare("SELECT COUNT(*) n FROM submissions WHERE state='pending'").get().n,
      approvedSources:this.db.prepare("SELECT COUNT(*) n FROM submissions WHERE state='approved'").get().n,
      sponsorInquiries:this.db.prepare('SELECT COUNT(*) n FROM mesh_sponsors').get().n,
      sevenDay:this.metrics(7),paymentsCollected:null,
      paymentsNote:'Payments are not captured or verified by the current application.'};
  }
}