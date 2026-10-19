import {synchronizeDraft} from './draft-sync.js?v=draft-sync-1';
import {validateDocument} from './validation.js?v=archive-random-1';
import {pagesSettings,registerPendingAsset,resolvePendingAsset} from './hosting.js';
const clone=value=>structuredClone(value);
const problem=(message,status=400)=>Object.assign(new Error(message),{status});
export class PasswordPublisher{
 constructor({apiBase},fetcher=(...args)=>fetch(...args)){
  let url;try{url=new URL(apiBase);}catch{throw problem('Вход ещё не подключён. Владелец сайта должен завершить настройку сервиса.',503);}
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw problem('Некорректный адрес сервиса входа.',503);
  this.base=url.href.replace(/\/$/,'');this.fetcher=fetcher;this.session='';
 }
 async request(path,{method='GET',data,body}={}){
  let response;try{response=await this.fetcher(this.base+'/api/'+path,{method,headers:{...(this.session?{Authorization:'Bearer '+this.session}:{}),...(data!==undefined||body!==undefined?{'Content-Type':'application/json'}:{})},body:body??(data!==undefined?JSON.stringify(data):undefined),credentials:'omit',cache:'no-store',redirect:'error'});}catch{throw problem('Не удалось связаться с сервисом входа. Повторите позже.',503);}
  let result;try{result=await response.json();}catch{throw problem('Сервис входа временно недоступен.',503);}
  if(!response.ok){if(response.status===401)this.session='';throw problem(result.error||'Не удалось выполнить запрос.',response.status);}return result;
 }
 async login(password){const result=await this.request('login',{method:'POST',data:{password}});this.session=result.session;return '';}
 async readState(){return this.request('published');}
 async head(){return '';}
 async publish(document,revision,files){
  const uploaded=[];
  for(const file of files){
   const bytes=new Uint8Array(await file.blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
   const result=await this.request('upload-blob?path='+encodeURIComponent(file.path),{method:'POST',data:{content:btoa(binary),encoding:'base64'}});uploaded.push({path:file.path,sha:result.sha});
  }
  return this.request('publish',{method:'POST',data:{document,revision,files:uploaded}});
 }
 async history(){return this.request('history');}
 async logout(){try{return await this.request('logout',{method:'POST',data:{}});}finally{this.session='';}}
 async changePassword(data){try{return await this.request('password',{method:'POST',data});}finally{this.session='';}}
}
const dbName=()=>{const s=pagesSettings();return `yumiliya-draft:${s.owner}/${s.repo}`;};
function database(){return new Promise((resolve,reject)=>{const req=indexedDB.open(dbName(),1);req.onupgradeneeded=()=>{req.result.createObjectStore('state');req.result.createObjectStore('files',{keyPath:'path'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(new Error('Не удалось открыть хранилище черновика.'));});}
async function storage(store,method,value,key){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction(store,method==='get'||method==='getAll'?'readonly':'readwrite');const req=tx.objectStore(store)[method](...([value,key].filter((_,i)=>i===0?value!==undefined:key!==undefined)));let result;req.onsuccess=()=>result=req.result;tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=()=>{db.close();reject(new Error('Не удалось сохранить черновик в браузере. Проверьте свободное место.'));};});}
let client,state,account='',active=false;const revisions=new Map();
async function files(){return storage('files','getAll');}
async function restoreAssets(){for(const file of await files())if(resolvePendingAsset(file.path)===file.path)registerPendingAsset(file.path,URL.createObjectURL(file.blob));}
async function persist(expected){
 const value={revision:state.revision,draftVersion:state.draftVersion,draft:state.draft,basePublished:state.basePublished};
 if(!arguments.length){await storage('state','put',value,'draft');return;}
 const db=await database();await new Promise((resolve,reject)=>{
  const tx=db.transaction('state','readwrite'),store=tx.objectStore('state'),request=store.get('draft');let conflict=false;
  request.onsuccess=()=>{const actual=request.result,unchanged=(!actual&&!expected)||(actual&&expected&&actual.revision===expected.revision&&actual.draftVersion===expected.draftVersion);if(!unchanged){conflict=true;tx.abort();return;}store.put(value,'draft');};
  tx.oncomplete=()=>{db.close();resolve();};tx.onabort=tx.onerror=()=>{db.close();reject(conflict?problem('Черновик изменён в другой вкладке. Обновите студию.',409):problem('Не удалось сохранить черновик.',503));};
 });
}
async function synchronize(published,saved){
 const previousState=state;
 let historicalBase;
 if(saved?.draft&&!saved.basePublished&&saved.revision!==published.revision){try{historicalBase=(await client.history()).find(item=>item.revision===saved.revision)?.document;}catch{}}
 const synced=synchronizeDraft(saved,published,historicalBase);
 if(synced.backup){const copies=await storage('state','get','draft-recoveries')||[];copies.push({revision:saved.revision,createdAt:new Date().toISOString(),document:clone(saved.draft)});await storage('state','put',copies,'draft-recoveries');}
 const copies=await storage('state','get','draft-recoveries')||[];
 state={revision:published.revision,updatedAt:published.updatedAt,draft:synced.draft,basePublished:synced.basePublished,draftVersion:synced.draftVersion,stale:false,syncNotice:synced.notice,recoveryAvailable:copies.length>0};
 try{await persist(saved);}catch(error){state=previousState;throw error;}
}
function requireSession(){if(!active||!client?.session)throw problem('Войдите с паролем администратора.',401);}
function detectExtension(bytes){const s=(a,b)=>new TextDecoder().decode(bytes.subarray(a,b));if(bytes[0]===137&&s(1,4)==='PNG')return 'png';if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'jpg';if(/^GIF8[79]a$/.test(s(0,6)))return 'gif';if(s(0,4)==='RIFF'&&s(8,12)==='WEBP')return 'webp';if(s(4,8)==='ftyp')return /avif|avis/.test(s(8,32))?'avif':/qt  /.test(s(8,32))?'mov':'mp4';if(bytes[0]===26&&bytes[1]===69&&bytes[2]===223&&bytes[3]===163)return 'webm';if(s(0,4)==='OggS')return 'ogg';throw problem('Выберите JPG, PNG, GIF, WEBP, AVIF, MP4, MOV, WEBM или OGG.',415);}
export async function pagesApi(path,{method='GET',data,raw}={}){
 if(path==='api/login'&&method==='POST'){
  client=new PasswordPublisher(pagesSettings());account=await client.login(data.password);
  const published=await client.readState(await client.head()),saved=await storage('state','get','draft');
  await synchronize(published,saved);active=true;await restoreAssets();return {csrf:'password-memory-session'};
 }
 requireSession();
 if(path==='api/logout'){await client.logout();active=false;return {ok:true};}
 if(path==='api/admin/password'&&method==='POST'){await client.changePassword(data);active=false;return {ok:true};}
 if(path==='api/admin/state')return {...clone(state),csrf:'password-memory-session',account};
 if(path==='api/admin/sync'&&method==='POST'){
  const before=JSON.stringify([state.revision,state.draftVersion,state.draft]);
  const published=await client.readState(),saved=await storage('state','get','draft');await synchronize(published,saved);await restoreAssets();
  return {changed:before!==JSON.stringify([state.revision,state.draftVersion,state.draft])};
 }
 if(path==='api/admin/recovery'){const copies=await storage('state','get','draft-recoveries')||[];if(!copies.length)throw problem('Сохранённых копий нет.',404);return clone(copies.at(-1));}
 if(path==='api/admin/draft'&&method==='PUT'){
  if(data.expectedDraftVersion!==state.draftVersion)throw problem('Черновик изменился. Обновите студию.',409);
  const saved=await storage('state','get','draft');if(saved&&(saved.draftVersion!==state.draftVersion||saved.revision!==state.revision))throw problem('Черновик изменён в другой вкладке. Экспортируйте изменения перед обновлением.',409);
  const previous=clone(state);state.draft=validateDocument(data.document);state.draftVersion++;try{await persist(saved);}catch(error){state=previous;throw error;}return {draftVersion:state.draftVersion};
 }
 if(path==='api/admin/publish'&&method==='POST'){
  if(data.expectedRevision!==state.revision||data.expectedDraftVersion!==state.draftVersion)throw problem('Черновик изменился. Повторите публикацию.',409);
  const saved=await storage('state','get','draft');if(saved&&(saved.draftVersion!==state.draftVersion||saved.revision!==state.revision))throw problem('Черновик изменён в другой вкладке. Экспортируйте изменения перед обновлением.',409);
  const paths=new Set();const collect=value=>{if(typeof value==='string')paths.add(value);else if(Array.isArray(value))value.forEach(collect);else if(value&&typeof value==='object')Object.values(value).forEach(collect);};collect(state.draft);const referenced=(await files()).filter(file=>paths.has(file.path));
  const result=await client.publish(state.draft,state.revision,referenced);state.revision=result.revision;state.updatedAt=result.updatedAt;state.draft=validateDocument(result.published||state.draft);state.basePublished=clone(state.draft);state.stale=false;state.syncNotice='';await persist();for(const file of referenced)await storage('files','delete',file.path);return {revision:state.revision,updatedAt:state.updatedAt,commit:result.commit};
 }
 if(path==='api/admin/upload'&&method==='POST'){
  if(!raw||raw.size>40*1024*1024)throw problem('Файл должен быть не больше 40 МБ.',413);
  const ext=detectExtension(new Uint8Array(await raw.slice(0,64).arrayBuffer())),path='assets/media/'+crypto.randomUUID()+'.'+ext;
  await storage('files','put',{path,blob:raw});registerPendingAsset(path,URL.createObjectURL(raw));return {url:path,type:['mp4','mov','webm','ogg'].includes(ext)?'video':ext==='gif'?'gif':'image'};
 }
 if(path==='api/admin/reload'&&method==='POST'){const published=await client.readState(await client.head());state={revision:published.revision,updatedAt:published.updatedAt,draft:clone(published.published),basePublished:clone(published.published),draftVersion:state.draftVersion+1,stale:false,syncNotice:''};await persist();await storage('files','clear');return {ok:true};}
 if(path==='api/admin/history'){
  revisions.clear();const all=await client.history();for(const item of all)revisions.set(item.revision,item);return all.filter(x=>x.revision<state.revision).map(({revision,updatedAt})=>({revision,updatedAt}));
 }
 if(/^api\/admin\/history\/\d+$/.test(path)){const item=revisions.get(Number(path.split('/').pop()));if(!item)throw problem('Сначала загрузите историю публикаций.',404);return clone(item);}
 throw problem('Этот раздел недоступен в режиме GitHub Pages.',422);
}
