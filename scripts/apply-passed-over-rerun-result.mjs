#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const [, , resultFile] = process.argv;
if (!resultFile) throw new Error('Usage: node scripts/apply-passed-over-rerun-result.mjs <result.json>');
const dashboardRoot = process.cwd();
const runDir = path.join(dashboardRoot, 'runs/2026-09-18-passed-over-rerun');
const ledgerFile = path.join(runDir, 'passed-over-rerun-199.json');
const absoluteResult = path.resolve(resultFile);
const result = JSON.parse(fs.readFileSync(absoluteResult, 'utf8'));
const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'));
const terminal = new Set(['PASS', 'FAIL', 'BLOCKED']);
if (!terminal.has(result.outcome)) throw new Error(`Invalid outcome: ${result.outcome}`);
if (!Array.isArray(result.findingIds) || !result.findingIds.length) throw new Error('findingIds are required');
const byId = new Map(ledger.findings.map((finding) => [finding.id, finding]));
for (const id of result.findingIds) {
  const finding = byId.get(id);
  if (!finding) throw new Error(`Unknown finding: ${id}`);
  if (finding.status !== 'NOT_RUN' && finding.status !== result.outcome) throw new Error(`${id} is already ${finding.status}`);
  const evidence = [path.relative(runDir, absoluteResult)];
  const screenshots = result.screenshots || (result.screenshot ? [result.screenshot] : []);
  evidence.unshift(...screenshots.map((screenshot) => path.join(path.relative(runDir, path.dirname(absoluteResult)), screenshot)));
  Object.assign(finding, {
    status: result.outcome,
    disposition: result.outcome === 'PASS' ? 'VERIFIED_FIXED_DEPLOYED' : result.disposition || result.outcome,
    testedAt: result.testedAt || new Date().toISOString(),
    browser: 'Chrome',
    viewport: result.viewport ? `${result.viewport.width}x${result.viewport.height}` : null,
    targetUrl: result.targetUrl || null,
    apiUrl: 'https://cicdevapi.uc.r.appspot.com',
    evidence,
    notes: Array.isArray(result.assertions) ? result.assertions.join('; ') : result.notes || null,
  });
}
ledger.updatedAt = result.testedAt || new Date().toISOString();
fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2) + '\n');
const counts = ledger.findings.reduce((acc, finding) => ({ ...acc, [finding.status]: (acc[finding.status] || 0) + 1 }), {});
console.log(JSON.stringify({ updated: result.findingIds, counts }, null, 2));
