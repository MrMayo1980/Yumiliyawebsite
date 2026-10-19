import {workspaceFromSearch,playerStorage,balanceNotice} from '../sections.js';
import {createScopedAdminApi} from '../scoped-admin.js';
import {nextCardId,normalizeCardIds} from '../card-ids.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {DEFAULT_APPEARANCE} from '../appearance.js';
import {FRAME_PRESETS,framePreset,normalizeFrameSettings,cardFrame,photoStyle} from '../frames.js';
const source=await readFile(new URL('../admin.js',import.meta.url),'utf8');
test('photo adjustments update styles without replacing preview images; a new source still refreshes the preview',()=>{
 const nodes=new Map(),face={style:{}},preview={dataset:{},writes:0,querySelector:()=>face,set innerHTML(value){this.writes++;this.html=value;}};nodes.set('card-frame-preview',preview);
 const document={getElementById(id){if(!nodes.has(id))nodes.set(id,{addEventListener(){}});return nodes.get(id);},querySelectorAll:()=>[],addEventListener(){}};
 const context=vm.createContext({workspaceFromSearch,playerStorage,balanceNotice,createScopedAdminApi,document,window:{addEventListener(){}},location:new URL('http://localhost/admin.html'),URLSearchParams,structuredClone,DEFAULT_APPEARANCE,FRAME_PRESETS,framePreset,normalizeFrameSettings,cardFrame,photoStyle,nextCardId,normalizeCardIds,isPages:()=>false,safeMediaUrl:url=>url});
 vm.runInContext(source.replace(/^import[^\n]*\n/gm,'').replace('initializeStudio();','globalThis.studio={setup:(doc,card)=>{draft=doc;modalDraft=card;},refresh:refreshFramePreviews,signature:cardPreviewSignature};'),context);
 const card={img:'assets/media/photo.jpg',name:'Test',r:'N',frame:'',frameEnabled:true,photo:{zoom:1,x:0,y:0}},doc={config:{cards:[card],theme:{frames:{N:FRAME_PRESETS.N.src},frameInset:4}}};
 context.studio.setup(doc,card);preview.dataset.signature=context.studio.signature(card);
 for(let x=0;x<30;x++){card.photo={zoom:2,x,y:-10};context.studio.refresh();}
 assert.equal(preview.writes,0);assert.match(face.style.cssText,/--photo-zoom:2;--photo-x:29%;--photo-y:-10%/);
 card.img='assets/media/another.jpg';context.studio.refresh();assert.equal(preview.writes,1);assert.match(preview.html,/another.jpg/);
});

test('local balance control preserves saved progress, rejects invalid amounts and does not dirty the draft',()=>{
 const store=new Map([['gacha3',JSON.stringify({gems:42,inv:{7:2},free:3,shards:9})]]),nodes=new Map();
 const document={getElementById(id){if(!nodes.has(id))nodes.set(id,{value:'12345',addEventListener(){}});return nodes.get(id);},querySelectorAll:()=>[],addEventListener(){}};
 const context=vm.createContext({workspaceFromSearch,playerStorage,balanceNotice,createScopedAdminApi,document,window:{addEventListener(){}},location:new URL('http://localhost/admin.html'),URLSearchParams,structuredClone,DEFAULT_APPEARANCE,isPages:()=>false,localStorage:{getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value)},setTimeout:()=>1,clearTimeout(){}});
 vm.runInContext(source.replace(/^import[^\n]*\n/gm,'').replace('initializeStudio();',"globalThis.balance={save:actions['save-local-balance'],dirty:()=>dirty,feedback:notify};"),context);
 context.balance.save();const state=JSON.parse(store.get('gacha3'));assert.equal(state.gems,12345);assert.deepEqual(state.inv,{7:2});assert.equal(state.free,3);assert.equal(state.shards,9);assert.equal(context.balance.dirty(),false);assert.equal(JSON.parse(store.get('yumiliya-local-balance')).gems,12345);
 for(const value of ['', '-1', '2.5', 'abc']){nodes.get('local-balance').value=value;assert.throws(()=>context.balance.save());assert.equal(JSON.parse(store.get('gacha3')).gems,12345);}
 nodes.get('modal').open=true;context.balance.feedback('Publication failed',true);assert.equal(nodes.get('modal-error').hidden,false);assert.equal(nodes.get('modal-error').textContent,'Publication failed');
});

function uploadFixture(){
 const nodes=new Map(),messages=[],seen=[];
 const document={getElementById(id){if(!nodes.has(id))nodes.set(id,{hidden:false,addEventListener(){}});return nodes.get(id);},querySelectorAll:()=>[],addEventListener(){}};
 const context=vm.createContext({workspaceFromSearch,playerStorage,balanceNotice,createScopedAdminApi,document,window:{addEventListener(){}},location:new URL('http://localhost/admin.html?section=drugie'),URLSearchParams,structuredClone,DEFAULT_APPEARANCE,isPages:()=>false,seen,messages});
 const hooks=`globalThis.uploads={run:uploadGallery,task:runUploadTask,state:()=>({draft,pendingUploads,busy,dirty,galleryUploadNotice}),block:promise=>{busy=true;syncTask=promise;},release:()=>{busy=false;syncTask=null;},setUpload:fn=>{upload=fn;}};draft={gallery:{items:[]}};status=()=>{};render=()=>{};notify=(...args)=>messages.push(args);commit=fn=>{fn();dirty=true;};upload=async file=>{seen.push(file.name);return {url:'assets/media/'+file.name,type:'image'};};`;
 vm.runInContext(source.replace(/^import[^\n]*\n/gm,'').replace('initializeStudio();',hooks),context);
 return {uploads:context.uploads,seen,messages};
}
test('file selection waits for focus-triggered synchronization and survives replacement of the file input',async()=>{
 const {uploads,seen}=uploadFixture();let resolve;const sync=new Promise(done=>resolve=done);uploads.block(sync);
 const selection=[{name:'purple.png',size:100}],operation=uploads.run(selection);selection.length=0;
 await new Promise(setImmediate);assert.deepEqual(seen,[]);assert.equal(uploads.state().pendingUploads,1);
 uploads.release();resolve();await operation;
 assert.deepEqual(seen,['purple.png']);assert.equal(uploads.state().draft.gallery.items.length,1);assert.equal(uploads.state().dirty,true);assert.equal(uploads.state().pendingUploads,0);assert.equal(uploads.state().busy,false);assert.match(uploads.state().galleryUploadNotice.text,/Добавлено в черновик: 1/);
});
test('simultaneous uploads are queued, errors stay visible and a later upload still succeeds',async()=>{
 const {uploads}=uploadFixture();let resolve;const gate=new Promise(done=>resolve=done),calls=[];
 uploads.setUpload(async file=>{calls.push(file.name);if(file.name==='one.png')await gate;if(file.name==='bad.png')throw new Error('Broken image');return {url:'assets/media/'+file.name,type:'image'};});
 const first=uploads.run([{name:'one.png'}]),second=uploads.run([{name:'two.png'}]);await new Promise(setImmediate);assert.deepEqual(calls,['one.png']);resolve();await Promise.all([first,second]);assert.deepEqual(calls,['one.png','two.png']);assert.equal(uploads.state().draft.gallery.items.length,2);
 await uploads.run([{name:'bad.png'}]);assert.equal(uploads.state().galleryUploadNotice.error,true);assert.match(uploads.state().galleryUploadNotice.text,/Broken image/);assert.equal(uploads.state().pendingUploads,0);
 await uploads.run([{name:'three.png'}]);assert.equal(uploads.state().draft.gallery.items.length,3);assert.equal(uploads.state().galleryUploadNotice.error,false);
 await uploads.run([]);assert.equal(uploads.state().pendingUploads,0);
});
