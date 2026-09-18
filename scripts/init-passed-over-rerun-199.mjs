import { mkdir, readFile, writeFile } from 'node:fs/promises';

const root = new URL('../runs/2026-09-18-passed-over-rerun/', import.meta.url);
const source = JSON.parse(await readFile(new URL('../runs/2026-09-17-defect-batch-deployed-retest/deployed-retest-276.json', import.meta.url), 'utf8'));
const plan = JSON.parse(await readFile(new URL('../runs/2026-09-17-defect-batch-deployed-retest/PASSED_OVER_RETEST_PLAN.json', import.meta.url), 'utf8'));
const planById = new Map(plan.plans.map((entry) => [entry.id, entry]));
const findings = source.findings.filter((finding) => finding.status === 'PASSED_OVER').map((finding) => ({
  id: finding.id,
  group: finding.group,
  scenarioId: finding.scenarioId,
  severity: finding.severity,
  title: finding.title,
  previousOutcome: finding.status,
  previousDisposition: finding.disposition,
  wave: planById.get(finding.id)?.wave,
  familyId: planById.get(finding.id)?.familyId,
  status: 'NOT_RUN',
  disposition: null,
  testedAt: null,
  browser: 'Chrome',
  viewport: null,
  targetUrl: null,
  apiUrl: null,
  evidence: [],
  notes: null,
}));
if (findings.length !== 199 || findings.some((finding) => !finding.familyId)) throw new Error('Expected 199 planned passed-over findings');
const now = new Date().toISOString();
const run = {
  schemaVersion: 1,
  runId: '2026-09-18-passed-over-rerun',
  state: 'IN_PROGRESS',
  startedAt: now,
  updatedAt: now,
  scope: {
    findingCount: findings.length,
    browser: 'Chrome',
    defaultViewport: '1792x976',
    mutability: 'Seed data and permanent test-environment changes allowed.',
    passwordPolicy: 'Restore any existing-user password immediately after its scenario and prove the restored credential works.',
    terminalOutcomes: ['PASS', 'FAIL', 'BLOCKED'],
    passedOverAllowed: false,
  },
  targets: source.targets,
  findings,
};
await mkdir(root, { recursive: true });
await writeFile(new URL('passed-over-rerun-199.json', root), JSON.stringify(run, null, 2) + '\n');
console.log(`Initialized ${findings.length} findings.`);
