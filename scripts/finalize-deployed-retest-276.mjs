import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const dashboardRoot = path.resolve(scriptDirectory, '..');
const workspaceRoot = path.resolve(dashboardRoot, '../..');
const runDirectory = path.join(dashboardRoot, 'runs/2026-09-17-defect-batch-deployed-retest');
const ledgerPath = path.join(runDirectory, 'deployed-retest-276.json');
const snapshotPath = path.join(dashboardRoot, 'dashboard-data.json');
const reportName = '2026-09-18-defect-delivery-retest';
const terminalStatuses = new Set(['PASS', 'FAIL', 'BLOCKED', 'OBSOLETE', 'DUPLICATE_COVERAGE', 'PASSED_OVER']);

const targets = new Map([
  ['Pitcher', path.join(workspaceRoot, 'pitcher-uat-report')],
  ['Admin', path.join(workspaceRoot, 'admin-uat-report')],
  ['Organization', path.join(workspaceRoot, 'organization-uat-report')],
  ['Grantor', path.join(workspaceRoot, 'grantor-uat-report')],
  ['Guest / Public', path.join(workspaceRoot, 'guest-public-uat-report')],
  ['KYC Reviewer', path.join(workspaceRoot, 'kyc-reviewer-uat-report')],
  ['KYC Approval', path.join(workspaceRoot, 'kyc-approval-uat-report')],
  ['Support Operations', path.join(workspaceRoot, 'support-operations-uat-report')],
  ['Assessor', path.join(dashboardRoot, '../webapp-gh-pages/pr-2323-review-report')],
  ['Investor', path.join(dashboardRoot, '../webapp-gh-pages/pr-2328-review-report')],
]);

const ledger = JSON.parse(await readFile(ledgerPath, 'utf8'));
if (ledger.findings?.length !== 276) throw new Error(`Expected 276 findings, received ${ledger.findings?.length ?? 0}`);
const incomplete = ledger.findings.filter((finding) => !terminalStatuses.has(finding.status));
if (incomplete.length) throw new Error(`Cannot finalize: ${incomplete.length} findings are not terminal`);

function countBy(rows, key) {
  return Object.fromEntries([...new Set(rows.map((row) => row[key]))].sort().map((value) => [value, rows.filter((row) => row[key] === value).length]));
}

function markdown(group, rows, summary) {
  const severity = countBy(rows, 'severity');
  const outcome = countBy(rows, 'status');
  const escapeCell = (value) => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
  return `# ${group} deployed defect-delivery retest\n\n` +
    `Completed: ${ledger.completedAt}\n\n` +
    `Environment: deployed development · Google Chrome · ${ledger.scope.defaultViewport} by default; additional sizes only for responsive findings.\n\n` +
    `This report records terminal disposition for every ${group} entry in the 276-finding delivery batch. ` +
    `PASS means the deployed behavior was verified. FAIL means the deployed defect remains reproducible. ` +
    `PASSED_OVER means the bounded attempt could not produce trustworthy proof, commonly because an exact fixture, actor, reversible mutation, or stable protected page was unavailable. ` +
    `DUPLICATE_COVERAGE points to another finding that exercised the same behavior.\n\n` +
    `## Summary\n\n` +
    `| Total | PASS | FAIL | DUPLICATE_COVERAGE | PASSED_OVER |\n|---:|---:|---:|---:|---:|\n` +
    `| ${summary.total} | ${summary.PASS ?? 0} | ${summary.FAIL ?? 0} | ${summary.DUPLICATE_COVERAGE ?? 0} | ${summary.PASSED_OVER ?? 0} |\n\n` +
    `Severity inventory: ${Object.entries(severity).map(([key, value]) => `${key} ${value}`).join(' · ')}. ` +
    `Outcome reconciliation: ${Object.entries(outcome).map(([key, value]) => `${key} ${value}`).join(' · ')}.\n\n` +
    `## Finding dispositions\n\n` +
    `| ID | Severity | Outcome | Title | Disposition | Tested |\n|---|---|---|---|---|---|\n` +
    rows.map((finding) => `| ${escapeCell(finding.id)} | ${escapeCell(finding.severity)} | ${escapeCell(finding.status)} | ${escapeCell(finding.title)} | ${escapeCell(finding.disposition)} | ${escapeCell(finding.testedAt)} |`).join('\n') +
    `\n\nThe machine-readable companion file preserves target URLs, evidence paths, notes, browser, viewport, and API provenance for each entry.\n`;
}

ledger.state = 'COMPLETE';
ledger.completedAt = ledger.updatedAt;
const allCounts = countBy(ledger.findings, 'status');
const groups = [];

for (const [group, directory] of targets) {
  const findings = ledger.findings.filter((finding) => finding.group === group);
  if (!findings.length) throw new Error(`No ledger findings found for ${group}`);
  const counts = countBy(findings, 'status');
  const summary = { total: findings.length, ...counts };
  const payload = {
    schemaVersion: 1,
    runId: ledger.runId,
    state: ledger.state,
    completedAt: ledger.completedAt,
    environment: ledger.targets,
    scope: ledger.scope,
    group,
    summary,
    findings,
  };
  await mkdir(path.join(directory, 'runs'), { recursive: true });
  await writeFile(path.join(directory, 'runs', `${reportName}.json`), JSON.stringify(payload, null, 2) + '\n');
  await writeFile(path.join(directory, 'DEPLOYED_RETEST_2026-09-18.md'), markdown(group, findings, summary));
  groups.push({ group, ...summary });
}

await writeFile(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8'));
snapshot.deployedRetest = {
  runId: ledger.runId,
  state: ledger.state,
  completedAt: ledger.completedAt,
  browser: ledger.scope.browser,
  defaultViewport: ledger.scope.defaultViewport,
  total: ledger.findings.length,
  outcomes: allCounts,
  groups,
  ledger: 'runs/2026-09-17-defect-batch-deployed-retest/deployed-retest-276.json',
};
await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2) + '\n');

console.log(JSON.stringify({ state: ledger.state, total: ledger.findings.length, outcomes: allCounts, groups }, null, 2));
