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
 const context=vm.createContext({document,window:{addEventListener(){}},location:new URL('http://localhost/admin.html'),URLSearchParams,structuredClone,DEFAULT_APPEARANCE,FRAME_PRESETS,framePreset,normalizeFrameSettings,cardFrame,photoStyle,isPages:()=>false,safeMediaUrl:url=>url});
 vm.runInContext(source.replace(/^import[^\n]*\n/gm,'').replace('initializeStudio();','globalThis.studio={setup:(doc,card)=>{draft=doc;modalDraft=card;},refresh:refreshFramePreviews,signature:cardPreviewSignature};'),context);
 const card={img:'assets/media/photo.jpg',name:'Test',r:'N',frame:'',frameEnabled:true,photo:{zoom:1,x:0,y:0}},doc={config:{cards:[card],theme:{frames:{N:FRAME_PRESETS.N.src},frameInset:4}}};
 context.studio.setup(doc,card);preview.dataset.signature=context.studio.signature(card);
 for(let x=0;x<30;x++){card.photo={zoom:2,x,y:-10};context.studio.refresh();}
 assert.equal(preview.writes,0);assert.match(face.style.cssText,/--photo-zoom:2;--photo-x:29%;--photo-y:-10%/);
 card.img='assets/media/another.jpg';context.studio.refresh();assert.equal(preview.writes,1);assert.match(preview.html,/another.jpg/);
});
