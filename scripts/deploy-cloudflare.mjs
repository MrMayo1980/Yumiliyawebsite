import {spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {hashPassword} from '../cloudflare/password.mjs';
import {buildPages} from './build-pages.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const wrangler=join(root,'node_modules/.bin/wrangler');
function run(command,args,{input,quiet=false}={}){
 const result=spawnSync(command,args,{cwd:root,input,encoding:'utf8',env:{...process.env,WRANGLER_SEND_METRICS:'false'},maxBuffer:4*1024*1024});
 if(result.status!==0)throw new Error((result.stderr||result.stdout||'Command failed').trim());
 if(!quiet&&result.stdout)process.stdout.write(result.stdout);return result.stdout;
}
// Sign-in is deliberately separate: account creation and OAuth consent belong
// to the owner, never to visitors or other password-holding editors.
const identity=JSON.parse(run(wrangler,['whoami','--json'],{quiet:true}));
if(!identity.loggedIn||identity.accounts?.length!==1)throw new Error('Sign in to one Cloudflare account before deploying.');
const configPath=join(root,'wrangler.jsonc'),config=JSON.parse(await readFile(configPath,'utf8'));
config.account_id=identity.accounts[0].id;await writeFile(configPath,JSON.stringify(config,null,2)+'\n');
if(config.d1_databases[0].database_id==='00000000-0000-0000-0000-000000000000'){
 const output=run(wrangler,['d1','create','yumiliya-admin-auth'],{quiet:true});
 const id=output.match(/"database_id"\s*:\s*"([a-f0-9-]{36})"/)?.[1]||output.match(/database_id\s*=\s*"([a-f0-9-]{36})"/)?.[1];
 if(!id)throw new Error('Could not identify the new authentication database.');
 config.d1_databases[0].database_id=id;await writeFile(configPath,JSON.stringify(config,null,2)+'\n');
}
run(wrangler,['d1','migrations','apply','yumiliya-admin-auth','--remote'],{input:'y\n'});
await mkdir(join(root,'.data'),{recursive:true,mode:0o700});
const passwordPath=join(root,'.data/cloudflare-initial-password.txt');let password;
try{password=(await readFile(passwordPath,'utf8')).trim();}catch(error){if(error.code!=='ENOENT')throw error;password=randomBytes(24).toString('base64url');await writeFile(passwordPath,password+'\n',{mode:0o600,flag:'wx'});}
// The owner's existing GitHub authorization is installed directly as an
// encrypted Worker secret. It is never written into Pages, source, or logs.
const publisherKey=run('gh',['auth','token','--hostname','github.com'],{quiet:true}).trim();
const secrets=JSON.stringify({INITIAL_CREDENTIALS:JSON.stringify(await hashPassword(password)),GITHUB_TOKEN:publisherKey});
run(wrangler,['secret','bulk'],{input:secrets});
const output=run(wrangler,['deploy']);
const apiBase=output.match(/https:\/\/[a-zA-Z0-9.-]+\.workers\.dev/)?.[0];
if(!apiBase)throw new Error('Deployment finished but its public address could not be identified.');
let ready=false;
for(let attempt=0;attempt<10;attempt++){
 try{
  const health=await fetch(apiBase+'/health',{signal:AbortSignal.timeout(10000)});if(!health.ok)throw new Error('Health check failed.');
  const anonymous=await fetch(apiBase+'/api/published',{headers:{Origin:config.vars.ALLOWED_ORIGIN},signal:AbortSignal.timeout(10000)});
  if(anonymous.status!==401)throw new Error('Anonymous requests were not rejected.');ready=true;break;
 }catch{if(attempt<9)await new Promise(resolve=>setTimeout(resolve,3000));}
}
if(!ready)throw new Error('Cloudflare deployed the service, but its public HTTPS address is not ready yet. Wait a little and rerun deployment.');
await writeFile(join(root,'data/hosting.json'),JSON.stringify({apiBase},null,2)+'\n');
await buildPages({source:root,apiBase});
console.log('Password service is deployed. Pages has been built with its public address.');
console.log('Initial admin password is stored privately in '+passwordPath+'.');
console.log('Commit and push the reviewed source and docs to finish the Pages update.');
