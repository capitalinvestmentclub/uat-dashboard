# CIC UAT dashboard

One summary for ten published E2E reports. Static HTML/CSS/JavaScript; no product API, private test data, runtime framework, or login required.

## Severity and execution analytics

- Severity doughnut shows each severity's share of unique findings (including gaps/questions). Its labeled legend opens matching finding results.
- Severity filter combines with group, result and search in Findings view; it is disabled and cleared in Scenarios view.
- The severity/result table separates latest targeted PASS, FAIL, PARTIAL, BLOCKED, NOT RUN, NOT REPORTED and CONFLICT outcomes.
- Chart test group and evidence test group stay synchronized. Charts deliberately ignore result/search/severity filters so their denominators remain clear.
- The read-only progress bar counts PASS/FAIL as executed to a reported outcome. PARTIAL, BLOCKED and NOT RUN remain separate; neither complete branch coverage nor six-size execution is inferred. An interactive slider would imply users can change test completion, so a progress bar is used instead.

## Refresh and validate

Run `npm ci`, `npm run build`, `npm test`, then `npm start` for a local preview. Build requires Node 22+ and authenticated GitHub CLI (GitHub Actions supplies `GH_TOKEN`). Each source is pinned to a remote commit before retrieval. Any failed source request fails the build rather than publishing incomplete totals.

Publish workflow runs on push or manual dispatch. Manual dispatch refreshes report data and deploys it as one snapshot. It does not execute UAT. The page displays the snapshot timestamp and individual source revisions. Existing detailed reports and histories are untouched.

## Interpretation

- Scenario rows preserve the original campaign status. Pitcher remains PARTIAL despite its 15 successful targeted retests.
- IN PROGRESS normalizes to PARTIAL while original observation text is retained.
- Latest targeted finding outcomes do not change scenario outcomes.
- Missing viewport outcomes remain NOT REPORTED. Broad campaign scope is not per-cell execution evidence.
- Unique findings require matching ID and title. Shared Admin/Super Admin/Cross-role findings retain all memberships. Explicit retests supersede missing retest data, not conflicting explicit outcomes.
- Defects, gaps and questions are distinct. Critical/high defect totals are historical inventory, not a claim that every defect is still open.
- Only public report data is aggregated; evidence is linked to its original host.

## Design and validation scope

Acceptance criteria: ten source reports, all published scenarios, deduplicated findings, literal search, every group/result/view filter, reset and empty/error states, six Chrome sizes, original evidence links, traceable source revisions and deployment.

`test/dashboard.test.js` maps those data and interaction requirements to normalization, filter-pair, DOM-rendering, missing-data, injection-string and conflict tests. Real Chrome rendering is additionally checked at 360×800, 390×844, 768×1024, 1024×768, 1280×800 and 1440×900.

The CIC webapp/webapi preflight does not apply: this independent static report has no application service, API port or environment variables. No product test result is created by dashboard validation.
