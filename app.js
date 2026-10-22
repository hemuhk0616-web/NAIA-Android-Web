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
