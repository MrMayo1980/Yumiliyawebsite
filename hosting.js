export const isPages=()=>!!globalThis.window?.YUMILIYA_PAGES;
export const pagesSettings=()=>globalThis.window?.YUMILIYA_PAGES;
const pending=new Map();
export function pendingAssetUrls(){return Object.fromEntries(pending);}
export function registerPendingAsset(path,url){pending.set(path,url);}
export function resolvePendingAsset(path){return pending.get(path)||path;}
export function materializeAssets(value){
 if(typeof value==='string')return resolvePendingAsset(value);
 if(Array.isArray(value))return value.map(materializeAssets);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,materializeAssets(v)]));
 return value;
}
export function localMediaUrl(value,{imagesOnly=false}={}){
 const mapped=pending.get(value);if(mapped)return mapped;
 try{
  const u=new URL(value,location.href);if(u.username||u.password)return '';
  const base=new URL('.',location.href),relative=u.pathname.startsWith(base.pathname)?u.pathname.slice(base.pathname.length):'';
  const allowed=imagesOnly?/^(assets\/(?:gacha|media)|uploads)\/[a-zA-Z0-9_-]+\.(webp|png|jpe?g|gif|avif)$/i:/^(assets\/(?:gacha|media)|uploads)\/[a-zA-Z0-9_-]+\.(webp|png|jpe?g|gif|avif|mp4|webm|mov|ogg)$/i;
  if(u.origin===base.origin)return allowed.test(relative)?u.href:'';
  return u.protocol==='https:'?u.href:'';
 }catch{return '';}
}
let publishedPromise,previewPromise;
export function loadPublished({fresh=false}={}){
 if(fresh)publishedPromise=undefined;
 return publishedPromise??=fetch('data/site-state.json'+(fresh?'?t='+Date.now():''),{cache:'no-store'}).then(async response=>{if(!response.ok)throw new Error('Опубликованные настройки недоступны.');return response.json();}).catch(error=>{publishedPromise=undefined;throw error;});
}
export function loadPreview(){
 if(window.parent===window)return Promise.reject(new Error('Откройте предпросмотр из админ-панели.'));
 return previewPromise??=new Promise((resolve,reject)=>{
  const id=crypto.randomUUID();
  const listener=event=>{if(event.origin!==location.origin||event.source!==window.parent||event.data?.type!=='yumiliya-preview-response'||event.data.id!==id)return;cleanup();for(const [path,url] of Object.entries(event.data.assets||{}))if(typeof url==='string'&&url.startsWith('blob:'+location.origin+'/'))pending.set(path,url);resolve(event.data.document);};
  const timeout=setTimeout(()=>{cleanup();reject(new Error('Предпросмотр недоступен. Откройте его снова из студии.'));},10000);
  const cleanup=()=>{clearTimeout(timeout);window.removeEventListener('message',listener);};
  window.addEventListener('message',listener);window.parent.postMessage({type:'yumiliya-preview-request',id},location.origin);
 });
}
export function providePreview(getDocument,acceptSource){
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.data?.type!=='yumiliya-preview-request'||typeof event.data.id!=='string'||!acceptSource(event.source))return;
  const document=getDocument();if(document)event.source.postMessage({type:'yumiliya-preview-response',id:event.data.id,document,assets:pendingAssetUrls()},location.origin);
 });
}
