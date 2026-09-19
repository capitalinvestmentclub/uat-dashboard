#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const originalPath = new URL('runs/2026-09-17-defect-batch-deployed-retest/deployed-retest-276.json', root);
const rerunPath = new URL('runs/2026-09-18-passed-over-rerun/passed-over-rerun-199.json', root);
const outputPath = new URL('runs/2026-09-18-passed-over-rerun/reconciled-276.json', root);
const dashboardPath = new URL('dashboard-data.json', root);
const original = JSON.parse(await readFile(originalPath, 'utf8'));
const rerun = JSON.parse(await readFile(rerunPath, 'utf8'));
const terminal = new Set(['PASS', 'FAIL', 'BLOCKED', 'OBSOLETE', 'DUPLICATE_COVERAGE', 'PASSED_OVER']);
if (original.findings.length !== 276 || rerun.findings.length !== 199) throw new Error('Unexpected original/rerun denominator');
const prior = new Map(original.findings.map(finding => [finding.id, finding]));
const updates = new Map();
for (const finding of rerun.findings) {
  const historical = prior.get(finding.id);
  if (!historical || historical.status !== 'PASSED_OVER' || updates.has(finding.id)) throw new Error(`Invalid rerun ID: ${finding.id}`);
  if (!['PASS', 'FAIL', 'BLOCKED'].includes(finding.status)) throw new Error(`Incomplete rerun: ${finding.id} ${finding.status}`);
  for (const evidence of finding.evidence || []) {
    if (!evidence.startsWith('evidence/')) throw new Error(`Unexpected evidence path: ${finding.id} ${evidence}`);
    await readFile(new URL(`runs/2026-09-18-passed-over-rerun/${evidence}`, root));
  }
  updates.set(finding.id, finding);
}
if (updates.size !== 199 || original.findings.filter(finding => finding.status === 'PASSED_OVER').length !== 199) throw new Error('Passed-over IDs do not reconcile');
const findings = original.findings.map(finding => {
  const update = updates.get(finding.id);
  if (!update) return { ...finding, evidence: (finding.evidence || []).map(item => `../2026-09-17-defect-batch-deployed-retest/${item}`) };
  return {
    ...finding,
    previousOutcome: finding.status,
    previousDisposition: finding.disposition,
    previousEvidence: (finding.evidence || []).map(item => `../2026-09-17-defect-batch-deployed-retest/${item}`),
    status: update.status,
    disposition: update.disposition,
    testedAt: update.testedAt,
    browser: update.browser,
    viewport: update.viewport,
    targetUrl: update.targetUrl,
    apiUrl: update.apiUrl,
    evidence: update.evidence,
    notes: update.notes,
    rerunId: rerun.runId,
  };
});
if (findings.some(finding => !terminal.has(finding.status))) throw new Error('Reconciliation left nonterminal entries');
const counts = rows => Object.fromEntries([...new Set(rows.map(row => row.status))].sort().map(status => [status, rows.filter(row => row.status === status).length]));
const completedAt = rerun.updatedAt;
const reconciled = { ...original, runId: '2026-09-18-reconciled-defect-batch', state: 'COMPLETE', updatedAt: completedAt, completedAt,
  sourceRuns: [
    'runs/2026-09-17-defect-batch-deployed-retest/deployed-retest-276.json',
    'runs/2026-09-18-passed-over-rerun/passed-over-rerun-199.json',
  ], findings };
const dashboard = JSON.parse(await readFile(dashboardPath, 'utf8'));
dashboard.generatedAt = new Date().toISOString();
dashboard.deployedRetest = {
  runId: reconciled.runId, state: 'COMPLETE', completedAt, browser: original.scope.browser,
  defaultViewport: original.scope.defaultViewport, total: findings.length, outcomes: counts(findings),
  groups: [...new Set(findings.map(finding => finding.group))].map(group => {
    const rows = findings.filter(finding => finding.group === group);
    return { group, total: rows.length, ...counts(rows) };
  }),
  ledger: 'runs/2026-09-18-passed-over-rerun/reconciled-276.json',
  priorLedger: reconciled.sourceRuns[0], rerunLedger: reconciled.sourceRuns[1],
};
await writeFile(rerunPath, JSON.stringify({ ...rerun, state: 'COMPLETE', completedAt }, null, 2) + '\n');
await writeFile(outputPath, JSON.stringify(reconciled, null, 2) + '\n');
await writeFile(dashboardPath, JSON.stringify(dashboard, null, 2) + '\n');
console.log(JSON.stringify({ total: findings.length, outcomes: counts(findings), rerun: counts(rerun.findings) }, null, 2));
