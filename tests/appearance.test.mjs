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
