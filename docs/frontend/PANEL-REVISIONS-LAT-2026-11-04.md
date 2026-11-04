# Lat panel revisions — 2026-11-04

SIMULATION_ONLY. Branch `codex/lat-panel-frontend`, integration base
`540ceee82e3441d44f93c11baf55b6b6eebb37da`. Draft PR:
https://github.com/luisantonioj/bloodledger/pull/109 (target:
`codex/panel-revisions-integration`, not main).

PRs #103 and #107 are in the base. Frontend uses their published routes and
strict parsers. No services, database, network, chaincode, OpenAPI or policy
source was changed. Earlier uncommitted phone edits/private material in
`/home/yuri/projects/bloodledger-current` are preserved; this branch uses the
isolated worktree `/home/yuri/.codex/worktrees/lat-panel-revisions/bloodledger-current`.

## Delivery status

| Item | Frontend implementation and evidence | Remaining gate |
|---|---|---|
| a | Five-card bank summary includes Expired (not usable) from summary labelExpiredPendingEvaluation | Actual-host check after compatible API/migration rollout |
| b | Approved quantity/reason, FEFO prefix, requested/approved/closed-shortfall details; historical nulls preserved | Jopia integration review; no live approval made |
| c | Current export heading preserved | Team's current DOH template missing; do not invent its heading |
| d | Synthetic inbound/outbound history checks for Mediatrix, Medix and N.L. Villa | Actual-host/paper evidence after host prerequisites |
| e | Counts-only discrepancy, PIN, actor-bound frozen retry, receive blocking and recount resolution display | Host migration/API; no live discrepancy or receive made |
| f | Committed banner unlocks next authorized action; current-context supplier detail read retry; requester transfer-row navigation; readable receipt options | Supplier details absent in historical records remain honestly not recorded |
| g | BROA simulation/advisory disclosure restored following review of dda543b | No forecast/model activation or allocation authority change |
| h | Synthetic figure panels and history captures prepared through the browser evidence switch | Composite Figs 15–19 not all replaced; DOH template and final paper selection still needed |
| i | Exact available heights/numbers, eight-status tooltip, zero inspection, table/copy/PDF, Manila timestamp and pending exclusion; own-scope/40-row/sum validation | Host endpoint validation after compatible API rollout |
| PIN | Six-digit local-host fallback, PIN fixtures; explicit server compatibility policy retained | No credential/PIN changes performed; fresh-server eight-digit default remains Jopia-owned |
| Manuscript | Proposed frontend wording in PANEL-MANUSCRIPT-SUGGESTIONS-2026-11-04.md | Native Suggesting-capable connection required; no direct manuscript edits |

## Validation

Node 24.17.0. Browser container `mcr.microsoft.com/playwright:v1.61.1-noble`,
normal networking, DejaVu font mount, `--workers=1`. Synthetic route fixtures;
no retained-host domain commands.

- `npm run check:web`: passed (TypeScript and production build; existing bundle-size advisory).
- `npm run test:web`: 507 passed, 0 failed, 0 skipped, 57 files. Includes the two design-token boundary tests.
- Design-token tests also run separately: 2 passed, 0 failed.
- Receipt-enabled configuration: 3 passed, 0 failed, 0 skipped. Covers exact frozen verification, receive evidence, counts-only mismatch, frozen discrepancy replay discovered by polling, receive blocking and matched recount resolution.
- Final full browser run: **266 passed, 0 failed, 7 skipped** (273 cases, 3.4 minutes). The seven existing retired-V1 mutation cases remain skipped. No browser retry was configured. Implementation commit: `fecd2d5`. Six synthetic screenshots were captured and visually reviewed for the dashboard layout.
- Earlier runs exposed outdated dashboard fixtures, missing generated OCR assets and phone-scanner test navigation. Fixtures were aligned with the published contract, pinned OCR assets prepared, and assertions preserved. No OCR recognition threshold or backend authorization was loosened.
- Candidate/index and this branch's HEAD ancestry secret scans pass. The all-local-refs history scan reports one unrelated, unmerged staff-branch API-build SHA-256 false positive at `67ff03e:docs/validation/lat-institution-staff-2026-10-21/README.md:137–138`. It is outside integration ancestry. Repository scanning configuration is unchanged; the all-refs scan is not claimed to pass.

### Commands and diagnostic runs

Run root-level `npm run check:web` and `npm run test:web`. Browser commands run
from `apps/web` inside the pinned container with the repository mounted at
`/workspace` and DejaVu fonts mounted read-only:

```bash
npx playwright test --config playwright-receipt.config.ts --workers=1
npx playwright test --workers=1
```

Final run sets `LAT_PANEL_EVIDENCE=/workspace/build/lat-panel-20261104`.
Previous diagnostic runs are superseded, not hidden:

| Run | Passed | Failed | Skipped |
|---|---:|---:|---:|
| Supplemental native focused run | 30 | 1 | 0 |
| Pinned initial focused run | 57 | 3 | 0 |
| Pinned dashboard recheck | 22 | 1 | 0 |
| Pinned expanded focused run | 55 | 3 | 0 |
| Pinned initial full suite | 253 | 8 | 7 |
| Pinned intermediate full suite | 265 | 1 | 7 |
| Pinned final full suite | **266** | **0** | **7** |
| Receipt-enabled fixture/layout diagnostic | 1 | 2 | 0 |
| Receipt-enabled final run | **3** | **0** | **0** |

An obsolete desktop-receipt run was interrupted after discovering its removed
entry point; no pass count is claimed for it. The intermediate full run's
secondary-hospital navigation failure did not recur on the final immutable
build run. No assertions were removed to obtain a pass. The added permission
test initially had 506 pass / 1 fail because the existing generic capability
helper returns an unmatched GET capability name; the corrected test asserts
that GET selects no authorized operator. Final unit result is 507/0/0.

## Host preflight — migration NOT applied

Read-only status on Lat's retained database: **42 applied / 2 pending**:

1. `20261021000000000_allow-sliding-application-sessions.js`
2. `20261103000000000_add-partial-approval-and-receipt-discrepancy.js`

A non-applying migrator preflight reports:

> Not run migration 20261021000000000_allow-sliding-application-sessions is preceding already run migration 20261021000000000_add-institution-staff

This is a retained-host history difference, not a reason to reset, remove the
staff migration or disable order checks automatically. Jopia must coordinate
an explicit order-recovery path preserving the existing staff build before the
normal rollout can proceed. No migration, restore, account change, API/web
redeploy or ledger upgrade was performed. No live transaction, census/forecast
rerun or model activation was performed. Browser fixtures do not establish
actual-host API availability or physical-device validation.

## Document access

The final IMRAD is readable through the connected Drive account. The panel form
ID `1P-FDfdQWkODuzrzM5MbHxNDBQ1jQvfsXhdQUAqERzJI` still returns not found.
After the user reported reconnecting, the connector still identified personal
Gmail rather than the requested school account. Searches did not locate the
current DOH template. No connected document-control session supports applying
tracked suggestions here. Native Google Docs direct batch edits were not used.

## Handoff and reproducible screenshots

Enable `LAT_PANEL_EVIDENCE=/workspace/build/lat-panel-20261104` for the
`e2e/panel-revisions.spec.ts` run in the pinned container. The ignored output
contains dashboard, supplier-review and blank operator-dialog figure panels,
plus per-hospital transaction-history captures. They are synthetic presentation
evidence, not independent review, clinical evidence or live custody records.
Final composite manuscript figures remain explicitly pending. Keep generated
images and private host evidence outside Git unless separately selected for publication.

Jopia reviews the partial/discrepancy parsers and changed interaction wiring on
PR #109, resolves the migration-order prerequisite and supplies the current DOH
template. Lat then performs actual-host read-only checks and finishes the
blocked export/figure/manuscript work. Open RQ-03/05/06/07/09/16/18 decisions
remain explicit. Demo bands, forecast surplus and human transfer approval stay
separate. No clinical, regulatory or production-readiness claim is made.
