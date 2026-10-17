import {localMediaUrl} from './hosting.js';
export async function loadLegacyGallery(){
 const response=await fetch('data/legacy-gallery.json',{cache:'no-cache'});
 if(!response.ok)throw new Error('Не удалось загрузить сохранённый архив.');
 const items=await response.json();if(!Array.isArray(items))throw new Error('Некорректный снимок архива.');return items;
}
export function mergeGallery(legacy,overlay){
 const hidden=new Set(overlay.deleted||[]),seen=new Set();return [...(overlay.items||[]),...legacy].filter(item=>{if(hidden.has(item.url)||seen.has(item.url))return false;seen.add(item.url);return true;});
}
export function mediaType(item){if(['image','gif','video'].includes(item.type))return item.type;return /\.(mp4|mov|webm|ogg)(\?|$)/i.test(item.url)?'video':/\.gif(\?|$)/i.test(item.url)?'gif':'image';}
export function safeMediaUrl(url){return localMediaUrl(url);}
