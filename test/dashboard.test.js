import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';
import {normalizeGroup,deduplicate,matches,status,statuses} from '../model.js';
const data=JSON.parse(readFileSync(new URL('../dashboard-data.json',import.meta.url)));
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/^import .*\n/,'').replace(/\bstatus\(/g,'normalizeStatus(');
async function page(payload=data,ok=true){
  const dom=new JSDOM(html,{url:'https://example.com/',runScripts:'outside-only'});
  Object.assign(dom.window,{matches,normalizeStatus:status,statuses,fetch:async()=>({ok,json:async()=>payload}),console:{error(){}}});
  dom.window.HTMLElement.prototype.scrollIntoView=function(){};
  vm.runInContext(script,dom.getInternalVMContext(),{filename:fileURLToPath(new URL('../app.js',import.meta.url))});
  await new Promise(resolve=>setImmediate(resolve));
  return dom;
}
test('snapshot has complete known source inventory and honest scenario outcomes',()=>{
  assert.equal(data.groups.length,10);assert.equal(data.groups.flatMap(g=>g.scenarios).length,198);assert.equal(data.uniqueFindings.length,118);
  assert(data.groups.every(g=>/^[a-f0-9]{40}$/.test(g.commit)));
  assert(data.groups[0].scenarios.every(s=>s.status==='PARTIAL'));
  assert.equal(data.uniqueFindings.filter(f=>['high','critical'].includes(f.severity)&&f.type==='Defect').length,65);
  assert.equal(data.uniqueFindings.filter(f=>f.status==='CONFLICT').length,0);
  assert(data.groups.flatMap(g=>g.findings).every(f=>f.id&&f.title));
});
test('status conversion is explicit and conservative',()=>{
  for(const s of statuses){assert.equal(status(s),s);assert.equal(status(s+' · evidence'),s);}
  assert.equal(status('IN PROGRESS · working'),'PARTIAL');
  for(const s of [null,undefined,'passed earlier','incomplete','six sizes inspected',''])assert.equal(status(s),'NOT REPORTED');
});
test('all filter pairs and adversarial search use literal case-insensitive matching',()=>{
  for(const g of ['',...data.groups.map(g=>g.name)])for(const s of ['',...statuses,'CONFLICT'])for(const q of ['','  ','kyc','PIT-F001','<script>','\"','x'.repeat(10000)]){
    const rows=data.uniqueFindings.filter(r=>matches(r,q,g,s));
    assert(rows.every(r=>(!g||r.groups.includes(g))&&(!s||r.status===s)));
  }
  assert(matches({id:'A',title:'One',group:'Test'},' one ','Test',''));
  assert(!matches({id:'A',title:'One',group:'Test'},'bad','Test',''));
});
test('normalization preserves schema boundaries and rejects missing scenarios',()=>{
  assert.throws(()=>normalizeGroup({repo:'bad',parsed:{}}),/Missing scenarios/);
  const base={name:'Test',repo:'kyc-approval-uat-report',commit:'a',parsed:{report:{sizes:['360×800','390×844'],scenarios:[[1,'Title','PASS · done','gap',['PASS','FAIL']]],findings:[{id:'F1',title:'Finding'}]}}};
  const g=normalizeGroup(base);assert.equal(g.scenarios[0].responsive[1].status,'FAIL');assert.equal(g.findings[0].status,'NOT REPORTED');
  const targeted=normalizeGroup({...base,targeted:{findings:[{id:'F1',status:'PARTIAL',summary:'narrow',responsive:[{size:'360×800',status:'PASS',evidence:[{url:'small.png',label:'Mobile'}]}],evidence:[{url:'proof.png',label:'Proof'}]}]}});
  assert.equal(targeted.findings[0].status,'PARTIAL');assert.match(targeted.findings[0].evidence[0].url,/\/proof.png$/);
  const generic=normalizeGroup({name:'G',repo:'admin-uat-report',parsed:{data:{scenarios:[['A','FAIL','Title']]}}});assert.deepEqual(generic.scenarios[0].responsive,[]);
  const updated=normalizeGroup({...base,updates:{F1:{status:'Fixed',resolution:'fixed',retest:{sizes:[]}}}});assert.equal(updated.findings[0].status,'PASS');
  assert.match(targeted.findings[0].responsive[0].evidence[0].url,/\/small.png$/);
  const pitcher=normalizeGroup({name:'Pitcher',repo:'pitcher-uat-report',parsed:{report:{sizes:['360×800'],scenarios:[[1,'Title','Observed','Gap']],findings:[['High',[1],'Title','Steps','Description','Expected','Observed defect'],['High',[1],'Question','Steps','Description','Expected','Reconciliation needed']]}}});
  assert.equal(pitcher.scenarios[0].responsive[0].status,'PARTIAL');assert.equal(pitcher.findings[1].type,'Question');
});
test('dedup preserves memberships and distinguishes conflicts from absent retests',()=>{
  const group=(name,status,title='Title')=>({name,findings:[{id:'F',title,status}]});
  assert.equal(deduplicate([group('A','NOT REPORTED'),group('B','PASS')])[0].status,'PASS');
  assert.equal(deduplicate([group('A','PASS'),group('B','NOT REPORTED')])[0].status,'PASS');
  assert.equal(deduplicate([group('A','PASS'),group('B','FAIL')])[0].status,'CONFLICT');
  assert.equal(deduplicate([group('A','PASS'),group('B','PASS','Different')]).length,2);
  assert.deepEqual(deduplicate([]),[]);
});
test('rendering and every view/group/result combination, reset and empty state',async()=>{
  const dom=await page();const d=dom.window.document;const event=()=>new dom.window.Event('change',{bubbles:true});
  assert.equal(d.querySelectorAll('.group-card').length,10);assert.equal(d.querySelectorAll('#results details').length,198);
  for(const view of ['scenarios','findings'])for(const group of ['',...data.groups.map(g=>g.name)])for(const result of ['',...statuses,'CONFLICT']){
    d.querySelector('#view').value=view;d.querySelector('#group').value=group;d.querySelector('#status').value=result;d.querySelector('#status').dispatchEvent(event());
    const source=view==='findings'?data.uniqueFindings:data.groups.flatMap(g=>g.scenarios.map(s=>({...s,group:g.name})));
    assert.equal(d.querySelectorAll('#results details').length,source.filter(r=>matches(r,'',group,result)).length);
  }
  d.querySelector('#filters').reset();await new Promise(r=>setImmediate(r));assert.equal(d.querySelectorAll('#results details').length,198);
  d.querySelector('#search').value='<img src=x onerror=alert(1)>';d.querySelector('#search').dispatchEvent(new dom.window.Event('input',{bubbles:true}));assert(d.querySelector('.empty'));assert.equal(d.querySelectorAll('#results img').length,0);
  for(const b of d.querySelectorAll('[data-group]')){b.click();assert.equal(d.querySelector('#group').value,b.dataset.group);}
  d.querySelector('#groups').dispatchEvent(new dom.window.Event('click',{bubbles:true}));
  d.querySelector('#filters').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));dom.window.close();
});
test('failure states do not display fabricated results',async()=>{
  for(const [payload,ok] of [[data,false],[{},true]]){const dom=await page(payload,ok);assert(dom.window.document.querySelector('[role=alert]'));assert.equal(dom.window.document.querySelectorAll('#results details').length,0);dom.window.close();}
});
