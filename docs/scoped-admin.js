import {projectDocument,replaceSection} from './sections.js?v=publish-fix-1';
// Both sections publish atomically; the editor only receives its selected section.
export function createScopedAdminApi(rawApi,getWorkspace){
 let fullDraft;
 return async(path,options={})=>{
  const workspace=getWorkspace();let next;
  if(path==='api/admin/draft'&&options.method==='PUT'){
   next=replaceSection(fullDraft,workspace,options.data.document);
   options={...options,data:{...options.data,document:next}};
  }
  if(path==='api/admin/publish'&&options.method==='POST')options={...options,data:{...options.data,workspace}};
  const result=await rawApi(path,options);
  if(next)fullDraft=structuredClone(next);
  if(path==='api/admin/state'){
   fullDraft=structuredClone(result.draft);
   return {...result,draft:projectDocument(result.draft,workspace),...(result.basePublished?{basePublished:projectDocument(result.basePublished,workspace)}:{})};
  }
  if((/^api\/admin\/history\/\d+$/.test(path)||path==='api/admin/recovery')&&result.document)return {...result,document:projectDocument(result.document,workspace)};
  return result;
 };
}
