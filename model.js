export const statuses = ['PASS','FAIL','PARTIAL','BLOCKED','NOT RUN','NOT REPORTED'];
export function status(value) {
  const text = String(value ?? '').toUpperCase().trim();
  if (text.startsWith('IN PROGRESS')) return 'PARTIAL';
  return statuses.find(s => text === s || text.startsWith(s+' ·')) || 'NOT REPORTED';
}
export function normalizeGroup({name,repo,commit,parsed,updates={},targeted=null,url:reportUrl=null}) {
  const source = parsed.report || parsed.data;
  if (!source || !Array.isArray(source.scenarios) || !source.scenarios.length) throw new Error(`Missing scenarios: ${repo}`);
  // Most roles publish at <repo>.github.io/<repo>/. A role whose report lives in a
  // subdirectory of another repo's Pages site passes its own URL instead, so the
  // repo stays the real repository name and its commit link keeps working.
  const url = reportUrl || `https://capitalinvestmentclub.github.io/${repo}/`;
  const sizes = source.sizes || [];
  const prefix = repo.startsWith('pitcher') ? 'PIT' : repo.startsWith('kyc-reviewer') ? 'KYCR' : 'KYCA';
  const scenarios = source.scenarios.map(row => {
    const numeric = typeof row[0] === 'number';
    const [id,title,observation,gap,coverage] = numeric ? [`${prefix}-${String(row[0]).padStart(3,'0')}`,row[1],row[2],row[3],row[4]] : [row[0],row[2],row[3] || '', '', null];
    const outcome = prefix === 'PIT' ? 'PARTIAL' : numeric ? status(observation) : status(row[1]);
    const responsive = numeric ? sizes.map((size,i)=>({size,status:prefix==='PIT'?'PARTIAL':status(Array.isArray(coverage)?coverage[i]:coverage),note:prefix==='PIT'?'incomplete':Array.isArray(coverage)?coverage[i]:coverage || 'Not explicitly reported'})) : [];
    return {id,title,status:outcome,observation,gap,responsive,url:url+(numeric?`#scenario-${row[0]}`:'')};
  });
  const rawFindings = prefix === 'PIT' ? source.findings.map(([severity,ids,title,steps,description,expected,evidenceStatus],i)=>({id:'PIT-F'+String(i+1).padStart(3,'0'),severity,title,description,scenario:ids.map(n=>'PIT-'+String(n).padStart(3,'0')).join(' / '),type:evidenceStatus==='Observed defect'?'Defect':'Question'})) : parsed.review?.findings || source.findings || [];
  const findings = rawFindings.map(f => {
    const retest = targeted?.findings?.find(t=>t.id===f.id);
    const update = updates?.[f.id];
    const responsive=(retest?.responsive || update?.retest?.sizes || []).map(cell=>({...cell,evidence:(cell.evidence || []).map(e=>({...e,url:new URL(e.url,url).href}))}));
    return {id:f.id,title:f.title,type:f.type || 'Defect',severity:String(f.severity || 'not reported').toLowerCase(),scenario:f.scenario || '',summary:f.summary || f.description || '',historicalStatus:f.status || 'Open',status:retest ? status(retest.status) : update?.status === 'Fixed' ? 'PASS' : 'NOT REPORTED',retestSummary:retest?.summary || update?.resolution || '',responsive,limitations:retest?.limitations || [],evidence:(retest?.evidence || update?.fix?.evidence || []).map(e=>({...e,url:new URL(e.url,url).href})),url,group:name};
  });
  return {name,repo,commit,url,checkpoint:source.cutoff || source.updated || parsed.review?.meta?.checkpoint || 'See source report',scenarios,findings,targeted:targeted ? {runId:targeted.runId,updatedAt:targeted.updatedAt,state:targeted.state,deployments:targeted.deployments,repairBatch:targeted.repairBatch || null} : null};
}
export function deduplicate(groups) {
  const unique = new Map();
  for (const g of groups) for (const f of g.findings) {
    // Deduplicate only exact identity AND title. Conflicting outcomes remain visible.
    const key = `${f.id}|${f.title}`;
    const existing = unique.get(key);
    if (existing) {
      const memberships=[...existing.groups,g.name];
      if(existing.status==='NOT REPORTED' && f.status!=='NOT REPORTED') Object.assign(existing,f);
      else if(f.status!=='NOT REPORTED' && existing.status!==f.status) existing.status='CONFLICT';
      existing.groups=memberships;
    }
    else unique.set(key,{...f,groups:[g.name]});
  }
  return [...unique.values()];
}
export function matches(row,query,group,outcome) {
  return (!group || row.group===group || row.groups?.includes(group)) && (!outcome || row.status===outcome) && `${row.id} ${row.title} ${row.summary || ''} ${row.observation || ''}`.toLowerCase().includes(query.trim().toLowerCase());
}
export const severities=['critical','high','medium','low','not reported'];
export const defectStatuses=[['PASS','Fixed · retest passed'],['FAIL','Still failing'],['PARTIAL','Partially verified'],['BLOCKED','Verification blocked'],['NOT RUN','Retest not run'],['NOT REPORTED','Awaiting verification'],['CONFLICT','Conflicting evidence']];
export function defectStatusBreakdown(findings) {
  const defects=findings.filter(f=>f.type==='Defect');
  return defectStatuses.map(([status,label])=>({status,label,count:defects.filter(f=>f.status===status).length,
    percent:defects.length?defects.filter(f=>f.status===status).length/defects.length*100:0}));
}
export function severityBreakdown(findings) {
  return severities.map(severity=>{
    const rows=findings.filter(f=>(severities.includes(f.severity)?f.severity:'not reported')===severity);
    return {severity,count:rows.length,percent:findings.length?rows.length/findings.length*100:0,
      outcomes:Object.fromEntries([...statuses,'CONFLICT'].map(s=>[s,rows.filter(f=>f.status===s).length]))};
  });
}
export function executionBreakdown(scenarios) {
  const count=s=>scenarios.filter(r=>r.status===s).length;
  const executed=count('PASS')+count('FAIL');
  const partial=count('PARTIAL'),blocked=count('BLOCKED'),notRun=count('NOT RUN');
  return {total:scenarios.length,executed,partial,blocked,notRun,unknown:scenarios.length-executed-partial-blocked-notRun,
    percent:scenarios.length?executed/scenarios.length*100:0};
}
