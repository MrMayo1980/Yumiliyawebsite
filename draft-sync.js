import {validateDocument} from './validation.js?v=drugie-empty-1';
const clone=value=>structuredClone(value),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const keyFor=path=>/(^|\.)config\.(cards|cols)$/.test(path)?'id':/(^|\.)gallery\.items$/.test(path)?'url':null;
function merge(base,local,remote,path,conflicts){
 if(same(local,base))return clone(remote);
 if(same(remote,base)||same(local,remote))return clone(local);
 const key=keyFor(path);
 if(key&&[base,local,remote].every(Array.isArray)){
  const b=new Map(base.map(x=>[x[key],x])),l=new Map(local.map(x=>[x[key],x])),r=new Map(remote.map(x=>[x[key],x]));
  const reordered=!same(local.filter(x=>b.has(x[key])).map(x=>x[key]),base.filter(x=>l.has(x[key])).map(x=>x[key]));
  const order=reordered?[...local,...remote]:[...remote,...local],ids=[...new Set(order.map(x=>x[key]))],result=[];
  for(const id of ids){const value=merge(b.get(id),l.get(id),r.get(id),path+'.'+id,conflicts);if(value!==undefined)result.push(value);}
  return result;
 }
 if([base,local,remote].every(record)){
  const result={};for(const key of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])){
   if(['__proto__','constructor','prototype'].includes(key))continue;
   const value=merge(base[key],local[key],remote[key],path?path+'.'+key:key,conflicts);if(value!==undefined)result[key]=value;
  }return result;
 }
 // Keep the published value when both sides changed the same field. The draft is backed up.
 conflicts.push(path);return clone(remote);
}
export function synchronizeDraft(saved,published,historicalBase){
 const latest=validateDocument(published.published),base=saved?.basePublished||historicalBase;
 if(!saved?.draft)return {draft:latest,basePublished:clone(latest),draftVersion:0,notice:'',backup:false};
 let local;try{const input=clone(saved.draft);if(!input.sections&&latest.sections)input.sections=clone(latest.sections);local=validateDocument(input);}catch{return {draft:latest,basePublished:clone(latest),draftVersion:(saved.draftVersion||0)+1,notice:'Студия показывает опубликованную версию. Предыдущий черновик сохранён в резервной копии.',backup:true};}
 if(saved.revision===published.revision)return {draft:local,basePublished:clone(latest),draftVersion:saved.draftVersion||0,notice:'',backup:false};
 if(!base)return {draft:latest,basePublished:clone(latest),draftVersion:(saved.draftVersion||0)+1,notice:'Загружена актуальная публикация. Старый черновик сохранён в резервной копии.',backup:true};
 const conflicts=[];let draft;
 try{draft=validateDocument(merge(validateDocument(base),local,latest,'',conflicts));}catch{draft=latest;conflicts.push('document');}
 return {draft,basePublished:clone(latest),draftVersion:(saved.draftVersion||0)+1,backup:!same(local,draft),notice:conflicts.length?'Студия синхронизирована. Совпадающие правки взяты с сайта; прежний черновик сохранён в копии.':'Опубликованные изменения добавлены в студию. Ваши неопубликованные правки сохранены.'};
}
