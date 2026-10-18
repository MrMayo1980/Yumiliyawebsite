import {FRAME_PRESETS,normalizeFrameSettings,cardFrame,photoStyle} from '../frames.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEFAULT_APPEARANCE,applySiteAppearance,applyLoginAppearance,displayImageUrl} from '../appearance.js';
import {validateDocument} from '../server/schema.mjs';
const config=JSON.parse(await readFile(new URL('../data/gacha.json',import.meta.url),'utf8'));
test('old documents receive display defaults; valid website and login customization round-trips',()=>{
 const original={config:structuredClone(config),gallery:{items:[],deleted:[]}};
 const doc=validateDocument(original,true);assert.deepEqual(doc.appearance,DEFAULT_APPEARANCE);assert.equal(original.appearance,undefined);
 doc.appearance.site.layout='grid';doc.appearance.site.columns=6;doc.appearance.site.mobileColumns=2;doc.appearance.site.name='Мой архив';doc.appearance.login.heading='Вход для редактора';doc.appearance.login.layout='centered';
 assert.deepEqual(validateDocument(doc,true).appearance,doc.appearance);
});
test('appearance rejects unsafe images, unsupported layouts, invalid dimensions and invalid login labels',()=>{
 for(const change of [d=>d.site.background='javascript:alert(1)',d=>d.login.logo='uploads/a.mp4',d=>d.site.columns=40,d=>d.site.bodyFont='url(https://evil.example)',d=>d.login.bg='red;display:none',d=>d.login.layout='unknown',d=>d.login.submitLabel='',d=>d.site.adminLabel='',d=>d.login.password='must-not-be-public']){
  const doc={config:structuredClone(config),gallery:{items:[],deleted:[]},appearance:structuredClone(DEFAULT_APPEARANCE)};change(doc.appearance);assert.throws(()=>validateDocument(doc,true));
 }
});
function element(){return {textContent:'',hidden:false,dataset:{},attributes:{},properties:new Map(),style:{setProperty(key,value){this[key]=value;}},set src(value){this.attributes.src=value;},get src(){return this.attributes.src;},removeAttribute(key){delete this.attributes[key];}};}
test('website branding applies literal text, responsive layout, colors and visibility switches',()=>{
 const nodes=new Map(),pick=selector=>{if(!nodes.has(selector))nodes.set(selector,element());return nodes.get(selector);};
 globalThis.location=new URL('http://127.0.0.1:8000/index.html');
 globalThis.document={title:'',body:element(),documentElement:element(),querySelector:pick,querySelectorAll:()=>[pick('.tline'),pick('.divider')]};
 const site=structuredClone(DEFAULT_APPEARANCE.site);site.name='<img src=x onerror=alert(1)>';site.layout='grid';site.columns=6;site.mobileColumns=2;site.showFooter=false;site.accent='#123456';site.titleFont='system-ui';site.background='uploads/bg.webp';
 applySiteAppearance(site);assert.equal(pick('h1').textContent,site.name);assert.equal(document.body.dataset.galleryLayout,'grid');assert.equal(document.documentElement.style['--site-columns'],'6');assert.equal(document.documentElement.style['--site-mobile-columns'],'2');assert.equal(document.documentElement.style['--site-accent'],'#123456');assert.equal(pick('footer').hidden,true);assert.equal(document.documentElement.style['--site-title-font'],'system-ui');assert.match(document.documentElement.style['--site-background'],/uploads\/bg.webp/);
});
test('login display changes labels and images without changing the password input or authentication',()=>{
 const nodes=new Map(),pick=selector=>{if(!nodes.has(selector))nodes.set(selector,element());return nodes.get(selector);};const screen=element();screen.querySelector=pick;
 globalThis.location=new URL('http://127.0.0.1:8000/admin.html');globalThis.document={title:'',getElementById:()=>screen};
 const login=structuredClone(DEFAULT_APPEARANCE.login);login.heading='Вход редактора';login.layout='centered';login.artwork='uploads/art.png';login.logo='uploads/logo.webp';login.passwordLabel='Ключ доступа';
 applyLoginAppearance(login);assert.equal(pick('[data-login="heading"]').textContent,login.heading);assert.equal(screen.dataset.layout,'centered');assert.equal(pick('[data-login="passwordLabel"]').textContent,'Ключ доступа');assert.equal(pick('[data-login="symbol"]').hidden,true);assert.equal(pick('[data-login="logo"]').hidden,false);assert.ok(!nodes.has('#password'));
 assert.equal(displayImageUrl('javascript:alert(1)'), '');assert.equal(displayImageUrl('/api/admin/state'),'');assert.equal(displayImageUrl('uploads/video.mp4'),'');
});

test('frame settings preserve old cards, validate image URLs and round-trip shared and individual frames',()=>{
 const old={config:structuredClone(config),gallery:{items:[],deleted:[]}},normalized=validateDocument(old,true);
 assert.deepEqual(normalized.config.theme.frames,Object.fromEntries(Object.entries(FRAME_PRESETS).map(([r,p])=>[r,p.src])));assert.equal(normalized.config.theme.frameInset,4);assert.equal(normalized.config.cards[0].frame,'');assert.equal(normalized.config.cards[0].frameEnabled,true);assert.equal(old.config.theme.frames,undefined);
 normalized.config.theme.frames.N='assets/media/frame.png';normalized.config.theme.frameInset=7.5;normalized.config.cards[0].frame='https://example.com/card-frame.webp';normalized.config.cards[0].frameEnabled=false;
 assert.deepEqual(validateDocument(normalized,true),normalized);
 for(const change of [d=>d.config.theme.frames.N='javascript:alert(1)',d=>d.config.theme.frames.R='uploads/movie.mp4',d=>d.config.theme.frameInset=99,d=>d.config.theme.frames.extra='bad',d=>d.config.cards[0].frame='data:text/html,bad',d=>d.config.cards[0].frame='uploads/movie.webm',d=>d.config.cards[0].frameEnabled='yes']){const bad=structuredClone(normalized);change(bad);assert.throws(()=>validateDocument(bad,true));}
});

test('frame migration preloads once, preserves custom choices and allows clearing afterwards',()=>{
 const c=structuredClone(config);c.theme.frames={N:'',R:'assets/media/my-frame.png',SR:''};
 normalizeFrameSettings(c);assert.equal(c.theme.frames.N,FRAME_PRESETS.N.src);assert.equal(c.theme.frames.R,'assets/media/my-frame.png');
 c.theme.frames.N='';normalizeFrameSettings(c);assert.equal(c.theme.frames.N,'');
 assert.equal(cardFrame(c.cards[0],c.theme),'');assert.equal(cardFrame({...c.cards[0],img:'assets/media/new.png',r:'SR'},c.theme),FRAME_PRESETS.SR.src);
 c.theme.frameLibraryVersion=2;assert.throws(()=>validateDocument({config:c,gallery:{items:[],deleted:[]}},true));
});

test('photo adjustments default to centered artwork, round-trip and reject unsafe or out-of-range values',()=>{
 const input={config:structuredClone(config),gallery:{items:[],deleted:[]}},doc=validateDocument(input,true);
 assert.deepEqual(doc.config.cards[0].photo,{zoom:1,x:0,y:0});assert.equal(input.config.cards[0].photo,undefined);
 doc.config.cards[0].photo={zoom:1.75,x:-30,y:45};assert.deepEqual(validateDocument(doc,true).config.cards[0].photo,doc.config.cards[0].photo);
 for(const photo of [null,{},[],{zoom:0,x:0,y:0},{zoom:5,x:0,y:0},{zoom:1,x:-101,y:0},{zoom:1,x:0,y:101},{zoom:NaN,x:0,y:0},{zoom:1,x:'0;display:none',y:0}]){
  const bad=structuredClone(doc);bad.config.cards[0].photo=photo;assert.throws(()=>validateDocument(bad,true));
 }
 assert.equal(photoStyle({photo:{zoom:'bad',x:Infinity,y:'0;display:none'}}),'--photo-zoom:1;--photo-x:0%;--photo-y:0%;');
});
