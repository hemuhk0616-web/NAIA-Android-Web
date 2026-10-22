"use strict";
// Browser-only development adapter; not the upstream NAIA Python engine.
const entries = new Map([["pose",["standing"]],["face",["smile"]]]);
const el = id => document.getElementById(id);
let count=0;
function expand(text, depth=0, stack=[]) {
  if(depth>24) throw Error("와일드카드 중첩 제한(24단계)");
  return text.replace(/__([\w./-]+)__/g,(match,name)=>{
    if(!entries.has(name))return match;
    if(stack.includes(name))throw Error("와일드카드 순환 참조: "+[...stack,name].join(" → "));
    const values=entries.get(name);
    if(!values.length)return "";
    const selected=values[Math.floor(Math.random()*values.length)];
    return expand(selected,depth+1,[...stack,name]);
  });
}
function applyRules(main, source){
  const context={prefix:[],main:[main],postfix:[]};
  const rules=source.split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith("#"));
  for(let i=0;i<rules.length;i++){
    const line=rules[i];
    const match=line.match(/^\(\*([^)]*)\):(prefix|main|postfix)\s*(\+=|=)\s*(.*)$/);
    if(!match)throw Error((i+1)+"행: 웹 미리보기 미지원 규칙 — "+line);
    const [,needle,target,operator,value]=match;
    if(!context.main.join(", ").includes(needle))continue;
    const expanded=expand(value);
    if(operator==="=")context[target]=[expanded];
    else context[target].push(expanded);
  }
  return context;
}
function preview(){
  try{
    const main=expand(el("main").value);
    const result=applyRules(main,el("rule").value);
    count++;
    el("result").textContent="PREFIX: "+result.prefix.join(", ")+"\nMAIN: "+result.main.join(", ")+"\nPOSTFIX: "+result.postfix.join(", ");
    el("status").textContent="미리보기 실행 "+count+"회 · 브라우저 부분 호환 엔진";
  }catch(error){el("status").textContent="오류: "+error.message;}
}
el("preview").addEventListener("click",preview);
el("copy").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(el("result").textContent);el("status").textContent="결과 복사 완료";}catch{el("status").textContent="복사 실패: 브라우저 권한을 확인하세요";}});

const STORAGE_KEY="naia-web-draft-v1";
const LIBRARY_KEY="naia-web-wildcards-v1";
function persistWildcards(){try{localStorage.setItem(LIBRARY_KEY,JSON.stringify(Object.fromEntries(entries)));}catch(e){el("status").textContent="와일드카드 자동 저장 실패: "+e.message;}}
function restoreWildcards(){try{const saved=JSON.parse(localStorage.getItem(LIBRARY_KEY)||"null");if(saved&&typeof saved==="object"&&!Array.isArray(saved)){for(const [key,lines] of Object.entries(saved)){if(Array.isArray(lines)&&lines.every(x=>typeof x==="string"))entries.set(key,lines);}}}catch(e){console.warn("와일드카드 저장본 읽기 실패",e);}}
function updateList(){
  el("loaded").textContent="와일드카드 "+entries.size+"개: "+Array.from(entries.keys()).join(", ");
  el("wildcards").textContent="";
  const picker=el("wildcard-picker");
  picker.replaceChildren();
  for(const [key,lines] of entries){
    const button=document.createElement("button");
    button.type="button";button.className="wildcard-item secondary";
    button.textContent=key+" ("+lines.length+"줄)";
    button.addEventListener("click",()=>{
      el("wildcard-name").value=key;
      el("wildcard-lines").value=lines.join("\n");
      el("status").textContent=key+" 편집 준비 완료";
    });
    picker.appendChild(button);
  }
}
function saveDraft(){
  try{
    localStorage.setItem(STORAGE_KEY,JSON.stringify({main:el("main").value,rule:el("rule").value}));
    el("status").textContent="이 브라우저에 프롬프트 저장 완료";
  }catch(e){el("status").textContent="저장 실패: "+e.message;}
}
function restoreDraft(){
  try{
    const data=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");
    if(!data){el("status").textContent="저장된 프롬프트가 없습니다";return;}
    el("main").value=String(data.main||"");
    el("rule").value=String(data.rule||"");
    el("status").textContent="저장본 불러오기 완료";
  }catch(e){el("status").textContent="불러오기 실패: "+e.message;}
}
async function importFiles(files){
  let count=0;
  for(const file of files){
    if(!file.name.toLowerCase().endsWith(".txt"))continue;
    const raw=file.webkitRelativePath||file.name;
    const key=raw.replace(/\\/g,"/").replace(/\.txt$/i,"").replace(/^[^/]+\//,"");
    if(!key||key.split("/").some(part=>part==="."||part===".."))continue;
    const lines=(await file.text()).split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith("#"));
    entries.set(key,lines);
    count++;
  }
  updateList();persistWildcards();
  el("status").textContent=count+"개 와일드카드 가져오기 완료 (현재 브라우저 메모리)";
}
el("files").addEventListener("change",event=>importFiles(Array.from(event.target.files||[])));
el("folder").addEventListener("change",event=>importFiles(Array.from(event.target.files||[])));
el("save").addEventListener("click",saveDraft);
el("restore").addEventListener("click",restoreDraft);
el("export").addEventListener("click",()=>{
  const data={format:"naia-web-v1",main:el("main").value,rule:el("rule").value,wildcards:Object.fromEntries(entries)};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
  const a=document.createElement("a");a.href=url;a.download="naia-web-settings.json";a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  el("status").textContent="설정 JSON 내보내기 완료";
});
el("settings-file").addEventListener("change",async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{
    if(file.size>5*1024*1024)throw Error("설정 파일이 너무 큽니다 (최대 5MB)");
    const data=JSON.parse(await file.text());
    if(data.format!=="naia-web-v1"||typeof data.main!=="string"||typeof data.rule!=="string"||!data.wildcards||typeof data.wildcards!=="object"||Array.isArray(data.wildcards))throw Error("지원하지 않는 설정 형식");
    const imported=new Map();
    for(const [key,lines] of Object.entries(data.wildcards)){
      if(!key||key==="__proto__"||!Array.isArray(lines)||!lines.every(x=>typeof x==="string"))throw Error("와일드카드 형식 오류");
      imported.set(key,lines);
    }
    el("main").value=data.main;el("rule").value=data.rule;
    entries.clear();for(const [key,lines] of imported)entries.set(key,lines);
    updateList();persistWildcards();el("status").textContent="설정 JSON 가져오기 완료";
  }catch(e){el("status").textContent="설정 가져오기 실패: "+e.message;}
});
updateList();

function wildcardKey(){
  const key=el("wildcard-name").value.trim().replace(/\\/g,"/");
  if(!key||! /^[a-zA-Z0-9가-힣_.\/-]+$/.test(key)||key.split("/").some(x=>!x||x==="."||x===".."))throw Error("와일드카드 이름이 올바르지 않습니다");
  return key;
}
el("wildcard-load").addEventListener("click",()=>{
  try{
    const key=wildcardKey();
    if(!entries.has(key))throw Error("등록된 와일드카드가 없습니다");
    el("wildcard-lines").value=entries.get(key).join("\n");
    el("status").textContent=key+" 불러오기 완료";
  }catch(e){el("status").textContent="오류: "+e.message;}
});
el("wildcard-save").addEventListener("click",()=>{
  try{
    const key=wildcardKey();
    const lines=el("wildcard-lines").value.split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith("#"));
    entries.set(key,lines);updateList();persistWildcards();
    el("status").textContent=key+" 저장 완료 (JSON으로 내보내면 백업 가능)";
  }catch(e){el("status").textContent="오류: "+e.message;}
});
el("wildcard-delete").addEventListener("click",()=>{
  try{
    const key=wildcardKey();
    if(!entries.delete(key))throw Error("등록된 와일드카드가 없습니다");
    el("wildcard-lines").value="";updateList();persistWildcards();
    el("status").textContent=key+" 삭제 완료";
  }catch(e){el("status").textContent="오류: "+e.message;}
});
