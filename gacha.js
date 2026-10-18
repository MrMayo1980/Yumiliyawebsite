import {normalizeFrameSettings,cardFrame,framePreset,photoStyle} from './frames.js?v=photo-1';
(async function bootGacha(){
const preview = new URLSearchParams(location.search).has('preview');
async function loadConfig(){
 if(window.YUMILIYA_PAGES){const {loadPublished,loadPreview,materializeAssets}=await import('./hosting.js');return materializeAssets((preview?await loadPreview():(await loadPublished()).published).config);}
 const endpoint=preview?'api/admin/preview':'api/gacha';
 try{const response=await fetch(endpoint,{cache:'no-store'});if(response.ok)return await response.json();if(preview)throw new Error('Войдите в админ-панель для предпросмотра.')}catch(e){if(preview)throw e}
 const response=await fetch('data/gacha.json',{cache:'no-store'});if(!response.ok)throw new Error('Настройки игры недоступны.');return await response.json();
}
const CONFIG=normalizeFrameSettings(await loadConfig());
const DATA={...CONFIG,cols:CONFIG.cols.filter(c=>c.enabled),cards:CONFIG.cards.filter(c=>c.enabled&&CONFIG.cols.some(col=>col.id===c.col&&col.enabled))};
if(!DATA.cols.length||DATA.cols.some(col=>!DATA.cards.some(c=>c.col===col.id&&c.r==='N')))throw new Error('Для игры нужна активная коллекция с картами N.');
const STORAGE=preview?'gacha_admin_preview':'gacha3';
if(preview&&new URLSearchParams(location.search).has('reset'))localStorage.removeItem(STORAGE);
const E=CONFIG.economy,L=CONFIG.labels;


const BACK=DATA.back;
const COLS=DATA.cols;
const C=DATA.cards;
const byR=r=>C.filter(c=>c.r===r&&c.col===S.col), get=id=>C.find(c=>c.id===id);
const SH=E.shards, PRICE=E.sellPrices;
const FRESH=()=>({col:COLS[0].id,gems:E.startingGems,free:E.startingFree,day:'',p:{},inv:{},shards:0,banner:0,test:false,mute:!CONFIG.effects.sound,mini:{n:0,g:0},st:{N:0,R:0,SR:0,M:0}});
let S=FRESH();
const P=()=>S.p[S.col]||(S.p[S.col]={pr:0,ps:0,g:false});
const VC=()=>(S.vcol&&COLS.find(x=>x.id===S.vcol))?S.vcol:S.col;
const colCards=id=>C.filter(c=>c.col===id);
const isDone=id=>{const a=colCards(id);return a.length>0&&a.every(c=>S.inv[c.id])};
const DEF=CONFIG.defaults;
const CS=id=>Object.assign({},DEF,((COLS.find(x=>x.id===id)||{}).settings)||{});
const defBanner=()=>{const l=CS(S.col).banner,o=byR('SR');return(l&&o.find(x=>x.id===l))?l:((o[0]||{}).id||0)};
const esc=s=>String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
try{const x=JSON.parse(localStorage.getItem(STORAGE)||'null');if(x)S=Object.assign(S,x)}catch(e){}
function norm(){S.test=false;S.st=Object.assign({N:0,R:0,SR:0,M:0},S.st);S.mini=S.mini||{n:0,g:0};if(!COLS.find(x=>x.id===S.col))S.col=COLS[0].id;S.p=S.p||{};S.inv=S.inv||{};if(S.pr!==undefined){S.p[S.col]=S.p[S.col]||{pr:S.pr,ps:S.ps,g:!!S.g};delete S.pr;delete S.ps;delete S.g}}norm();
const save=()=>{try{localStorage.setItem(STORAGE,JSON.stringify(S))}catch(e){}};
const $=id=>document.getElementById(id);
function toast(t){const e=$('toast');e.textContent=t;e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.display='none',1800)}
const pick=a=>a[Math.floor(Math.random()*a.length)];
const weighted=a=>{let n=Math.random()*a.reduce((s,c)=>s+c.weight,0);for(const c of a){n-=c.weight;if(n<0)return c}return a[a.length-1]};
function pull(){
 const st=CS(S.col);
 const hS=byR('SR').length>0,hR=byR('R').length>0;
 if(hS||hR)P().pr++;if(hS)P().ps++;let r;
 if(hS&&st.pityS>0&&P().ps>=st.pityS)r='SR';else if((hS||hR)&&st.pityR>0&&P().pr>=st.pityR)r=hS&&(!hR||Math.random()<st.sr/(st.sr+st.r))?'SR':'R';
 else{const x=Math.random()*100;r=x<st.sr?'SR':x<st.sr+st.r?'R':x<st.sr+st.r+st.money?'M':'N'}
 if(r==='SR'&&!hS)r='N';if(r==='R'&&!hR)r='N';
 if(r==='M'){const m=pick(E.moneyPrizes);S.gems+=m;S.st.M++;return{c:null,money:m}}
 let c;
 if(r==='SR'){P().pr=0;P().ps=0;if(!get(S.banner)||get(S.banner).col!==S.col||get(S.banner).r!=='SR'||(st.banner&&S.banner!==defBanner()))S.banner=defBanner();let ban=(st.bannerGuarantee&&P().g)||Math.random()<st.bannerRate/100||byR('SR').length<2;
  c=ban?get(S.banner):weighted(byR('SR').filter(x=>x.id!==S.banner));P().g=st.bannerGuarantee&&!ban}
 else{if(r==='R')P().pr=0;c=weighted(byR(r))}
 S.st[c.r]++;const isNew=!S.inv[c.id];S.inv[c.id]=(S.inv[c.id]||0)+1;
 let sh=0;if(!isNew){sh=SH[c.r];S.shards+=sh}
 return{c,isNew,sh};
}
function daily(){const d=new Date(),k=d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();if(S.day!==k){S.day=k;S.free+=E.dailyFree;S.mini={n:0,g:(S.mini&&S.mini.g)||0};save();setTimeout(()=>toast(L.dailyBonus+': +'+E.dailyFree+' 🎟'),500)}}
function doPull(n){
 if(isDone(S.col)&&!S.test){toast('Коллекция собрана, выбери другую');openDr();return}
 const f=S.test?0:Math.min(S.free,n),need=S.test?0:(n-f)*CS(S.col).price;
 if(S.gems<need){toast('Не хватает 💎');return}
 S.free-=f;S.gems-=need;const out=[];for(let i=0;i<n;i++)out.push(pull());
 save();render();rollMode='main';showRes(out);
}
function flash(){if(CONFIG.effects.flash){const f=$('flash');f.classList.remove('go');void f.offsetWidth;f.classList.add('go');}try{CONFIG.effects.vibration&&navigator.vibrate&&navigator.vibrate([60,40,140])}catch(e){}}
const SND=(()=>{let ctx=null;
 const g=()=>{if(S.mute||!CONFIG.effects.sound||CONFIG.effects.volume===0)return null;try{ctx=ctx||new (window.AudioContext||window.webkitAudioContext)();if(ctx.state==='suspended')ctx.resume();return ctx}catch(e){return null}};
 const tone=(f,t0,d,type,v,f2)=>{const c=g();if(!c)return;const o=c.createOscillator(),a=c.createGain(),T=c.currentTime+t0;o.type=type;o.frequency.setValueAtTime(f,T);if(f2)o.frequency.exponentialRampToValueAtTime(f2,T+d);a.gain.setValueAtTime(.0001,T);a.gain.exponentialRampToValueAtTime(Math.max(.0001,v*CONFIG.effects.volume),T+.015);a.gain.exponentialRampToValueAtTime(.0001,T+d);o.connect(a);a.connect(c.destination);o.start(T);o.stop(T+d+.05)};
 const noise=(t0,d,f1,f2,v)=>{const c=g();if(!c)return;const n=Math.floor(c.sampleRate*d),b=c.createBuffer(1,n,c.sampleRate),x=b.getChannelData(0);for(let i=0;i<n;i++)x[i]=Math.random()*2-1;const s=c.createBufferSource(),fl=c.createBiquadFilter(),a=c.createGain(),T=c.currentTime+t0;s.buffer=b;fl.type='bandpass';fl.Q.value=1.2;fl.frequency.setValueAtTime(f1,T);fl.frequency.exponentialRampToValueAtTime(f2,T+d);a.gain.setValueAtTime(Math.max(.0001,v*CONFIG.effects.volume),T);a.gain.exponentialRampToValueAtTime(.0001,T+d);s.connect(fl);fl.connect(a);a.connect(c.destination);s.start(T)};
 return{
  start(){noise(0,.35,300,2500,.12)},
  tick(){tone(1100,0,.025,'square',.03)},
  card(o){noise(0,.16,1200,4000,.12);
   if(!o.c){tone(988,.05,.12,'square',.07);tone(1319,.15,.25,'square',.07);if(o.money>=200){[523,659,784,1047,1319].forEach((f,i)=>tone(f,.2+i*.09,.8,'triangle',.15));flash()}return}
   const r=o.c.r;
   if(r==='N')tone(440,.05,.2,'triangle',.12);
   else if(r==='R'){tone(659,.05,.35,'sine',.16);tone(880,.15,.5,'sine',.16);tone(1319,.25,.6,'sine',.08)}
   else{[523,659,784,1047,1319,1568].forEach((f,i)=>tone(f,.05+i*.09,.9,'triangle',.15));tone(110,0,1.2,'sine',.35,45);[2093,2637,3136].forEach((f,i)=>tone(f,.5+i*.12,.5,'sine',.06));flash()}
  }}})();
let skipAll=false,skipFn=null,rollMode='main';
const PRIZES=CONFIG.mini.prizes;
const miniCost=()=>CONFIG.mini.baseCost+CONFIG.mini.costStep*S.mini.n;
function pickPrize(min){const p=PRIZES.filter(x=>x[0]>=min),s=p.reduce((a,x)=>a+x[1],0);let r=Math.random()*s;for(const x of p){if((r-=x[1])<0)return x[0]}return p[0][0]}
const mfiller=()=>({c:null,money:PRIZES[Math.floor(Math.random()*PRIZES.length)][0]});
function doMini(){
 if(!CONFIG.mini.enabled)return;
 const cost=S.test?0:miniCost();
 if(!S.test&&S.shards<cost){toast('Не хватает осколков');return}
 S.shards-=cost;S.mini.n++;S.mini.g=(S.mini.g||0)+1;
 let amt;if(CONFIG.mini.guaranteeEvery>0&&S.mini.g>=CONFIG.mini.guaranteeEvery){amt=pickPrize(CONFIG.mini.guaranteeMin);S.mini.g=0}else{amt=pickPrize(0);if(amt>=CONFIG.mini.guaranteeMin)S.mini.g=0}
 S.gems+=amt;save();render();rollMode='mini';showRes([{c:null,money:amt}]);
}
const PITCH=110,TILE=52;
const itemHtml=o=>o.c?`<div class="it ${o.c.r}">${cardFace(o.c)}</div>`:`<div class="it M"><div class="coin2">💰<b>+${o.money}</b></div></div>`;
function filler(){const x=Math.random(),hS=byR('SR').length,hR=byR('R').length;
 const r=x<.05&&hS?'SR':x<.23&&hR?'R':x<.40?'M':'N';
 if(r==='M')return{c:null,money:pick(E.moneyPrizes)};
 return{c:pick(byR(r))}}
function spin(res,dur){return new Promise(done=>{
 const st=$('strip'),W=$('rwrap').clientWidth,n=46,k=38,arr=[];
 for(let i=0;i<n;i++)arr.push(i===k?res:(rollMode==='mini'?mfiller():filler()));
 st.style.transition='none';st.style.transform='translateX(0)';st.innerHTML=arr.map(itemHtml).join('');void st.offsetWidth;
 const jit=(Math.random()-.5)*70,target=-(k*PITCH+TILE+jit)+W/2;
 st.style.transition='transform '+dur+'s cubic-bezier(.1,.7,.1,1)';st.style.transform='translateX('+target+'px)';
 SND.start();
 let last=-1,raf,over=false;
 const tick=()=>{const m=new DOMMatrix(getComputedStyle(st).transform),idx=Math.floor((-m.m41+W/2)/PITCH);if(idx!==last){last=idx;SND.tick()}raf=requestAnimationFrame(tick)};tick();
 const fin=()=>{if(over)return;over=true;cancelAnimationFrame(raf);clearTimeout(to);st.removeEventListener('transitionend',fin);skipFn=null;st.children[k].classList.add('win');done()};
 st.addEventListener('transitionend',fin);const to=setTimeout(fin,dur*1000+600);
 skipFn=()=>{st.style.transition='none';st.style.transform='translateX('+target+'px)';fin()};
})}
function cardFace(card,{locked=false,concealed=false}={}){
 const frame=locked?'':cardFrame(card,CONFIG.theme),preset=framePreset(frame);
 return `<span class="card-face${frame?' has-frame':''}${preset?' has-builtin-frame':''}${concealed?' concealed':''}"${locked?'':` style="${photoStyle(card)}"`}><span class="card-photo"><img class="card-art" src="${esc(locked?BACK:card.img)}" alt="${esc(locked||concealed?'Неизвестная карта':card.name)}"></span>${frame?`<img class="card-frame${preset?' frame-preset frame-preset-'+preset:''}" src="${esc(frame)}" alt="" aria-hidden="true">`:''}</span>`;
}
const wait=ms=>new Promise(r=>setTimeout(r,skipAll?0:ms));
function resultHtml(o){
 if(!o.c)return `<div class="big"><div class="coin" style="height:190px;border-radius:50%">💰<b>+${o.money}</b><span>💎</span></div></div><div class="rline">Монеты <b>+${o.money} 💎</b></div>`;
 return `<div class="big ${o.c.r}">${cardFace(o.c)}</div><div class="rline"><b>${esc(o.c.name)}</b> · ${o.c.r}${o.isNew?'<span class="tag2">NEW</span>':''}${o.sh?' · +'+o.sh+' ✦':''}</div>`}
async function showRes(out){
 skipAll=false;const multi=out.length>1;
 $('ov').classList.add('show');$('res').style.display='none';$('rwrap').style.display='';$('rres').innerHTML='';$('close').style.display='none';$('again').style.display='none';$('obal').textContent='';$('skip').style.display='';
 $('skip').textContent=L.skip+(multi?' всё':'');
 for(let i=0;i<out.length;i++){
  if(skipAll&&multi)break;
  $('rres').innerHTML=multi?'<div class="cnt2">'+(i+1)+' / '+out.length+'</div>':'';
  await spin(out[i],multi?CONFIG.effects.multiSpinSeconds:CONFIG.effects.spinSeconds);
  SND.card(out[i]);
  if(!multi){$('rres').innerHTML=resultHtml(out[i]);break}
  $('rres').innerHTML='<div class="cnt2">'+(i+1)+' / '+out.length+'</div>'+resultHtml(out[i]);
  await wait(out[i].c&&out[i].c.r==='SR'?1800:out[i].c&&out[i].c.r==='R'?1100:700);
 }
 if(multi){
  $('rwrap').style.display='none';$('rres').innerHTML='';
  $('res').innerHTML=out.map(o=>`<div class="tile flip ${o.c?o.c.r:'M'}"><div class="in"><div class="f">${o.c?cardFace(o.c):`<div class="coin">💰<b>+${o.money}</b><span>💎</span></div>`}${o.c&&o.isNew?'<span class="tag">NEW</span>':''}${o.sh?`<span class="sh">+${o.sh}✦</span>`:''}</div></div></div>`).join('');
  $('res').style.display='';
 }
 $('skip').style.display='none';$('close').style.display='';
 const mini=rollMode==='mini',mc=S.test?0:miniCost(),can=mini?(S.test||S.shards>=mc):((S.test||S.free>0||S.gems>=CS(S.col).price)&&!(isDone(S.col)&&!S.test));
 $('again').style.display='';$('again').disabled=!can;
 $('again').innerHTML=can?(mini?'Ещё раз<small>'+(S.test?'бесплатно':mc+' ✦')+'</small>':esc(L.again)+'<small>'+(S.test||S.free>0?'🎟 бесплатная':CS(S.col).price+' 💎')+'</small>'):(mini?'Не хватает ✦':(isDone(S.col)&&!S.test?'Коллекция собрана':'Не хватает 💎'));
 $('obal').textContent=mini?'✦ '+S.shards+' · 💎 '+(S.test?'∞':S.gems):'💎 '+(S.test?'∞':S.gems)+' · 🎟 '+(S.test?'∞':S.free);
}
$('skip').onclick=()=>{skipAll=true;if(skipFn)skipFn()};
$('again').onclick=()=>rollMode==='mini'?doMini():doPull(1);
$('close').onclick=()=>{$('ov').classList.remove('show');if(rollMode==='main'&&isDone(S.col)&&!S.test){const other=COLS.some(c=>!isDone(c.id));toast(other?'Коллекция собрана! Выбери следующую':'Все коллекции собраны!');if(other)setTimeout(()=>openDr('pull'),450)}};
let drMode='pull';
function renderDr(){
 const pull=drMode==='pull',cur=pull?S.col:VC();
 $('drh').textContent=pull?'Коллекция для круток':'Коллекция в альбоме';
 $('drn').textContent=pull?'Собранные коллекции закрыты для круток, но остаются в альбоме.':'Здесь можно смотреть любые коллекции, в том числе собранные.';
 $('drlist').innerHTML=COLS.map(c=>{const cs=colCards(c.id),own=cs.filter(x=>S.inv[x.id]).length,done=isDone(c.id);
  return `<button class="dc ${c.id===cur?'sel':''} ${done&&pull?'done':''}" data-id="${c.id}">${c.cover?`<img class="cv" src="${c.cover}" alt="">`:''}<b>${esc(c.name)}${done?' ✔':''}</b>${c.desc?`<div class="dd">${esc(c.desc)}</div>`:''}<span class="mut">${done?(pull?'Собрана, круток нет':'Собрана полностью'):'Собрано '+own+' из '+cs.length}</span><div class="bar"><i style="width:${cs.length?own/cs.length*100:0}%;background:linear-gradient(90deg,#37c6ff,#bfeaff)"></i></div></button>`}).join('');
 [...$('drlist').children].forEach(b=>b.onclick=()=>{const id=b.dataset.id;
  if(drMode==='view'){S.vcol=id;save();closeDr();render();return}
  if(isDone(id)&&!S.test){toast('Коллекция собрана, крутить её больше нельзя');return}
  S.col=id;S.banner=defBanner();save();closeDr();render()})}
const openDr=(m)=>{drMode=m==='view'?'view':'pull';renderDr();$('dr').classList.add('open')},closeDr=()=>$('dr').classList.remove('open');
$('colbtn').onclick=()=>openDr('pull');$('colbtn2').onclick=()=>openDr('view');$('drbg').onclick=closeDr;
let tx=0,ty=0;document.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY},{passive:true});
document.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-tx,dy=Math.abs(e.changedTouches[0].clientY-ty);
 if(dy>60)return;if($('dr').classList.contains('open')){if(dx<-70)closeDr()}else if(tx<28&&dx>70&&!$('ov').classList.contains('show')&&$('v3').style.display==='none'&&$('v4').style.display==='none')openDr($('v1').style.display!=='none'?'pull':'view')},{passive:true});
const bkCode=()=>'GACHA1:'+btoa(unescape(encodeURIComponent(JSON.stringify(S))));
function bkMsg(t,err){const m=$('bkmsg');m.textContent=t;m.style.color=err?'#ff9aa8':'#8ff0a4'}
function bkRestore(raw){
 try{raw=String(raw||'').trim().replace(/\s+/g,'');if(raw.indexOf('GACHA1:')!==0)throw new Error('Это не код резервной копии.');
  const o=JSON.parse(decodeURIComponent(escape(atob(raw.slice(7)))));if(!o||typeof o!=='object'||typeof o.inv!=='object')throw new Error('Код повреждён.');
  S=Object.assign(FRESH(),o);norm();save();g48Load();render();bkMsg('Прогресс восстановлен.');toast('Прогресс восстановлен')}
 catch(e){bkMsg('Не удалось восстановить: '+(/^(Это|Код)/.test(e.message)?e.message:'код повреждён или скопирован не полностью.'),1)}}
$('bk').onclick=()=>{$('bkt').value=bkCode();$('bki').value='';$('bkmsg').textContent='';$('bkov').classList.add('show')};
$('bkx').onclick=()=>$('bkov').classList.remove('show');
$('bkc').onclick=()=>{const v=$('bkt').value;const ok=()=>bkMsg('Код скопирован. Сохрани его в надёжном месте.');
 const fb=()=>{try{$('bkt').removeAttribute('readonly');$('bkt').select();document.execCommand('copy');$('bkt').setAttribute('readonly','');ok()}catch(e){bkMsg('Не удалось скопировать. Выдели код и скопируй вручную.',1)}};
 try{navigator.clipboard.writeText(v).then(ok,fb)}catch(e){fb()}};
$('bkf').onclick=()=>{try{const b=new Blob([$('bkt').value],{type:'text/plain'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='gacha_backup.txt';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000);bkMsg('Файл gacha_backup.txt сохранён.')}catch(e){bkMsg('Не удалось сохранить файл. Скопируй код.',1)}};
$('bkr').onclick=()=>bkRestore($('bki').value);
$('bkl').onclick=()=>$('bkfile').click();
$('bkfile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(f){const tx=await f.text();$('bki').value=tx;bkRestore(tx)}};
function fit(){const w=innerWidth,h=innerHeight,land=w>h*1.1,r=document.documentElement.style;
 const z=Math.max(1,Math.min(2.4,land?Math.min(w/900,h/700):Math.min(w/520,h/985)));
 r.setProperty('--z',z.toFixed(3));r.setProperty('--mw',Math.min(w/z,land?CONFIG.theme.maxWidth:Math.min(900,CONFIG.theme.maxWidth)).toFixed(1))}
fit();addEventListener('resize',fit);
function render(){
 renderCustomUI();
 $('mute').textContent=S.mute?'🔇':'🔊';$('gems').textContent=S.test?'∞':S.gems;$('fr').textContent=S.test?'∞':S.free;
 $('colname2').textContent=COLS.find(x=>x.id===VC()).name;{const v=colCards(VC());$('colprog2').textContent=v.filter(c=>S.inv[c.id]).length+'/'+v.length+(isDone(VC())?' ✔':'')}
 {const st=CS(S.col),nn=Math.max(0,+(100-st.sr-st.r-st.money).toFixed(1));
 $('pr').textContent=st.pityR?P().pr+'/'+st.pityR:'выкл.';$('br').style.width=(st.pityR?Math.min(100,P().pr/st.pityR*100):0)+'%';$('prl').textContent='Гарант R+ ('+st.pityR+')';
 $('ps').textContent=st.pityS?P().ps+'/'+st.pityS:'выкл.';$('bs').style.width=(st.pityS?Math.min(100,P().ps/st.pityS*100):0)+'%';$('psl').textContent='Гарант SR ('+st.pityS+')';
 $('rates').innerHTML='Шансы: <b style="color:var(--sr)">SR '+st.sr+'%</b> · <b style="color:var(--r)">R '+st.r+'%</b> · <b>💰 деньги '+st.money+'%</b> · <b>N '+nn+'%</b>. Правила, гаранты и мини-рулетка описаны во вкладке «Справка».'+(isDone(S.col)?'':'')}
 $('fifty').textContent=P().g&&CS(S.col).bannerGuarantee?'⭐ Следующая SR — гарантированно баннерная':'Баннерная SR: '+CS(S.col).bannerRate+'%';
 const hs=byR('SR').length>0,hr=byR('R').length>0;
 if(hs&&(!get(S.banner)||get(S.banner).col!==S.col||get(S.banner).r!=='SR'))S.banner=defBanner();
 const lock=!!(hs&&CS(S.col).banner&&byR('SR').some(x=>x.id===CS(S.col).banner));if(lock)S.banner=CS(S.col).banner;$('ban').style.display=lock?'none':'';
 $('hero').style.display=hs?'':'none';$('pity').style.display=hs||hr?'':'none';$('note').style.display=hs?'none':'';$('note').textContent=hr?'В этой коллекции пока нет SR, они появятся позже. Гарант на R работает.':'В этой коллекции пока только обычные карты N. Редкие появятся позже, поэтому гарантов здесь нет.';$('spity').style.display=hs?'':'none';$('fifty').parentNode.style.display=hs?'':'none';
 if(hs)$('hero').innerHTML=cardFace(get(S.banner));
 $('ban').innerHTML=byR('SR').map(c=>`<button class="chip card ${c.id===S.banner?'on':''}" data-id="${c.id}">${cardFace(c)}</button>`).join('');
 [...$('ban').children].forEach(b=>b.onclick=()=>{S.banner=+b.dataset.id;save();render()});
 const cc=C.filter(c=>c.col===VC()),own=cc.filter(c=>S.inv[c.id]).length;
 $('pcount').textContent=own+'/'+cc.length;$('pname').textContent=COLS.find(x=>x.id===VC()).name;$('pbar').style.width=(own/cc.length*100)+'%';
 [...$('filt').children].forEach(b=>b.classList.toggle('on',b.dataset.f===filt));$('shards').textContent='Осколки: '+S.shards+' ✦';
 $('grid').innerHTML=C.filter(c=>c.col===VC()&&(filt==='all'||c.r===filt)).sort((a,b)=>['SR','R','N'].indexOf(a.r)-['SR','R','N'].indexOf(b.r)).map(c=>`<button class="cell ${c.r} ${S.inv[c.id]?'':'lock'}" data-id="${c.id}"><div class="card">${cardFace(c,{locked:!S.inv[c.id]})}</div>${S.inv[c.id]?`<span class="cnt">${S.inv[c.id]}</span>`:''}</button>`).join('');
 [...$('grid').children].forEach(b=>b.onclick=()=>detail(+b.dataset.id));
 const tp=S.st.N+S.st.R+S.st.SR+S.st.M,pc=k=>S.st[k]+' ('+(tp?(S.st[k]/tp*100).toFixed(1):'0')+'%)';
 $('stats').innerHTML='Статистика круток: '+tp+' · N '+pc('N')+' · R '+pc('R')+' · SR '+pc('SR')+' · 💰 '+pc('M');

 const tot=S.test?1e9:S.gems+S.free*CS(S.col).price;const done=isDone(S.col)&&!S.test,cs=colCards(S.col);
 $('colname').textContent=COLS.find(x=>x.id===S.col).name;$('colprog').textContent=cs.filter(c=>S.inv[c.id]).length+'/'+cs.length+(isDone(S.col)?' ✔':'');
 $('p1').innerHTML=done?esc(L.collectionDone)+'<small>выбери другую в меню ☰</small>':esc(L.pull)+'<small>'+CS(S.col).price+' 💎</small>';$('p1').classList.toggle('sm',done);
 $('p1').disabled=tot<CS(S.col).price||done;
 const dups=C.reduce((s,c)=>s+Math.max(0,(S.inv[c.id]||0)-1)*PRICE[c.r],0);
 $('sellall').textContent='Продать дубли +'+dups+' 💎';$('sellall').disabled=!dups;
 const mcost=S.test?0:miniCost(),mok=S.test||S.shards>=mcost;
 $('conv').innerHTML='🎰 '+esc(L.mini)+'<small>'+(mok?'':'нужно ')+mcost+' ✦ · у тебя '+S.shards+' ✦</small>';$('conv').disabled=!mok;
 $('t2').textContent=L.collection+(CONFIG.mini.enabled&&mok&&S.shards>0?' 🎰':'');
}
function detail(id){
 const c=get(id),own=S.inv[id]||0,p=PRICE[c.r];
 $('dm').innerHTML=`<div class="card">${cardFace(c,{concealed:!own})}</div><div><b>${own?esc(c.name):'???'}</b> · ${c.r}${own?' · ×'+own:''}</div>${own>1?`<button class="btn main" id="sell" style="margin-top:8px">Продать дубликат +${p} 💎</button>`:''}`;
 if(own>1)$('sell').onclick=()=>{S.inv[id]--;S.gems+=p;save();render();detail(id);toast('+'+p+' 💎')};
 $('det').classList.add('show');
}
$('det').onclick=()=>$('det').classList.remove('show');$('dm').onclick=e=>e.stopPropagation();
$('mute').onclick=()=>{S.mute=!S.mute;save();render();if(!S.mute)SND.card({c:{r:'R'}})};
let filt='all';[...$('filt').children].forEach(b=>b.onclick=()=>{filt=b.dataset.f;render()});
$('p1').onclick=()=>doPull(1);
$('conv').onclick=()=>doMini();
$('sellall').onclick=()=>{let g=0;C.forEach(c=>{const d=(S.inv[c.id]||0)-1;if(d>0){g+=d*PRICE[c.r];S.inv[c.id]=1}});if(g){S.gems+=g;save();render();toast('+'+g+' 💎')}};
$('t1').onclick=()=>tab(1);$('t2').onclick=()=>tab(2);$('t3').onclick=()=>tab(3);

/* ===== 2048 ===== */
const G48R=CONFIG.game2048.rewards,G48LIM=CONFIG.game2048.dailyLimit;
const todayKey=()=>{const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()};
let grid=[],tiles=[],tid=1,g48busy=false;
const g48Fresh=o=>({g:Array(16).fill(0),s:0,over:false,claimed:[],b:(o&&o.b)||0,earned:(o&&o.earned)||0,day:(o&&o.day)||''});
function g48Day(){const k=todayKey();if(S.g48.day!==k){S.g48.day=k;S.g48.earned=0}}
function setEl(t){t.el.className='t48 v'+(t.v>2048?'big':t.v)+(String(t.v).length===4?' l4':String(t.v).length===3?' l3':'');t.el.textContent=t.v}
function mk(v,r,c,pop){const el=document.createElement('div');el.style.setProperty('--r',r);el.style.setProperty('--c',c);const t={id:tid++,v,r,c,el};setEl(t);if(pop)el.classList.add('pop');$('g48t').appendChild(el);grid[r][c]=t;tiles.push(t);return t}
function addTile(){const e=[];for(let r=0;r<4;r++)for(let c=0;c<4;c++)if(!grid[r][c])e.push([r,c]);if(!e.length)return;const p=pick(e);mk(Math.random()<.9?2:4,p[0],p[1],true)}
function g48Build(newGame){
 $('g48t').innerHTML='';grid=[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];tiles=[];
 if(newGame){addTile();addTile()}else S.g48.g.forEach((v,i)=>{if(v)mk(v,(i/4)|0,i%4,false)});
 $('g48over').style.display=S.g48.over?'flex':'none';
}
function g48Load(){if(!S.g48||!Array.isArray(S.g48.g)||S.g48.g.length!==16)S.g48=g48Fresh(S.g48);
 const empty=!S.g48.g.some(v=>v);g48Build(empty);if(empty){g48Save()}g48Render()}
function g48Save(){S.g48.g=Array(16).fill(0);tiles.forEach(t=>{S.g48.g[t.r*4+t.c]=t.v});save()}
function g48Render(){g48Day();$('g48s').textContent=S.g48.s;$('g48b').textContent=S.g48.b;
 $('g48lim').textContent='Сегодня из 2048: '+S.g48.earned+' / '+G48LIM+' 💎';$('g48bar').style.width=Math.min(100,S.g48.earned/G48LIM*100)+'%'}
function g48Reset(){S.g48=g48Fresh(S.g48);g48Build(true);g48Save();g48Render()}
function g48Award(v){
 if(!G48R[v]||S.g48.claimed.includes(v))return;S.g48.claimed.push(v);g48Day();
 const a=Math.min(G48R[v],Math.max(0,G48LIM-S.g48.earned));
 if(a>0){S.g48.earned+=a;S.gems+=a;SND.card({c:null,money:a});toast('+'+a+' 💎 за плитку '+v);render()}
 else toast('Плитка '+v+': дневной лимит 2048 исчерпан');
}
const VEC=[[0,-1],[-1,0],[0,1],[1,0]];
function canMove(){for(let r=0;r<4;r++)for(let c=0;c<4;c++){const t=grid[r][c];if(!t)return true;if(c<3&&grid[r][c+1]&&grid[r][c+1].v===t.v)return true;if(r<3&&grid[r+1][c]&&grid[r+1][c].v===t.v)return true}return false}
function g48Move(d){
 if(!CONFIG.game2048.enabled||g48busy||S.g48.over)return;const [dr,dc]=VEC[d],rs=[0,1,2,3],cs=[0,1,2,3];if(dr>0)rs.reverse();if(dc>0)cs.reverse();
 let moved=false,gain=0;const merged=[];
 for(const r of rs)for(const c of cs){const t=grid[r][c];if(!t)continue;let nr=r,nc=c;
  while(true){const pr=nr+dr,pc=nc+dc;if(pr<0||pr>3||pc<0||pc>3||grid[pr][pc])break;nr=pr;nc=pc}
  const pr=nr+dr,pc=nc+dc,nb=(pr>=0&&pr<=3&&pc>=0&&pc<=3)?grid[pr][pc]:null;grid[r][c]=0;
  if(nb&&nb.v===t.v&&!nb.m){t.r=pr;t.c=pc;nb.m=true;nb.v*=2;gain+=nb.v;merged.push([t,nb]);moved=true}
  else{grid[nr][nc]=t;if(nr!==r||nc!==c)moved=true;t.r=nr;t.c=nc}}
 if(!moved){tiles.forEach(t=>{t.m=false});return}
 g48busy=true;tiles.forEach(t=>{t.el.style.setProperty('--r',t.r);t.el.style.setProperty('--c',t.c)});
 const gone=new Set(merged.map(x=>x[0]));tiles=tiles.filter(t=>!gone.has(t));
 SND.tick();
 setTimeout(()=>{
  merged.forEach(([t,nb])=>{t.el.remove();setEl(nb);nb.el.classList.add('bump')});tiles.forEach(t=>{t.m=false});
  S.g48.s+=gain;if(S.g48.s>S.g48.b)S.g48.b=S.g48.s;
  addTile();
  merged.forEach(([t,nb])=>g48Award(nb.v));
  if(!canMove()){S.g48.over=true;$('g48over').style.display='flex'}
  g48Save();g48Render();g48busy=false;
 },130);
}
function g48Swipe(dx,dy){if(Math.max(Math.abs(dx),Math.abs(dy))<24)return;g48Move(Math.abs(dx)>Math.abs(dy)?(dx<0?0:2):(dy<0?1:3))}
{const B=$('g48');let sx=0,sy=0,down=false;
 B.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY},{passive:true});
 B.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
 B.addEventListener('touchend',e=>{g48Swipe(e.changedTouches[0].clientX-sx,e.changedTouches[0].clientY-sy)});
 B.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'){down=true;sx=e.clientX;sy=e.clientY}});
 addEventListener('pointerup',e=>{if(down){down=false;g48Swipe(e.clientX-sx,e.clientY-sy)}});
 addEventListener('keydown',e=>{if($('v4').style.display==='none')return;const k={ArrowLeft:0,ArrowUp:1,ArrowRight:2,ArrowDown:3}[e.key];if(k!==undefined){e.preventDefault();g48Move(k)}})}
$('g48n').onclick=g48Reset;$('g48n2').onclick=g48Reset;
$('t4').onclick=()=>tab(4);
function tab(n){if(n===4&&!CONFIG.game2048.enabled)n=1;[1,2,3,4].forEach(i=>{$('v'+i).style.display=n===i?'':'none';$('t'+i).classList.toggle('on',n===i)});if(n===4)g48Render()}
applyTheme();g48Load();daily();render();

function applyTheme(){
 document.title=CONFIG.title;const t=CONFIG.theme,r=document.documentElement.style;
 for(const [k,v] of Object.entries({bg:t.bg,panel:t.panel,line:t.line,tx:t.text,mut:t.muted,acc:t.accent,n:t.N,r:t.R,sr:t.SR}))r.setProperty('--'+k,v);
 r.setProperty('--game-font',JSON.stringify(t.font));r.setProperty('--card-radius',t.cardRadius+'px');r.setProperty('--frame-inset',(t.frameInset??4)+'%');
 for(const key of ['background','pill','button'])r.setProperty('--art-'+key,t[key]?'url('+JSON.stringify(t[key])+')':'none');
}
function renderCustomUI(){
 $('t1').textContent=L.summon;$('t3').textContent=L.help;$('t4').textContent=L.game2048;$('t4').hidden=!CONFIG.game2048.enabled;
 $('close').textContent=L.close;$('conv').hidden=!CONFIG.mini.enabled;$('mute').hidden=!CONFIG.effects.sound;
 const vars={...CS(S.col),dailyFree:E.dailyFree,startingGems:E.startingGems,dailyLimit:CONFIG.game2048.dailyLimit,miniBase:CONFIG.mini.baseCost,miniStep:CONFIG.mini.costStep,miniGuarantee:CONFIG.mini.guaranteeEvery,miniMin:CONFIG.mini.guaranteeMin};
 const text=value=>value.replace(/\{\{(\w+)\}\}/g,(match,key)=>Object.hasOwn(vars,key)?vars[key]:match);
 $('v3').replaceChildren(...CONFIG.help.map(h=>{const d=document.createElement('details'),s=document.createElement('summary'),b=document.createElement('div');s.textContent=text(h.title);b.className='hb';b.style.whiteSpace='pre-line';b.textContent=text(h.body);d.append(s,b);return d}));
 const info=$('v4').querySelector('.info');info.textContent='Награды за плитки: '+Object.entries(CONFIG.game2048.rewards).map(([k,v])=>k+' — '+v+' 💎').join(', ')+'. Лимит: '+G48LIM+' 💎 в день.';
}
})().catch(error=>{const app=document.querySelector('.app');app.replaceChildren();const title=document.createElement('h2'),message=document.createElement('p');title.textContent='Игра недоступна';message.textContent=location.protocol==='file:'?'Откройте сайт через сервер: http://127.0.0.1:8000.':error.message;app.append(title,message);console.error(error);});
