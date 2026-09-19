import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
import { normalizeGroup, deduplicate } from '../model.js';

const names = ['Pitcher','Admin','Organization','Grantor','Guest / Public','KYC Reviewer','KYC Approval','Super Admin','Support Operations','Cross-role Platform Journeys'];
const repos = ['pitcher','admin','organization','grantor','guest-public','kyc-reviewer','kyc-approval','super-admin','support-operations','cross-role-platform-journeys'];
// Assessor and Investor publish from the webapp gh-pages branch rather than a
// dedicated <role>-uat-report repo. webapp is private, so they are read from
// their public Pages URLs and pinned to the webapp commit recorded in the payload.
const hosted = [
  {name:'Assessor', url:'https://capitalinvestmentclub.github.io/webapp/pr-2323-review-report/', repo:'webapp'},
  {name:'Investor', url:'https://capitalinvestmentclub.github.io/webapp/pr-2328-review-report/', repo:'webapp'},
];
// Only extract known, published report scripts. No source script runs in the browser.
function extract(source) {
  const context = vm.createContext({ window: {}, document: { getElementById: () => ({}) } }, {codeGeneration:{strings:false,wasm:false}});
  vm.runInContext(source + '\n;globalThis.extracted = {report: typeof report === "undefined" ? null : report, data: window.ADMIN_UAT || window.GUEST_PUBLIC_UAT || window.ASSESSOR_UAT || window.INVESTOR_UAT, review: window.PR_REVIEW_DATA, updates: window.PR_REVIEW_UPDATES};', context, {timeout:1000});
  return JSON.parse(JSON.stringify(context.extracted));
}
async function get(url, optional=false) {
  const response = await fetch(url, {signal:AbortSignal.timeout(30000)});
  if (optional && response.status === 404) return null;
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return response.text();
}
const groups = await Promise.all(repos.map(async (name,index) => {
  const repo = `${name}-uat-report`;
  const commit = execFileSync('gh',['api',`repos/capitalinvestmentclub/${repo}/commits/HEAD`,'--jq','.sha'],{encoding:'utf8'}).trim();
  const raw = `https://raw.githubusercontent.com/capitalinvestmentclub/${repo}/${commit}/`;
  const [source,retest,targeted,releaseStatus] = await Promise.all([get(raw+'data.js'),get(raw+'retest.js',true),get(raw+'targeted-run.json',true),get(raw+'release-status.json',true)]);
  const parsed = extract(source);
  const updates = name === 'pitcher' && retest ? extract(retest).updates : {};
  const group = normalizeGroup({name:names[index],repo,commit,parsed,updates,targeted:targeted ? JSON.parse(targeted) : null,releaseStatus:releaseStatus ? JSON.parse(releaseStatus) : null});
  console.log(`${group.name}: ${group.scenarios.length} scenarios, ${group.findings.length} findings`);
  return group;
}));
const hostedGroups = await Promise.all(hosted.map(async (entry) => {
  // webapp is private, so raw.githubusercontent cannot serve it. Its Pages site
  // is public, and the payload carries the webapp commit it was generated from,
  // which is the provenance that matters for these two roles.
  const parsed = extract(await get(`${entry.url}data.js`));
  const commit = parsed.data?.source?.commit;
  if (!/^[a-f0-9]{40}$/.test(commit || '')) throw new Error(`Missing source commit: ${entry.name}`);
  const group = normalizeGroup({name:entry.name,repo:entry.repo,commit,parsed,updates:{},targeted:null,url:entry.url});
  console.log(`${group.name}: ${group.scenarios.length} scenarios, ${group.findings.length} findings`);
  return group;
}));
groups.push(...hostedGroups);
const reconciledPath = new URL('../runs/2026-09-18-passed-over-rerun/reconciled-276.json', import.meta.url);
const reconciledSource = await readFile(reconciledPath, 'utf8').catch(error => {
  if (error.code === 'ENOENT') return null;
  throw error;
});
const ledger = JSON.parse(reconciledSource || await readFile(new URL('../runs/2026-09-17-defect-batch-deployed-retest/deployed-retest-276.json', import.meta.url), 'utf8'));
const outcomeCounts = rows => Object.fromEntries([...new Set(rows.map(row=>row.status))].sort().map(status=>[status,rows.filter(row=>row.status===status).length]));
const deployedRetest = {
  runId: ledger.runId,
  state: ledger.state,
  completedAt: ledger.completedAt,
  browser: ledger.scope.browser,
  defaultViewport: ledger.scope.defaultViewport,
  total: ledger.findings.length,
  outcomes: outcomeCounts(ledger.findings),
  groups: [...new Set(ledger.findings.map(finding=>finding.group))].map(group=>{
    const findings=ledger.findings.filter(finding=>finding.group===group);
    return {group,total:findings.length,...outcomeCounts(findings)};
  }),
  ledger: reconciledSource ? 'runs/2026-09-18-passed-over-rerun/reconciled-276.json' : 'runs/2026-09-17-defect-batch-deployed-retest/deployed-retest-276.json',
  ...(reconciledSource ? { priorLedger: ledger.sourceRuns[0], rerunLedger: ledger.sourceRuns[1] } : {}),
};
const data = {generatedAt:new Date().toISOString(),sizes:['360×800','390×844','768×1024','1024×768','1280×800','1440×900'],groups,uniqueFindings:deduplicate(groups),deployedRetest};
await writeFile(new URL('../dashboard-data.json',import.meta.url), JSON.stringify(data,null,2)+'\n');
