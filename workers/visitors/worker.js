const BOT=/bot|crawler|spider|slurp|facebookexternalhit|whatsapp|slackbot|discordbot|twitterbot|linkedinbot|telegrambot|applebot|chatgpt-user|headless|lighthouse|pingdom|uptimerobot/i;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const sql={
 rate:'INSERT INTO rate_limits(hash,hour,requests) VALUES (?, ?, 1) ON CONFLICT(hash,hour) DO UPDATE SET requests=requests+1 RETURNING requests',
 insert:`INSERT OR IGNORE INTO visitors(id,first_seen,last_seen) SELECT ?,?,? WHERE NOT EXISTS(SELECT 1 FROM networks WHERE hash IN (?,?) AND seen>?) AND (SELECT requests FROM rate_limits WHERE hash=? AND hour=?)<=3 RETURNING id`,
 network:'INSERT INTO networks(hash,seen) VALUES (?,?) ON CONFLICT(hash) DO UPDATE SET seen=excluded.seen',
 seen:'UPDATE visitors SET last_seen=? WHERE id=?',
 total:"SELECT total FROM counters WHERE key='observers'"
};
const json=(body,status=200,cached=false)=>Response.json(body,{status,headers:{'Cache-Control':cached?'public, max-age=30, stale-while-revalidate=300':'no-store','Content-Type':'application/json','X-Content-Type-Options':'nosniff'}});
async function digest(value){const data=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(data),v=>v.toString(16).padStart(2,'0')).join('');}
export function allowed(request,origin){const h=request.headers,ua=h.get('user-agent')||'';return h.get('origin')===origin&&h.get('referer')?.startsWith(origin+'/')&&!!h.get('accept-language')&&ua.length>15&&!BOT.test(ua)&&h.get('sec-gpc')!=='1'&&h.get('dnt')!=='1';}
const worker = {
 async fetch(request,env){
  try{
   const path=new URL(request.url).pathname;if(!env.DB||!env.HASH_SECRET)return json({available:false},503);
   if(request.method==='GET'&&path==='/api/visitors'){const row=await env.DB.prepare(sql.total).first();return json({total:row.total},200,true);}
   if(request.method!=='POST'||path!=='/api/visitors/visit')return json({counted:false},404);
   if(!allowed(request,env.ALLOWED_ORIGIN))return json({counted:false},200);
   if(Number(request.headers.get('content-length')||0)>1024)return json({counted:false},413);
   const raw=await request.text();if(raw.length>1024)return json({counted:false},413);let body;try{body=JSON.parse(raw);}catch{return json({counted:false},400);}
   if(!UUID.test(body.id)||body.webdriver===true||body.visible!==true||body.rendered!==true)return json({counted:false},400);
   const ip=request.headers.get('cf-connecting-ip');if(!ip)return json({counted:false});
   const now=Math.floor(Date.now()/1000),day=Math.floor(now/86400),hour=Math.floor(now/3600),ua=request.headers.get('user-agent');
   // Raw network identity is used only in memory and never persisted or logged.
   const id=await digest('browser:'+body.id),hash=await digest(`${env.HASH_SECRET}:${day}:${ip}:${ua}`),previous=await digest(`${env.HASH_SECRET}:${day-1}:${ip}:${ua}`);
   const results=await env.DB.batch([
    env.DB.prepare(sql.rate).bind(hash,hour),
    env.DB.prepare(sql.insert).bind(id,now,now,hash,previous,now-86400,hash,hour),
    env.DB.prepare(sql.network).bind(hash,now),
    env.DB.prepare(sql.seen).bind(now,id),
    env.DB.prepare(sql.total)
   ]);
   return json({total:results[4].results[0].total,counted:results[1].results.length>0});
  }catch{return json({available:false},503);}
 },
 async scheduled(event,env,ctx){ctx.waitUntil(env.DB.batch([env.DB.prepare('DELETE FROM networks WHERE seen < ?').bind(Math.floor(Date.now()/1000)-172800),env.DB.prepare('DELETE FROM rate_limits WHERE hour < ?').bind(Math.floor(Date.now()/3600000)-48)]));}
};

export default worker;
