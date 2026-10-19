export const workspaceFromSearch=search=>new URLSearchParams(search).get('section')==='drugie'?'drugie':'main';
export const workspaceQuery=workspace=>workspace==='drugie'?'section=drugie':'';
export const playerStorage=(workspace,preview=false)=>(preview?'gacha_admin_preview':'gacha3')+(workspace==='drugie'?'_drugie':'');
export const balanceNotice=workspace=>'yumiliya-local-balance'+(workspace==='drugie'?'-drugie':'');
export function projectDocument(document,workspace='main'){
 const selected=workspace==='drugie'?(document.sections?.drugie||document):document;
 return {config:selected.config,gallery:selected.gallery,appearance:selected.appearance};
}
export function emptySection(document){
 const copy=structuredClone(projectDocument(document));
 copy.config.title='Другие девушки — Гача';
 copy.config.cols=[];copy.config.cards=[];copy.config.help=[];
 copy.gallery={items:[],deleted:[],includeLegacy:false};
 if(copy.appearance){copy.appearance.site.title='Другие девушки — Архив и гача';copy.appearance.site.name='Другие девушки';copy.appearance.login.brand='Другие девушки';copy.appearance.login.pageTitle='Другие девушки — Студия';}
 if(copy.appearance)copy.appearance.site.footer='🌸 Другие девушки · Все права защищены';
 return copy;
}
export function replaceSection(document,workspace,edited){
 if(!document)throw new Error('Сначала загрузите актуальный черновик.');
 const next=structuredClone(document),selected=structuredClone(projectDocument(edited));
 if(workspace==='drugie')next.sections={...next.sections,drugie:selected};
 else Object.assign(next,selected);
 return next;
}
