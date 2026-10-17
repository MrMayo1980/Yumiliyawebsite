// One-time migration of the old public archive. Normal page loads never scan unsigned manifests.
import {writeFile} from 'node:fs/promises';
const items=[],seen=new Set(),deleted=new Set();let misses=0,versions=0;
for(let v=1;v<=999&&misses<3;v+=3){
 const result=await Promise.all([v,v+1,v+2].filter(n=>n<=999).map(async n=>{const r=await fetch(`https://res.cloudinary.com/dflgldw4j/raw/upload/gallery/manifest_${String(n).padStart(3,'0')}.json`,{signal:AbortSignal.timeout(20000)});if(r.status===404)return null;if(!r.ok)throw new Error(`Не удалось прочитать манифест: ${r.status}`);return r.json();}));
 for(const data of result){if(!data){if(++misses>=3)break;continue;}misses=0;versions++;for(const url of data.deleted||[])deleted.add(url);for(const item of data.items||[])if(!seen.has(item.url)){seen.add(item.url);items.push(item);}}
}
const safe=items.filter(item=>{if(deleted.has(item.url))return false;try{const u=new URL(item.url);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}});
await writeFile(new URL('../data/legacy-gallery.json',import.meta.url),JSON.stringify(safe,null,2)+'\n');
console.log(`Снимок архива сохранён: ${safe.length} файлов из ${versions} манифестов.`);
