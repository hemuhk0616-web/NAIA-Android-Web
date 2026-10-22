"use strict";
// Browser-only development adapter; not the upstream NAIA Python engine.
const entries = new Map([["pose",["standing"]],["face",["smile"]]]);
const el = id => document.getElementById(id);
let count=0;
function expand(text, depth=0) {
  if(depth>12) throw Error("와일드카드 중첩 제한(12단계)");
  return text.replace(/__([^_]+)__/g, (match,name)=>{
    const values=entries.get(name);
    if(!values || !values.length) return match;
    return expand(values[Math.floor(Math.random()*values.length)],depth+1);
  });
}
function preview(){
  try{
    const main=expand(el("main").value);
    let prefix="";
    const rule=el("rule").value.trim();
    if(rule){
      const match=rule.match(/^\(\*([^)]*)\):prefix\+=(.*)$/s);
      if(!match) throw Error("웹 미리보기에서 지원하지 않는 규칙입니다. 원본 엔진 테스트가 필요합니다.");
      if(main.includes(match[1])) prefix=expand(match[2]);
    }
    count++;
    el("result").textContent="PREFIX: "+prefix+"\nMAIN: "+main;
    el("status").textContent="미리보기 실행 "+count+"회 · 브라우저 제한 엔진";
  }catch(error){el("status").textContent="오류: "+error.message;}
}
el("preview").addEventListener("click",preview);
el("copy").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(el("result").textContent);el("status").textContent="결과 복사 완료";}catch{el("status").textContent="복사 실패: 브라우저 권한을 확인하세요";}});
el("files").addEventListener("change",async event=>{
  const files=Array.from(event.target.files||[]);
  for(const file of files){
    if(!file.name.toLowerCase().endsWith(".txt"))continue;
    const name=file.name.slice(0,-4);
    const lines=(await file.text()).split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith("#"));
    entries.set(name,lines);
  }
  el("loaded").textContent="사용 가능: "+Array.from(entries.keys()).join(", ");
  el("status").textContent=files.length+"개 파일 선택 완료";
});

const STORAGE_KEY="naia-web-draft-v1";
function updateList(){
  el("loaded").textContent="와일드카드 "+entries.size+"개: "+Array.from(entries.keys()).join(", ");
  el("wildcards").textContent=Array.from(entries.entries()).map(([key,lines])=>key+" ("+lines.length+"줄)").join(" · ");
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
  updateList();
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
    updateList();el("status").textContent="설정 JSON 가져오기 완료";
  }catch(e){el("status").textContent="설정 가져오기 실패: "+e.message;}
});
updateList();
