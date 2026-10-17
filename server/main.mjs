import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createApp} from './app.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
if(process.env.NODE_ENV==='production'&&!process.env.PUBLIC_ORIGIN?.startsWith('https://'))throw new Error('В рабочем режиме задайте PUBLIC_ORIGIN=https://ваш-домен.');
const app=await createApp({root,dataDir:resolve(process.env.DATA_DIR||resolve(root,'.data'))});
const server=createServer(app);server.requestTimeout=60000;server.headersTimeout=15000;
const port=Number(process.env.PORT||8000),host=process.env.HOST||'127.0.0.1';server.listen(port,host,()=>console.log(`Юмилия: http://${host}:${port}\nАдмин: http://${host}:${port}/admin.html`));
