import {validateDocument} from './validation.js';
import {pagesSettings,registerPendingAsset} from './hosting.js';
const clone=value=>structuredClone(value);
const problem=(message,status=400)=>Object.assign(new Error(message),{status});
export class GithubPublisher{
 constructor({owner,repo,branch='main',prefix='docs/'},fetcher=fetch){this.owner=owner;this.repo=repo;this.branch=branch;this.prefix=prefix;this.fetcher=fetcher;this.token='';}
 async request(path,{method='GET',data}={}){
  if(!this.token)throw problem('Войдите с токеном GitHub.',401);
  let response;try{response=await this.fetcher('https://api.github.com'+path,{method,headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+this.token,'X-GitHub-Api-Version':'2026-03-10',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,cache:'no-store',credentials:'omit',redirect:'error'});}catch{throw problem('Не удалось связаться с GitHub. Проверьте подключение.',503);}
  const body=response.status===204?{}:await response.json();
  if(!response.ok){
   const messages={401:'Токен GitHub недействителен или истёк.',403:'GitHub отклонил запрос. Проверьте доступ токена к этому репозиторию и разрешение Contents: Read and write.',404:'Репозиторий или файл недоступен этому токену.',409:'В репозитории появились изменения. Загрузите актуальную версию перед публикацией.',422:'Ветка изменилась или защищена. Обновите данные и повторите публикацию.'};
   throw problem(messages[response.status]||'GitHub не смог выполнить запрос.',response.status);
  }
  return body;
 }
 get base(){return `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}`;}
 async login(token){
  if(typeof token!=='string'||!token.trim()||token.length>500)throw problem('Укажите токен GitHub.',401);
  this.token=token.trim();
  try{const user=await this.request('/user'),repo=await this.request(this.base);if(!repo.permissions?.push)throw problem('У этого аккаунта нет права записи в репозиторий.',403);return user.login;}catch(error){this.token='';throw error;}
 }
 async head(){return (await this.request(this.base+'/git/ref/heads/'+encodeURIComponent(this.branch))).object.sha;}
 async readState(ref){
  const file=await this.request(this.base+'/contents/data/site-state.json?ref='+encodeURIComponent(ref));
  const blob=file.content?file:await this.request(this.base+'/git/blobs/'+file.sha);
  const bytes=Uint8Array.from(atob(blob.content.replace(/\s/g,'')),c=>c.charCodeAt(0));
  const state=JSON.parse(new TextDecoder().decode(bytes));state.published=validateDocument(state.published,true);return state;
 }
 async blob(content,encoding='utf-8'){return (await this.request(this.base+'/git/blobs',{method:'POST',data:{content,encoding}})).sha;}
 async publish(document,revision,files){
  const doc=validateDocument(document,true),head=await this.head(),current=await this.readState(head);
  if(current.revision!==revision)throw problem('Сайт уже изменён в другой вкладке или на другом устройстве. Экспортируйте черновик и загрузите актуальную версию.',409);
  const parent=await this.request(this.base+'/git/commits/'+head),updatedAt=new Date().toISOString(),state={revision:revision+1,updatedAt,published:doc};
  const tree=[];
  for(const file of files){
   if(!/^assets\/media\/[a-zA-Z0-9_-]+\.(webp|png|jpg|gif|avif|mp4|mov|webm|ogg)$/.test(file.path))throw problem('Некорректный путь загруженного файла.',422);
   const bytes=new Uint8Array(await file.blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));const sha=await this.blob(btoa(binary),'base64');
   for(const path of [file.path,this.prefix+file.path])tree.push({path,mode:'100644',type:'blob',sha});
  }
  const sha=await this.blob(JSON.stringify(state,null,2)+'\n');
  for(const path of ['data/site-state.json',this.prefix+'data/site-state.json'])tree.push({path,mode:'100644',type:'blob',sha});
  const createdTree=await this.request(this.base+'/git/trees',{method:'POST',data:{base_tree:parent.tree.sha,tree}});
  const commit=await this.request(this.base+'/git/commits',{method:'POST',data:{message:`Publish website settings (revision ${state.revision})`,tree:createdTree.sha,parents:[head]}});
  await this.request(this.base+'/git/refs/heads/'+encodeURIComponent(this.branch),{method:'PATCH',data:{sha:commit.sha,force:false}});
  return {...state,commit:commit.sha};
 }
 async history(){
  const commits=await this.request(this.base+'/commits?path=data%2Fsite-state.json&per_page=11');
  const results=[];for(let i=0;i<commits.length;i+=3){const batch=await Promise.all(commits.slice(i,i+3).map(async commit=>{try{const state=await this.readState(commit.sha);return {revision:state.revision,updatedAt:state.updatedAt,document:state.published};}catch(error){if(error.status===404)return null;throw error;}}));results.push(...batch.filter(Boolean));}return results;
 }
}
const dbName=()=>{const s=pagesSettings();return `yumiliya-draft:${s.owner}/${s.repo}`;};
function database(){return new Promise((resolve,reject)=>{const req=indexedDB.open(dbName(),1);req.onupgradeneeded=()=>{req.result.createObjectStore('state');req.result.createObjectStore('files',{keyPath:'path'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(new Error('Не удалось открыть хранилище черновика.'));});}
async function storage(store,method,value,key){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction(store,method==='get'||method==='getAll'?'readonly':'readwrite');const req=tx.objectStore(store)[method](...([value,key].filter((_,i)=>i===0?value!==undefined:key!==undefined)));let result;req.onsuccess=()=>result=req.result;tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=()=>{db.close();reject(new Error('Не удалось сохранить черновик в браузере. Проверьте свободное место.'));};});}
let client,state,account='',active=false;const revisions=new Map();
async function files(){return storage('files','getAll');}
async function restoreAssets(){for(const file of await files())registerPendingAsset(file.path,URL.createObjectURL(file.blob));}
async function persist(){await storage('state','put',{revision:state.revision,draftVersion:state.draftVersion,draft:state.draft},'draft');}
function requireSession(){if(!active||!client?.token)throw problem('Войдите с токеном GitHub.',401);}
function detectExtension(bytes){const s=(a,b)=>new TextDecoder().decode(bytes.subarray(a,b));if(bytes[0]===137&&s(1,4)==='PNG')return 'png';if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'jpg';if(/^GIF8[79]a$/.test(s(0,6)))return 'gif';if(s(0,4)==='RIFF'&&s(8,12)==='WEBP')return 'webp';if(s(4,8)==='ftyp')return /avif|avis/.test(s(8,32))?'avif':/qt  /.test(s(8,32))?'mov':'mp4';if(bytes[0]===26&&bytes[1]===69&&bytes[2]===223&&bytes[3]===163)return 'webm';if(s(0,4)==='OggS')return 'ogg';throw problem('Выберите JPG, PNG, GIF, WEBP, AVIF, MP4, MOV, WEBM или OGG.',415);}
export async function pagesApi(path,{method='GET',data,raw}={}){
 if(path==='api/login'&&method==='POST'){
  client=new GithubPublisher(pagesSettings());account=await client.login(data.password);
  const published=await client.readState(await client.head()),saved=await storage('state','get','draft');
  state={revision:saved?.revision??published.revision,updatedAt:published.updatedAt,draft:saved?.draft||clone(published.published),draftVersion:saved?.draftVersion||0,stale:!!saved&&saved.revision!==published.revision};active=true;await restoreAssets();return {csrf:'github-memory-session'};
 }
 requireSession();
 if(path==='api/logout'){client.token='';active=false;return {ok:true};}
 if(path==='api/admin/state')return {...clone(state),csrf:'github-memory-session',account};
 if(path==='api/admin/draft'&&method==='PUT'){
  if(data.expectedDraftVersion!==state.draftVersion)throw problem('Черновик изменился. Обновите студию.',409);
  const saved=await storage('state','get','draft');if(saved&&(saved.draftVersion!==state.draftVersion||saved.revision!==state.revision))throw problem('Черновик изменён в другой вкладке. Экспортируйте изменения перед обновлением.',409);
  state.draft=validateDocument(data.document);state.draftVersion++;await persist();return {draftVersion:state.draftVersion};
 }
 if(path==='api/admin/publish'&&method==='POST'){
  if(data.expectedRevision!==state.revision||data.expectedDraftVersion!==state.draftVersion)throw problem('Черновик изменился. Повторите публикацию.',409);
  const saved=await storage('state','get','draft');if(saved&&(saved.draftVersion!==state.draftVersion||saved.revision!==state.revision))throw problem('Черновик изменён в другой вкладке. Экспортируйте изменения перед обновлением.',409);
  const paths=new Set();const collect=value=>{if(typeof value==='string')paths.add(value);else if(Array.isArray(value))value.forEach(collect);else if(value&&typeof value==='object')Object.values(value).forEach(collect);};collect(state.draft);const referenced=(await files()).filter(file=>paths.has(file.path));
  const result=await client.publish(state.draft,state.revision,referenced);state.revision=result.revision;state.updatedAt=result.updatedAt;state.stale=false;await persist();for(const file of referenced)await storage('files','delete',file.path);return {revision:state.revision,updatedAt:state.updatedAt,commit:result.commit};
 }
 if(path==='api/admin/upload'&&method==='POST'){
  if(!raw||raw.size>40*1024*1024)throw problem('Файл должен быть не больше 40 МБ.',413);
  const ext=detectExtension(new Uint8Array(await raw.slice(0,64).arrayBuffer())),path='assets/media/'+crypto.randomUUID()+'.'+ext;
  await storage('files','put',{path,blob:raw});registerPendingAsset(path,URL.createObjectURL(raw));return {url:path,type:['mp4','mov','webm','ogg'].includes(ext)?'video':ext==='gif'?'gif':'image'};
 }
 if(path==='api/admin/reload'&&method==='POST'){const published=await client.readState(await client.head());state={revision:published.revision,updatedAt:published.updatedAt,draft:clone(published.published),draftVersion:state.draftVersion+1,stale:false};await persist();await storage('files','clear');return {ok:true};}
 if(path==='api/admin/history'){
  revisions.clear();const all=await client.history();for(const item of all)revisions.set(item.revision,item);return all.filter(x=>x.revision<state.revision).map(({revision,updatedAt})=>({revision,updatedAt}));
 }
 if(/^api\/admin\/history\/\d+$/.test(path)){const item=revisions.get(Number(path.split('/').pop()));if(!item)throw problem('Сначала загрузите историю публикаций.',404);return clone(item);}
 throw problem('Этот раздел недоступен в режиме GitHub Pages.',422);
}
