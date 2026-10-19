import {projectDocument,replaceSection} from '../sections.js';
import {validateDocumentTransition} from '../card-ids.js';
import {validateDocument} from '../validation.js';
const problem=(message,status=400)=>Object.assign(new Error(message),{status});
export class GithubPublisher{
 constructor({owner,repo,branch='main',prefix='docs/'},fetcher=(...args)=>fetch(...args)){this.owner=owner;this.repo=repo;this.branch=branch;this.prefix=prefix;this.fetcher=fetcher;this.token='';}
 async request(path,{method='GET',data}={}){
  if(!this.token)throw problem('Сервис публикации не настроен.',401);
  let response;try{response=await this.fetcher('https://api.github.com'+path,{method,headers:{Accept:'application/vnd.github+json','User-Agent':'Yumiliya-Password-Service',Authorization:'Bearer '+this.token,'X-GitHub-Api-Version':'2026-03-10',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,cache:'no-store',credentials:'omit',redirect:'manual'});}catch{throw problem('Не удалось связаться с GitHub. Проверьте подключение.',503);}
  if(response.status>=300&&response.status<400)throw problem('Сервис публикации получил неожиданный адрес перенаправления.',503);
  const body=response.status===204?{}:await response.json();
  if(!response.ok){
   const messages={401:'Публикация временно недоступна. Владелец сайта должен обновить настройки сервиса.',403:'Публикация отклонена. Владелец сайта должен проверить доступ сервиса к репозиторию.',404:'Опубликованные настройки недоступны сервису.',409:'В репозитории появились изменения. Загрузите актуальную версию перед публикацией.',422:'Ветка изменилась или защищена. Обновите данные и повторите публикацию.'};
   throw problem(messages[response.status]||'GitHub не смог выполнить запрос.',response.status);
  }
  return body;
 }
 get base(){return `/repos/${encodeURIComponent(this.owner)}/${encodeURIComponent(this.repo)}`;}
 async head(){return (await this.request(this.base+'/git/ref/heads/'+encodeURIComponent(this.branch))).object.sha;}
 async readState(ref){
  const file=await this.request(this.base+'/contents/data/site-state.json?ref='+encodeURIComponent(ref));
  const blob=file.content?file:await this.request(this.base+'/git/blobs/'+file.sha);
  const bytes=Uint8Array.from(atob(blob.content.replace(/\s/g,'')),c=>c.charCodeAt(0));
  const state=JSON.parse(new TextDecoder().decode(bytes));state.published=validateDocument(state.published,true);return state;
 }
 async blob(content,encoding='utf-8'){return (await this.request(this.base+'/git/blobs',{method:'POST',data:{content,encoding}})).sha;}
 async publish(document,revision,files,workspace){
  if(workspace!==undefined&&!['main','drugie'].includes(workspace))throw problem('Выберите раздел для публикации.',422);
  const head=await this.head(),current=await this.readState(head);
  if(current.revision!==revision)throw problem('Сайт уже изменён в другой вкладке или на другом устройстве. Экспортируйте черновик и загрузите актуальную версию.',409);
  const doc=validateDocument(workspace?replaceSection(current.published,workspace,projectDocument(document,workspace)):document,true);
  validateDocumentTransition(current.published,doc);
  const parent=await this.request(this.base+'/git/commits/'+head),updatedAt=new Date().toISOString(),state={revision:revision+1,updatedAt,published:doc};
  const tree=[];
  for(const file of files){
   if(!/^assets\/media\/[a-zA-Z0-9_-]+\.(webp|png|jpg|gif|avif|mp4|mov|webm|ogg)$/.test(file.path)||!/^([a-f0-9]{40}|[a-f0-9]{64})$/.test(file.sha))throw problem('Некорректный загруженный файл.',422);
   for(const path of [file.path,this.prefix+file.path])tree.push({path,mode:'100644',type:'blob',sha:file.sha});
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
