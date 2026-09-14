import {matches,status,statuses} from './model.js';
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
    if(run)$('deployments').innerHTML=`<details><summary><span class="row-title">Latest targeted retest deployment versions<small>${escape(run.runId)} · ${escape(run.state)}</small></span></summary><div class="detail">${Object.entries(run.deployments||{}).map(([service,release])=>`<p><strong>${escape(service)}</strong>: ${escape(release.version)}<br>Commit: ${escape(release.commit)}</p>`).join('')}<p>These versions apply to the targeted run, not every historical campaign.</p></div></details>`;
    $('freshness').textContent=`Snapshot refreshed ${new Date(data.generatedAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}. Source revisions are linked below. This is a report aggregation, not a new test run.`;
    $('metrics').innerHTML=[[data.groups.length,'Published test groups','Linked to their detailed reports'],[scenarios.length,'Reported scenarios','Campaign outcomes preserved'],[highDefects.length,'Unique critical / high defects',`${high.filter(f=>f.type!=='Defect').length} additional critical/high gaps or questions`],[high.filter(f=>f.status==='PASS').length,'Critical / high findings: retest PASS','Narrow retest scope · not full-suite closure']].map(([n,title,note])=>`<div class="metric"><strong>${n}</strong><span>${title}</span><small>${note}</small></div>`).join('');
    $('group').insertAdjacentHTML('beforeend',data.groups.map(g=>`<option>${escape(g.name)}</option>`).join(''));
    $('status').insertAdjacentHTML('beforeend',[...statuses,'CONFLICT'].map(s=>`<option>${s}</option>`).join(''));
    $('groups').innerHTML=data.groups.map(g=>{const counts=statuses.map(s=>[s,g.scenarios.filter(r=>r.status===s).length]).filter(([,n])=>n).map(([s,n])=>`${n} ${s.toLowerCase()}`).join(' · ');const gh=g.findings.filter(f=>['critical','high'].includes(f.severity)&&f.type==='Defect');return `<article class="group-card"><h3>${escape(g.name)}</h3><p class="counts">${g.scenarios.length} scenarios · ${gh.length} critical/high defects*</p><p>${escape(counts)}</p><button data-group="${escape(g.name)}">Explore scenarios</button><a href="${g.url}">Detailed report ↗</a><small>Campaign: ${escape(g.checkpoint)}<br>${g.targeted?`Targeted retest: ${escape(g.targeted.updatedAt)}<br>`:''}Source <a href="https://github.com/capitalinvestmentclub/${g.repo}/commit/${g.commit}">${g.commit.slice(0,8)}</a></small></article>`;}).join('')+'<p><small>*Historical finding inventory. Shared findings count in each group, but only once in overall totals.</small></p>';
    function render(){
      const findings=$('view').value==='findings';
      const rows=(findings?data.uniqueFindings:scenarios).filter(r=>matches(r,$('search').value,$('group').value,$('status').value));
      $('count').textContent=`${rows.length} ${findings?'unique findings · result means latest available targeted retest':'scenarios · result means original campaign outcome'}`;
      $('results').innerHTML=rows.length?rows.map(r=>`<details><summary>${badge(r.status)}<span class="row-title"><small>${escape(r.id)} · ${escape(findings?r.groups.join(' / '):r.group)}${findings?` · ${escape(r.severity)} · ${escape(r.type)}`:''}</small>${escape(r.title)}</span></summary><div class="detail"><p><strong>${findings?'Original finding':'Observed coverage'}:</strong> ${escape(findings?r.summary:r.observation)||'See detailed source report.'}</p>${findings?`<p><strong>Targeted retest:</strong> ${escape(r.retestSummary)||'No targeted retest result is recorded in this snapshot.'}</p>`:`<p><strong>Remaining scope:</strong> ${escape(r.gap)||'See source report for scenario boundaries and follow-up.'}</p>`}<p><strong>Chrome viewport evidence</strong> — ${findings?'targeted finding check':'original scenario record'}; not reported is not a pass.</p>${viewport(r.responsive,data.sizes)}${r.limitations?.length?`<p><strong>Limitations:</strong> ${escape(Array.isArray(r.limitations)?r.limitations.join(' '):r.limitations)}</p>`:''}${r.evidence?.length?`<ul>${r.evidence.map(e=>`<li><a href="${safeLink(e.url)}">${escape(e.label)}</a></li>`).join('')}</ul>`:''}<a href="${safeLink(r.url)}">Open detailed report and run history ↗</a></div></details>`).join(''):'<p class="empty">No matching results. Change your filters or select Reset filters.</p>';
    }
    $('filters').addEventListener('submit',e=>e.preventDefault());
    $('filters').addEventListener('input',render);
    $('filters').addEventListener('change',render);
    $('filters').addEventListener('reset',event=>{
      event.preventDefault();
      $('view').value='scenarios';$('group').value='';$('status').value='';$('search').value='';
      render();
    });
    $('groups').addEventListener('click',e=>{const button=e.target.closest('[data-group]');if(button){$('group').value=button.dataset.group;$('view').value='scenarios';$('search').value='';$('status').value='';render();$('explore-heading').scrollIntoView();$('group').focus({preventScroll:true});}});
    render();
  }catch(error){$('freshness').textContent='The dashboard could not load its source snapshot.';$('results').innerHTML='<p class="error" role="alert">Please reload to retry. If the problem continues, use the original CIC reports; no results have been inferred.</p>';console.error(error);}
}
init();
