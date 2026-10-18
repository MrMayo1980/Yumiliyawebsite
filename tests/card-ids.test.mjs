import test from 'node:test';
import assert from 'node:assert/strict';
import {nextCardId,normalizeCardIds,validateCardTransition} from '../card-ids.js';
test('deleting the last card never makes its ID available again',()=>{
 const config={cards:[{id:1},{id:2}]};normalizeCardIds(config);assert.equal(config.nextCardId,3);config.cards.pop();assert.equal(nextCardId(config),3);normalizeCardIds(config);assert.equal(config.nextCardId,3);
});
test('new and duplicated cards respect published ID history even in an older draft',()=>{
 const draft={cards:[{id:1},{id:2}]},published={cards:[{id:1}],nextCardId:20};assert.equal(nextCardId(draft,published),20);draft.cards.push({id:20});normalizeCardIds(draft);assert.equal(nextCardId(draft,published),21);
});
test('publishing rejects retired IDs, preserves the allocation floor through deletions and permits existing-card edits',()=>{
 const previous={cards:[{id:1},{id:3}],nextCardId:5};assert.throws(()=>validateCardTransition(previous,{cards:[{id:1},{id:2}]}),error=>error.status===422);
 const deletion={cards:[{id:1}],nextCardId:2};validateCardTransition(previous,deletion);assert.equal(deletion.nextCardId,5);
 const edit={cards:[{id:1,img:'changed.jpg'},{id:3}]};validateCardTransition(previous,edit);assert.equal(edit.nextCardId,5);
 const addition={cards:[{id:1},{id:3},{id:5}]};validateCardTransition(previous,addition);assert.equal(addition.nextCardId,6);
});
