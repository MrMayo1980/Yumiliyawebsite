const maximum=config=>Math.max(0,...config.cards.map(card=>card.id));
export function nextCardId(config,published){
 const id=Math.max(maximum(config)+1,config.nextCardId||1,published?maximum(published)+1:1,published?.nextCardId||1);
 if(!Number.isSafeInteger(id)||id>=Number.MAX_SAFE_INTEGER)throw new Error('Нет свободного ID для новой карты.');
 return id;
}
export function normalizeCardIds(config){config.nextCardId=Math.max(config.nextCardId||1,maximum(config)+1);return config;}
export function validateCardTransition(previous,next){
 const used=new Set(previous.cards.map(card=>card.id)),minimum=Math.max(previous.nextCardId||1,maximum(previous)+1);
 for(const card of next.cards)if(!used.has(card.id)&&card.id<minimum)throw Object.assign(new Error('ID новой карты уже использовался. Обновите студию и создайте новую карту; прогресс старых карт сохранится.'),{status:422});
 next.nextCardId=Math.max(minimum,next.nextCardId||1,maximum(next)+1);
}
