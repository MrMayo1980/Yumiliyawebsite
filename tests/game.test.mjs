import {normalizeFrameSettings,cardFrame,framePreset,FRAME_PRESETS,photoStyle} from '../frames.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../gacha.js',import.meta.url),'utf8');
const original=JSON.parse(await readFile(new URL('../data/gacha.json',import.meta.url),'utf8'));
async function boot(config,{preview=false,saved=null}={}){
 const nodes=new Map(),store=new Map();if(saved)store.set('gacha3',JSON.stringify(saved));
 const node=()=>({children:[],style:{setProperty(){}},classList:{add(){},remove(){},toggle(){},contains(){return false;}},appendChild(n){this.children.push(n);},append(...n){this.children.push(...n);},replaceChildren(...n){this.children=n;},querySelector(){return node();},addEventListener(){},removeEventListener(){},parentNode:{style:{}},textContent:'',innerHTML:'',offsetWidth:300,clientWidth:300});
 const document={getElementById(id){if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:node,documentElement:node(),addEventListener(){},querySelector:node,body:node()};
 const context=vm.createContext({normalizeFrameSettings,cardFrame,framePreset,photoStyle,document,location:new URL('http://localhost/gacha_game.html'+(preview?'?preview=1':'')),URLSearchParams,fetch:async()=>({ok:true,json:async()=>structuredClone(config)}),localStorage:{getItem:key=>store.get(key),setItem:(key,val)=>store.set(key,val)},setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:()=>1,cancelAnimationFrame(){},addEventListener(){},innerWidth:390,innerHeight:800,console,window:{},navigator:{},DOMMatrix:class{m41=0},getComputedStyle:()=>({transform:'none'})});
 await vm.runInContext(source.replace(/^import[^\n]*\n/, '').replace('applyTheme();g48Load();daily();render();','globalThis.game={pull,doPull,doMini,state:()=>S,config:CONFIG,tab,cardFace,resultHtml,itemHtml,detail};applyTheme();g48Load();daily();render();'),context);
 assert.ok(context.game,'Game booted successfully');return {game:context.game,nodes,store};
}
test('custom starting balance, daily bonus, labels, mini-game switches and preview storage reach the game',async()=>{
 const c=structuredClone(original);c.economy.startingGems=4321;c.economy.startingFree=2;c.economy.dailyFree=7;c.labels.pull='Открыть карту';c.labels.collection='Альбом';c.game2048.enabled=false;c.mini.enabled=false;
 const {game,nodes,store}=await boot(c,{preview:true});assert.equal(game.state().gems,4321);assert.equal(game.state().free,9);assert.match(nodes.get('p1').innerHTML,/Открыть карту/);assert.equal(nodes.get('t2').textContent,'Альбом');assert.equal(nodes.get('t4').hidden,true);assert.equal(nodes.get('conv').hidden,true);assert.ok(store.has('gacha_admin_preview'));assert.ok(!store.has('gacha3'));
});
test('collection guarantees, forced banner, duplicate rewards and configured money payouts are honored',async()=>{
 const c=structuredClone(original);c.cols[0].settings.pityS=1;c.cols[0].settings.banner=7;c.cols[0].settings.bannerRate=100;c.economy.shards.SR=123;
 const {game}=await boot(c);const a=game.pull(),b=game.pull();assert.equal(a.c.id,7);assert.equal(a.isNew,true);assert.equal(b.isNew,false);assert.equal(b.sh,123);assert.equal(game.state().shards,123);
 const money=structuredClone(original);Object.assign(money.cols[0].settings,{sr:0,r:0,money:100,pityR:0,pityS:0});money.economy.moneyPrizes=[777];const {game:g}=await boot(money);const initial=g.state().gems;assert.equal(g.pull().money,777);assert.equal(g.state().gems,initial+777);
});
test('disabled collections/cards are excluded and existing player progress survives configuration changes',async()=>{
 const c=structuredClone(original);c.cols[0].enabled=false;c.economy.startingGems=9999;c.cards.find(x=>x.col===c.cols[1].id&&x.r==='SR').enabled=false;
 const saved={col:'mb',gems:42,free:3,day:'2099-1-1',p:{},inv:{7:2},shards:9,banner:7,mini:{n:0,g:0},st:{N:0,R:0,SR:0,M:0}};
 const {game}=await boot(c,{saved});assert.equal(game.state().gems,42);assert.equal(game.state().inv[7],2);assert.equal(game.state().col,'kv');
});

test('rarity frames and per-card overrides appear consistently without changing saved inventory or exposing locked artwork',async()=>{
 const config=structuredClone(original);config.theme.frames={N:'assets/media/frame-n.png',R:'assets/media/frame-r.png',SR:'assets/media/frame-sr.png'};config.theme.frameInset=6;
 const card=config.cards.find(card=>card.r==='SR');card.frame='assets/media/custom-frame.png';
 const saved={col:card.col,gems:42,free:3,day:'2099-1-1',p:{},inv:{[card.id]:2},shards:9,banner:card.id,mini:{n:0,g:0},st:{N:0,R:0,SR:0,M:0}};
 const {game,nodes}=await boot(config,{saved});
 for(const html of [nodes.get('hero').innerHTML,nodes.get('ban').innerHTML,nodes.get('grid').innerHTML,game.itemHtml({c:card}),game.resultHtml({c:card})])assert.match(html,/custom-frame.png/);
 game.detail(card.id);assert.match(nodes.get('dm').innerHTML,/custom-frame.png/);assert.equal(game.state().inv[card.id],2);assert.equal(game.state().gems,42);
 const normal=config.cards.find(card=>card.r==='N');assert.match(game.cardFace(normal),/frame-n.png/);
 assert.ok(!game.cardFace({...normal,frameEnabled:false}).includes('card-frame'));assert.ok(!game.cardFace(normal,{locked:true}).includes('card-frame'));assert.ok(!game.cardFace(normal,{locked:true}).includes(normal.img));assert.match(game.cardFace(normal,{locked:true}),new RegExp(config.back.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 assert.match(game.cardFace({...normal,name:'<img src=x>',frame:'https://example.com/f.png?q="test"'}),/&lt;img src=x&gt;/);assert.match(game.cardFace({...normal,frame:'https://example.com/f.png?q="test"'}),/&quot;test&quot;/);
});

test('preloaded original frames decorate new artwork and preserve baked-in originals',async()=>{
 const config=structuredClone(original),card=config.cards[0];card.img='assets/media/new-art.jpg';
 const {game}=await boot(config);assert.match(game.cardFace(card),/frame-preset-N/);assert.ok(game.cardFace(card).includes(FRAME_PRESETS.N.src));
 for(const r of ['N','R','SR'])assert.match(game.cardFace({...card,r}),new RegExp('frame-preset-'+r));
 const framedOriginal=config.cards[1];assert.ok(!game.cardFace(framedOriginal).includes('card-frame'));
 assert.match(game.cardFace({...framedOriginal,frame:FRAME_PRESETS.SR.src}),/frame-preset-SR/);
 assert.ok(!game.cardFace(card,{locked:true}).includes('frame-preset'));
 assert.ok(!game.cardFace({...card,frameEnabled:false}).includes('card-frame'));
});

test('photo framing reaches every unlocked card view and never changes locked card backs',async()=>{
 const c=structuredClone(original),card=c.cards.find(x=>x.r==='SR');card.photo={zoom:2.25,x:-17,y:28};
 const saved={col:card.col,gems:42,free:3,day:'2099-1-1',p:{},inv:{[card.id]:2},shards:9,banner:card.id,mini:{n:0,g:0},st:{N:0,R:0,SR:0,M:0}};
 const {game,nodes}=await boot(c,{saved});game.detail(card.id);
 for(const html of [game.cardFace(card),nodes.get('hero').innerHTML,nodes.get('ban').innerHTML,nodes.get('grid').innerHTML,game.itemHtml({c:card}),game.resultHtml({c:card}),nodes.get('dm').innerHTML]){
  assert.match(html,/--photo-zoom:2.25;--photo-x:-17%;--photo-y:28%/);assert.match(html,/class="card-photo"/);
 }
 const locked=game.cardFace(card,{locked:true});assert.ok(!locked.includes('--photo-'));assert.ok(!locked.includes(card.img));
 assert.equal(game.state().inv[card.id],2);
});
