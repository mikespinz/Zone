(()=>{
  'use strict';
  if(window.__CC_RUNTIME_PATCHED__) return;
  window.__CC_RUNTIME_PATCHED__='2.3.2-livefix';

  const VERSION='2.3.1';
  const SOURCE_ROLE_NORMALIZE=new Map([[25,7],[50,6]]);

  function normalizeSourceRoles(){
    const data=window.CC_DATA;
    if(!data?.wrestlers?.length) return 0;
    let changed=0;
    for(const w of data.wrestlers){
      if(!Array.isArray(w.positions)) continue;
      for(let i=0;i<w.positions.length;i++){
        const raw=Number(w.positions[i]);
        if(SOURCE_ROLE_NORMALIZE.has(raw)){
          w.positions[i]=SOURCE_ROLE_NORMALIZE.get(raw);
          changed++;
        }
      }
    }
    return changed;
  }

  function fixSavedVersionText(){
    let changed=0;
    for(let i=0;i<localStorage.length;i++){
      const key=localStorage.key(i);
      if(!key) continue;
      const raw=localStorage.getItem(key);
      if(!raw || (!raw.includes('Creative Control 2.2') && !raw.includes('CREATIVE CONTROL 2.2'))) continue;
      const next=raw
        .replaceAll('Creative Control 2.2',`Creative Control ${VERSION}`)
        .replaceAll('CREATIVE CONTROL 2.2',`CREATIVE CONTROL ${VERSION}`);
      if(next!==raw){try{localStorage.setItem(key,next);changed++}catch{}}
    }
    return changed;
  }

  function cleanRenderedText(root=document){
    let changed=0;
    const walker=document.createTreeWalker(root.body||root,NodeFilter.SHOW_TEXT);
    const bad=[];
    while(walker.nextNode()){
      const n=walker.currentNode;
      const text=n.nodeValue||'';
      if(!text) continue;
      let next=text;
      next=next.replaceAll('Creative Control 2.2',`Creative Control ${VERSION}`)
               .replaceAll('CREATIVE CONTROL 2.2',`CREATIVE CONTROL ${VERSION}`);
      next=next.replace(/\bundefined\s*([•·])/g,'Unassigned $1');
      if(next!==text){n.nodeValue=next;changed++}
      if(/\b(?:undefined|NaN)\b|�/.test(next)) bad.push(next.trim().slice(0,180));
    }
    return {changed,bad:[...new Set(bad)].slice(0,30)};
  }

  function refreshCurrentView(){
    try{
      if(!document.getElementById('appShell')?.hidden){
        const active=document.querySelector('#nav button[data-view].active');
        if(active) active.click();
      }
    }catch{}
  }

  function audit(){
    const data=window.CC_DATA||{};
    const text=(document.body?.innerText||'');
    const bad=[];
    if(/\bundefined\b/.test(text)) bad.push('visible undefined');
    if(/\bNaN\b/.test(text)) bad.push('visible NaN');
    if(text.includes('�')) bad.push('replacement character');
    const ids=(data.wrestlers||[]).map(w=>w.id), duplicateIds=ids.length-new Set(ids).size;
    const promoIds=new Set((data.promotions||[]).map(p=>+p.id));
    const invalidEmployers=(data.wrestlers||[]).reduce((n,w)=>n+(w.employers||[]).filter(Boolean).filter(id=>!promoIds.has(+id)).length,0);
    const unresolvedPositions=(data.wrestlers||[]).reduce((n,w)=>n+(w.positions||[]).filter(x=>![0,1,2,3,4,5,6,7].includes(+x)).length,0);
    const report={patch:window.__CC_RUNTIME_PATCHED__,engine:window.__CC_TEST__?.version||'loading',workers:(data.wrestlers||[]).length,promotions:(data.promotions||[]).length,duplicateWorkerIds:duplicateIds,invalidEmployerRefs:invalidEmployers,unresolvedPositionCodes:unresolvedPositions,visibleTextIssues:bad,timestamp:new Date().toISOString()};
    window.__CC_LIVE_QA__=report;
    return report;
  }

  function apply(){
    const roles=normalizeSourceRoles();
    const saves=fixSavedVersionText();
    refreshCurrentView();
    setTimeout(()=>{
      const cleaned=cleanRenderedText();
      const report=audit();
      report.normalizedRoleSlots=roles;
      report.updatedSaveSlots=saves;
      report.cleanedTextNodes=cleaned.changed;
      report.visibleTextIssues=[...new Set([...(report.visibleTextIssues||[]),...cleaned.bad])];
      window.__CC_LIVE_QA__=report;
      console.info('[CREATIVE CONTROL QA]',report);
    },120);
  }

  const observer=new MutationObserver(()=>cleanRenderedText());
  observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(window.CC_DATA?.wrestlers?.length && window.__CC_TEST__){clearInterval(timer);apply()}
    else if(tries>200){clearInterval(timer);cleanRenderedText();audit()}
  },50);
})();
