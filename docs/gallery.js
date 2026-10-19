import {localMediaUrl} from './hosting.js';
export async function loadLegacyGallery(){
 const response=await fetch('data/legacy-gallery.json',{cache:'no-cache'});
 if(!response.ok)throw new Error('Не удалось загрузить сохранённый архив.');
 const items=await response.json();if(!Array.isArray(items))throw new Error('Некорректный снимок архива.');return items;
}
export function mergeGallery(legacy,overlay){
 const hidden=new Set(overlay.deleted||[]),seen=new Set();return [...(overlay.items||[]),...(overlay.includeLegacy===false?[]:legacy)].filter(item=>{if(hidden.has(item.url)||seen.has(item.url))return false;seen.add(item.url);return true;});
}
export function mediaType(item){if(['image','gif','video'].includes(item.type))return item.type;return /\.(mp4|mov|webm|ogg)(\?|$)/i.test(item.url)?'video':/\.gif(\?|$)/i.test(item.url)?'gif':'image';}
export function safeMediaUrl(url){return localMediaUrl(url);}

// Only nearby archive videos get a source; only visible videos may autoplay.
export function createVideoLoader({isActive,autoplay,Observer=globalThis.IntersectionObserver}){
 const sources=new Map(),visible=new Set();
 const load=video=>{const src=sources.get(video);if(src&&video.getAttribute('src')!==src){video.preload='metadata';video.src=src;video.load();}};
 const updateVideo=video=>{
  const playing=isActive()&&visible.has(video)&&autoplay();
  if(playing){load(video);if(video.paused)video.play().catch(()=>{});}
  else if(!video.paused)video.pause();
 };
 const nearby=Observer?new Observer(entries=>{for(const e of entries)if(e.isIntersecting&&isActive()){load(e.target);nearby.unobserve(e.target);}},{rootMargin:'300px'}):null;
 const playback=Observer?new Observer(entries=>{for(const e of entries){if(e.isIntersecting)visible.add(e.target);else visible.delete(e.target);updateVideo(e.target);}},{threshold:0.01}):null;
 return {
  observe(video,src){sources.set(video,src);video.preload='none';if(nearby){nearby.observe(video);playback.observe(video);}else{video.src=src;}},
  update(){for(const video of sources.keys())updateVideo(video);},
  reset(){nearby?.disconnect();playback?.disconnect();for(const video of sources.keys()){video.pause();if(video.hasAttribute('src')){video.removeAttribute('src');video.load();}}sources.clear();visible.clear();}
 };
}
