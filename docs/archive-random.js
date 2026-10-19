import {mediaType,safeMediaUrl} from './gallery.js?v=drugie-1';

export function randomPool(items,filter='all',respectFilter=false){
 return items.filter(item=>safeMediaUrl(item.url)&&(!respectFilter||filter==='all'||mediaType(item)===filter));
}
export function chooseRandom(items,random=Math.random){return items.length?items[Math.min(items.length-1,Math.floor(random()*items.length))]:null;}

export function createArchiveRoulette({items,settings,openMedia,onChange=()=>{}}){
 const button=document.getElementById('archive-random'),dialog=document.getElementById('archive-roulette'),track=document.getElementById('roulette-track'),viewport=document.getElementById('roulette-viewport'),status=document.getElementById('roulette-status');
 let animation,timer,run=0,busy=false;
 const update=()=>{const options=settings();button.hidden=!options.randomEnabled;button.disabled=busy||!items().length;button.textContent=options.randomLabel;document.getElementById('roulette-title').textContent=options.randomTitle;};
 const cancel=()=>{run++;clearTimeout(timer);animation?.cancel();animation=null;busy=false;if(dialog.open)dialog.close();track.replaceChildren();update();onChange();};
 const spin=()=>{
  if(busy||!settings().randomEnabled)return;
  const pool=items(),winner=chooseRandom(pool);if(!winner)return;
  busy=true;const token=++run,options=settings();update();status.textContent=options.randomSpinLabel;
  const stop=14,cards=[];
  for(let i=0;i<18;i++){
   const item=i===stop?winner:chooseRandom(pool),type=mediaType(item),card=document.createElement('div');card.className='roulette-card';
   if(type!=='video'){const image=document.createElement('img');image.src=safeMediaUrl(item.url);image.alt='';image.decoding='async';card.appendChild(image);}
   else{const icon=document.createElement('span');icon.className='roulette-video-icon';icon.textContent='▶';card.appendChild(icon);}
   const label=document.createElement('span');label.className='roulette-card-label';label.textContent=item.name||(type==='video'?'Видео':type==='gif'?'GIF':'Фото');card.appendChild(label);cards.push(card);
  }
  track.replaceChildren(...cards);dialog.showModal();onChange();
  const reveal=()=>{if(token!==run)return;const url=safeMediaUrl(winner.url),type=mediaType(winner);cancel();openMedia(url,type);};
  const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(reduced||!track.animate){reveal();return;}
  const width=cards[0].getBoundingClientRect().width,gap=12,center=(viewport.clientWidth-width)/2;
  animation=track.animate([{transform:`translateX(${center}px)`},{transform:`translateX(${center-stop*(width+gap)}px)`}],{duration:options.randomDuration,easing:'cubic-bezier(.12,.65,.12,1)',fill:'forwards'});
  animation.finished.then(()=>{if(token===run){status.textContent=winner.name||options.randomLabel;timer=setTimeout(reveal,450);}},()=>{});
 };
 button.addEventListener('click',spin);
 document.getElementById('roulette-close').addEventListener('click',cancel);
 dialog.addEventListener('cancel',event=>{event.preventDefault();cancel();});
 dialog.addEventListener('click',event=>{if(event.target===dialog)cancel();});
 return {update,cancel,spin};
}
