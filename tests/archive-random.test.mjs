import test from 'node:test';
import assert from 'node:assert/strict';
import {randomPool,chooseRandom,createArchiveRoulette} from '../archive-random.js';
import {DEFAULT_APPEARANCE} from '../appearance.js';
globalThis.location=new URL('https://mrmayo1980.github.io/Yumiliyawebsite/');
const photo={url:'https://example.com/photo.jpg',type:'image',name:'Photo'},video={url:'https://example.com/movie.mp4',type:'video',name:'Video'},gif={url:'https://example.com/animation.gif',type:'gif'};
test('random selection covers every eligible published item and respects optional filters',()=>{
 const items=[photo,video,gif,{url:'javascript:alert(1)',type:'image'}];
 assert.deepEqual(randomPool(items,'video',false),[photo,video,gif]);assert.deepEqual(randomPool(items,'video',true),[video]);assert.deepEqual(randomPool(items,'image',true),[photo]);assert.deepEqual(randomPool(items,'all',true),[photo,video,gif]);
 assert.equal(chooseRandom([photo,video,gif],()=>0),photo);assert.equal(chooseRandom([photo,video,gif],()=>.5),video);assert.equal(chooseRandom([photo,video,gif],()=>.999),gif);assert.equal(chooseRandom([]),null);
});
function fixture(pool,{animated=false}={}){
 const nodes=new Map(),created=[],opened=[],options=structuredClone(DEFAULT_APPEARANCE.site);let resolve,reject,cancelled=false;
 const element=()=>({children:[],events:{},open:false,clientWidth:600,addEventListener(type,fn){this.events[type]=fn;},appendChild(child){this.children.push(child);},replaceChildren(...children){this.children=children;},getBoundingClientRect:()=>({width:180}),showModal(){this.open=true;},close(){this.open=false;}});
 const document={getElementById(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);},createElement(tag){const node=element();node.tag=tag;created.push(node);return node;}};
 globalThis.document=document;globalThis.location=new URL('https://mrmayo1980.github.io/Yumiliyawebsite/');
 if(animated)document.getElementById('roulette-track').animate=()=>({finished:new Promise((ok,no)=>{resolve=ok;reject=no;}),cancel(){cancelled=true;reject?.(new Error('cancelled'));}});
 const roulette=createArchiveRoulette({items:()=>pool,settings:()=>options,openMedia:(...args)=>opened.push(args)});
 return {roulette,nodes,created,opened,options,complete:()=>resolve?.(),cancelled:()=>cancelled};
}
test('empty archive disables the button; a selected video opens without loading roulette video sources',()=>{
 const empty=fixture([]);empty.roulette.update();assert.equal(empty.nodes.get('archive-random').disabled,true);empty.roulette.spin();assert.equal(empty.opened.length,0);
 const app=fixture([video]);app.roulette.spin();assert.deepEqual(app.opened,[[video.url,'video']]);assert.ok(!app.created.some(node=>node.tag==='video'));assert.equal(app.nodes.get('archive-roulette').open,false);
 app.options.randomEnabled=false;app.roulette.update();assert.equal(app.nodes.get('archive-random').hidden,true);app.roulette.spin();assert.equal(app.opened.length,1);
});
test('closing an animated roulette cancels selection; repeated clicks do not start duplicate spins',async()=>{
 const app=fixture([photo],{animated:true});app.roulette.spin();const count=app.created.length;app.roulette.spin();assert.equal(app.created.length,count);assert.equal(app.nodes.get('archive-roulette').open,true);assert.equal(app.nodes.get('archive-random').disabled,true);
 app.roulette.cancel();await new Promise(setImmediate);assert.equal(app.cancelled(),true);assert.equal(app.opened.length,0);assert.equal(app.nodes.get('roulette-track').children.length,0);
 app.roulette.spin();app.complete();await new Promise(resolve=>setTimeout(resolve,500));assert.deepEqual(app.opened,[[photo.url,'image']]);
});
