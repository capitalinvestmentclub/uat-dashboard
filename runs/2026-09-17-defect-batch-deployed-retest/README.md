# 276-entry deployed Chrome retest

This append-only run retests the exact 276 unique finding IDs from the merged defect-delivery batch.

## Scope

- Browser: Chrome only.
- Default viewport: \`1792x976\`.
- Additional viewports: only for responsive findings or when the observed layout warrants expansion.
- Frontend candidate: \`auth-35306705473-1\`.
- API: \`https://cicdevapi.uc.r.appspot.com\`.
- Evidence authority: deployed, real-API browser behavior.

## Status rules

- \`PASS\`: the deployed contract passed with current evidence.
- \`FAIL\`: the original defect still reproduces.
- \`BLOCKED\`: a demonstrated external or environment dependency prevents execution.
- \`OBSOLETE\`: the historical surface or contract no longer exists, with replacement behavior verified.
- \`DUPLICATE_COVERAGE\`: another explicitly linked execution proves the identical contract.
- \`PASSED_OVER\`: outside the user-approved Chrome-only scope or not a product defect, with a written reason.
- \`NOT_RUN\`: pending and never terminal.

No report branch may be merged until all 276 IDs have a terminal status and the reconciliation checks pass.
