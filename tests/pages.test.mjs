import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,cp,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {GithubPublisher} from '../pages-admin.js';
import {localMediaUrl} from '../hosting.js';
import {buildPages,PUBLIC_FILES} from '../scripts/build-pages.mjs';
import {DEFAULT_APPEARANCE} from '../appearance.js';
const config=JSON.parse(await readFile(new URL('../data/gacha.json',import.meta.url),'utf8'));
const document={config,appearance:structuredClone(DEFAULT_APPEARANCE),gallery:{items:[],deleted:[]}};
function fakeGithub({revision=0,allowPush=true,failUpdate=false}={}){
 const requests=[];let i=0;
 const fetcher=async(url,options)=>{
  const path=new URL(url).pathname,data=options.body?JSON.parse(options.body):null;requests.push({path,options,data});let body,status=200;
  if(path==='/user')body={login:'MrMayo1980'};
  else if(path.endsWith('/Yumiliyawebsite'))body={permissions:{push:allowPush}};
  else if(path.includes('/git/ref/'))body={object:{sha:'head-sha'}};
  else if(path.includes('/contents/'))body={content:Buffer.from(JSON.stringify({revision,published:document})).toString('base64')};
  else if(path.endsWith('/git/commits/head-sha'))body={tree:{sha:'base-tree'}};
  else if(path.endsWith('/git/blobs'))body={sha:'blob-'+(++i)};
  else if(path.endsWith('/git/trees'))body={sha:'new-tree'};
  else if(path.endsWith('/git/commits'))body={sha:'new-commit'};
  else if(path.includes('/git/refs/')){body=failUpdate?{message:'Conflict'}:{object:{sha:'new-commit'}};if(failUpdate)status=422;}
  else throw new Error('Unexpected endpoint '+path);
  return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
 };return {requests,fetcher};
}
test('GitHub publication commits source and Pages data/assets atomically, preserves files and never persists the token',async()=>{
 const {requests,fetcher}=fakeGithub(),client=new GithubPublisher({owner:'MrMayo1980',repo:'Yumiliyawebsite'},fetcher);
 assert.equal(await client.login('test-token-not-a-real-credential'),'MrMayo1980');
 const result=await client.publish(document,0,[{path:'assets/media/test.png',blob:new Blob(['test-art'])}]);assert.equal(result.revision,1);
 const tree=requests.find(x=>x.path.endsWith('/git/trees')).data;assert.equal(tree.base_tree,'base-tree');assert.deepEqual(tree.tree.map(x=>x.path),['assets/media/test.png','docs/assets/media/test.png','data/site-state.json','docs/data/site-state.json']);
 const commit=requests.find(x=>x.path.endsWith('/git/commits')).data;assert.deepEqual(commit.parents,['head-sha']);assert.equal(commit.tree,'new-tree');
 const update=requests.find(x=>x.path.includes('/git/refs/')).data;assert.equal(update.force,false);assert.equal(update.sha,'new-commit');
 assert.ok(requests.every(x=>x.options.headers.Authorization==='Bearer test-token-not-a-real-credential'));assert.ok(!requests.some(x=>JSON.stringify(x.data).includes('test-token-not-a-real-credential')));
});
test('GitHub login rejects read-only accounts and publication rejects stale revisions and protected branch errors',async()=>{
 const readonly=new GithubPublisher({owner:'MrMayo1980',repo:'Yumiliyawebsite'},fakeGithub({allowPush:false}).fetcher);await assert.rejects(readonly.login('test-only'),e=>e.status===403);assert.equal(readonly.token,'');
 const changed=fakeGithub({revision:2}),client=new GithubPublisher({owner:'MrMayo1980',repo:'Yumiliyawebsite'},changed.fetcher);await client.login('test-only');await assert.rejects(client.publish(document,0,[]),e=>e.status===409);assert.ok(!changed.requests.some(x=>x.options.method==='POST'));
 const failing=new GithubPublisher({owner:'MrMayo1980',repo:'Yumiliyawebsite'},fakeGithub({failUpdate:true}).fetcher);await failing.login('test-only');await assert.rejects(failing.publish(document,0,[]),e=>e.status===422);
});
test('HTTPS project-site media paths work without allowing private local endpoints',()=>{
 globalThis.location=new URL('https://mrmayo1980.github.io/Yumiliyawebsite/admin.html');
 assert.equal(localMediaUrl('assets/gacha/test.webp'),'https://mrmayo1980.github.io/Yumiliyawebsite/assets/gacha/test.webp');assert.equal(localMediaUrl('assets/media/test.png'),'https://mrmayo1980.github.io/Yumiliyawebsite/assets/media/test.png');
 for(const path of ['api/admin/state','../other-repo/file.html','https://user:password@example.com/test.jpg'])assert.equal(localMediaUrl(path),'');
});
test('Pages build includes both applications and excludes credentials, source server and unpublished files',async t=>{
 const source=await mkdtemp(join(tmpdir(),'yumiliya-pages-'));t.after(()=>rm(source,{recursive:true,force:true}));
 for(const file of PUBLIC_FILES)await cp(new URL('../'+file,import.meta.url),join(source,file));await cp(new URL('../assets/',import.meta.url),join(source,'assets'),{recursive:true});await cp(new URL('../data/',import.meta.url),join(source,'data'),{recursive:true});
 await mkdir(join(source,'.data'));await writeFile(join(source,'.data/credentials.json'),'private-test-secret');await writeFile(join(source,'.env'),'private-test-secret');await mkdir(join(source,'uploads'));await writeFile(join(source,'uploads/unpublished.png'),'private-unpublished-art');
 await buildPages({source});const names=await readdir(join(source,'docs'));assert.ok(names.includes('index.html'));assert.ok(names.includes('admin.html'));assert.ok(!names.some(x=>['.data','.env','server','tests','uploads'].includes(x)));assert.ok(names.includes('.nojekyll'));
 const html=await readFile(join(source,'docs/admin.html'),'utf8');assert.match(html,/pages-config.js/);assert.match(html,/https:\/\/api.github.com/);assert.ok(!html.includes('private-test-secret'));
 const runtime=await readFile(join(source,'docs/pages-config.js'),'utf8');assert.match(runtime,/MrMayo1980/);assert.ok(!runtime.includes('private-test-secret'));
});
