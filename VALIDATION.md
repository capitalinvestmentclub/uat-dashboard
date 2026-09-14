# Dashboard validation — 14 September 2026 UTC

Scope: this summary website, not a new product UAT run.

- Fresh remote source snapshots: 10 reports, 198 scenario rows, 118 unique findings.
- Unique critical/high inventory: 65 defects plus 4 gaps/questions. 23 critical/high findings have explicit targeted PASS outcomes; this is not full-scenario completion.
- `npm test`: 7 tests passed, including exhaustive view/group/result combinations and adversarial literal searches.
- `node --test --experimental-test-coverage --test-coverage-include=model.js --test-coverage-include=app.js`: app 92.68% lines / 93.10% branches / 100% functions; model 100% lines / 92.78% branches / 100% functions.
- Actual Chrome: all ten group options, seven result options, both views, finding expansion, empty search, immediate reset and source links inspected. Console error/warning log empty.
- Exact Chrome viewports: 360×800, 390×844, 768×1024, 1024×768, 1280×800 and 1440×900. No document horizontal overflow; screenshots in `evidence/`.
- A real-Chrome reset timing race was fixed by explicitly resetting controls before rendering; immediate empty-search recovery re-tested successfully.
- Normalization preserves Pitcher incomplete scenario cells, type distinctions, original observations, source revisions and missing coverage. Nested viewport evidence links resolve to their original report.

No existing report repository or product application was modified. Static publication contains no application credentials or private test artifacts. Refresh workflow fails closed on source-fetch or validation failure.
