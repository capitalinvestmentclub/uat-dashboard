import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';
import {normalizeGroup,deduplicate,reconcileDeployedFindings,matches,status,statuses,severities,severityBreakdown,executionBreakdown,defectStatusBreakdown} from '../model.js';
const data=JSON.parse(readFileSync(new URL('../dashboard-data.json',import.meta.url)));
const passedOverPlan=JSON.parse(readFileSync(new URL('../runs/2026-09-17-defect-batch-deployed-retest/PASSED_OVER_RETEST_PLAN.json',import.meta.url)));
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/^import .*\n/,'').replace(/\bstatus\(/g,'normalizeStatus(');
async function page(payload=data,ok=true){
  const dom=new JSDOM(html,{url:'https://example.com/',runScripts:'outside-only'});
  Object.assign(dom.window,{matches,normalizeStatus:status,statuses,severities,severityBreakdown,executionBreakdown,defectStatusBreakdown,fetch:async()=>({ok,json:async()=>payload}),console:{error(){}}});
  dom.window.HTMLElement.prototype.scrollIntoView=function(){};
  vm.runInContext(script,dom.getInternalVMContext(),{filename:fileURLToPath(new URL('../app.js',import.meta.url))});
  await new Promise(resolve=>setImmediate(resolve));
  return dom;
}
test('snapshot has complete known source inventory and honest scenario outcomes',()=>{
  assert.equal(data.groups.length,12);assert.equal(data.groups.flatMap(g=>g.scenarios).length,280);assert.equal(data.uniqueFindings.length,355);
  assert(data.groups.every(g=>/^[a-f0-9]{40}$/.test(g.commit)));
  assert(data.groups[0].scenarios.every(s=>s.status==='PARTIAL'));
  assert.equal(data.uniqueFindings.filter(f=>['high','critical'].includes(f.severity)&&f.type==='Defect').length,190);
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
  const releaseStatus={releaseId:'batch',reportEntriesLinked:276,uatStatusesChanged:0};
  assert.deepEqual(normalizeGroup({...base,releaseStatus}).releaseStatus,releaseStatus);
});
test('current delivery ledger is visible, escaped, and does not change UAT outcomes',async()=>{
  const payload=structuredClone(data);
  payload.groups[0].releaseStatus={releaseId:'batch',state:'MERGED <script>',reportEntriesLinked:276,uatStatusesChanged:0,acceptanceBoundary:'Retest required.',repositories:[{name:'webapi',deliveryState:'DEPLOYED',uatState:'NOT RUN',testState:'POST-MERGE FULL TEST FAILED',note:'5 suites failed.',pullRequest:'javascript:alert(1)',deploymentRun:'https://example.com/deploy'}]};
  const dom=await page(payload);const section=dom.window.document.querySelector('#delivery-ledger');
  assert.match(section.textContent,/276 report entries/);assert.match(section.textContent,/POST-MERGE FULL TEST FAILED/);
  assert.equal(section.querySelector('script'),null);assert.equal(section.querySelector('a').getAttribute('href'),'#');
  assert.equal(payload.uniqueFindings.length,data.uniqueFindings.length);dom.window.close();
});
test('completed 276-finding deployed retest is reconciled and visible',async()=>{
  assert.equal(data.deployedRetest.state,'COMPLETE');
  assert.equal(data.deployedRetest.total,276);
  assert.deepEqual(data.deployedRetest.outcomes,{BLOCKED:55,DUPLICATE_COVERAGE:1,FAIL:30,PASS:190});
  assert.match(data.deployedRetest.ledger,/reconciled-276\.json$/);
  assert.match(data.deployedRetest.rerunLedger,/passed-over-rerun-199\.json$/);
  assert.equal(data.deployedRetest.groups.length,10);
  assert.equal(data.deployedRetest.groups.reduce((total,group)=>total+group.total,0),276);
  const dom=await page();const section=dom.window.document.querySelector('#deployed-retest');
  assert.match(section.textContent,/276 of 276 entries/);
  assert.match(section.textContent,/190 passed/);
  assert.match(section.textContent,/55 blocked/);
  assert.match(section.textContent,/199-entry rerun/);
  assert.equal(section.querySelectorAll('tbody tr').length,10);
  dom.window.close();
});
test('reconciled ledger updates the finding chart, drilldowns, and evidence without changing the 259-defect denominator',async()=>{
  const ledgerUrl=new URL(`../${data.deployedRetest.ledger}`,import.meta.url);
  const ledger=JSON.parse(readFileSync(ledgerUrl));
  const raw=deduplicate(data.groups);
  assert.equal(defectStatusBreakdown(raw).find(row=>row.status==='NOT REPORTED').count,194);
  assert.equal(data.uniqueFindings.length,raw.length);
  const byId=new Map(data.uniqueFindings.map(finding=>[finding.id,finding]));
  for(const result of ledger.findings){
    const finding=byId.get(result.id);
    assert(finding,`${result.id} missing from dashboard`);
    assert.equal(finding.status,result.status);
    assert.equal(finding.deployedRetest.status,result.status);
    assert.match(finding.retestSummary,/Deployed Chrome/);
    assert(finding.evidence.some(evidence=>evidence.url.endsWith('reconciled-276.json')));
  }
  const counts=Object.fromEntries(defectStatusBreakdown(data.uniqueFindings).map(row=>[row.status,row.count]));
  assert.deepEqual(counts,{PASS:172,FAIL:27,PARTIAL:12,BLOCKED:44,DUPLICATE_COVERAGE:1,'NOT RUN':0,'NOT REPORTED':3,CONFLICT:0});
  assert.equal(byId.get('GRT003-VALID-001').previousRetest.status,'FAIL');
  assert.equal(byId.get('GRT003-VALID-001').status,'PASS');
  const dom=await page();const document=dom.window.document;
  assert.match(document.querySelector('.donut').getAttribute('aria-label'),/Awaiting verification: 3, 1\.2%/);
  document.querySelector('[data-outcome="NOT REPORTED"]').click();
  assert.equal(document.querySelectorAll('#results details').length,3);
  dom.window.close();
});
test('ledger reconciliation fails closed on nonterminal or unmatched evidence',()=>{
  const findings=[{id:'F1',title:'Example',groups:['Group'],status:'NOT REPORTED',evidence:[],responsive:[],limitations:[]}];
  const result={id:'F1',title:'Example',group:'Group',status:'PASS',testedAt:'2026-09-18T00:00:00Z',evidence:[]};
  const ledger={state:'COMPLETE',findings:[result]};
  const url='https://example.com/reconciled.json';
  assert.equal(reconcileDeployedFindings(findings,ledger,url)[0].status,'PASS');
  assert.throws(()=>reconcileDeployedFindings(findings,{...ledger,state:'IN_PROGRESS'},url),/not complete/);
  assert.throws(()=>reconcileDeployedFindings(findings,{...ledger,findings:[{...result,title:'Wrong'}]},url),/Unmatched/);
  assert.throws(()=>reconcileDeployedFindings(findings,{...ledger,findings:[{...result,status:'PASSED_OVER'}]},url),/Nonterminal/);
  assert.throws(()=>reconcileDeployedFindings(findings,{...ledger,findings:[result,result]},url),/Duplicate/);
});
test('published ledger links retain their evidence files',()=>{
  const ledgerUrl=new URL(`../${data.deployedRetest.ledger}`,import.meta.url);
  const ledger=JSON.parse(readFileSync(ledgerUrl));
  assert.equal(ledger.findings.length,276);
  assert.equal(ledger.findings.filter(finding=>finding.rerunId).length,199);
  for(const finding of ledger.findings){
    for(const evidence of finding.evidence||[]){
      assert(existsSync(new URL(evidence,ledgerUrl)),`${finding.id} missing ${evidence}`);
    }
  }
  const workflow=readFileSync(new URL('../.github/workflows/publish.yml',import.meta.url),'utf8');
  assert.match(workflow,/cp -R runs public\//);
});
test('every passed-over finding has an executable retest plan',()=>{
  assert.equal(passedOverPlan.scope.passedOverFindings,199);
  assert.equal(passedOverPlan.plans.length,199);
  assert.equal(new Set(passedOverPlan.plans.map(plan=>plan.id)).size,199);
  assert.equal(passedOverPlan.familySummary.reduce((total,family)=>total+family.count,0),199);
  for(const plan of passedOverPlan.plans){
    assert(plan.family);assert(plan.actors.length);assert(plan.seedAndSetup);assert(plan.browserExecution);
    assert(plan.originalAcceptanceEvidence.length);assert(plan.passCriteria);assert(plan.failCriteria);assert(plan.evidence.length);
  }
  assert.equal(passedOverPlan.plans.filter(plan=>plan.passwordRule).length,3);
  assert.match(passedOverPlan.scope.completionRule,/PASSED_OVER is not permitted/);
});
test('dedup preserves memberships and distinguishes conflicts from absent retests',()=>{
  const group=(name,status,title='Title')=>({name,findings:[{id:'F',title,status}]});
  assert.equal(deduplicate([group('A','NOT REPORTED'),group('B','PASS')])[0].status,'PASS');
  assert.equal(deduplicate([group('A','PASS'),group('B','NOT REPORTED')])[0].status,'PASS');
  assert.equal(deduplicate([group('A','PASS'),group('B','FAIL')])[0].status,'CONFLICT');
  assert.equal(deduplicate([group('A','PASS'),group('B','PASS','Different')]).length,2);
  assert.deepEqual(deduplicate([]),[]);
});
test('repair readiness survives normalization without promoting a failed retest',()=>{
  const repairBatch={runId:'repair',mergeStatus:'MERGED',deploymentStatus:'PENDING',cloudRetestStatus:'PENDING',findings:[{id:'F',classification:'PRODUCT_FIX_LOCAL_VERIFIED'}]};
  const group=normalizeGroup({name:'Test',repo:'admin-uat-report',parsed:{data:{scenarios:[['A','FAIL','Title']],findings:[{id:'F',title:'Finding',severity:'high'}]}},targeted:{repairBatch,findings:[{id:'F',status:'FAIL',responsive:[]}]}});
  assert.deepEqual(group.targeted.repairBatch,repairBatch);
  assert.equal(group.findings[0].status,'FAIL');
  assert.equal(group.scenarios[0].status,'FAIL');
});
test('repair progress is visible, escaped, and separate from pie and execution counts',async()=>{
  const payload=structuredClone(data);
  payload.groups[0].targeted={repairBatch:{runId:'repair-<script>',state:'MERGED — deployment pending',mergeStatus:'MERGED',deploymentStatus:'PENDING',cloudRetestStatus:'PENDING',scope:'Not a new test run',pullRequests:[{url:'javascript:alert(1)',label:'Unsafe link'}],deployments:{webapi:{version:'test',commit:'abc'}},findings:[{id:'ADM051',classification:'TEST_FIXTURE_CORRECTED',summary:'Old seed was not backfilled.',cloudRetestStatus:'PENDING'}]}};
  const baseline=await page();const dom=await page(payload);const d=dom.window.document;
  assert.match(d.querySelector('#repair-delivery').textContent,/Old seed was not backfilled/);
  assert.match(d.querySelector('#repair-delivery').textContent,/Cloud retest: PENDING/);
  assert.equal(d.querySelector('#repair-delivery script'),null);
  assert.equal(d.querySelector('#repair-delivery a').getAttribute('href'),'#');
  assert.equal(d.querySelector('#severity-chart').textContent,baseline.window.document.querySelector('#severity-chart').textContent);
  assert.equal(d.querySelector('#execution-chart').textContent,baseline.window.document.querySelector('#execution-chart').textContent);
  dom.window.close();baseline.window.close();
});
test('rendering and every view/group/result combination, reset and empty state',async()=>{
  const dom=await page();const d=dom.window.document;const event=()=>new dom.window.Event('change',{bubbles:true});
  assert.equal(d.querySelectorAll('.group-card').length,12);assert.equal(d.querySelectorAll('#results details').length,280);
  for(const view of ['scenarios','findings'])for(const group of ['',...data.groups.map(g=>g.name)])for(const result of ['',...statuses,'CONFLICT']){
    d.querySelector('#view').value=view;d.querySelector('#group').value=group;d.querySelector('#status').value=result;d.querySelector('#status').dispatchEvent(event());
    const source=view==='findings'?data.uniqueFindings:data.groups.flatMap(g=>g.scenarios.map(s=>({...s,group:g.name})));
    assert.equal(d.querySelectorAll('#results details').length,source.filter(r=>matches(r,'',group,result)).length);
  }
  d.querySelector('#filters').reset();await new Promise(r=>setImmediate(r));assert.equal(d.querySelectorAll('#results details').length,280);
  d.querySelector('#search').value='<img src=x onerror=alert(1)>';d.querySelector('#search').dispatchEvent(new dom.window.Event('input',{bubbles:true}));assert(d.querySelector('.empty'));assert.equal(d.querySelectorAll('#results img').length,0);
  for(const b of d.querySelectorAll('[data-group]')){b.click();assert.equal(d.querySelector('#group').value,b.dataset.group);}
  d.querySelector('#groups').dispatchEvent(new dom.window.Event('click',{bubbles:true}));
  d.querySelector('#filters').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));dom.window.close();
});
test('failure states do not display fabricated results',async()=>{
  for(const [payload,ok] of [[data,false],[{},true]]){const dom=await page(payload,ok);assert(dom.window.document.querySelector('[role=alert]'));assert.equal(dom.window.document.querySelectorAll('#results details').length,0);dom.window.close();}
});
test('severity percentages and execution totals are exact, conservative and zero-safe',()=>{
  const dist=severityBreakdown(data.uniqueFindings);assert.equal(dist.reduce((n,d)=>n+d.count,0),355);
  assert(Math.abs(dist.reduce((n,d)=>n+d.percent,0)-100)<1e-10);
  assert.equal(severityBreakdown([{severity:'unexpected',status:'FAIL'}])[4].count,1);
  assert(severityBreakdown([]).every(d=>d.percent===0));
  const c=executionBreakdown(data.groups.flatMap(g=>g.scenarios));
  assert.deepEqual(c,{total:280,executed:171,partial:67,blocked:21,notRun:21,unknown:0,percent:171/280*100});
  assert.equal(executionBreakdown([]).percent,0);
  assert.equal(executionBreakdown([{status:'unknown'}]).unknown,1);
});
test('severity drilldowns, every severity/group pair, scope synchronization and reset',async()=>{
  const dom=await page();const d=dom.window.document;const change=id=>d.getElementById(id).dispatchEvent(new dom.window.Event('change',{bubbles:true}));
  assert(d.getElementById('severity').disabled);assert.equal(d.querySelector('[role=progressbar]').getAttribute('aria-valuenow'),'61.1');
  for(const group of ['',...data.groups.map(g=>g.name)]){
    d.getElementById('chart-group').value=group;change('chart-group');assert.equal(d.getElementById('group').value,group);
    for(const severity of severities){
      d.querySelector(`[data-severity="${severity}"]`).click();
      assert.equal(d.getElementById('view').value,'findings');assert.equal(d.getElementById('severity').value,severity);
      assert.equal(d.querySelectorAll('#results details').length,data.uniqueFindings.filter(f=>(!group||f.groups.includes(group))&&f.severity===severity).length);
    }
  }
  d.getElementById('severity-chart').click();
  d.getElementById('severity-results').click();
  d.getElementById('filters').reset();assert.equal(d.getElementById('severity').value,'');assert(d.getElementById('severity').disabled);assert.equal(d.getElementById('chart-group').value,'');
  d.getElementById('view').value='findings';change('view');d.getElementById('severity').value='critical';change('severity');
  for(const outcome of statuses){d.getElementById('status').value=outcome;change('status');assert.equal(d.querySelectorAll('#results details').length,data.uniqueFindings.filter(f=>f.severity==='critical'&&f.status===outcome).length);}
  d.getElementById('view').value='scenarios';change('view');assert.equal(d.getElementById('severity').value,'');dom.window.close();
});
test('empty chart scope never shows NaN or fabricated progress',async()=>{
  const empty={...data,groups:[{...data.groups[0],scenarios:[],findings:[]}],uniqueFindings:[]};const dom=await page(empty);
  assert.equal(dom.window.document.querySelector('[role=progressbar]').getAttribute('aria-valuenow'),'0.0');assert(!dom.window.document.body.textContent.includes('NaN'));dom.window.close();
});
test('latest status pie excludes questions and reconciles all defect outcomes',()=>{
  const pie=defectStatusBreakdown(data.uniqueFindings);
  assert.equal(pie.reduce((n,d)=>n+d.count,0),259);
  for(const outcome of [...statuses,'CONFLICT']) {
    assert.equal(pie.find(d=>d.status===outcome)?.count || 0,
      data.uniqueFindings.filter(f=>f.type==='Defect'&&f.status===outcome).length);
  }
  const fixture=defectStatusBreakdown([{type:'Defect',status:'PASS'},{type:'Defect',status:'FAIL'},{type:'Defect',status:'PARTIAL'},{type:'Defect',status:'BLOCKED'},{type:'Question',status:'PASS'}]);
  for(const outcome of ['PASS','FAIL','PARTIAL','BLOCKED']) assert.equal(fixture.find(d=>d.status===outcome).count,1);
  assert.equal(fixture.reduce((n,d)=>n+d.count,0),4);
  assert(Math.abs(pie.reduce((n,d)=>n+d.percent,0)-100)<1e-10);
  assert(defectStatusBreakdown([]).every(d=>d.percent===0));
});
test('each status pie drilldown matches defects-only list and preserves group scope',async()=>{
  const dom=await page();const d=dom.window.document;
  for(const group of ['',...data.groups.map(g=>g.name)]){
    d.getElementById('chart-group').value=group;d.getElementById('chart-group').dispatchEvent(new dom.window.Event('change',{bubbles:true}));
    for(const outcome of [...statuses,'CONFLICT']){
      d.querySelector(`[data-outcome="${outcome}"]`).click();
      assert.equal(d.getElementById('view').value,'defects');assert.equal(d.getElementById('status').value,outcome);
      assert.equal(d.querySelectorAll('#results details').length,data.uniqueFindings.filter(f=>f.type==='Defect'&&f.status===outcome&&(!group||f.groups.includes(group))).length);
    }
  }
  d.getElementById('filters').reset();assert.equal(d.getElementById('view').value,'scenarios');dom.window.close();
});
