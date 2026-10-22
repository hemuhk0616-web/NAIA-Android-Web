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
x=run("standing","(*standing):prefix+=hello\n(*standing):postfix+=world");
assert.match(x.result,/PREFIX: hello/);
assert.match(x.result,/POSTFIX: world/);
x=run("standing","(*standing):prefix+=first\n(*first):postfix+=second");
assert.match(x.result,/POSTFIX: second/);
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
console.log("Web editor smoke tests passed.");
