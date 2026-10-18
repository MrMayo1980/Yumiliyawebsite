import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mergeGallery,mediaType,safeMediaUrl,createVideoLoader} from '../gallery.js';
test('archive overlays rename, reorder and hide legacy content without duplicates',()=>{
 const legacy=[{url:'https://example.com/one.jpg',name:'One',type:'image'},{url:'https://example.com/two.gif',name:'Two',type:'gif'}];
 const merged=mergeGallery(legacy,{items:[{...legacy[1],name:'Renamed'},{url:'uploads/abc.webp',name:'New',type:'image'}],deleted:[legacy[0].url]});
 assert.deepEqual(merged.map(x=>x.name),['Renamed','New']);assert.equal(mediaType(merged[0]),'gif');assert.equal(mediaType({url:'https://example.com/a.mp4'}),'video');
});
test('media URL handling excludes scripts, credentials and private local endpoints',()=>{
 globalThis.location=new URL('http://127.0.0.1:8000/admin.html');
 for(const url of ['javascript:alert(1)','data:text/html,test','https://user:password@example.com/a.jpg','/api/admin/state','/.data/credentials.json'])assert.equal(safeMediaUrl(url),'');
 assert.equal(safeMediaUrl('uploads/abc.png'),'http://127.0.0.1:8000/uploads/abc.png');assert.equal(safeMediaUrl('https://example.com/photo.jpg'),'https://example.com/photo.jpg');
});
test('migrated archive is a usable snapshot with unique safe HTTPS URLs',async()=>{
 const legacy=JSON.parse(await readFile(new URL('../data/legacy-gallery.json',import.meta.url),'utf8'));assert.ok(legacy.length>0);assert.equal(new Set(legacy.map(x=>x.url)).size,legacy.length);assert.ok(legacy.every(x=>new URL(x.url).protocol==='https:'));
});

test('archive videos defer sources, autoplay only in view and stop when hidden or removed',()=>{
 const observers=[];
 class Observer{constructor(callback,options){this.callback=callback;this.options=options;this.targets=new Set();observers.push(this);}observe(target){this.targets.add(target);}unobserve(target){this.targets.delete(target);}disconnect(){this.targets.clear();}emit(target,isIntersecting){this.callback([{target,isIntersecting}]);}}
 const video=()=>({paused:true,loads:0,plays:0,pauses:0,attrs:{},get src(){return this.attrs.src;},set src(v){this.attrs.src=v;},getAttribute(k){return this.attrs[k]??null;},hasAttribute(k){return k in this.attrs;},removeAttribute(k){delete this.attrs[k];},load(){this.loads++;},play(){this.paused=false;this.plays++;return Promise.resolve();},pause(){this.paused=true;this.pauses++;}});
 let active=true,autoplay=true;const loader=createVideoLoader({isActive:()=>active,autoplay:()=>autoplay,Observer}),near=video(),far=video();
 loader.observe(near,'https://example.com/near.mp4');loader.observe(far,'https://example.com/far.mp4');assert.equal(near.src,undefined);assert.equal(far.src,undefined);assert.equal(near.preload,'none');
 observers[0].emit(near,true);assert.equal(near.loads,1);assert.equal(near.paused,true);assert.equal(far.loads,0);
 observers[1].emit(near,true);assert.equal(near.plays,1);assert.equal(near.loads,1);loader.update();assert.equal(near.plays,1);
 observers[1].emit(near,false);assert.equal(near.paused,true);
 observers[1].emit(near,true);active=false;loader.update();assert.equal(near.paused,true);
 observers[0].emit(far,true);assert.equal(far.src,undefined);
 active=true;loader.update();assert.equal(near.paused,false);autoplay=false;loader.update();assert.equal(near.paused,true);
 loader.reset();assert.equal(near.src,undefined);assert.equal(near.loads,2);assert.equal(far.loads,0);assert.ok(observers.every(o=>o.targets.size===0));
});
