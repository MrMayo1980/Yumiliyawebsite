import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mergeGallery,mediaType,safeMediaUrl} from '../gallery.js';
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
