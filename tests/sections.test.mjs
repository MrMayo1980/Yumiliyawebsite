import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateDocument} from '../validation.js';
import {projectDocument,replaceSection,playerStorage,balanceNotice} from '../sections.js';
import {createScopedAdminApi} from '../scoped-admin.js';
import {mergeGallery} from '../gallery.js';
import {validateDocumentTransition} from '../card-ids.js';
import {synchronizeDraft} from '../draft-sync.js';
const config=JSON.parse(await readFile(new URL('../data/gacha.json',import.meta.url),'utf8'));
const fresh=()=>validateDocument({config:structuredClone(config),gallery:{items:[],deleted:[]}},true);
test('second section duplicates content once and keeps configuration, gallery and card ID history independent',()=>{
 const document=fresh(),other=document.sections.drugie;
 assert.equal(other.appearance.site.name,'Drugie Devushki');assert.deepEqual(other.config.cards,document.config.cards);
 other.config.cards[0].name='Other card';other.config.nextCardId=500;other.gallery.items.push({url:'assets/media/other.jpg',type:'image'});
 assert.notEqual(document.config.cards[0].name,'Other card');assert.notEqual(document.config.nextCardId,500);assert.equal(document.gallery.items.length,0);
 const normalized=validateDocument(document,true);assert.equal(normalized.sections.drugie.config.cards[0].name,'Other card');
 const legacy=[{url:'assets/media/legacy.jpg',type:'image'}];assert.equal(mergeGallery(legacy,{items:[],deleted:[],includeLegacy:false}).length,0);assert.equal(mergeGallery(legacy,document.gallery).length,1);
 assert.notEqual(playerStorage('main'),playerStorage('drugie'));assert.notEqual(balanceNotice('main'),balanceNotice('drugie'));
 const malformed=structuredClone(document);malformed.sections.drugie.config.cards[0].img='javascript:alert(1)';assert.throws(()=>validateDocument(malformed,true));
 malformed.sections.drugie=document;assert.throws(()=>validateDocument(malformed,true));
});
test('saving either editor preserves the other section and a scoped history restores only the selected section',async()=>{
 let document=fresh(),workspace='drugie',published;
 const raw=async(path,options)=>{
  if(path==='api/admin/state')return {draft:structuredClone(document),basePublished:structuredClone(document),revision:1,draftVersion:0};
  if(path==='api/admin/draft'){document=validateDocument(options.data.document);return {draftVersion:1};}
  if(path==='api/admin/publish'){published=structuredClone(document);return {revision:2};}
  if(path==='api/admin/history/0')return {document:fresh()};
 };
 const api=createScopedAdminApi(raw,()=>workspace),other=(await api('api/admin/state')).draft;
 other.config.title='Independent other game';other.gallery.items.push({url:'assets/media/other.jpg',type:'image'});
 await api('api/admin/draft',{method:'PUT',data:{document:other}});assert.equal(document.config.title,config.title);
 workspace='main';const main=(await api('api/admin/state')).draft;main.config.economy.startingGems=222;
 await api('api/admin/draft',{method:'PUT',data:{document:main}});await api('api/admin/publish',{method:'POST'});
 assert.equal(published.sections.drugie.config.title,'Independent other game');assert.equal(published.sections.drugie.gallery.items.length,1);assert.equal(published.config.economy.startingGems,222);assert.notEqual(published.sections.drugie.config.economy.startingGems,222);
 workspace='drugie';assert.equal((await api('api/admin/history/0')).document.config.title,'Drugie Devushki — Гача');
 const replaced=replaceSection(document,'drugie',fresh());assert.equal(replaced.config.economy.startingGems,222);
});
test('secondary card retirement is enforced and draft sync merges secondary cards independently',()=>{
 const base=fresh();base.sections.drugie.config.nextCardId=100;
 const invalid=structuredClone(base);invalid.sections.drugie.config.cards.push({...invalid.sections.drugie.config.cards[0],id:50});assert.throws(()=>validateDocumentTransition(base,invalid));
 const local=structuredClone(base),remote=structuredClone(base);
 local.config.cards[0].name='Local main';local.sections.drugie.config.cards[0].name='Local other';
 remote.sections.drugie.config.cards.push({...remote.sections.drugie.config.cards[1],id:100,name:'Published other'});
 const result=synchronizeDraft({revision:1,draftVersion:0,draft:local,basePublished:base},{revision:2,published:remote});
 assert.equal(result.draft.config.cards[0].name,'Local main');assert.equal(result.draft.sections.drugie.config.cards[0].name,'Local other');assert.equal(result.draft.sections.drugie.config.cards.at(-1).name,'Published other');
});
