"use strict";
const fs=require("node:fs");
const vm=require("node:vm");
const assert=require("node:assert/strict");
const elements=new Map();
function element(id){
  if(!elements.has(id))elements.set(id,{
    value:"",textContent:"",files:[],handlers:{},children:[],
    replaceChildren(...nodes){this.children=nodes;},
    appendChild(node){this.children.push(node);},
    addEventListener(type,fn){this.handlers[type]=fn;},
    click(){this.handlers.click?.();},
  });
  return elements.get(id);
}
const local=new Map();
const ctx={
  document:{getElementById:element,createElement:()=>({textContent:"",className:"",type:"",handlers:{},addEventListener(type,fn){this.handlers[type]=fn;},click(){this.handlers.click?.();},set href(x){},set download(x){}})},
  localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v)},
  navigator:{clipboard:{writeText:async()=>{}}},
  URL:{createObjectURL:()=> "blob:test",revokeObjectURL:()=>{}},
  Blob:class{},setTimeout:()=>{},console,Math,Map,JSON,Error,
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync("app.js","utf8"),ctx);
function run(main,rule){
  element("main").value=main;
  element("rule").value=rule;
  element("preview").click();
  return {result:element("result").textContent,status:element("status").textContent};
}
let x=run("1girl, __pose__","(*standing):prefix+=__face__");
assert.match(x.result,/PREFIX: smile/);
assert.match(x.result,/MAIN: 1girl, standing/);
x=run("standing","(*):prefix+=always");
assert.match(x.result,/PREFIX: always/);
x=run("standing","(*standing):prefix+=hello\n(*standing):postfix+=world");
assert.match(x.result,/PREFIX: hello/);
assert.match(x.result,/POSTFIX: world/);
x=run("standing","(*standing):prefix+=first\n(*first):postfix+=second");
assert.match(x.result,/POSTFIX: second/);
x=run("<angry,shy|b|c>, standing","(*<angry,shy|b|c>):prefix+=matched");
assert.match(x.result,/PREFIX: matched/);
x=run("(red, blue:1.2), standing","(*red, blue):prefix+=weighted-comma");
assert.match(x.result,/PREFIX: weighted-comma/);
x=run("[red, blue], standing","(*red, blue):prefix+=bracket-comma");
assert.match(x.result,/PREFIX: bracket-comma/);
x=run('"red, blue", standing','(*red, blue):prefix+=quoted-comma');
assert.match(x.result,/PREFIX: quoted-comma/);
x=run("standing","(*rating(e)):prefix+=incorrect");
assert.match(x.status,/이미지 평가 정보가 없어/);
element("character-1").value="";
x=run("standing","(*char_on(1)):prefix+=active");
assert.doesNotMatch(x.result,/PREFIX: active/);
element("character-1").value="blue hair";
x=run("standing","(*char_on(1)):prefix+=active");
assert.match(x.result,/PREFIX: active/);
element("character-1").value="";
for(const fn of ["char_on(2)","char_in(1, standing)"]){
  x=run("standing","(*"+fn+"):prefix+=incorrect");
  assert.match(x.status,/캐릭터 1 슬롯만 지원|조건 함수는 웹 미리보기에서 미지원/);
}
x=run("standing, smile","(*standing && smile):prefix+=both");
assert.match(x.result,/PREFIX: both/);
x=run("standing","(**standing && ~!smile):prefix+=only-standing");
assert.match(x.result,/PREFIX: only-standing/);
x=run("standing","(*smile || standing):prefix+=either");
assert.match(x.result,/PREFIX: either/);
x=run("standing","(**standing && smile):prefix+=incorrect");
assert.doesNotMatch(x.result,/incorrect/);
x=run("standing, smile","(*(standing && smile) || sitting):prefix+=nested");
assert.match(x.result,/PREFIX: nested/);
x=run("standing","(*(standing && smile) || sitting):prefix+=incorrect");
assert.doesNotMatch(x.result,/incorrect/);
x=run("standing","(*(standing &&):prefix+=bad");
assert.match(x.status,/조건식 문법 오류/);
x=run("standing, smile","(*standing & smile):prefix+=single-and");
assert.match(x.result,/PREFIX: single-and/);
x=run("standing","(*smile | standing):prefix+=single-or");
assert.match(x.result,/PREFIX: single-or/);
x=run("standing","(*standing |& smile):prefix+=bad");
assert.match(x.status,/조건식 문법 오류/);
x=run("1.2::standing::","(*standing):prefix+=nai-weight");
assert.match(x.result,/PREFIX: nai-weight/);
x=run("(standing:1.2)","(*standing):prefix+=webui-weight");
assert.match(x.result,/PREFIX: webui-weight/);
x=run("long hair, blue eyes","(*long hair & blue eyes):prefix+=multiword");
assert.match(x.result,/PREFIX: multiword/);
x=run("long hair","(*\"long hair\"):prefix+=quoted-tag");
assert.match(x.result,/PREFIX: quoted-tag/);
x=run("long hair","(*~short hair):prefix+=not-short");
assert.match(x.result,/PREFIX: not-short/);
x=run("understanding","(*standing):prefix+=substring");
assert.match(x.result,/PREFIX: substring/);
x=run("standing","(*~standing):prefix+=incorrect");
assert.doesNotMatch(x.result,/incorrect/);
x=run("standing","(*~!sitting):prefix+=not-exact");
assert.match(x.result,/PREFIX: not-exact/);
x=run("standing","(*!standing):prefix+=exact-alias");
assert.match(x.result,/PREFIX: exact-alias/);
x=run("understanding","(**standing):prefix+=incorrect");
assert.doesNotMatch(x.result,/incorrect/);
x=run("standing","(*standing):main=changed");
assert.match(x.result,/MAIN: changed/);
x=run("__missing__","");
assert.match(x.status,/등록되지 않은 와일드카드: missing/);
assert.match(element("result").textContent,/미리보기 실패/);
assert.doesNotMatch(element("result").textContent,/PREFIX: smile/);
x=run("standing","# comment\n\nunsupported rule");
assert.match(x.status,/3행/);
assert.match(x.status,/미지원 규칙/);
element("main").value="saved prompt";
element("rule").value="saved rule";
element("save").click();
element("main").value="other";
element("restore").click();
assert.equal(element("main").value,"saved prompt");
assert.equal(element("rule").value,"saved rule");
element("wildcard-name").value="test/nested";
element("wildcard-lines").value="alpha\nbeta";
element("wildcard-save").click();
assert.equal(element("wildcard-picker").children.some(x=>x.textContent.includes("test/nested")),true);
assert.equal(JSON.parse(local.get("naia-web-wildcards-v1"))["test/nested"].length,2);
element("wildcard-lines").value="";
element("wildcard-load").click();
assert.equal(element("wildcard-lines").value,"alpha\nbeta");
x=run("__nested__","");
assert.match(x.result,/MAIN: (alpha|beta)/);
element("main").value="__test/nested__";
element("rule").value="";
element("batch-count").value="3";
element("batch-run").click();
assert.match(element("batch-results").textContent,/\[3\]/);
assert.match(element("batch-results").textContent,/MAIN: (alpha|beta)/);
element("batch-export").click();
assert.match(element("status").textContent,/일괄 결과 TXT 내보내기 완료/);
element("main").value="__missing__";
element("batch-run").click();
assert.match(element("batch-results").textContent,/생성 실패/);
assert.match(element("status").textContent,/1번째 생성 실패/);
element("batch-export").click();
assert.match(element("status").textContent,/먼저 일괄 생성을 실행하세요/);
element("batch-copy").click();
element("main").value="__test/nested__";
element("wildcard-export").click();
assert.match(element("status").textContent,/TXT 내보내기 완료/);
element("wildcard-name").value="표정/미소";
element("wildcard-lines").value="웃는 얼굴";
element("wildcard-save").click();
x=run("__표정/미소__","");
assert.match(x.result,/MAIN: 웃는 얼굴/);
element("wildcard-name").value="test/nested";
element("wildcard-delete").click();
assert.equal(element("wildcard-picker").children.some(x=>x.textContent.includes("test/nested")),false);
vm.runInContext('entries.clear();restoreWildcards();updateList()',ctx);
assert.equal(element("wildcard-picker").children.some(x=>x.textContent.includes("pose")),true);
vm.runInContext('entries.delete("pose");persistWildcards();entries.clear();restoreWildcards();updateList()',ctx);
assert.equal(element("wildcard-picker").children.some(x=>x.textContent.includes("pose")),false);
// Browser storage failures must not be reported as successful saves.
const originalSetItem=ctx.localStorage.setItem;
ctx.localStorage.setItem=()=>{throw Error("quota exceeded");};
element("wildcard-name").value="storage-test";
element("wildcard-lines").value="temporary";
element("wildcard-save").click();
assert.match(element("status").textContent,/자동 저장 실패/);
assert.match(element("status").textContent,/JSON으로 백업/);
ctx.localStorage.setItem=originalSetItem;
// A failed JSON backup must not be presented as a successful download.
const originalCreateObjectURL=ctx.URL.createObjectURL;
ctx.URL.createObjectURL=()=>{throw Error("download blocked");};
element("export").click();
assert.match(element("status").textContent,/설정 JSON 내보내기 실패/);
assert.match(element("status").textContent,/download blocked/);
ctx.URL.createObjectURL=originalCreateObjectURL;
// JSON import must restore both prompt fields and wildcard library.
(async()=>{
  const backup={format:"naia-web-v1",main:"restored prompt",rule:"(*):prefix+=ok",wildcards:{"restored/eyes":["blue eyes"]}};
  await element("settings-file").handlers.change({target:{files:[{size:128,text:async()=>JSON.stringify(backup)}]}});
  assert.equal(element("main").value,"restored prompt");
  assert.equal(element("rule").value,"(*):prefix+=ok");
  assert.equal(JSON.parse(local.get("naia-web-draft-v1")).main,"restored prompt");
  assert.equal(JSON.parse(local.get("naia-web-wildcards-v1"))["restored/eyes"][0],"blue eyes");
  // Simulate a failed draft write; old editor and library must remain intact.
  const setItem=ctx.localStorage.setItem;
  ctx.localStorage.setItem=(key,value)=>{if(key==="naia-web-draft-v1")throw Error("quota");return setItem(key,value);};
  const bad={...backup,main:"must not replace",wildcards:{"new":["new"]}};
  await element("settings-file").handlers.change({target:{files:[{size:128,text:async()=>JSON.stringify(bad)}]}});
  assert.equal(element("main").value,"restored prompt");
  assert.equal(JSON.parse(local.get("naia-web-wildcards-v1"))["restored/eyes"][0],"blue eyes");
  assert.match(element("status").textContent,/설정 저장 실패/);
  ctx.localStorage.setItem=setItem;
  // Malformed backups must never replace the current editor state.
  for(const malformed of ["null",'{"format":"naia-web-v1","main":"bad","rule":"","wildcards":{"broken":"not an array"}}']){
    await element("settings-file").handlers.change({target:{files:[{size:128,text:async()=>malformed}]}});
    assert.match(element("status").textContent,/설정 가져오기 실패/);
    assert.equal(element("main").value,"restored prompt");
    assert.equal(JSON.parse(local.get("naia-web-wildcards-v1"))["restored/eyes"][0],"blue eyes");
  }
  console.log("Web editor smoke tests passed.");
})().catch(error=>{console.error(error);process.exitCode=1;});

