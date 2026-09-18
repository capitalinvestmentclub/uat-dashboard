# CIC UAT dashboard

## Deployed defect-delivery retest — 18 September 2026

The Chrome retest ledger now has terminal dispositions for all 276 entries in the delivery batch: 64 PASS, 12 FAIL, 1 DUPLICATE_COVERAGE and 199 PASSED_OVER. The dashboard renders the reconciled ten-report breakdown from `dashboard-data.json`; the complete machine-readable evidence ledger is in `runs/2026-09-17-defect-batch-deployed-retest/deployed-retest-276.json`.

One summary for twelve published E2E reports. Static HTML/CSS/JavaScript; no product API, private test data, runtime framework, or login required.

## Severity and execution analytics

- The doughnut shows latest available verification status of unique defects only. Fixed means the recorded targeted retest passed; it does not imply full-scenario closure. Click a status to open matching defects. Gaps and questions are excluded from this chart.
- Historical severity remains available through the severity/result table and severity filter. Chart percentages are rounded to one decimal place.
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
- Assessor and Investor publish from the webapp `gh-pages` site rather than a dedicated report repo, because that repository is private. They are read from their public Pages URLs and pinned to the webapp commit their payload records.
- Assessor and Investor scenario verdicts come from each role's `COVERAGE_LEDGER.md`, the release authority for that campaign. `Fail (partial)` means the cells that ran failed and the rest were never run; the Investor campaign's named-browser cells are all unrun by design, so its scenarios read PARTIAL rather than executed.

## Design and validation scope

Acceptance criteria: twelve source reports, all published scenarios, deduplicated findings, literal search, every group/result/view filter, reset and empty/error states, six Chrome sizes, original evidence links, traceable source revisions and deployment.

`test/dashboard.test.js` maps those data and interaction requirements to normalization, filter-pair, DOM-rendering, missing-data, injection-string and conflict tests. Real Chrome rendering is additionally checked at 360×800, 390×844, 768×1024, 1024×768, 1280×800 and 1440×900.

The CIC webapp/webapi preflight does not apply: this independent static report has no application service, API port or environment variables. No product test result is created by dashboard validation.
