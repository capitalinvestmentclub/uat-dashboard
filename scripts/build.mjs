import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import vm from 'node:vm';
import { normalizeGroup, deduplicate } from '../model.js';

const names = ['Pitcher','Admin','Organization','Grantor','Guest / Public','KYC Reviewer','KYC Approval','Super Admin','Support Operations','Cross-role Platform Journeys'];
const repos = ['pitcher','admin','organization','grantor','guest-public','kyc-reviewer','kyc-approval','super-admin','support-operations','cross-role-platform-journeys'];
// Only extract known, published report scripts. No source script runs in the browser.
function extract(source) {
  const context = vm.createContext({ window: {}, document: { getElementById: () => ({}) } }, {codeGeneration:{strings:false,wasm:false}});
  vm.runInContext(source + '\n;globalThis.extracted = {report: typeof report === "undefined" ? null : report, data: window.ADMIN_UAT || window.GUEST_PUBLIC_UAT, review: window.PR_REVIEW_DATA, updates: window.PR_REVIEW_UPDATES};', context, {timeout:1000});
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
  const [source,retest,targeted] = await Promise.all([get(raw+'data.js'),get(raw+'retest.js',true),get(raw+'targeted-run.json',true)]);
  const parsed = extract(source);
  const updates = name === 'pitcher' && retest ? extract(retest).updates : {};
  const group = normalizeGroup({name:names[index],repo,commit,parsed,updates,targeted:targeted ? JSON.parse(targeted) : null});
  console.log(`${group.name}: ${group.scenarios.length} scenarios, ${group.findings.length} findings`);
  return group;
}));
const data = {generatedAt:new Date().toISOString(),sizes:['360×800','390×844','768×1024','1024×768','1280×800','1440×900'],groups,uniqueFindings:deduplicate(groups)};
await writeFile(new URL('../dashboard-data.json',import.meta.url), JSON.stringify(data,null,2)+'\n');
