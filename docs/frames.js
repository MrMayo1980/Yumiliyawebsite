// Reuse the original artwork files: frames.css hides their picture areas.
export const FRAME_PRESETS = {
  "N": {
    "label": "N · Серебро",
    "src": "assets/gacha/8fc111987e4b70f595eb.webp"
  },
  "R": {
    "label": "R · Сапфир",
    "src": "assets/gacha/9fe8fd284fe08cada5a0.webp"
  },
  "SR": {
    "label": "SR · Золото и розовый",
    "src": "assets/gacha/24c240745ffdf28311e7.webp"
  }
};
const ORIGINAL_FRAMED_ART = new Set([
  "assets/gacha/8fc111987e4b70f595eb.webp",
  "assets/gacha/0f7d79dc9b3940087b2c.webp",
  "assets/gacha/f22d9fe5f884cf7baad5.webp",
  "assets/gacha/9fe8fd284fe08cada5a0.webp",
  "assets/gacha/02053729c6cc54248cb0.webp",
  "assets/gacha/0ec851f963090caee930.webp",
  "assets/gacha/24c240745ffdf28311e7.webp",
  "assets/gacha/c02b67971c7ce6c73aad.webp",
  "assets/gacha/6fd295b71e28a4bf5b6f.webp",
  "assets/gacha/8fd793ff61ef4cc79753.webp",
  "assets/gacha/cfa3a9cd538061e8ab07.webp",
  "assets/gacha/36648b996172d3da79fb.webp",
  "assets/gacha/2f423316fe106a5e6306.webp",
  "assets/gacha/75f71c0ff4b8683495b2.webp",
  "assets/gacha/6da9f2f1b6361b3c4056.webp",
  "assets/gacha/cfcbfbb781bf7c6a18ce.webp",
  "assets/gacha/470e2c407ad37e4727f9.webp",
  "assets/gacha/00648162cbdc86d10768.webp"
]);
export const framePreset = src => Object.entries(FRAME_PRESETS).find(([,preset])=>preset.src===src)?.[0] || '';
export function normalizeFrameSettings(config){
 const theme=config.theme;
 theme.frames??={N:'',R:'',SR:''};theme.frameInset??=4;
 // Migrate empty controls once; later clearing a frame remains an intentional choice.
 if(theme.frameLibraryVersion===undefined){
  for(const rarity of ['N','R','SR'])if(!theme.frames[rarity])theme.frames[rarity]=FRAME_PRESETS[rarity].src;
  theme.frameLibraryVersion=1;
 }
 for(const card of config.cards){card.frame??='';card.frameEnabled??=true;card.photo??={zoom:1,x:0,y:0};}
 return config;
}
export function cardFrame(card,theme){
 if(card.frameEnabled===false)return '';
 const src=card.frame||theme.frames?.[card.r]||'';
 // Original cards already contain their decoration. New/replaced art inherits a frame.
 if(!card.frame&&framePreset(src)&&ORIGINAL_FRAMED_ART.has(card.img))return '';
 return src;
}

// Keep CSS values numeric even when loading a hand-edited/static configuration.
export function photoSettings(card){
 const bounded=(value,fallback,min,max)=>typeof value==='number'&&Number.isFinite(value)?Math.min(max,Math.max(min,value)):fallback;
 return {zoom:bounded(card.photo?.zoom,1,1,4),x:bounded(card.photo?.x,0,-100,100),y:bounded(card.photo?.y,0,-100,100)};
}
export function photoStyle(card){
 const {zoom,x,y}=photoSettings(card);
 return `--photo-zoom:${zoom};--photo-x:${x}%;--photo-y:${y}%;`;
}
