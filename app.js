import {matches,status,statuses,severities,severityBreakdown,executionBreakdown,defectStatusBreakdown} from './model.js';
const $=id=>document.getElementById(id);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const badge=s=>`<span class="badge ${s.toLowerCase().replaceAll(' ','-')}">${escape(s)}</span>`;
const safeLink=url=>{try{const u=new URL(url);return u.protocol==='https:'?escape(u.href):'#';}catch{return '#';}};
function viewport(rows,sizes){return `<div class="viewport-grid">${sizes.map(size=>{const cell=rows.find(r=>String(r.size).replace('x','×')===size);return `<div class="viewport"><strong>${size}</strong>${badge(status(cell?.status))}${cell?.summary||cell?.note?`<p>${escape(cell.summary||cell.note)}</p>`:''}${(cell?.evidence||[]).map(e=>`<p><a href="${safeLink(e.url)}">${escape(e.label||'Evidence')}</a></p>`).join('')}</div>`;}).join('')}</div>`;}
async function init(){
  try{
    const response=await fetch('dashboard-data.json',{cache:'no-cache'});
    if(!response.ok)throw new Error('Source snapshot is unavailable.');
    const data=await response.json();
    if(!Array.isArray(data.groups)||!data.groups.length)throw new Error('Source snapshot is incomplete.');
    const scenarios=data.groups.flatMap(g=>g.scenarios.map(s=>({...s,group:g.name})));
    const high=data.uniqueFindings.filter(f=>['critical','high'].includes(f.severity));
    const highDefects=high.filter(f=>f.type==='Defect');
    const run=data.groups.find(g=>g.targeted)?.targeted;
    const repairs=data.groups.filter(g=>g.targeted?.repairBatch);
    const delivery=data.groups.find(g=>g.releaseStatus)?.releaseStatus;
    const deliveryReports=delivery?data.groups.filter(g=>g.releaseStatus?.releaseId===delivery.releaseId).length:0;
    const deployedRetest=data.deployedRetest;
    if(deployedRetest){
      const outcomes=deployedRetest.outcomes||{};
      const section=document.createElement('section');section.id='deployed-retest';section.setAttribute('aria-label','Deployed defect delivery retest');
      section.innerHTML=`<h2>Deployed defect-delivery retest</h2><p><strong>${escape(deployedRetest.state)}</strong> · ${escape(deployedRetest.total)} of ${escape(deployedRetest.total)} entries have terminal outcomes in ${escape(deployedRetest.browser)}.</p><p>${escape(outcomes.PASS||0)} passed · ${escape(outcomes.FAIL||0)} still fail · ${escape(outcomes.BLOCKED||0)} blocked · ${escape(outcomes.DUPLICATE_COVERAGE||0)} duplicate coverage · ${escape(outcomes.PASSED_OVER||0)} passed over.</p><p>Default viewport ${escape(deployedRetest.defaultViewport)}; responsive findings expanded only where required. <a href="${safeLink(new URL(deployedRetest.ledger,location.href).href)}">Open the complete evidence ledger</a>${deployedRetest.rerunLedger?` · <a href="${safeLink(new URL(deployedRetest.rerunLedger,location.href).href)}">199-entry rerun</a> · <a href="${safeLink(new URL(deployedRetest.priorLedger,location.href).href)}">Original run</a>`:''}.</p><div class="severity-table" tabindex="0" role="region" aria-label="Retest disposition by report"><table><caption>Terminal outcomes in the reconciled delivery-batch report</caption><thead><tr><th scope="col">Report</th><th scope="col">Total</th><th scope="col">PASS</th><th scope="col">FAIL</th><th scope="col">BLOCKED</th><th scope="col">DUPLICATE</th><th scope="col">PASSED OVER</th></tr></thead><tbody>${deployedRetest.groups.map(group=>`<tr><th scope="row">${escape(group.group)}</th><td>${escape(group.total)}</td><td>${escape(group.PASS||0)}</td><td>${escape(group.FAIL||0)}</td><td>${escape(group.BLOCKED||0)}</td><td>${escape(group.DUPLICATE_COVERAGE||0)}</td><td>${escape(group.PASSED_OVER||0)}</td></tr>`).join('')}</tbody></table></div></section>`;
      $('deployments').insertAdjacentElement('beforebegin',section);
    }
    if(delivery){
      const section=document.createElement('section');section.id='delivery-ledger';section.setAttribute('aria-label','Current defect-batch delivery status');
      section.innerHTML=`<h2>Current defect-batch delivery</h2><p><strong>${escape(delivery.state)}</strong></p><p>${escape(delivery.reportEntriesLinked)} report entries are linked to this batch; ${escape(delivery.uatStatusesChanged)} UAT finding statuses changed by this publication. Recorded consistently in ${deliveryReports} detailed reports.</p><p><strong>${escape(delivery.acceptanceBoundary)}</strong></p>${(delivery.repositories||[]).map(repository=>`<details><summary><span class="row-title">${escape(repository.name)}<small>${escape(repository.deliveryState)} · deployed UAT ${escape(repository.uatState)}</small></span></summary><div class="detail"><p><strong>Tests:</strong> ${escape(repository.testState)}</p><p>${escape(repository.note)}</p><p><a href="${safeLink(repository.pullRequest)}">Pull request</a> · <a href="${safeLink(repository.deploymentRun)}">Deployment</a>${repository.postMergeTestRun?` · <a href="${safeLink(repository.postMergeTestRun)}">Post-merge tests</a>`:''}${repository.candidateUrl?` · <a href="${safeLink(repository.candidateUrl)}">Candidate</a>`:''}</p></div></details>`).join('')}`;
      $('deployments').insertAdjacentElement('beforebegin',section);
    }
    if(repairs.length){
      const section=document.createElement('section');section.id='repair-delivery';section.setAttribute('aria-label','Repair delivery progress');
      section.innerHTML=`<h2>Repair delivery progress</h2><p>Implementation, merge and deployment progress are separate from browser test outcomes. The pie chart changes only when a recorded targeted retest result changes.</p>${repairs.map(g=>{const batch=g.targeted.repairBatch;return `<details><summary><span class="row-title">${escape(g.name)}<small>${escape(batch.state)}</small></span></summary><div class="detail"><p>${escape(batch.runId)}</p><p><strong>Merge:</strong> ${escape(batch.mergeStatus)} · <strong>Deployment:</strong> ${escape(batch.deploymentStatus)} · <strong>Cloud retest:</strong> ${escape(batch.cloudRetestStatus)}</p><p>${escape(batch.scope)}</p>${batch.releaseGate?`<p>${escape(batch.releaseGate)}</p>`:''}${Object.entries(batch.deployments||{}).map(([service,release])=>`<p>${escape(service)}: ${escape(release.version)} · ${escape(release.commit)}</p>`).join('')}${(batch.pullRequests||[]).map(pr=>`<p><a href="${safeLink(pr.url)}">${escape(pr.label||'Release pull request')}</a></p>`).join('')}${(batch.findings||[]).map(f=>`<p><strong>${escape(f.id)}</strong> · ${escape(f.classification)} — ${escape(f.summary)}<br>Cloud retest: ${escape(f.cloudRetestStatus)}</p>`).join('')}</div></details>`;}).join('')}`;
      $('deployments').insertAdjacentElement('afterend',section);
    }
    if(run)$('deployments').innerHTML=`<details><summary><span class="row-title">Latest targeted retest deployment versions<small>${escape(run.runId)} · ${escape(run.state)}</small></span></summary><div class="detail">${Object.entries(run.deployments||{}).map(([service,release])=>`<p><strong>${escape(service)}</strong>: ${escape(release.version)}<br>Commit: ${escape(release.commit)}</p>`).join('')}<p>These versions apply to the targeted run, not every historical campaign.</p></div></details>`;
    $('freshness').textContent=`Snapshot refreshed ${new Date(data.generatedAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}. Source revisions are linked below. This is a report aggregation, not a new test run.`;
    $('metrics').innerHTML=[[data.groups.length,'Published test groups','Linked to their detailed reports'],[scenarios.length,'Reported scenarios','Campaign outcomes preserved'],[highDefects.length,'Unique critical / high defects',`${high.filter(f=>f.type!=='Defect').length} additional critical/high gaps or questions`],[high.filter(f=>f.status==='PASS').length,'Critical / high findings: retest PASS','Narrow retest scope · not full-suite closure']].map(([n,title,note])=>`<div class="metric"><strong>${n}</strong><span>${title}</span><small>${note}</small></div>`).join('');
    $('group').insertAdjacentHTML('beforeend',data.groups.map(g=>`<option>${escape(g.name)}</option>`).join(''));
    $('chart-group').insertAdjacentHTML('beforeend',data.groups.map(g=>`<option>${escape(g.name)}</option>`).join(''));
    $('severity').insertAdjacentHTML('beforeend',severities.map(s=>`<option value="${s}">${s==='not reported'?'Not reported':s[0].toUpperCase()+s.slice(1)}</option>`).join(''));
    $('status').insertAdjacentHTML('beforeend',[...statuses,'CONFLICT'].map(s=>`<option>${s}</option>`).join(''));
    $('groups').innerHTML=data.groups.map(g=>{const counts=statuses.map(s=>[s,g.scenarios.filter(r=>r.status===s).length]).filter(([,n])=>n).map(([s,n])=>`${n} ${s.toLowerCase()}`).join(' · ');const gh=g.findings.filter(f=>['critical','high'].includes(f.severity)&&f.type==='Defect');return `<article class="group-card"><h3>${escape(g.name)}</h3><p class="counts">${g.scenarios.length} scenarios · ${gh.length} critical/high defects*</p><p>${escape(counts)}</p><button data-group="${escape(g.name)}">Explore scenarios</button><a href="${g.url}">Detailed report ↗</a><small>Campaign: ${escape(g.checkpoint)}<br>${g.targeted?`Targeted retest: ${escape(g.targeted.updatedAt)}<br>`:''}Source <a href="https://github.com/capitalinvestmentclub/${g.repo}/commit/${g.commit}">${g.commit.slice(0,8)}</a></small></article>`;}).join('')+'<p><small>*Historical finding inventory. Shared findings count in each group, but only once in overall totals.</small></p>';
    function renderAnalytics(){
      const group=$('group').value;
      $('chart-group').value=group;
      const scopedFindings=data.uniqueFindings.filter(f=>!group||f.groups.includes(group));
      const distribution=severityBreakdown(scopedFindings);
      const latest=defectStatusBreakdown(scopedFindings);
      const defectTotal=latest.reduce((n,d)=>n+d.count,0);
      const colors=['#2c7255','#a92d39','#ba8b1f','#8a609a','#467ab2','#87918d','#233b52'];
      let offset=0;
      const gradient=latest.map((d,i)=>{const from=offset;offset+=d.percent;return `${colors[i]} ${from}% ${offset}%`;}).join(',');
      $('severity-chart').innerHTML=`<div class="donut-layout"><div class="donut" role="img" aria-label="${escape(latest.map(d=>`${d.label}: ${d.count}, ${d.percent.toFixed(1)}%`).join('; '))}" style="background:${defectTotal?`conic-gradient(${gradient})`:'#e5e8e3'}"><span><strong>${defectTotal}</strong>unique defects</span></div><div class="chart-legend">${latest.map((d,i)=>`<button type="button" data-outcome="${d.status}" aria-label="Show ${d.label} defects"><span class="swatch" style="background:${colors[i]}"></span><span>${d.label}</span><strong>${d.count}</strong><span>${d.percent.toFixed(1)}%</span></button>`).join('')}</div></div><p class="analytics-note">Latest available retest evidence in this snapshot. Fixed means the recorded targeted retest passed, not full-scenario closure. Missing retests remain awaiting verification, even if code was merged. Gaps and questions are excluded.</p>`;
      const coverage=executionBreakdown(scenarios.filter(s=>!group||s.group===group));
      const segments=[['Executed: PASS / FAIL',coverage.executed,'#2c7255'],['Partial',coverage.partial,'#ba8b1f'],['Blocked',coverage.blocked,'#8a609a'],['Not run',coverage.notRun,'#b7bfbb'],['Not reported',coverage.unknown,'#77858c']];
      $('execution-chart').innerHTML=`<p class="execution-number"><strong>${coverage.percent.toFixed(1)}%</strong> executed to a reported outcome</p><p>${coverage.executed} of ${coverage.total} scenarios have a PASS or FAIL outcome.</p><div class="execution-bar" role="progressbar" aria-label="Scenarios with PASS or FAIL outcome" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${coverage.percent.toFixed(1)}" aria-valuetext="${coverage.executed} of ${coverage.total} scenarios; ${coverage.partial} partial, ${coverage.blocked} blocked, ${coverage.notRun} not run, ${coverage.unknown} not reported">${segments.map(([label,n,color])=>`<span style="width:${coverage.total?n/coverage.total*100:0}%;background:${color}" title="${label}: ${n}"></span>`).join('')}</div><ul class="coverage-legend">${segments.map(([label,n,color])=>`<li><span class="swatch" style="background:${color}"></span><span>${label}</span><strong>${n}</strong><span>${(coverage.total?n/coverage.total*100:0).toFixed(1)}%</span></li>`).join('')}</ul><p class="analytics-note">Not run = explicitly unexecuted. Partial and blocked are separate—not counted as completed execution. A FAIL outcome does not mean every scenario branch ran. This measures reported scenarios, not six-size cell completion.</p>`;
      $('severity-results').innerHTML=`<div class="severity-table" tabindex="0" role="region" aria-label="Retest results by severity"><table><caption>Latest targeted finding results by severity · ${escape(group||'All test groups')}</caption><thead><tr><th scope="col">Severity</th><th scope="col">Total</th>${[...statuses,'CONFLICT'].map(s=>`<th scope="col">${s}</th>`).join('')}</tr></thead><tbody>${distribution.map(d=>`<tr><th scope="row"><button type="button" data-severity="${d.severity}" aria-label="Show ${d.severity} findings">${d.severity}</button></th><td>${d.count}</td>${[...statuses,'CONFLICT'].map(s=>`<td>${d.outcomes[s]}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="analytics-note">This severity table includes all finding types. NOT REPORTED means no targeted retest result. On smaller screens, scroll the table horizontally.</p>`;
    }
    function render(){
      const findings=$('view').value!=='scenarios';
      const defectsOnly=$('view').value==='defects';
      $('severity').disabled=!findings;
      if(!findings)$('severity').value='';
      renderAnalytics();
      const rows=(findings?data.uniqueFindings:scenarios).filter(r=>(!defectsOnly||r.type==='Defect')&&matches(r,$('search').value,$('group').value,$('status').value)&&(!findings||!$('severity').value||r.severity===$('severity').value));
      $('count').textContent=`${rows.length} ${findings?`${defectsOnly?'unique defects':'unique findings'} · result means latest available targeted retest`:'scenarios · result means original campaign outcome'}`;
      $('results').innerHTML=rows.length?rows.map(r=>`<details><summary>${badge(r.status)}<span class="row-title"><small>${escape(r.id)} · ${escape(findings?r.groups.join(' / '):r.group)}${findings?` · ${escape(r.severity)} · ${escape(r.type)}`:''}</small>${escape(r.title)}</span></summary><div class="detail"><p><strong>${findings?'Original finding':'Observed coverage'}:</strong> ${escape(findings?r.summary:r.observation)||'See detailed source report.'}</p>${findings?`<p><strong>Targeted retest:</strong> ${escape(r.retestSummary)||'No targeted retest result is recorded in this snapshot.'}</p>`:`<p><strong>Remaining scope:</strong> ${escape(r.gap)||'See source report for scenario boundaries and follow-up.'}</p>`}<p><strong>Chrome viewport evidence</strong> — ${findings?'targeted finding check':'original scenario record'}; not reported is not a pass.</p>${viewport(r.responsive,data.sizes)}${r.limitations?.length?`<p><strong>Limitations:</strong> ${escape(Array.isArray(r.limitations)?r.limitations.join(' '):r.limitations)}</p>`:''}${r.evidence?.length?`<ul>${r.evidence.map(e=>`<li><a href="${safeLink(e.url)}">${escape(e.label)}</a></li>`).join('')}</ul>`:''}<a href="${safeLink(r.url)}">Open detailed report and run history ↗</a></div></details>`).join(''):'<p class="empty">No matching results. Change your filters or select Reset filters.</p>';
    }
    $('filters').addEventListener('submit',e=>e.preventDefault());
    $('filters').addEventListener('input',render);
    $('filters').addEventListener('change',render);
    $('filters').addEventListener('reset',event=>{
      event.preventDefault();
      $('view').value='scenarios';$('group').value='';$('status').value='';$('search').value='';$('severity').value='';
      render();
    });
    $('chart-group').addEventListener('change',()=>{$('group').value=$('chart-group').value;render();});
    $('severity-chart').addEventListener('click',event=>{
      const button=event.target.closest('[data-outcome]');
      if(!button)return;
      $('view').value='defects';$('severity').value='';$('status').value=button.dataset.outcome;$('search').value='';
      render();$('explore-heading').scrollIntoView();$('status').focus({preventScroll:true});
    });
    $('severity-results').addEventListener('click',event=>{
      const button=event.target.closest('[data-severity]');
      if(!button)return;
      $('view').value='findings';$('severity').value=button.dataset.severity;$('status').value='';$('search').value='';
      render();$('explore-heading').scrollIntoView();$('severity').focus({preventScroll:true});
    });
    $('groups').addEventListener('click',e=>{const button=e.target.closest('[data-group]');if(button){$('group').value=button.dataset.group;$('view').value='scenarios';$('search').value='';$('status').value='';render();$('explore-heading').scrollIntoView();$('group').focus({preventScroll:true});}});
    render();
  }catch(error){$('freshness').textContent='The dashboard could not load its source snapshot.';$('results').innerHTML='<p class="error" role="alert">Please reload to retry. If the problem continues, use the original CIC reports; no results have been inferred.</p>';console.error(error);}
}
init();
