import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {getPlatformProxy} from 'wrangler';
import {createWorker} from '../cloudflare/worker.mjs';
import {hashPassword} from '../cloudflare/password.mjs';
const origin='https://mrmayo1980.github.io',password='test-password-for-worker-941!',serverSecret='server-only-repository-credential';
const document=JSON.parse(await readFile(new URL('../data/site-state.json',import.meta.url),'utf8')).published;
async function fixture(t){
 const platform=await getPlatformProxy({configPath:new URL('../wrangler.jsonc',import.meta.url).pathname,persist:false});t.after(()=>platform.dispose());
 const sql=await readFile(new URL('../cloudflare/migrations/0001_auth.sql',import.meta.url),'utf8');
 for(const statement of sql.split(';').map(x=>x.trim()).filter(Boolean))await platform.env.DB.prepare(statement).run();
 const env={...platform.env,INITIAL_CREDENTIALS:JSON.stringify(await hashPassword(password)),GITHUB_TOKEN:serverSecret};
 const requests=[];
 const worker=createWorker({fetcher:async(url,options={})=>{
  assert.equal(options.headers.Authorization,'Bearer '+serverSecret);const path=new URL(url).pathname;
  let data;if(options.body instanceof ReadableStream)data=JSON.parse(await new Response(options.body).text());else if(options.body)data=JSON.parse(options.body);requests.push({path,data});
  if(path.includes('/git/ref/'))return Response.json({object:{sha:'old-head'}});
  if(path.includes('/contents/'))return Response.json({content:Buffer.from(JSON.stringify({revision:0,published:document})).toString('base64')});
  if(path.endsWith('/git/commits/old-head'))return Response.json({tree:{sha:'old-tree'}});
  if(path.endsWith('/git/blobs'))return Response.json({sha:'a'.repeat(40)});
  if(path.endsWith('/git/trees'))return Response.json({sha:'tree'});
  if(path.endsWith('/git/commits'))return Response.json({sha:'commit'});
  if(path.includes('/git/refs/'))return Response.json({object:{sha:'commit'}});
  throw new Error('Unexpected endpoint '+path);
 }});
 async function call(path,{method='GET',data,session,ip='192.0.2.1',requestOrigin=origin}={}){
  return worker.fetch(new Request('https://login.example.workers.dev'+path,{method,headers:{Origin:requestOrigin,'CF-Connecting-IP':ip,...(session?{Authorization:'Bearer '+session}:{}),...(data!==undefined?{'Content-Type':'application/json'}:{})},body:data!==undefined?JSON.stringify(data):undefined}),env);
 }
 async function login(ip='192.0.2.1'){const response=await call('/api/login',{method:'POST',data:{password},ip});assert.equal(response.status,200);return (await response.json()).session;}
 return {env,worker,call,login,requests};
}
test('Worker protects repository actions, checks passwords privately, enforces CORS and revokes logged-out sessions',async t=>{
 const {call,login,requests,env}=await fixture(t);
 assert.equal((await call('/api/published')).status,401);assert.equal(requests.length,0);
 assert.equal((await call('/api/login',{method:'POST',data:{password},requestOrigin:'https://evil.example'})).status,403);
 const preflight=await call('/api/publish',{method:'OPTIONS'});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),origin);assert.equal(preflight.headers.get('Access-Control-Allow-Credentials'),null);
 assert.equal((await call('/api/login',{method:'POST',data:{password:'wrong'}})).status,401);
 const session=await login();assert.match(session,/^[a-f0-9]{64}$/);
 const state=await call('/api/published',{session});assert.equal(state.status,200);const body=await state.text();assert.ok(!body.includes(serverSecret));assert.ok(!body.includes(password));assert.equal(JSON.parse(body).published.config.title,document.config.title);
 const stored=await env.DB.prepare('SELECT value FROM credentials WHERE id=1').first();assert.ok(!stored.value.includes(password));
 assert.equal((await call('/api/logout',{method:'POST',session})).status,200);assert.equal((await call('/api/published',{session})).status,401);
});
test('Worker validates uploaded blob ownership, publishes public settings atomically and rejects invalid/stale changes',async t=>{
 const {call,login,requests}=await fixture(t),session=await login(),other=await login('192.0.2.2');
 const path='assets/media/upload.png',sha='a'.repeat(40),changed=structuredClone(document);changed.config.cards[0].img=path;
 assert.equal((await call('/api/upload-blob?path=admin.html',{method:'POST',session,data:{content:'test',encoding:'base64'}})).status,422);
 assert.equal((await call('/api/publish',{method:'POST',session,data:{document:changed,revision:0,files:[{path,sha}]}})).status,422);
 assert.equal((await call('/api/upload-blob?path='+encodeURIComponent(path),{method:'POST',session,data:{content:'dGVzdA==',encoding:'base64'}})).status,200);
 assert.equal((await call('/api/publish',{method:'POST',session:other,data:{document:changed,revision:0,files:[{path,sha}]}})).status,422);
 const response=await call('/api/publish',{method:'POST',session,data:{document:changed,revision:0,files:[{path,sha}]}});assert.equal(response.status,200);assert.equal((await response.json()).revision,1);
 const tree=requests.find(x=>x.path.endsWith('/git/trees')).data;assert.deepEqual(tree.tree.map(x=>x.path),[path,'docs/'+path,'data/site-state.json','docs/data/site-state.json']);assert.equal(tree.base_tree,'old-tree');assert.equal(requests.find(x=>x.path.includes('/git/refs/')).data.force,false);
 assert.equal((await call('/api/publish',{method:'POST',session,data:{document:changed,revision:2,files:[]}})).status,409);
 changed.config.cards[0].img='javascript:bad';assert.equal((await call('/api/publish',{method:'POST',session,data:{document:changed,revision:0,files:[]}})).status,422);
 assert.ok(!requests.some(x=>JSON.stringify(x.data||{}).includes(serverSecret)||JSON.stringify(x.data||{}).includes(password)));
});
test('Worker password changes revoke every session and persist the new password across instances',async t=>{
 const {call,login,env,worker}=await fixture(t),session=await login(),other=await login('192.0.2.2'),newPassword='changed-test-password-741!';
 assert.equal((await call('/api/password',{method:'POST',session,data:{currentPassword:password,newPassword}})).status,200);
 for(const value of [session,other])assert.equal((await call('/api/published',{session:value})).status,401);
 assert.equal((await call('/api/login',{method:'POST',data:{password}})).status,401);
 assert.equal((await call('/api/login',{method:'POST',data:{password:newPassword}})).status,200);
 const restarted=createWorker();const result=await restarted.fetch(new Request('https://login.example.workers.dev/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.4'},body:JSON.stringify({password:newPassword})}),env);assert.equal(result.status,200);
});
test('Worker throttles failed logins persistently and refuses expired sessions',async t=>{
 const {call,login,env}=await fixture(t),session=await login();await env.DB.prepare('UPDATE sessions SET expires=0').run();assert.equal((await call('/api/published',{session})).status,401);
 for(let i=0;i<8;i++)assert.equal((await call('/api/login',{method:'POST',data:{password:'wrong'},ip:'192.0.2.8'})).status,401);
 assert.equal((await call('/api/login',{method:'POST',data:{password},ip:'192.0.2.8'})).status,429);
});

test('Worker publishes a selected section without publishing or validating unfinished games in the other section',async t=>{
 const {call,login}=await fixture(t),session=await login(),draft=structuredClone(document);
 draft.appearance.site.name='Scoped main';draft.sections.drugie.config.cols=[{...structuredClone(draft.config.cols[0]),enabled:true}];draft.sections.drugie.config.cards=[];
 const response=await call('/api/publish',{method:'POST',session,data:{document:draft,revision:0,files:[],workspace:'main'}});
 assert.equal(response.status,200);const result=await response.json();assert.equal(result.published.appearance.site.name,'Scoped main');assert.deepEqual(result.published.sections,document.sections);
 const invalid=await call('/api/publish',{method:'POST',session,data:{document:draft,revision:0,files:[],workspace:'drugie'}});assert.equal(invalid.status,422);
 assert.equal((await call('/api/publish',{method:'POST',session,data:{document:draft,revision:0,files:[],workspace:'invalid'}})).status,422);
});
