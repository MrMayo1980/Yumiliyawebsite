import {GithubPublisher} from './github.mjs';
import {hashPassword,verifyPassword,digest,randomSecret} from './password.mjs';
import {validateDocument} from '../validation.js';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const SESSION_MS=8*60*60*1000;
async function jsonBody(request,max=4*1024*1024){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw fail('Ожидается JSON.',415);
 if(Number(request.headers.get('content-length'))>max)throw fail('Запрос слишком большой.',413);
 const reader=request.body?.getReader();if(!reader)throw fail('Пустой запрос.');
 let size=0;const chunks=[];for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw fail('Запрос слишком большой.',413);}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw fail('Некорректный JSON.');}
}
async function credential(env){
 let row=await env.DB.prepare('SELECT value FROM credentials WHERE id=1').first();
 if(!row){
  let initial;try{initial=JSON.parse(env.INITIAL_CREDENTIALS);}catch{throw fail('Сервис входа ещё не настроен.',503);}
  if(!/^[a-f0-9]{64}$/.test(initial.salt)||!/^[a-f0-9]{64}$/.test(initial.hash)||initial.iterations!==100000)throw fail('Сервис входа ещё не настроен.',503);
  await env.DB.prepare('INSERT OR IGNORE INTO credentials(id,value) VALUES(1,?)').bind(JSON.stringify(initial)).run();
  row=await env.DB.prepare('SELECT value FROM credentials WHERE id=1').first();
 }
 return {value:row.value,parsed:JSON.parse(row.value)};
}
async function throttle(env,key,max){
 const now=Date.now(),until=now+15*60*1000;
 const row=await env.DB.prepare('INSERT INTO attempts(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END, expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING count').bind(key,until,now,now).first();
 if(row.count>max)throw fail('Слишком много попыток. Попробуйте через 15 минут.',429);
}
async function authenticate(request,env){
 const token=/^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('authorization')||'')?.[1];
 if(!token)throw fail('Войдите в панель администратора.',401);
 const key=await digest(token);
 const row=await env.DB.prepare('SELECT s.digest FROM sessions s JOIN credentials c ON c.id=1 AND s.credential=c.value WHERE s.digest=? AND s.expires>?').bind(key,Date.now()).first();
 if(!row)throw fail('Сеанс завершён. Войдите снова.',401);return key;
}
// Only this server-side module receives the repository publishing credential.
function github(env,fetcher){
 if(!env.GITHUB_TOKEN)throw fail('Сервис публикации ещё не настроен.',503);
 const client=new GithubPublisher({owner:env.GITHUB_OWNER,repo:env.GITHUB_REPO,branch:env.GITHUB_BRANCH||'main',prefix:'docs/'},fetcher);
 client.token=env.GITHUB_TOKEN;return client;
}
export function createWorker({fetcher=(...args)=>fetch(...args)}={}){
 return {async fetch(request,env){
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Vary':'Origin'};
  const respond=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
  try{
   const url=new URL(request.url),origin=request.headers.get('origin');
   if(url.pathname==='/health'&&request.method==='GET')return respond({ok:true});
   if(!env.ALLOWED_ORIGIN||origin!==env.ALLOWED_ORIGIN)throw fail('Недопустимый источник запроса.',403);
   headers['Access-Control-Allow-Origin']=origin;
   if(request.method==='OPTIONS'){
    headers['Access-Control-Allow-Methods']='GET, POST, OPTIONS';headers['Access-Control-Allow-Headers']='Authorization, Content-Type';headers['Access-Control-Max-Age']='600';return new Response(null,{status:204,headers});
   }
   if(!env.DB)throw fail('Сервис входа ещё не настроен.',503);
   if(url.pathname==='/api/login'&&request.method==='POST'){
    const ip=await digest(request.headers.get('CF-Connecting-IP')||'unknown');
    await throttle(env,ip,8);await throttle(env,'global',300);
    const body=await jsonBody(request,2048),current=await credential(env);
    if(!await verifyPassword(body.password,current.parsed))throw fail('Неверный пароль.',401);
    const session=randomSecret(),key=await digest(session),now=Date.now();
    await env.DB.batch([
     env.DB.prepare('DELETE FROM sessions WHERE expires<=?').bind(now),
     env.DB.prepare('DELETE FROM uploads WHERE expires<=?').bind(now),
     env.DB.prepare('DELETE FROM attempts WHERE expires<=?').bind(now),
     env.DB.prepare('INSERT INTO sessions(digest,credential,expires) VALUES(?,?,?)').bind(key,current.value,now+SESSION_MS),
     env.DB.prepare('DELETE FROM attempts WHERE key=?').bind(ip)
    ]);
    return respond({session});
   }
   const key=await authenticate(request,env);
   if(url.pathname==='/api/logout'&&request.method==='POST'){await env.DB.prepare('DELETE FROM sessions WHERE digest=?').bind(key).run();return respond({ok:true});}
   if(url.pathname==='/api/password'&&request.method==='POST'){
    await throttle(env,'password:'+key,8);const body=await jsonBody(request,4096),current=await credential(env);
    if(!await verifyPassword(body.currentPassword,current.parsed))throw fail('Текущий пароль неверен.',401);
    const next=await hashPassword(body.newPassword);
    await env.DB.batch([env.DB.prepare('UPDATE credentials SET value=? WHERE id=1').bind(JSON.stringify(next)),env.DB.prepare('DELETE FROM sessions'),env.DB.prepare('DELETE FROM uploads')]);return respond({ok:true});
   }
   const client=github(env,fetcher);
   if(url.pathname==='/api/published'&&request.method==='GET')return respond(await client.readState(await client.head()));
   if(url.pathname==='/api/history'&&request.method==='GET')return respond(await client.history());
   if(url.pathname==='/api/upload-blob'&&request.method==='POST'){
    const path=url.searchParams.get('path');if(!/^assets\/media\/[a-zA-Z0-9_-]{1,100}\.(webp|png|jpg|gif|avif|mp4|mov|webm|ogg)$/.test(path||''))throw fail('Некорректный путь файла.',422);
    if(!request.headers.get('content-type')?.startsWith('application/json'))throw fail('Ожидается JSON.',415);
    const max=56*1024*1024;if(Number(request.headers.get('content-length'))>max)throw fail('Файл слишком большой.',413);
    // Stream the browser-encoded blob straight to GitHub, without buffering a
    // 40 MB video plus its base64 representation inside the 128 MB Worker.
    let size=0;const body=request.body.pipeThrough(new TransformStream({transform(chunk,controller){size+=chunk.length;if(size>max)throw fail('Файл слишком большой.',413);controller.enqueue(chunk);}}));
    const response=await fetcher('https://api.github.com'+client.base+'/git/blobs',{method:'POST',headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+env.GITHUB_TOKEN,'X-GitHub-Api-Version':'2026-03-10','Content-Type':'application/json','User-Agent':'Yumiliya-Password-Service'},body,redirect:'manual',duplex:'half'});
    if(!response.ok){await response.body?.cancel();throw fail('Не удалось загрузить файл. Повторите позже.',502);}
    const result=await response.json();if(!/^[a-f0-9]{40,64}$/.test(result.sha))throw fail('Некорректный ответ хранилища.',502);
    await env.DB.prepare('INSERT INTO uploads(session,path,sha,expires) VALUES(?,?,?,?) ON CONFLICT(session,path) DO UPDATE SET sha=excluded.sha,expires=excluded.expires').bind(key,path,result.sha,Date.now()+SESSION_MS).run();return respond({sha:result.sha});
   }
   if(url.pathname==='/api/publish'&&request.method==='POST'){
    const body=await jsonBody(request);if(body.workspace!==undefined&&!['main','drugie'].includes(body.workspace))throw fail('Выберите раздел для публикации.',422);const document=validateDocument(body.document,!body.workspace);
    if(!Number.isSafeInteger(body.revision)||body.revision<0||!Array.isArray(body.files)||body.files.length>300)throw fail('Некорректные данные публикации.',422);
    const referenced=new Set();const collect=v=>{if(typeof v==='string')referenced.add(v);else if(Array.isArray(v))v.forEach(collect);else if(v&&typeof v==='object')Object.values(v).forEach(collect);};collect(document);
    const storedFiles=new Map((await env.DB.prepare('SELECT path,sha FROM uploads WHERE session=? AND expires>?').bind(key,Date.now()).all()).results.map(file=>[file.path,file.sha]));
    const files=[];for(const file of body.files){
     if(!referenced.has(file.path))throw fail('Файл не используется в публикации.',422);
     const stored=storedFiles.get(file.path);
     if(!stored||stored!==file.sha)throw fail('Сначала загрузите файл в текущем сеансе.',422);files.push({path:file.path,sha:stored});
    }
    return respond(await client.publish(document,body.revision,files,body.workspace));
   }
   throw fail('Маршрут не найден.',404);
  }catch(error){return respond({error:error.status?error.message:'Сервис временно недоступен. Повторите позже.'},error.status||503);}
 }};
}
export default createWorker();
