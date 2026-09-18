import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Usage: node scripts/init-deployed-retest-276.mjs <execution-register.json>');

const sourceBytes = await readFile(sourcePath);
const source = JSON.parse(sourceBytes);
if (source.findings?.length !== 276) throw new Error('Expected 276 findings, received ' + (source.findings?.length ?? 0));

const runId = '2026-09-17-defect-batch-deployed-retest';
const outputDirectory = new URL('../runs/' + runId + '/', import.meta.url);
await mkdir(outputDirectory, { recursive: true });

const findings = source.findings.map((finding) => ({
  id: finding.id,
  group: finding.group,
  scenarioId: finding.scenarioId,
  severity: finding.severity,
  title: finding.title,
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

const run = {
  schemaVersion: 1,
  runId,
  state: 'IN_PROGRESS',
  executionMode: 'cloud',
  startedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  scope: {
    sourceFindingCount: 276,
    sourceRegisterSha256: createHash('sha256').update(sourceBytes).digest('hex'),
    uniqueScenarioFamilies: new Set(findings.map((finding) => finding.scenarioId)).size,
    browser: 'Chrome',
    defaultViewport: '1792x976',
    viewportPolicy: 'One representative desktop viewport unless the finding concerns responsiveness or the observed behavior warrants expansion.',
    mergePolicy: 'Keep report changes local until every finding is PASS, FAIL, BLOCKED, OBSOLETE, DUPLICATE_COVERAGE, or PASSED_OVER.',
  },
  targets: {
    frontend: {
      url: 'https://auth-35306705473-1-dot-planar-truck-361704.uc.r.appspot.com',
      version: 'auth-35306705473-1',
      mergeCommit: 'd8777aae575f942514538381d54d3715aabf4b8c',
      trafficPromoted: false,
    },
    api: {
      url: 'https://cicdevapi.uc.r.appspot.com',
      mergeCommit: '46a098ebcdcdebac39d1ba73569c793cd70a72fb',
      health: '/api/v1/health',
      postMergeTestRisk: '5 suites and 7 tests failed in workflow run 35281782628.',
    },
    notificationservice: {
      mergeCommit: '08b76889070663f7e7d57cad2003d5cd87378340',
    },
  },
  findings,
};

await writeFile(new URL('deployed-retest-276.json', outputDirectory), JSON.stringify(run, null, 2) + '\n');
console.log('Initialized ' + findings.length + ' findings across ' + run.scope.uniqueScenarioFamilies + ' scenario families.');
