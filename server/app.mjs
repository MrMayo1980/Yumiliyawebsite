import {readFile,writeFile,mkdir,rename,readdir,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {resolve,join,extname,basename} from 'node:path';
import {randomUUID} from 'node:crypto';
import {token,verifyPassword} from './auth.mjs';
import {validateDocument} from './schema.mjs';
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif','.avif':'image/avif','.mp4':'video/mp4','.mov':'video/quicktime','.webm':'video/webm','.ogg':'video/ogg'};
export async function createApp({root=process.cwd(),dataDir=resolve(root,'.data'),publicOrigin=process.env.PUBLIC_ORIGIN,production=process.env.NODE_ENV==='production'}={}) {
  root=resolve(root);if(publicOrigin)publicOrigin=new URL(publicOrigin).origin;await mkdir(dataDir,{recursive:true,mode:0o700});await mkdir(join(dataDir,'history'),{recursive:true,mode:0o700});await mkdir(join(root,'uploads'),{recursive:true});
  let credentials;try{credentials=JSON.parse(await readFile(join(dataDir,'credentials.json'),'utf8'));}catch{throw new Error('Сначала настройте пароль: npm run setup');}
  const initial={config:JSON.parse(await readFile(join(root,'data/gacha.json'),'utf8')),gallery:{items:[],deleted:[]}};
  let state;try{state=JSON.parse(await readFile(join(dataDir,'state.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;state={revision:0,draftVersion:0,published:initial,draft:structuredClone(initial),updatedAt:null};}
  state.published=validateDocument(state.published,true);state.draft=validateDocument(state.draft);
  const sessions=new Map(),attempts=new Map();let saving=Promise.resolve();
  const atomic=async(file,obj)=>{const tmp=file+'.'+randomUUID()+'.tmp';await writeFile(tmp,JSON.stringify(obj),{mode:0o600});await rename(tmp,file);};
  const mutate=fn=>{const job=saving.then(fn);saving=job.catch(()=>{});return job;};
  const persist=async(next)=>{await atomic(join(dataDir,'state.json'),next);state=next;};
  const json=(res,code,value)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  const error=(message,status=400)=>Object.assign(new Error(message),{status});
  async function body(req,max=24*1024*1024){if(Number(req.headers['content-length'])>max)throw error('Файл слишком большой.',413);const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>max)throw error('Файл слишком большой.',413);chunks.push(chunk);}return Buffer.concat(chunks);}
  const parse=async req=>{if(!req.headers['content-type']?.startsWith('application/json'))throw error('Ожидается JSON.',415);try{return JSON.parse(await body(req));}catch(e){if(e.status)throw e;throw error('Некорректный JSON.');}};
  const session=req=>{const match=/(?:^|;\s*)yumiliya_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'');const s=match&&sessions.get(match[1]);if(!s||s.expires<Date.now()){if(match)sessions.delete(match[1]);throw error('Войдите в панель администратора.',401);}return s;};
  const snapshot=s=>({revision:state.revision,draftVersion:state.draftVersion,updatedAt:state.updatedAt,draft:state.draft,csrf:s.csrf});
  function uploadType(buf){if(buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'png';if(buf[0]===255&&buf[1]===216&&buf[2]===255)return 'jpg';if(/^GIF8[79]a$/.test(buf.subarray(0,6).toString()))return 'gif';if(buf.subarray(0,4).toString()==='RIFF'&&buf.subarray(8,12).toString()==='WEBP')return 'webp';if(buf.subarray(4,8).toString()==='ftyp'){if(/avif|avis/.test(buf.subarray(8,32).toString()))return 'avif';if(/qt  /.test(buf.subarray(8,32).toString()))return 'mov';return 'mp4';}if(buf.subarray(0,4).equals(Buffer.from([26,69,223,163])))return 'webm';if(buf.subarray(0,4).toString()==='OggS')return 'ogg';throw error('Поддерживаются JPG, PNG, GIF, WEBP, AVIF, MP4, MOV, WEBM и OGG.',415);}
  const csp="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; media-src 'self' blob: https:; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'; form-action 'self'";
  return async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','SAMEORIGIN');res.setHeader('Content-Security-Policy',csp);if(production)res.setHeader('Strict-Transport-Security','max-age=31536000');
    try{
      const url=new URL(req.url,'http://localhost');const path=url.pathname;const host=req.headers.host;
      if(!host||!/^([a-zA-Z0-9.-]+|\[[a-fA-F0-9:]+\])(?::\d+)?$/.test(host))throw error('Некорректный адрес.',400);
      const origin=publicOrigin||`http://${host}`;
      if(publicOrigin&&host!==new URL(publicOrigin).host)throw error('Недопустимый адрес сервера.',403);
      if(!publicOrigin&&!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host))throw error('Настройте PUBLIC_ORIGIN для публичного домена.',403);
      if(path.startsWith('/api/')){
        if(req.method!=='GET'&&req.headers.origin!==origin)throw error('Запрос должен быть отправлен с этого сайта.',403);
        if(path==='/api/appearance'&&req.method==='GET')return json(res,200,state.published.appearance);
        if(path==='/api/gacha'&&req.method==='GET')return json(res,200,state.published.config);
        if(path==='/api/gallery'&&req.method==='GET')return json(res,200,state.published.gallery);
        if(path==='/api/login'&&req.method==='POST'){
          const ip=req.socket.remoteAddress,now=Date.now();const a=attempts.get(ip)||{count:0,until:now+15*60*1000};if(a.until<now){a.count=0;a.until=now+15*60*1000;}if(a.count>=8)throw error('Слишком много попыток. Попробуйте через 15 минут.',429);a.count++;attempts.set(ip,a);
          const data=await parse(req);if(!await verifyPassword(data.password,credentials))throw error('Неверный пароль.',401);
          attempts.delete(ip);if(sessions.size>=100)sessions.delete(sessions.keys().next().value);
          const id=token(),s={csrf:token(),expires:now+8*60*60*1000};sessions.set(id,s);
          res.setHeader('Set-Cookie',`yumiliya_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${production||origin.startsWith('https:')?'; Secure':''}`);return json(res,200,{csrf:s.csrf});
        }
        const s=session(req);
        if(req.method!=='GET'&&req.headers['x-csrf-token']!==s.csrf)throw error('Проверка безопасности не пройдена. Обновите страницу.',403);
        if(path==='/api/logout'&&req.method==='POST'){const id=/(?:^|;\s*)yumiliya_session=([a-f0-9]{64})/.exec(req.headers.cookie||'')?.[1];sessions.delete(id);res.setHeader('Set-Cookie',`yumiliya_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${production?'; Secure':''}`);return json(res,200,{ok:true});}
        if(path==='/api/admin/state'&&req.method==='GET')return json(res,200,snapshot(s));
        if(path==='/api/admin/appearance'&&req.method==='GET')return json(res,200,state.draft.appearance);
        if(path==='/api/admin/gallery'&&req.method==='GET')return json(res,200,state.draft.gallery);
        if(path==='/api/admin/preview'&&req.method==='GET')return json(res,200,state.draft.config);
        if(path==='/api/admin/draft'&&req.method==='PUT'){
          const data=await parse(req);const doc=validateDocument(data.document);return await mutate(async()=>{if(data.expectedDraftVersion!==state.draftVersion)throw error('Черновик изменён в другой вкладке. Сначала экспортируйте свои изменения и загрузите актуальную версию.',409);await persist({...state,draft:doc,draftVersion:state.draftVersion+1});json(res,200,{draftVersion:state.draftVersion});});
        }
        if(path==='/api/admin/publish'&&req.method==='POST'){
          const data=await parse(req);return await mutate(async()=>{if(data.expectedRevision!==state.revision||data.expectedDraftVersion!==state.draftVersion)throw error('Данные изменились. Обновите панель перед публикацией.',409);validateDocument(state.draft,true);const next={...state,revision:state.revision+1,published:structuredClone(state.draft),updatedAt:new Date().toISOString()};await atomic(join(dataDir,'history',`${state.revision}.json`),{revision:state.revision,document:state.published,updatedAt:state.updatedAt});await persist(next);json(res,200,{revision:state.revision,updatedAt:state.updatedAt});});
        }
        if(path==='/api/admin/history'&&req.method==='GET'){const names=(await readdir(join(dataDir,'history'))).filter(n=>/^\d+\.json$/.test(n)).sort((a,b)=>parseInt(b)-parseInt(a)).slice(0,50);const history=[];for(const n of names){const h=JSON.parse(await readFile(join(dataDir,'history',n),'utf8'));history.push({revision:h.revision,updatedAt:h.updatedAt});}return json(res,200,history);}
        if(/^\/api\/admin\/history\/\d+$/.test(path)&&req.method==='GET'){try{return json(res,200,JSON.parse(await readFile(join(dataDir,'history',basename(path)+'.json'),'utf8')));}catch(e){if(e.code==='ENOENT')throw error('Версия не найдена.',404);throw e;}}
        if(path==='/api/admin/password'&&req.method==='POST'){const data=await parse(req);if(!await verifyPassword(data.currentPassword,credentials))throw error('Текущий пароль неверен.',401);const {hashPassword}=await import('./auth.mjs');let next;try{next=await hashPassword(data.newPassword);}catch(e){throw error(e.message,422);}await atomic(join(dataDir,'credentials.json'),next);credentials=next;sessions.clear();res.setHeader('Set-Cookie','yumiliya_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return json(res,200,{ok:true});}
        if(path==='/api/admin/upload'&&req.method==='POST'){const buf=await body(req,40*1024*1024);const ext=uploadType(buf);const name=randomUUID()+'.'+ext;await writeFile(join(root,'uploads',name),buf,{flag:'wx',mode:0o644});return json(res,201,{url:'uploads/'+name,type:['mp4','mov','webm','ogg'].includes(ext)?'video':ext==='gif'?'gif':'image'});}
        throw error('Маршрут не найден.',404);
      }
      if(!['GET','HEAD'].includes(req.method))throw error('Метод не поддерживается.',405);
      const file=path==='/'?'index.html':decodeURIComponent(path.slice(1));
      if(file==='data/gacha.json')return json(res,200,state.published.config);
      const allowed=['frames.js','frames.css','hosting.js','validation.js','draft-sync.js','pages-admin.js','appearance.js','site.css','index.html','index.js','data/legacy-gallery.json','admin.html','admin.js','admin.css','gallery.js','gacha_game.html','gacha.js'];
      if(!allowed.includes(file)&&!/^(assets\/(?:gacha|media)|uploads)\/[a-zA-Z0-9_-]+\.(webp|png|jpe?g|gif|avif|mp4|webm|mov|ogg)$/i.test(file))throw error('Файл не найден.',404);
      const full=join(root,file);let info;try{info=await stat(full);}catch{throw error('Файл не найден.',404);}if(!info.isFile())throw error('Файл не найден.',404);
      res.writeHead(200,{'Content-Type':MIME[extname(full)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':file.startsWith('assets/')||file.startsWith('uploads/')?'public, max-age=31536000, immutable':'no-cache'});if(req.method==='HEAD')return res.end();createReadStream(full).pipe(res);
    }catch(e){if(!res.headersSent)json(res,e.status||500,{error:e.status?e.message:'Не удалось выполнить запрос.'});else res.end();if(!e.status)console.error(e);}
  };
}
