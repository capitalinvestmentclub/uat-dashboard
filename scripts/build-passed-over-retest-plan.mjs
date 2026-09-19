import { readFile, writeFile } from 'node:fs/promises';

const ledgerUrl = new URL('../runs/2026-09-17-defect-batch-deployed-retest/deployed-retest-276.json', import.meta.url);
const registerUrl = new URL('../../../awaiting276-local-20260916/execution-register.json', import.meta.url);
const outputDirectory = new URL('../runs/2026-09-17-defect-batch-deployed-retest/', import.meta.url);
const ledger = JSON.parse(await readFile(ledgerUrl, 'utf8'));
const register = JSON.parse(await readFile(registerUrl, 'utf8'));
const sourceById = new Map(register.findings.map((finding) => [finding.id, finding]));
const passedOver = ledger.findings.filter((finding) => finding.status === 'PASSED_OVER');
if (passedOver.length !== 199) throw new Error(`Expected 199 passed-over findings, received ${passedOver.length}`);

const families = {
  identity: {
    wave: 1,
    name: 'Identity, registration, verification and account security',
    actors: ['fresh Assessor', 'fresh Investor', 'fresh Pitcher', 'controlled mailbox', 'Admin'],
    seed: 'Create mailbox-backed disposable users in verified, unverified, incomplete-profile and locked states. Preserve every original password before a password scenario.',
    flow: 'Execute registration, verification, login/lockout, recovery, readiness gating and account-policy paths in Chrome; reload and reauthenticate after every persisted transition.',
  },
  profile: {
    wave: 2,
    name: 'Profile, account settings, accessibility and export',
    actors: ['editable Assessor', 'Investor', 'Admin'],
    seed: 'Seed editable profiles with controlled expertise, qualifications, employment, awards, KYC draft data, public links and availability settings.',
    flow: 'Exercise the exact control named by the finding, include invalid and boundary input, save, reload, inspect accessible names and downstream profile rendering.',
  },
  requests: {
    wave: 3,
    name: 'Assessment request creation, delivery and negotiation',
    actors: ['funded requester', 'requestable Assessor', 'controlled mailboxes'],
    seed: 'Create a requestable, KYC-eligible Assessor and funded Pitcher/Investor requesters; seed free and paid pending requests with unique correlation labels.',
    flow: 'Run create, retry/idempotency, accept, reject, cancel and counteroffer paths; reconcile requester and Assessor workspaces, wallets, notifications and email after refresh.',
  },
  assessment: {
    wave: 4,
    name: 'Assessment editor, drafts, submission, RFI, rework and ratings',
    actors: ['Assessor', 'originating requester', 'organization viewer/non-owner'],
    seed: 'Create active Review, Technology and structured-task assignments plus completed and rework-requested variants, all with known owners and editable drafts.',
    flow: 'Exercise save, refresh, resume, validation, concurrent tabs, unsaved navigation, submit, immutable result, RFI, rework/version and rating/report paths across both actors.',
  },
  finance: {
    wave: 5,
    name: 'Wallet, holds, receipts, settlement and withdrawal',
    actors: ['funded payer', 'payee Assessor', 'approved-KYC Investor', 'Admin'],
    seed: 'Credit synthetic wallets, create uniquely labelled holds, completed settlements, failed withdrawals and pending bids; capture starting balances and ledger IDs.',
    flow: 'Perform the financial action in Chrome, force each required terminal branch, then reconcile balances, reservations, receipts, payer/payee direction and immutable ledger history.',
  },
  sessions: {
    wave: 5,
    name: 'Scheduling, live session and communications lifecycle',
    actors: ['host', 'two participants', 'overflow participant', 'controlled mailboxes'],
    seed: 'Give the host sufficient credits and create scheduled, rescheduled, cancelled, capacity-full and completed sessions with unique titles.',
    flow: 'Exercise invitations, prejoin, join denial, capacity, presence, chat, leave/end, summaries and email CTAs in separate Chrome contexts; verify persisted terminal state.',
  },
  projects: {
    wave: 6,
    name: 'Projects, temporary access, milestones, RFI and governance',
    actors: ['project owner', 'temporary Assessor', 'unrelated Investor', 'organization actor'],
    seed: 'Create a funded project with nonzero wallet, multiple shareholders, active/completed temporary assignments, milestones, RFIs and a governance-report obligation.',
    flow: 'Test discovery, privacy, role authorization, create/comment/review/revoke, RFI follow-up/reopen and governance revision through each actor; refresh and compare downstream state.',
  },
  grants: {
    wave: 6,
    name: 'Grant eligibility, applications, invitations and decisions',
    actors: ['Grantor', 'anonymous co-grantor', 'eligible Assessor', 'ineligible Assessor', 'Admin'],
    seed: 'Create draft, open, closed and terminated grants with applications in pending/approved/rejected states, custom URLs, anonymous/fixed co-grantors and funded balances.',
    flow: 'Exercise catalogue filtering, eligibility, application rejection, invitations, membership counts, decisions, disbursement, chat/feedback and deep links across actors.',
  },
  messaging: {
    wave: 4,
    name: 'Messaging, unread state and notifications',
    actors: ['sender', 'recipient', 'requester', 'Assessor'],
    seed: 'Create writable, cancelled and completed assessment conversations with controlled unread counts and system-context events.',
    flow: 'Send HTML-shaped and long Unicode content, test read/unread synchronization, responsive action reachability, system attribution and terminal write denial after reload.',
  },
  marketplace: {
    wave: 6,
    name: 'Marketplace listing, bids, privacy and reservation lifecycle',
    actors: ['seller', 'buyer', 'unrelated visitor'],
    seed: 'Give the seller available equity and create active/pending/expired listings and bids in known currencies with sufficient buyer funds.',
    flow: 'Exercise list, over-list, bid expiry, pending decision, cancel/revoke, holder privacy, currency consistency and reservation release across seller/buyer/visitor contexts.',
  },
  operations: {
    wave: 2,
    name: 'Admin, KYC and support operations',
    actors: ['Admin', 'Super Admin', 'KYC Reviewer', 'KYC Approver', 'Support'],
    seed: 'Seed disposable users, grants, KYC cases, notification templates, feedback records, legal holds and export requests in every required lifecycle state.',
    flow: 'Use the authorized operational role in Chrome to execute the named row action, decision, filter, preview or backfill; verify rationale, accessibility, state refresh and audit history.',
  },
  closure: {
    wave: 7,
    name: 'Account closure and post-close security',
    actors: ['disposable Assessor', 'Admin', 'controlled mailbox'],
    seed: 'Create a disposable verified Assessor with removable blockers, auditable activity and a controlled recovery mailbox.',
    flow: 'Exercise blocker feedback, closure request, approval and post-close access/reset behavior; verify notifications and immutable admin notes. Never close a shared test identity.',
  },
  dates: {
    wave: 3,
    name: 'Cross-surface date persistence matrix',
    actors: ['Pitcher', 'Assessor', 'Investor', 'Admin', 'Support'],
    seed: 'Create editable KYC, external-holder, agreement, milestone, financial-report, grant, feedback and assessment records using distinctive dates around month/DST boundaries.',
    flow: 'Enter each date through Chrome in America/Phoenix, save, reload, reopen the editor and compare list/detail/history/email values to the exact entered calendar date.',
  },
  communications: {
    wave: 4,
    name: 'Transactional email content and deep-link delivery',
    actors: ['Pitcher', 'Investor', 'Assessor', 'Grantor', 'controlled mailboxes'],
    seed: 'Create fresh uniquely labelled session, request, negotiation, promotion/agreement and grant-decision events with mailbox access for every sender and recipient.',
    flow: 'Trigger each event in Chrome, retrieve the actual message, verify recipient/role/copy/date/duration/reason, follow the CTA in the intended actor context and confirm the destination.',
  },
  organizationPublic: {
    wave: 7,
    name: 'Organization, Grantor and public account lifecycle coverage',
    actors: ['organization owner', 'viewer', 'restricted member', 'Grantor', 'guest', 'allowed user', 'restricted user'],
    seed: 'Create three complete organizations, public-funding records, verified/unverified accounts and an explicit allowed/restricted identity pair.',
    flow: 'Run creation, verification, membership/role, public discovery, funding and authorization lifecycles end to end; verify persisted state and denial behavior after refresh.',
  },
  pitcherLifecycle: {
    wave: 6,
    name: 'Pitcher lifecycle, agreements, assessments and bid presentation',
    actors: ['Pitcher owner', 'Assessor', 'Investor bidder', 'Admin'],
    seed: 'Create an activated Pitcher, completed paid review owned by that Pitcher, promoted pitch with agreement, pending project bid and terminal grant application.',
    flow: 'Exercise activation CTA, completed-result deep link, agreement promotion link, terminal grant state and pending bid actions at the required viewport; verify immutable persisted results.',
  },
  investorSocial: {
    wave: 3,
    name: 'Investor preferences, follows and reporting',
    actors: ['Investor', 'followed target', 'report target', 'Admin'],
    seed: 'Create discoverable pitches/profiles with known preference attributes, follow state and a disposable report target.',
    flow: 'Toggle preferences and follow state, filter favourites, submit a report and verify counts, acknowledgement and durable audit state immediately and after identity refresh.',
  },
};

function numericId(id, prefix) {
  const match = id.match(new RegExp(`^${prefix}(\\d+)$`));
  return match ? Number(match[1]) : null;
}

function familyFor(finding) {
  const d = numericId(finding.id, 'D-A');
  const inv = numericId(finding.id, 'INV-F');
  if (inv !== null) {
    if (inv <= 8) return 'identity';
    if (inv <= 16) return ['INV-F011','INV-F012'].includes(finding.id) ? 'sessions' : 'finance';
    if (inv <= 19) return 'investorSocial';
    return 'projects';
  }
  if (d !== null) {
    if ([1,6,7,8,9,17,18,19].includes(d)) return 'identity';
    if ([12,14,24,25,26,27,28,31,32].includes(d)) return 'profile';
    if ([39,40].includes(d)) return 'assessment';
    if ((d >= 42 && d <= 68) || [72,74,75].includes(d)) return d === 44 || d === 45 || d === 46 || d === 60 || d === 66 || d === 68 ? 'communications' : 'requests';
    if (d >= 76 && d <= 92) return 'assessment';
    if (d >= 93 && d <= 105) return 'finance';
    if (d >= 106 && d <= 108) return 'assessment';
    if (d >= 109 && d <= 111) return 'finance';
    if (d >= 113 && d <= 119) return 'projects';
    if (d >= 120 && d <= 131) return 'sessions';
    if (d >= 132 && d <= 141) return 'grants';
    if (d >= 142 && d <= 149) return 'messaging';
    if (d >= 155 && d <= 160) return 'marketplace';
    if (d >= 161 && d <= 165) return 'closure';
  }
  if (finding.id.startsWith('G-A')) return finding.title.toLowerCase().includes('grant') ? 'grants' : finding.title.toLowerCase().includes('buy table') ? 'marketplace' : 'profile';
  if (finding.id.startsWith('ADM') || finding.id.startsWith('KYCR') || finding.id.startsWith('KYCA') || finding.id.startsWith('SUP')) return finding.id.includes('DATE') || finding.title.toLowerCase().includes('date shift') ? 'dates' : 'operations';
  if (finding.id.startsWith('ORG') || finding.id.startsWith('GRT024') || finding.id.startsWith('PUB')) return 'organizationPublic';
  if (finding.id === 'GRT014-STATE-001') return 'grants';
  if (finding.id === 'PIT-F014') return 'dates';
  if (['PIT-F017','PIT-F024','PIT-F030','PIT-F036'].includes(finding.id)) return 'communications';
  if (finding.id === 'PIT-F020') return 'finance';
  if (finding.id === 'PIT-F029') return 'messaging';
  return 'pitcherLifecycle';
}

const plans = passedOver.map((finding) => {
  const source = sourceById.get(finding.id);
  if (!source) throw new Error(`Missing source register entry for ${finding.id}`);
  const familyId = familyFor(finding);
  const family = families[familyId];
  return {
    id: finding.id,
    group: finding.group,
    severity: finding.severity,
    title: finding.title,
    wave: family.wave,
    familyId,
    family: family.name,
    actors: family.actors,
    seedAndSetup: family.seed,
    browserExecution: family.flow,
    originalAcceptanceEvidence: source.acceptanceCriteria,
    passCriteria: `The workflow is completed through the deployed Chrome UI and the behavior described by “${finding.title}” is no longer reproducible; the corrected state persists after reload and is consistent for every affected actor and downstream surface.`,
    failCriteria: `The behavior described by “${finding.title}” reproduces, a valid user action is rejected or lost, authorization is wrong, or persisted/downstream state disagrees with the originating action.`,
    evidence: ['before/action/after screenshots', 'relevant request and response metadata', 'persisted reload or cross-role readback', 'mailbox evidence when communications are in scope'],
    passwordRule: ['D-A17','D-A18','D-A164'].includes(finding.id) ? 'Capture the original credential securely, run the password scenario, restore the original password immediately, and prove the original credential works before continuing.' : null,
    previousBlocker: finding.notes,
  };
});

const familySummary = Object.entries(families).map(([familyId, family]) => ({
  familyId,
  wave: family.wave,
  family: family.name,
  count: plans.filter((plan) => plan.familyId === familyId).length,
  actors: family.actors,
  seedAndSetup: family.seed,
  browserExecution: family.flow,
})).filter((family) => family.count).sort((a, b) => a.wave - b.wave || b.count - a.count);

const payload = {
  schemaVersion: 1,
  createdAt: new Date().toISOString(),
  sourceRunId: ledger.runId,
  scope: {
    passedOverFindings: plans.length,
    browser: 'Google Chrome',
    environment: 'deployed test environment',
    mutability: 'Seed data and permanent test-environment changes are allowed.',
    viewportPolicy: 'Use 1792x976 by default; add 1440x900, 1024x768, 390x844 or another relevant size only for responsive/layout findings.',
    passwordPolicy: 'Any existing-user password changed during testing must be restored immediately and the restored credential must be verified before continuing.',
    completionRule: 'Every finding must end PASS or FAIL. BLOCKED is permitted only for a demonstrated product/environment failure after one bounded remediation attempt; PASSED_OVER is not permitted in this rerun.',
  },
  executionWaves: [
    { wave: 0, objective: 'Create the seed manifest, mailbox aliases, correlation prefix, starting-balance snapshot and cleanup/restoration ledger.' },
    { wave: 1, objective: 'Repair/create stable identities and prove every required role can authenticate and reach its protected surface.' },
    { wave: 2, objective: 'Close profile, accessibility, Admin, KYC and Support findings using the newly authorized actors.' },
    { wave: 3, objective: 'Close date, request-creation and Investor preference findings with reusable low-risk fixtures.' },
    { wave: 4, objective: 'Close assessment-editor, RFI, rework, messaging and communications findings.' },
    { wave: 5, objective: 'Close financial and session lifecycles with pre-recorded balances, credits and mailbox assertions.' },
    { wave: 6, objective: 'Close grants, projects, marketplace and Pitcher lifecycle findings using seeded multi-actor records.' },
    { wave: 7, objective: 'Close organization/public and account-closure lifecycles, then reconcile reports and remove PASSED_OVER from this scope.' },
  ],
  familySummary,
  plans,
};

const esc = (value) => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
let markdown = `# Retest plan for 199 passed-over CIC findings\n\n`;
markdown += `Created: ${payload.createdAt}\n\n`;
markdown += `## Execution contract\n\n- Deployed test environment; Google Chrome only.\n- Seed data and permanent test-environment changes are allowed.\n- Default viewport: 1792×976. Expand only for responsive/layout findings.\n- Any existing-user password changed during a test must be restored immediately, followed by a successful login using the restored credential.\n- Every entry must finish PASS or FAIL. BLOCKED requires a demonstrated product/environment failure after one bounded remediation attempt. No entry may return to PASSED_OVER.\n\n`;
markdown += `## Execution waves\n\n| Wave | Objective |\n|---:|---|\n${payload.executionWaves.map((wave) => `| ${wave.wave} | ${esc(wave.objective)} |`).join('\n')}\n\n`;
markdown += `## Reusable seed and scenario families\n\n| Wave | Family | Findings | Seed/setup | Browser execution |\n|---:|---|---:|---|---|\n${familySummary.map((family) => `| ${family.wave} | ${esc(family.family)} | ${family.count} | ${esc(family.seedAndSetup)} | ${esc(family.browserExecution)} |`).join('\n')}\n\n`;
markdown += `## Per-finding retest matrix\n\n| Wave | ID | Group | Severity | Scenario family | Required proof | Password restoration |\n|---:|---|---|---|---|---|---|\n`;
markdown += plans.map((plan) => `| ${plan.wave} | ${esc(plan.id)} | ${esc(plan.group)} | ${esc(plan.severity)} | ${esc(plan.family)} | ${esc(plan.passCriteria)} | ${esc(plan.passwordRule || 'Not applicable')} |`).join('\n');
markdown += `\n\nThe JSON companion contains the actors, seed/setup instructions, browser execution method, original acceptance evidence, pass/fail criteria, evidence requirements and previous blocker for every finding.\n`;

await writeFile(new URL('PASSED_OVER_RETEST_PLAN.json', outputDirectory), JSON.stringify(payload, null, 2) + '\n');
await writeFile(new URL('PASSED_OVER_RETEST_PLAN.md', outputDirectory), markdown);
console.log(JSON.stringify({ findings: plans.length, families: familySummary.length, waves: payload.executionWaves.length, byWave: Object.fromEntries(payload.executionWaves.map(({wave}) => [wave, plans.filter((plan) => plan.wave === wave).length])) }, null, 2));
