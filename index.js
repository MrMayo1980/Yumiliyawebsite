import {isPages,loadPublished,loadPreview,providePreview} from './hosting.js';
import {loadLegacyGallery,mergeGallery,mediaType,safeMediaUrl} from './gallery.js';
import {DEFAULT_APPEARANCE,loadAppearance,applySiteAppearance} from './appearance.js';
const preview=new URLSearchParams(location.search).has('preview');
let site=structuredClone(DEFAULT_APPEARANCE.site);

let allItems = [];
let activeFilter = 'all';
let previewDocument;
if(isPages()&&preview){previewDocument=await loadPreview();providePreview(()=>previewDocument,source=>source===document.getElementById('gacha-frame').contentWindow);}

document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('dragstart', e => e.preventDefault());

async function fetchMedia() {
  const loading=document.getElementById('loading');loading.style.display='block';
  document.getElementById('gallery-error').hidden=true;
  const results=await Promise.allSettled([
    loadLegacyGallery(),
    isPages()?(preview?Promise.resolve(previewDocument.gallery):loadPublished().then(state=>state.published.gallery)):fetch(preview?'api/admin/gallery':'api/gallery',{cache:'no-store'}).then(r=>r.ok?r.json():{items:[],deleted:[]}).catch(()=>({items:[],deleted:[]}))
  ]);
  const legacy=results[0].status==='fulfilled'?results[0].value:[];
  const overlay=results[1].status==='fulfilled'?results[1].value:{items:[],deleted:[]};
  allItems=mergeGallery(legacy,overlay).filter(item=>safeMediaUrl(item.url));
  if(results[0].status==='rejected')document.getElementById('gallery-error').hidden=false;
  render();
}

function getType(item) { return mediaType(item); }

function render() {
  document.getElementById('loading').style.display = 'none';
  const gallery = document.getElementById('gallery');
  const empty = document.getElementById('empty');
  const filtered = activeFilter === 'all' ? allItems : allItems.filter(i => getType(i) === activeFilter);
  if (!filtered.length) { gallery.innerHTML = ''; empty.classList.add('visible'); return; }
  empty.classList.remove('visible');
  gallery.innerHTML = '';
  filtered.forEach(item => {
    const type = getType(item);
    const div = document.createElement('div');
    div.className = 'item';
    const mediaEl=document.createElement(type==='video'?'video':'img');
    mediaEl.src=safeMediaUrl(item.url);
    if(type==='video'){mediaEl.muted=true;mediaEl.loop=true;mediaEl.autoplay=site.autoplayVideos&&document.body.dataset.section==='archives';mediaEl.playsInline=true;}
    else{mediaEl.alt=item.name||'';mediaEl.loading='lazy';mediaEl.draggable=false;}
    div.appendChild(mediaEl);
    if(type==='gif'){const badge=document.createElement('div');badge.className='gif-badge';badge.textContent='GIF';div.appendChild(badge);}
    const overlay=document.createElement('div');overlay.className='overlay';div.appendChild(overlay);
    div.addEventListener('click', () => openLightbox(item.url, type));
    gallery.appendChild(div);
  });
}

function openLightbox(url, type) {
  const img = document.getElementById('lightbox-img');
  const vid = document.getElementById('lightbox-vid');
  img.style.display = 'none'; vid.style.display = 'none';
  if (type === 'video') { document.getElementById('lightbox-vid-src').src = url; vid.load(); vid.style.display = 'block'; }
  else { img.src = url; img.style.display = 'block'; }
  document.getElementById('lightbox').classList.add('open');
}

const closeLB = () => { document.getElementById('lightbox').classList.remove('open'); document.getElementById('lightbox-vid').pause(); };
document.getElementById('lightbox-close').addEventListener('click', closeLB);
document.getElementById('lightbox').addEventListener('click', e => { if (e.target === document.getElementById('lightbox')) closeLB(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLB(); });

document.querySelectorAll('.filter-pill button').forEach(btn => {
  btn.addEventListener('click', () => {
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
    closeLB();
    const frame = document.getElementById('gacha-frame');
    if (!frame.hasAttribute('src')) frame.src = frame.dataset.src+(preview?'?preview=1':'');
  }
  document.querySelectorAll('#gallery video').forEach(video => {
    if (section === 'gacha') video.pause();
    else if(site.autoplayVideos)video.play().catch(() => {});
  });
  updateHeaderHeight();
}

function updateHeaderHeight() {
  document.documentElement.style.setProperty('--site-header-height', `${document.querySelector('header').getBoundingClientRect().height}px`);
}

new ResizeObserver(updateHeaderHeight).observe(document.querySelector('header'));
window.addEventListener('hashchange', showSection);
async function initialize(){
  try{site=(await loadAppearance(preview)).site;}catch(error){console.error(error);}
  applySiteAppearance(site);
  const admin=document.getElementById('admin-link');
  if(preview){admin.href='admin.html?login-preview=1';admin.target='_blank';admin.rel='noopener';}
  showSection();
}
await initialize();
document.getElementById('retry-gallery').addEventListener('click',fetchMedia);
fetchMedia();
