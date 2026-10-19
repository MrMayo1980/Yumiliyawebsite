import {normalizeCardIds} from './card-ids.js';
import {normalizeFrameSettings} from './frames.js';
import {DEFAULT_APPEARANCE,DISPLAY_FONTS} from './appearance.js?v=archive-random-1';
export function validateDocument(doc, publish = false) {
  const fail = message => {throw Object.assign(new Error(message), {status:422});};
  const obj = (v,n) => {if(!v || typeof v!=='object' || Array.isArray(v)) fail(`${n}: требуется объект.`);};
  const text = (v,n,max=2000) => {if(typeof v!=='string'||v.length>max) fail(`${n}: недопустимый текст.`);};
  const num = (v,n,min=0,max=1000000,int=false) => {if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(int&&!Number.isInteger(v))) fail(`${n}: допустимо ${min}–${max}${int?' (целое число)':''}.`);};
  const bool = (v,n) => {if(typeof v!=='boolean') fail(`${n}: требуется переключатель.`);};
  const list = (v,n,max=2000) => {if(!Array.isArray(v)||v.length>max) fail(`${n}: недопустимый список.`);};
  const image = (v,n,empty=false) => {
    text(v,n,12*1024*1024);if(empty&&!v)return;
    if(/^(assets\/(?:gacha|media)|uploads)\/[a-zA-Z0-9_-]+\.(webp|png|jpe?g|gif|avif|mp4|webm|mov|ogg)$/i.test(v))return;
    if(/^data:image\/(png|jpeg|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/.test(v))return;
    try {const u=new URL(v);if(u.protocol==='https:'&&!u.username&&!u.password)return;}catch{}
    fail(`${n}: используйте HTTPS-ссылку или загруженный файл.`);
  };
  const frameImage=(value,name)=>{image(value,name,true);if(/\.(mp4|mov|webm|ogg)(?:[?#]|$)/i.test(value))fail(`${name}: выберите изображение с прозрачным центром.`);};
  obj(doc,'Документ');
  if(doc.appearance===undefined)doc={...doc,appearance:structuredClone(DEFAULT_APPEARANCE)};
  obj(doc.config,'Игра');obj(doc.gallery,'Архив');const c=doc.config;
  if(c.version!==1)fail('Неизвестная версия настроек.');text(c.title,'Название',100);if(!c.title.trim())fail('Укажите название игры.');image(c.back,'Рубашка');
  const settings=(s,n)=>{obj(s,n);for(const k of ['price','pityR','pityS','banner'])num(s[k],`${n}: ${k}`,0,1000000,true);for(const k of ['sr','r','money','bannerRate'])num(s[k],`${n}: ${k}`,0,100);bool(s.bannerGuarantee,n);if(s.sr+s.r+s.money>100.000001)fail(`${n}: сумма шансов превышает 100%.`);};
  settings(c.defaults,'Базовые шансы');list(c.cols,'Коллекции',200);list(c.cards,'Карты',3000);
  if(c.nextCardId!==undefined)num(c.nextCardId,'Следующий ID карты',1,Number.MAX_SAFE_INTEGER,true);
  const ids=new Set(),cardIds=new Set();
  for(const col of c.cols){obj(col,'Коллекция');text(col.id,'ID коллекции',64);if(!/^[a-zA-Z0-9_-]+$/.test(col.id)||ids.has(col.id))fail('ID коллекций должны быть уникальными (латиница, цифры, _ и -).');ids.add(col.id);text(col.name,'Название коллекции',200);if(!col.name.trim())fail('Укажите название коллекции.');if(col.desc!==undefined)text(col.desc,'Описание',2000);if(col.cover)image(col.cover,'Обложка');bool(col.enabled,'Коллекция');settings(col.settings,col.name);}
  for(const card of c.cards){obj(card,'Карта');num(card.id,'ID карты',1,Number.MAX_SAFE_INTEGER,true);if(cardIds.has(card.id))fail('ID карт должны быть уникальны.');cardIds.add(card.id);if(!ids.has(card.col))fail('Карта ссылается на неизвестную коллекцию.');text(card.name,'Название карты',200);if(!card.name.trim())fail('Укажите название карты.');if(!['N','R','SR'].includes(card.r))fail('Неизвестная редкость карты.');image(card.img,'Изображение карты',!publish);num(card.weight,'Вес карты',0.001,1000000);bool(card.enabled,'Карта');if(card.frame!==undefined)frameImage(card.frame,'Рамка карты');if(card.frameEnabled!==undefined)bool(card.frameEnabled,'Рамка карты');if(card.photo!==undefined){obj(card.photo,'Положение фото');num(card.photo.zoom,'Масштаб фото',1,4);num(card.photo.x,'Положение фото X',-100,100);num(card.photo.y,'Положение фото Y',-100,100);}}
  if(publish){if(!c.cols.some(x=>x.enabled))fail('Включите хотя бы одну коллекцию.');for(const col of c.cols.filter(x=>x.enabled)){const cards=c.cards.filter(x=>x.enabled&&x.col===col.id);if(!cards.some(x=>x.r==='N'))fail(`${col.name}: нужна хотя бы одна активная карта N.`);for(const [r,k] of [['R','r'],['SR','sr']])if(col.settings[k]>0&&!cards.some(x=>x.r===r))fail(`${col.name}: шанс ${r} задан, но активных карт ${r} нет.`);if(col.settings.banner&&!cards.some(x=>x.id===col.settings.banner&&x.r==='SR'))fail(`${col.name}: баннер должен ссылаться на активную SR-карту.`);}}
  obj(c.economy,'Экономика');for(const k of ['startingGems','startingFree','dailyFree'])num(c.economy[k],k,0,1000000,true);
  for(const k of ['shards','sellPrices']){obj(c.economy[k],k);for(const r of ['N','R','SR'])num(c.economy[k][r],`${k} ${r}`,0,1000000,true);}
  list(c.economy.moneyPrizes,'Денежные призы',100);if(!c.economy.moneyPrizes.length)fail('Добавьте денежный приз.');c.economy.moneyPrizes.forEach(x=>num(x,'Денежный приз',0,1000000,true));
  obj(c.mini,'Рулетка');bool(c.mini.enabled,'Рулетка');for(const k of ['baseCost','costStep','guaranteeEvery','guaranteeMin'])num(c.mini[k],k,0,1000000,true);list(c.mini.prizes,'Призы рулетки',100);if(!c.mini.prizes.length)fail('Добавьте приз рулетки.');for(const p of c.mini.prizes){if(!Array.isArray(p)||p.length!==2)fail('Приз рулетки: [сумма, вес].');num(p[0],'Сумма приза',0,1000000,true);num(p[1],'Вес приза',0.001,1000000);}if(c.mini.guaranteeEvery&&!c.mini.prizes.some(p=>p[0]>=c.mini.guaranteeMin))fail('Нет приза для гаранта рулетки.');
  obj(c.game2048,'2048');bool(c.game2048.enabled,'2048');num(c.game2048.dailyLimit,'Лимит 2048',0,1000000,true);obj(c.game2048.rewards,'Награды 2048');for(const [tile,value] of Object.entries(c.game2048.rewards)){if(!['4','8','16','32','64','128','256','512','1024','2048','4096','8192','16384','32768','65536'].includes(tile))fail('Награды 2048: укажите степень двойки от 4 до 65536.');num(value,'Награда 2048',0,1000000,true);}
  obj(c.effects,'Эффекты');for(const k of ['sound','flash','vibration'])bool(c.effects[k],k);num(c.effects.volume,'Громкость',0,1);for(const k of ['spinSeconds','multiSpinSeconds'])num(c.effects[k],k,0.2,30);
  obj(c.theme,'Оформление');for(const k of ['background','pill','button'])image(c.theme[k],k,true);for(const k of ['bg','panel','line','text','muted','accent','N','R','SR'])if(!/^#[0-9a-fA-F]{6}$/.test(c.theme[k]))fail(`${k}: нужен цвет #RRGGBB.`);if(!['Philosopher','Montserrat','Cormorant Garamond','system-ui'].includes(c.theme.font))fail('Выберите шрифт из списка.');num(c.theme.maxWidth,'Ширина',400,1800,true);num(c.theme.cardRadius,'Скругление',0,40,true);
  if(c.theme.frames!==undefined){obj(c.theme.frames,'Рамки карт');for(const key of Object.keys(c.theme.frames))if(!['N','R','SR'].includes(key))fail('Неизвестная редкость рамки.');for(const rarity of ['N','R','SR'])frameImage(c.theme.frames[rarity],`Рамка ${rarity}`);}
  if(c.theme.frameLibraryVersion!==undefined&&c.theme.frameLibraryVersion!==1)fail('Неизвестная версия готовых рамок.');
  if(c.theme.frameInset!==undefined)num(c.theme.frameInset,'Отступ внутри рамки',0,30);
  obj(c.labels,'Подписи');for(const key of ['summon','collection','game2048','help','pull','again','close','skip','dailyBonus','collectionDone','mini'])text(c.labels[key],key,150);
  list(c.help,'Справка',100);for(const h of c.help){obj(h,'Справка');text(h.title,'Заголовок',200);text(h.body,'Текст справки',20000);}
  obj(doc.appearance,'Оформление');obj(doc.appearance.site,'Оформление сайта');obj(doc.appearance.login,'Экран входа');
  doc={...doc,appearance:{...doc.appearance,site:{...DEFAULT_APPEARANCE.site,...doc.appearance.site}}};
  const site=doc.appearance.site,login=doc.appearance.login;
  for(const section of ['site','login'])for(const key of Object.keys(doc.appearance[section]))if(!Object.hasOwn(DEFAULT_APPEARANCE[section],key))fail(`Оформление ${section}: неизвестное поле ${key}.`);
  const color=(value,name)=>{if(!/^#[0-9a-fA-F]{6}$/.test(value))fail(`${name}: нужен цвет #RRGGBB.`);};
  const choice=(value,values,name)=>{if(!values.includes(value))fail(`${name}: выберите значение из списка.`);};
  const art=(value,name)=>{image(value,name,true);if(/\.(mp4|mov|webm|ogg)(?:[?#]|$)/i.test(value))fail(`${name}: выберите изображение.`);};
  for(const key of ['title','name','subtitle','archivesLabel','gachaLabel','adminLabel','footer','emptyText','emptyIcon','loadingText','filterAll','filterImage','filterGif','filterVideo','closeLabel'])text(site[key],`Сайт: ${key}`,key==='footer'||key==='subtitle'?1000:200);
  if(!site.name.trim()||!site.adminLabel.trim())fail('Укажите название сайта и подпись кнопки администратора.');
  for(const key of ['bg','panel','accent','text','muted','glow1','glow2'])color(site[key],`Сайт: ${key}`);
  for(const key of ['randomLabel','randomTitle','randomSpinLabel']){text(site[key],`Рулетка: ${key}`,200);if(!site[key].trim())fail('Укажите подписи рулетки архива.');}
  for(const key of ['randomColor','randomTextColor'])color(site[key],`Рулетка: ${key}`);
  for(const key of ['randomEnabled','randomRespectFilter'])bool(site[key],`Рулетка: ${key}`);
  num(site.randomDuration,'Длительность рулетки, мс',1000,10000,true);
  art(site.background,'Фон сайта');for(const key of ['titleFont','bodyFont'])choice(site[key],DISPLAY_FONTS,`Сайт: ${key}`);
  choice(site.layout,['masonry','grid'],'Макет галереи');choice(site.aspectRatio,['auto','1/1','4/5','3/4','16/9'],'Формат фотографий');
  for(const [key,min,max] of [['columns',1,6],['mobileColumns',1,2],['gap',0,40],['cardRadius',0,40],['contentWidth',700,2000],['headerPadding',16,120],['titleSize',32,120]])num(site[key],`Сайт: ${key}`,min,max,true);
  for(const key of ['showSubtitle','showDecorations','showFilters','showFooter','hoverZoom','autoplayVideos'])bool(site[key],`Сайт: ${key}`);
  for(const key of ['pageTitle','brand','brandTag','tagline','headline','description','backLabel','eyebrow','heading','intro','passwordLabel','submitLabel','sessionNote','invalidPasswordMessage','symbol'])text(login[key],`Вход: ${key}`,key==='description'||key==='headline'?2000:500);
  for(const key of ['brand','heading','passwordLabel','submitLabel'])if(!login[key].trim())fail(`Вход: ${key} не может быть пустым.`);
  for(const key of ['bg','panel','accent','text','muted','hero'])color(login[key],`Вход: ${key}`);
  for(const key of ['artwork','background','logo'])art(login[key],`Вход: ${key}`);
  for(const key of ['bodyFont','titleFont'])choice(login[key],DISPLAY_FONTS,`Вход: ${key}`);
  choice(login.layout,['split','centered'],'Макет экрана входа');bool(login.showStory,'Иллюстрация экрана входа');
  list(doc.gallery.items,'Архив',10000);list(doc.gallery.deleted,'Скрытые файлы',20000);
  const urls=new Set();for(const item of doc.gallery.items){obj(item,'Файл');image(item.url,'Ссылка файла');if(urls.has(item.url))fail('В архиве есть повторяющиеся ссылки.');urls.add(item.url);if(!['image','gif','video'].includes(item.type))fail('Неизвестный тип файла.');text(item.name||'','Имя файла',300);}
  for(const url of doc.gallery.deleted)image(url,'Скрытая ссылка');
  const normalized=structuredClone(doc);normalizeFrameSettings(normalized.config);normalizeCardIds(normalized.config);
  return normalized;
}
