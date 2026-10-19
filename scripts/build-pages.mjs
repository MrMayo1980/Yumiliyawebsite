import {readFile,writeFile,mkdir,cp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DEFAULT_APPEARANCE} from '../appearance.js';
import {validateDocument} from '../validation.js';
const root=fileURLToPath(new URL('../',import.meta.url));
export const PUBLIC_FILES=['index.html','index.js','sections.js','scoped-admin.js','archive-random.js','site.css','admin.html','admin.js','admin.css','appearance.js','frames.js','frames.css','hosting.js','pages-admin.js','draft-sync.js','card-ids.js','validation.js','gallery.js','gacha_game.html','gacha.js'];
export async function buildPages({source=root,destination=join(source,'docs'),useLocalPublished=false,apiBase}={}){
 source=resolve(source);destination=resolve(destination);if(destination===source||!destination.startsWith(source+'/'))throw new Error('Output must be a subdirectory of the source.');
 let state;
 if(useLocalPublished){try{const local=JSON.parse(await readFile(join(source,'.data/state.json'),'utf8'));state={revision:local.revision,updatedAt:local.updatedAt,published:local.published};}catch(error){if(error.code!=='ENOENT')throw error;}}
 if(!state){try{state=JSON.parse(await readFile(join(source,'data/site-state.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;state={revision:0,updatedAt:null,published:{config:JSON.parse(await readFile(join(source,'data/gacha.json'),'utf8')),appearance:structuredClone(DEFAULT_APPEARANCE),gallery:{items:[],deleted:[]}}};}}
 // Only referenced, published uploads are promoted into repository assets.
 const walk=async value=>{
  if(typeof value==='string'&&/^uploads\/[a-zA-Z0-9_-]+\.[a-z0-9]+$/.test(value)){const dest='assets/media/'+value.slice('uploads/'.length);await mkdir(join(source,'assets/media'),{recursive:true});await cp(join(source,value),join(source,dest));return dest;}
  if(Array.isArray(value)){const result=[];for(const item of value)result.push(await walk(item));return result;}
  if(value&&typeof value==='object'){const result={};for(const [k,v]of Object.entries(value))result[k]=await walk(v);return result;}return value;
 };
 state.published=validateDocument(await walk(state.published),true);await writeFile(join(source,'data/site-state.json'),JSON.stringify(state,null,2)+'\n');
 await rm(destination,{recursive:true,force:true});await mkdir(join(destination,'data'),{recursive:true});
 let existing={};try{existing=JSON.parse(await readFile(join(source,'data/hosting.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 apiBase??=existing.apiBase||'';
 let connect='';if(apiBase){const url=new URL(apiBase);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('The password service must use an HTTPS origin.');connect=' '+url.origin;}
 const csp=`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self'${connect}; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'`;
 for(const file of PUBLIC_FILES){let content=await readFile(join(source,file));if(file.endsWith('.html'))content=content.toString().replace('<head>',`<head><meta http-equiv="Content-Security-Policy" content="${csp}"><script src="pages-config.js"></script>`);await writeFile(join(destination,file),content);}
 await cp(join(source,'assets'),join(destination,'assets'),{recursive:true});
 for(const file of ['gacha.json','legacy-gallery.json','site-state.json'])await cp(join(source,'data',file),join(destination,'data',file));
 const settings={owner:'MrMayo1980',repo:'Yumiliyawebsite',branch:'main',prefix:'docs/',apiBase};
 await writeFile(join(destination,'pages-config.js'),'window.YUMILIYA_PAGES=Object.freeze('+JSON.stringify(settings)+');\n');await writeFile(join(destination,'.nojekyll'),'');
 return {destination,revision:state.revision};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const result=await buildPages({useLocalPublished:process.argv.includes('--use-local-published')});console.log(`GitHub Pages ready: ${result.destination} (revision ${result.revision})`);}
