import {workspaceFromSearch,projectDocument} from './sections.js?v=drugie-empty-1';
import {createArchiveRoulette,randomPool} from './archive-random.js?v=archive-random-1';
import {isPages,loadPublished,loadPreview,providePreview} from './hosting.js';
import {loadLegacyGallery,mergeGallery,mediaType,safeMediaUrl,createVideoLoader} from './gallery.js?v=drugie-empty-1';
import {DEFAULT_APPEARANCE,loadAppearance,applySiteAppearance} from './appearance.js?v=drugie-empty-1';
const preview=new URLSearchParams(location.search).has('preview'),workspace=workspaceFromSearch(location.search);
const sectionSuffix=workspace==='drugie'?'section=drugie':'';
let site=structuredClone(DEFAULT_APPEARANCE.site);

let allItems = [];
let activeFilter = 'all';
let previewDocument,galleryLoaded=false,galleryRequest;
const videoLoader=createVideoLoader({isActive:()=>document.body.dataset.section==='archives'&&!document.hidden&&!document.getElementById('lightbox').classList.contains('open')&&!document.getElementById('archive-roulette').open,autoplay:()=>site.autoplayVideos});
const roulette=createArchiveRoulette({items:()=>randomPool(allItems,activeFilter,site.randomRespectFilter),settings:()=>site,openMedia:openLightbox,onChange:()=>videoLoader.update()});
document.addEventListener('visibilitychange',()=>videoLoader.update());
if(isPages()&&preview){previewDocument=await loadPreview();providePreview(()=>previewDocument,source=>source===document.getElementById('gacha-frame').contentWindow);}

document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('dragstart', e => e.preventDefault());

async function fetchMedia(){
 if(galleryRequest)return galleryRequest;
 galleryRequest=loadMedia();
 try{await galleryRequest;}finally{galleryRequest=null;}
}
async function loadMedia() {
  const loading=document.getElementById('loading');loading.style.display='block';
  document.getElementById('gallery-error').hidden=true;
  const results=await Promise.allSettled([
    loadLegacyGallery(),
    isPages()?(preview?Promise.resolve(projectDocument(previewDocument,workspace).gallery):loadPublished().then(state=>projectDocument(state.published,workspace).gallery)):fetch((preview?'api/admin/gallery':'api/gallery')+(sectionSuffix?'?'+sectionSuffix:''),{cache:'no-store'}).then(r=>r.ok?r.json():{items:[],deleted:[]}).catch(()=>({items:[],deleted:[]}))
  ]);
  const legacy=results[0].status==='fulfilled'?results[0].value:[];
  const overlay=results[1].status==='fulfilled'?results[1].value:{items:[],deleted:[]};
  allItems=mergeGallery(legacy,overlay).filter(item=>safeMediaUrl(item.url));
  if(results[0].status==='rejected')document.getElementById('gallery-error').hidden=false;
  galleryLoaded=true;render();
}

function getType(item) { return mediaType(item); }

function render() {
  document.getElementById('loading').style.display = 'none';
  const gallery = document.getElementById('gallery');
  const empty = document.getElementById('empty');
  const filtered = activeFilter === 'all' ? allItems : allItems.filter(i => getType(i) === activeFilter);
  roulette.update();videoLoader.reset();
  if (!filtered.length) { gallery.innerHTML = ''; empty.classList.add('visible'); return; }
  empty.classList.remove('visible');
  const fragment=document.createDocumentFragment(),videos=[];
  filtered.forEach(item => {
    const type=getType(item),url=safeMediaUrl(item.url);
    const div = document.createElement('div');
    div.className = 'item';
    const mediaEl=document.createElement(type==='video'?'video':'img');
    // Reserve space before loading so native image lazy loading sees the real viewport.
    mediaEl.width=600;mediaEl.height=800;
    if(type==='video')videos.push([mediaEl,url]);
    else mediaEl.src=url;
    if(type==='video'){mediaEl.muted=true;mediaEl.loop=true;mediaEl.preload='none';mediaEl.playsInline=true;}
    else{mediaEl.alt=item.name||'';mediaEl.loading='lazy';mediaEl.decoding='async';mediaEl.draggable=false;}
    div.appendChild(mediaEl);
    if(type==='gif'){const badge=document.createElement('div');badge.className='gif-badge';badge.textContent='GIF';div.appendChild(badge);}
    const overlay=document.createElement('div');overlay.className='overlay';div.appendChild(overlay);
    div.dataset.url=url;div.dataset.type=type;
    fragment.appendChild(div);
  });
  gallery.replaceChildren(fragment);
  for(const [video,url] of videos)videoLoader.observe(video,url);
}
document.getElementById('gallery').addEventListener('click',event=>{const item=event.target.closest('.item');if(item)openLightbox(item.dataset.url,item.dataset.type);});

function openLightbox(url, type) {
  const img = document.getElementById('lightbox-img');
  const vid = document.getElementById('lightbox-vid');
  img.style.display = 'none'; vid.style.display = 'none';
  if (type === 'video') { document.getElementById('lightbox-vid-src').src = url; vid.load(); vid.style.display = 'block'; }
  else { img.src = url; img.style.display = 'block'; }
  document.getElementById('lightbox').classList.add('open');videoLoader.update();
}

const closeLB=()=>{
 document.getElementById('lightbox').classList.remove('open');
 const video=document.getElementById('lightbox-vid'),source=document.getElementById('lightbox-vid-src');video.pause();
 if(source.hasAttribute('src')){source.removeAttribute('src');video.load();}
 document.getElementById('lightbox-img').removeAttribute('src');videoLoader.update();
};
document.getElementById('lightbox-close').addEventListener('click', closeLB);
document.getElementById('lightbox').addEventListener('click', e => { if (e.target === document.getElementById('lightbox')) closeLB(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLB(); });

document.querySelectorAll('.filter-pill button').forEach(btn => {
  btn.addEventListener('click', () => {
    if(activeFilter===btn.dataset.filter)return;
    document.querySelectorAll('.filter-pill button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    render();
  });
});

function showSection() {
  const section = location.hash === '#gacha' ? 'gacha' : 'archives';
  document.body.dataset.section = section;
  ['archives', 'gacha'].forEach(name => {
    document.getElementById(`${name}-panel`).hidden = name !== section;
    const link = document.getElementById(`${name}-link`);
    if (name === section) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (section === 'gacha') {
    roulette.cancel();closeLB();
    const frame = document.getElementById('gacha-frame');
    if (!frame.hasAttribute('src')) frame.src = frame.dataset.src+([sectionSuffix,preview?'preview=1':''].filter(Boolean).length?(frame.dataset.src.includes('?')?'&':'?')+[sectionSuffix,preview?'preview=1':''].filter(Boolean).join('&'):'');
    else if(!preview)frame.contentWindow?.postMessage({type:'yumiliya-refresh-game'},location.origin);
  }
  if(section==='archives'&&!galleryLoaded)fetchMedia();
  videoLoader.update();
  updateHeaderHeight();
}

function updateHeaderHeight() {
  const style=document.documentElement.style,value=`${document.querySelector('header').getBoundingClientRect().height}px`;
  if(style.getPropertyValue('--site-header-height')!==value)style.setProperty('--site-header-height',value);
}

new ResizeObserver(updateHeaderHeight).observe(document.querySelector('header'));
window.addEventListener('hashchange', showSection);
async function initialize(){
  try{site={...DEFAULT_APPEARANCE.site,...(await loadAppearance(preview)).site};}catch(error){console.error(error);}
  applySiteAppearance(site);roulette.update();
  for(const name of ['main','drugie']){const link=document.getElementById(name+'-workspace-link');if(name===workspace)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
  const admin=document.getElementById('admin-link');admin.href='admin.html'+(sectionSuffix?'?'+sectionSuffix:'');
  const frame=document.getElementById('gacha-frame');frame.title='Карточная гача — '+site.name;
  if(preview){admin.href='admin.html?login-preview=1'+(sectionSuffix?'&'+sectionSuffix:'');admin.target='_blank';admin.rel='noopener';}
  showSection();
}
await initialize();
document.getElementById('retry-gallery').addEventListener('click',fetchMedia);
