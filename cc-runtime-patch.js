(()=>{
  'use strict';
  if(window.__CC_RUNTIME_PATCHED__) return;
  window.__CC_RUNTIME_PATCHED__='2.3.3-encodingfix';

  const VERSION='2.3.1';
  const SOURCE_ROLE_NORMALIZE=new Map([[25,7],[50,6]]); // legacy DAT -> game roles

  const CP1252_BYTES=new Map([
    [0x20ac,0x80],[0x0081,0x81],[0x201a,0x82],[0x0192,0x83],[0x201e,0x84],[0x2026,0x85],[0x2020,0x86],[0x2021,0x87],
    [0x02c6,0x88],[0x2030,0x89],[0x0160,0x8a],[0x2039,0x8b],[0x0152,0x8c],[0x008d,0x8d],[0x017d,0x8e],[0x008f,0x8f],
    [0x0090,0x90],[0x2018,0x91],[0x2019,0x92],[0x201c,0x93],[0x201d,0x94],[0x2022,0x95],[0x2013,0x96],[0x2014,0x97],
    [0x02dc,0x98],[0x2122,0x99],[0x0161,0x9a],[0x203a,0x9b],[0x0153,0x9c],[0x009d,0x9d],[0x017e,0x9e],[0x0178,0x9f]
  ]);
  const UTF8_SUSPECT=/[\u00c2\u00c3\u00e2\u00ef\u00f0]/;
  function decodeMojibakeOnce(text){
    if(!UTF8_SUSPECT.test(text)) return text;
    const bytes=[];
    for(const ch of text){
      const cp=ch.codePointAt(0);
      if(cp<=0xff) bytes.push(cp);
      else if(CP1252_BYTES.has(cp)) bytes.push(CP1252_BYTES.get(cp));
      else return text;
    }
    try{
      const decoded=new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(bytes));
      const oldBad=(text.match(/[\u00c2\u00c3\u00e2\u00ef\u00f0]/g)||[]).length;
      const newBad=(decoded.match(/[\u00c2\u00c3\u00e2\u00ef\u00f0]/g)||[]).length;
      return newBad<oldBad?decoded:text;
    }catch{return text}
  }
  function repairMojibake(text){
    let out=text;
    for(let i=0;i<3;i++){
      const next=decodeMojibakeOnce(out);
      if(next===out) break;
      out=next;
    }
    return out;
  }

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
      if(next!==raw){
        try{localStorage.setItem(key,next);changed++}catch{}
      }
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
      let next=repairMojibake(text);
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
    if(/[\u00c2\u00c3\u00e2\u00ef\u00f0]/.test(text)) bad.push('possible mojibake');
    const duplicateIds=(()=>{const ids=(data.wrestlers||[]).map(w=>w.id),s=new Set(ids);return ids.length-s.size})();
    const invalidEmployers=(data.wrestlers||[]).reduce((n,w)=>n+(w.employers||[]).filter(Boolean).filter(id=>!(data.promotions||[]).some(p=>+p.id===+id)).length,0);
    const unresolvedPositions=(data.wrestlers||[]).reduce((n,w)=>n+(w.positions||[]).filter(x=>![0,1,2,3,4,5,6,7].includes(+x)).length,0);
    const report={
      patch:window.__CC_RUNTIME_PATCHED__,
      engine:window.__CC_TEST__?.version||'loading',
      workers:(data.wrestlers||[]).length,
      promotions:(data.promotions||[]).length,
      duplicateWorkerIds:duplicateIds,
      invalidEmployerRefs:invalidEmployers,
      unresolvedPositionCodes:unresolvedPositions,
      visibleTextIssues:bad,
      timestamp:new Date().toISOString()
    };
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
    if(window.CC_DATA?.wrestlers?.length && window.__CC_TEST__){
      clearInterval(timer);
      apply();
    }else if(tries>200){
      clearInterval(timer);
      cleanRenderedText();
      audit();
    }
  },50);
})();
