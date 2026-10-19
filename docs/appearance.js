import {projectDocument,workspaceFromSearch} from './sections.js?v=drugie-1';
import {isPages,loadPublished,loadPreview,localMediaUrl,resolvePendingAsset} from './hosting.js';
// Public display settings only. Authentication and permissions stay on the server.
export const DISPLAY_FONTS=['Cormorant Garamond','Montserrat','Philosopher','system-ui'];
export const DEFAULT_APPEARANCE={
  site:{
    title:'Юмилия — Архив и гача',name:'Юмилия',subtitle:'Архив контента · Карточная гача',archivesLabel:'Архив',gachaLabel:'Гача',adminLabel:'Админ',footer:'🌸 Юмилия · Все права защищены',emptyText:'Фотографии появятся здесь',emptyIcon:'🌸',loadingText:'Загрузка — —',filterAll:'Все',filterImage:'Фото',filterGif:'GIF',filterVideo:'Видео',closeLabel:'✕ закрыть',
    randomEnabled:true,randomLabel:'✦ Случайный файл',randomTitle:'Рулетка архива',randomSpinLabel:'Выбираем случайный файл…',randomColor:'#e8649a',randomTextColor:'#ffffff',randomDuration:3000,randomRespectFilter:false,
    bg:'#0e0d18',panel:'#13112a',accent:'#e8649a',text:'#e8e0f0',muted:'#a094af',glow1:'#1a0e2e',glow2:'#1a0826',background:'',titleFont:'Cormorant Garamond',bodyFont:'Montserrat',
    layout:'masonry',columns:4,mobileColumns:1,gap:10,cardRadius:6,contentWidth:1400,headerPadding:56,titleSize:88,aspectRatio:'auto',showSubtitle:true,showDecorations:true,showFilters:true,showFooter:true,hoverZoom:true,autoplayVideos:true
  },
  login:{
    pageTitle:'Юмилия — Студия',brand:'Юмилия',brandTag:'CONTENT STUDIO',tagline:'ВАША КОЛЛЕКЦИЯ. ВАШИ ПРАВИЛА.',headline:'Маленький мир,\nкоторый создаёте вы.',description:'Архив, карточные коллекции и все настройки игры — в одной студии.',backLabel:'Открыть сайт ↗',eyebrow:'ДОБРО ПОЖАЛОВАТЬ',heading:'Вход в студию',intro:'Войдите, чтобы управлять архивом и игрой.',passwordLabel:'Пароль',submitLabel:'Войти',sessionNote:'Сеанс защищён и завершается через 8 часов.',invalidPasswordMessage:'Неверный пароль.',symbol:'✳',artwork:'',background:'',logo:'',
    bg:'#100e18',panel:'#191623',accent:'#ec83af',text:'#f2edf7',muted:'#b2a4bd',hero:'#42223d',bodyFont:'Montserrat',titleFont:'Cormorant Garamond',layout:'split',showStory:true
  }
};
export async function loadAppearance(preview=false){
  if(isPages())return projectDocument(preview?await loadPreview():(await loadPublished()).published,workspaceFromSearch(location.search)).appearance;
  const response=await fetch((preview?'api/admin/appearance':'api/appearance')+(workspaceFromSearch(location.search)==='drugie'?'?section=drugie':''),{cache:'no-store'});
  if(!response.ok){if(preview)throw new Error('Войдите в студию для предпросмотра.');return structuredClone(DEFAULT_APPEARANCE);}
  return response.json();
}
export function displayImageUrl(value){
  if(!value)return '';
  if(/^data:image\/(png|jpeg|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/.test(value))return value;
  return localMediaUrl(value,{imagesOnly:true});
}
const fontValue=value=>value==='system-ui'?'system-ui':JSON.stringify(value);
const text=(selector,value,root=document)=>{const el=root.querySelector(selector);if(el)el.textContent=value;};
function imageVar(style,key,value){const url=displayImageUrl(value);style.setProperty(key,url?`url(${JSON.stringify(url)})`:'none');}
export function applySiteAppearance(site){
  site={...DEFAULT_APPEARANCE.site,...site};
  document.title=site.title;const root=document.documentElement.style;
  for(const key of ['bg','panel','accent','text','muted','glow1','glow2'])root.setProperty('--site-'+key,site[key]);
  root.setProperty('--site-title-font',fontValue(site.titleFont));root.setProperty('--site-body-font',fontValue(site.bodyFont));
  for(const [key,value] of Object.entries({'width':site.contentWidth+'px','gap':site.gap+'px','radius':site.cardRadius+'px','header-padding':site.headerPadding+'px','title-size':site.titleSize+'px','columns':site.columns,'tablet-columns':Math.min(3,site.columns),'small-columns':Math.min(2,site.columns),'mobile-columns':site.mobileColumns,'ratio':site.aspectRatio}))root.setProperty('--site-'+key,String(value));
  root.setProperty('--random-color',site.randomColor);root.setProperty('--random-text',site.randomTextColor);
  const random=document.querySelector('#archive-random');if(random){random.hidden=!site.randomEnabled;random.textContent=site.randomLabel;}
  imageVar(root,'--site-background',site.background);
  document.body.dataset.galleryLayout=site.layout;document.body.dataset.galleryRatio=site.aspectRatio;document.body.dataset.hoverZoom=String(site.hoverZoom);
  for(const [selector,key] of Object.entries({'h1':'name','.subtitle':'subtitle','#archives-link':'archivesLabel','#gacha-link':'gachaLabel','#admin-link':'adminLabel','footer':'footer','#empty p':'emptyText','#empty .flower':'emptyIcon','#loading':'loadingText','#lightbox-close':'closeLabel','[data-filter="all"]':'filterAll','[data-filter="image"]':'filterImage','[data-filter="gif"]':'filterGif','[data-filter="video"]':'filterVideo'}))text(selector,site[key]);
  document.querySelector('.subtitle').hidden=!site.showSubtitle;document.querySelectorAll('.tline,.divider').forEach(el=>el.hidden=!site.showDecorations);document.querySelector('.filter-pill').hidden=!site.showFilters;document.querySelector('footer').hidden=!site.showFooter;
}
export function applyLoginAppearance(login){
  const screen=document.getElementById('login-screen');if(!screen)return;
  for(const key of ['bg','panel','accent','text','muted','hero'])screen.style.setProperty('--login-'+key,login[key]);
  screen.style.setProperty('--login-body-font',fontValue(login.bodyFont));screen.style.setProperty('--login-title-font',fontValue(login.titleFont));imageVar(screen.style,'--login-background',login.background);
  screen.dataset.layout=login.layout;screen.dataset.story=String(login.showStory);
  for(const [selector,key] of Object.entries({'[data-login="brand"]':'brand','[data-login="brandTag"]':'brandTag','[data-login="tagline"]':'tagline','[data-login="headline"]':'headline','[data-login="description"]':'description','[data-login="back"]':'backLabel','[data-login="eyebrow"]':'eyebrow','[data-login="heading"]':'heading','[data-login="intro"]':'intro','[data-login="passwordLabel"]':'passwordLabel','[data-login="submitLabel"]':'submitLabel','[data-login="note"]':'sessionNote','[data-login="symbol"]':'symbol'}))text(selector,login[key],screen);
  const art=screen.querySelector('[data-login="artwork"]'),logo=screen.querySelector('[data-login="logo"]');
  for(const [el,value] of [[art,login.artwork],[logo,login.logo]]){const src=displayImageUrl(value);el.hidden=!src;if(src)el.src=src;else el.removeAttribute('src');}
  screen.querySelector('[data-login="symbol"]').hidden=!!displayImageUrl(login.artwork);
  if(!screen.hidden)document.title=login.pageTitle;
}
