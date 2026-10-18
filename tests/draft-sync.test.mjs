import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {synchronizeDraft} from '../draft-sync.js';
import {validateDocument} from '../validation.js';
const current=JSON.parse(await readFile(new URL('../data/site-state.json',import.meta.url),'utf8')).published;
current.config.cards=current.config.cards.filter(card=>card.id<=18);current.config.cards.push({...structuredClone(current.config.cards[0]),id:19,name:'Published new card'});delete current.config.nextCardId;
const base=()=>{const doc=structuredClone(current);doc.config.cards=doc.config.cards.filter(card=>card.id<=18);return doc;};
const published=()=>({revision:5,published:structuredClone(current)});
test('legacy stale draft receives published cards and keeps unrelated unpublished edits',()=>{
 const old=base(),draft=structuredClone(old);draft.config.cards[0].name='Local edited name';draft.appearance.site.subtitle='Local subtitle';
 const saved={revision:4,draftVersion:7,draft},result=synchronizeDraft(saved,published(),old);
 assert.ok(result.draft.config.cards.some(card=>card.id===19));assert.equal(result.draft.config.cards[0].name,'Local edited name');assert.equal(result.draft.appearance.site.subtitle,'Local subtitle');assert.equal(result.draftVersion,8);assert.equal(saved.draft.config.cards.length,18);assert.equal(result.backup,true);
});
test('saved base allows safe additions, removals and field changes from both sides',()=>{
 const old=base(),draft=structuredClone(old),remote=published();draft.config.cards[0].name='Local';draft.config.cards=draft.config.cards.filter(card=>card.id!==2);draft.config.cards.push({...structuredClone(draft.config.cards[0]),id:20,name:'Unpublished'});remote.published.config.cards[0].weight=2;
 const result=synchronizeDraft({revision:4,draftVersion:2,draft,basePublished:old},remote);
 assert.equal(result.draft.config.cards.find(card=>card.id===1).name,'Local');assert.equal(result.draft.config.cards.find(card=>card.id===1).weight,2);assert.ok(!result.draft.config.cards.some(card=>card.id===2));assert.ok(result.draft.config.cards.some(card=>card.id===19));assert.ok(result.draft.config.cards.some(card=>card.id===20));
});
test('same-revision draft preserves intentional deletion and publication baseline',()=>{
 const remote=published(),draft=structuredClone(remote.published);draft.config.cards=draft.config.cards.filter(card=>card.id!==19);
 const result=synchronizeDraft({revision:5,draftVersion:3,draft},remote);assert.ok(!result.draft.config.cards.some(card=>card.id===19));assert.ok(result.basePublished.config.cards.some(card=>card.id===19));assert.equal(result.draftVersion,3);
});
test('conflicts prefer published values while retaining a backup; missing history also preserves a recovery copy',()=>{
 const old=base(),draft=structuredClone(old),remote=published();draft.config.cards[0].name='Local';remote.published.config.cards[0].name='Remote';
 const conflict=synchronizeDraft({revision:4,draftVersion:1,draft,basePublished:old},remote);assert.equal(conflict.draft.config.cards[0].name,'Remote');assert.equal(conflict.backup,true);assert.ok(conflict.notice);
 const missing=synchronizeDraft({revision:1,draftVersion:1,draft},remote);assert.deepEqual(missing.draft,validateDocument(remote.published));assert.equal(missing.backup,true);
});
test('clean drafts match published cards after syncing; subsequent save/relogin is stable',()=>{
 const remote=published(),synced=synchronizeDraft({revision:4,draftVersion:0,draft:base()},remote,base());
 assert.deepEqual(synced.draft,validateDocument(remote.published));
 const again=synchronizeDraft({revision:5,draftVersion:synced.draftVersion,draft:synced.draft,basePublished:synced.basePublished},remote);assert.deepEqual(again.draft,synced.draft);assert.equal(again.draftVersion,synced.draftVersion);assert.equal(again.backup,false);
});
