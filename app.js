"use strict";
// Browser-only development adapter; not the upstream NAIA Python engine.
const entries = new Map([["pose",["standing"]],["face",["smile"]]]);
const el = id => document.getElementById(id);
let count=0;
function resolveWildcard(name){
  if(entries.has(name))return name;
  for(const key of entries.keys())if(key.endsWith("/"+name))return key;
  return null;
}
function expand(text, depth=0, stack=[]) {
  if(depth>24) throw Error("와일드카드 중첩 제한(24단계)");
  return text.replace(/__([\p{L}\p{N}_./-]+)__/gu,(match,name)=>{
    const key=resolveWildcard(name);
    if(!key)throw Error("등록되지 않은 와일드카드: "+name);
    if(stack.includes(key))throw Error("와일드카드 순환 참조: "+[...stack,key].join(" → "));
    const values=entries.get(key);
    if(!values.length)return "";
    const selected=values[Math.floor(Math.random()*values.length)];
    return expand(selected,depth+1,[...stack,key]);
  });
}
function splitTagsSmart(text){
  const tags=[];let part="",depth=0;
  for(const ch of text){
    if(ch==="<")depth++;
    else if(ch===">")depth=Math.max(0,depth-1);
    if(ch===","&&depth===0){if(part.trim())tags.push(part.trim());part="";}
    else part+=ch;
  }
  if(part.trim())tags.push(part.trim());
  return tags;
}
function conditionTagVariants(tag){
  const result=[tag.trim()];
  const nai=tag.match(/^[-+]?\d+(?:\.\d+)?::(.+)::$/);
  const webui=tag.match(/^\((.+):[-+]?\d+(?:\.\d+)?\)$/);
  const plain=(nai?.[1]||webui?.[1]||tag).trim();
  result.push(plain);
  if(plain.startsWith("(")&&plain.endsWith(")"))result.push(plain.slice(1,-1).trim());
  return result;
}
function evaluateCondition(source,tags,lineNumber){
  if(!source.trim())return true;
  const tokens=[];
  let buffer="",angle=0,quote="";
  const flush=()=>{if(buffer.trim())tokens.push(buffer.trim());buffer="";};
  for(let pos=0;pos<source.length;pos++){
    const ch=source[pos];
    if(quote){buffer+=ch;if(ch===quote)quote="";continue;}
    if(ch==='"'||ch==="'"){quote=ch;buffer+=ch;continue;}
    if(ch==="<"){angle++;buffer+=ch;continue;}
    if(ch===">"&&angle){angle--;buffer+=ch;continue;}
    if(!angle&&(ch==="("||ch===")"||ch==="&"||ch==="|")){
      flush();
      if((ch==="&"||ch==="|")&&source[pos+1]===ch){tokens.push(ch+ch);pos++;}
      else tokens.push(ch);
    }else buffer+=ch;
  }
  flush();
  const error=()=>{throw Error(lineNumber+"행: 조건식 문법 오류 — "+source);};
  if(quote||angle)error();
  let i=0;
  const variants=tags.flatMap(conditionTagVariants);
  function atom(){
    const t=tokens[i++];
    if(t==="("){const v=or();if(tokens[i++]!==")")error();return v;}
    if(!t||t===")"||t==="&&"||t==="||"||t==="&"||t==="|")error();
    const exactNot=t.startsWith("~!");
    const containsNot=!exactNot&&t.startsWith("~");
    const exact=!exactNot&&!containsNot&&(t.startsWith("*")||t.startsWith("!"));
    const raw=(exactNot?t.slice(2):(containsNot||exact?t.slice(1):t)).trim();
    const needle=((raw.startsWith('"')&&raw.endsWith('"'))||(raw.startsWith("'")&&raw.endsWith("'"))?raw.slice(1,-1):raw).trim();
    if(!needle)error();
    const found=exact||exactNot?variants.includes(needle):variants.some(tag=>tag.includes(needle));
    return exactNot||containsNot?!found:found;
  }
  function and(){let v=atom();while(tokens[i]==="&&"||tokens[i]==="&"){i++;const rhs=atom();v=v&&rhs;}return v;}
  function or(){let v=and();while(tokens[i]==="||"||tokens[i]==="|"){i++;const rhs=and();v=v||rhs;}return v;}
  const result=or();if(i!==tokens.length)error();return result;
}
function applyRules(main, source){
  const context={prefix:[],main:[main],postfix:[]};
  const rules=source.split(/\r?\n/).map((text,index)=>({text:text.trim(),line:index+1})).filter(x=>x.text&&!x.text.startsWith("#"));
  for(let i=0;i<rules.length;i++){
    const {text:line,line:lineNumber}=rules[i];
    const match=line.match(/^\(\*(.*)\):(prefix|main|postfix)\s*(\+=|=)\s*(.*)$/);
    if(!match)throw Error(lineNumber+"행: 웹 미리보기 미지원 규칙 — "+line);
    const [,needle,target,operator,value]=match;
    const tags=[...context.prefix,...context.main,...context.postfix].flatMap(splitTagsSmart);
    if(!evaluateCondition(needle,tags,lineNumber))continue;
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
  }catch(error){el("result").textContent="미리보기 실패: "+error.message;el("status").textContent="오류: "+error.message;}
}
el("preview").addEventListener("click",preview);
el("copy").addEventListener("click",async()=>{try{if(!el("result").textContent.startsWith("PREFIX: "))throw Error("먼저 미리보기를 실행하세요");await navigator.clipboard.writeText(el("result").textContent);el("status").textContent="결과 복사 완료";}catch{el("status").textContent="복사 실패: 브라우저 권한을 확인하세요";}});

const STORAGE_KEY="naia-web-draft-v1";
const LIBRARY_KEY="naia-web-wildcards-v1";
function persistWildcards(){try{localStorage.setItem(LIBRARY_KEY,JSON.stringify(Object.fromEntries(entries)));}catch(e){el("status").textContent="와일드카드 자동 저장 실패: "+e.message;}}
function restoreWildcards(){try{const saved=JSON.parse(localStorage.getItem(LIBRARY_KEY)||"null");if(saved&&typeof saved==="object"&&!Array.isArray(saved)){entries.clear();for(const [key,lines] of Object.entries(saved)){if(/^[\p{L}\p{N}_.\/-]+$/u.test(key)&&!key.split("/").some(part=>!part||part==="."||part==="..")&&Array.isArray(lines)&&lines.every(x=>typeof x==="string"))entries.set(key,lines);}}}catch(e){console.warn("와일드카드 저장본 읽기 실패",e);}}
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
  const imported=[];
  for(const file of files){
    if(!file.name.toLowerCase().endsWith(".txt"))continue;
    const raw=file.webkitRelativePath||file.name;
    const normalized=raw.replace(/\\/g,"/").replace(/\.txt$/i,"");
    const key=file.webkitRelativePath?normalized.replace(/^[^/]+\//,""):normalized;
    if(!key||!/^[\p{L}\p{N}_.\/-]+$/u.test(key)||key.split("/").some(part=>!part||part==="."||part===".."))continue;
    const lines=(await file.text()).split(/\r?\n/).map(s=>s.trim()).filter(s=>s&&!s.startsWith("#"));
    imported.push([key,lines]);
    count++;
  }
  for(const [key,lines] of imported)entries.set(key,lines);
  updateList();persistWildcards();
  el("status").textContent=count+"개 와일드카드 가져오기 완료 (브라우저에 자동 저장됨)";
}
el("files").addEventListener("change",event=>importFiles(Array.from(event.target.files||[])).catch(e=>{el("status").textContent="TXT 가져오기 실패: "+e.message;}));
el("folder").addEventListener("change",event=>importFiles(Array.from(event.target.files||[])).catch(e=>{el("status").textContent="폴더 가져오기 실패: "+e.message;}));
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
      if(!key||!/^[\p{L}\p{N}_.\/-]+$/u.test(key)||key.split("/").some(part=>!part||part==="."||part==="..")||!Array.isArray(lines)||!lines.every(x=>typeof x==="string"))throw Error("와일드카드 형식 오류");
      imported.set(key,lines);
    }
    el("main").value=data.main;el("rule").value=data.rule;
    entries.clear();for(const [key,lines] of imported)entries.set(key,lines);
    updateList();persistWildcards();el("status").textContent="설정 JSON 가져오기 완료";
  }catch(e){el("status").textContent="설정 가져오기 실패: "+e.message;}
});
restoreWildcards();updateList();

function wildcardKey(){
  const key=el("wildcard-name").value.trim().replace(/\\/g,"/");
  if(!key||! /^[\p{L}\p{N}_.\/-]+$/u.test(key)||key.split("/").some(x=>!x||x==="."||x===".."))throw Error("와일드카드 이름이 올바르지 않습니다");
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

function generateOnce(){
  const main=expand(el("main").value);
  const result=applyRules(main,el("rule").value);
  return ["PREFIX: "+result.prefix.join(", "),"MAIN: "+result.main.join(", "),"POSTFIX: "+result.postfix.join(", ")].join("\n");
}
el("batch-run").addEventListener("click",()=>{
  try{
    const amount=Number(el("batch-count").value);
    if(!Number.isInteger(amount)||amount<1||amount>30)throw Error("생성 횟수는 1~30 사이 정수여야 합니다");
    const results=[];
    for(let i=0;i<amount;i++){
      try{results.push("["+String(i+1)+"]\n"+generateOnce());}
      catch(e){throw Error((i+1)+"번째 생성 실패: "+e.message);}
    }
    el("batch-results").textContent=results.join("\n\n");
    el("status").textContent=amount+"개 생성 완료";
  }catch(e){el("batch-results").textContent="생성 실패 — "+e.message;el("status").textContent="일괄 생성 오류: "+e.message;}
});
el("batch-copy").addEventListener("click",async()=>{
  try{if(!/^\[1\]\n/.test(el("batch-results").textContent))throw Error("먼저 일괄 생성을 실행하세요");await navigator.clipboard.writeText(el("batch-results").textContent);el("status").textContent="일괄 결과 복사 완료";}
  catch(e){el("status").textContent="일괄 결과 복사 실패: "+e.message;}
});

el("wildcard-export").addEventListener("click",()=>{
  try{
    const key=wildcardKey();
    if(!entries.has(key))throw Error("등록된 와일드카드가 없습니다");
    const text=entries.get(key).join("\n")+"\n";
    const blob=new Blob([text],{type:"text/plain;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=key.replace(/\//g,"__")+".txt";a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    el("status").textContent=key+" TXT 내보내기 완료";
  }catch(e){el("status").textContent="TXT 내보내기 오류: "+e.message;}
});

el("batch-export").addEventListener("click",()=>{
  try{
    const output=el("batch-results").textContent;
    if(!/^\[1\]\n/.test(output))throw Error("먼저 일괄 생성을 실행하세요");
    const blob=new Blob([output+"\n"],{type:"text/plain;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download="naia-batch-prompts.txt";a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    el("status").textContent="일괄 결과 TXT 내보내기 완료";
  }catch(e){el("status").textContent="일괄 결과 내보내기 오류: "+e.message;}
});

