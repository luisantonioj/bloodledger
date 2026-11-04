# Lat panel revisions — 2026-11-04

SIMULATION_ONLY; frontend work on codex/lat-panel-frontend. Integration base:
540ceee82e3441d44f93c11baf55b6b6eebb37da. PRs #103 and #107 are merged into
codex/panel-revisions-integration; use their published contracts without changing
services, database, network or chaincode source. No chaincode upgrade is planned.
Earlier uncommitted phone edits in bloodledger-current are preserved in that
checkout; this work uses an isolated managed worktree.

## Work in progress

| Item | Frontend scope | Status |
|---|---|---|
| a | Expired (not usable) dashboard card | Pending |
| b | Partial approval/reason, requested/approved/shortfall details | Pending |
| c | DOH PDF heading matching the team's current template | Blocked: sample requested |
| d | Per-hospital inbound/outbound history and paper screenshots | Pending |
| e | Receipt mismatch recording and shared discrepancy status | Pending |
| f | Terminal command unlock, supplier summary, requester transfer links, receipt labels | Pending |
| g | BROA simulation disclosure review | Pending |
| h | Refresh Figs 15–19 after UI changes | Pending |
| i | Exact dashboard counts, status tooltip, table/copy/PDF/freshness | Pending |
| PIN | Six-digit local-host forms; no credential rotation | Pending |
| Manuscript | Frontend-only suggested text | Blocked for native suggestions: no connected document session |

## Evidence and boundaries

No new checks have run for this initial draft. Report exact pass/fail/skip counts
as implementation proceeds; a draft PR does not claim completed validation.
The final IMRAD is readable. The panel-form Drive ID currently returns not
found for the connected account. Google Docs batch updates make direct edits,
not tracked suggestions, so no direct manuscript change is authorized by the
Suggesting-only request. Prepare frontend wording for review while that access
is resolved. Do not replace another owner's manuscript sections.

Keep RQ-03/05/06/07/09/16/18 explicit. Demonstration bands, exact inventory,
forecast-derived surplus and human approval remain distinct. No live blood
transaction, model activation, census/forecast rerun, reset or credential change
is included. Host migration/read-only validation must preserve private data
and pass backup/prerequisite checks. Never upgrade the Lat-host ledger for this
frontend task.
