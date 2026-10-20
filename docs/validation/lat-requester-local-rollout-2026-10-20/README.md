# Local requester form rollout — 2026-10-20

SIMULATION_ONLY. Authorized by the user requesting the local requester functionality while acting as Jopia. Agent self-validation; no independent teammate review or clinical/production claim.

## Source and changes

Existing branch `lat-sync-20261020`, saved HEAD `6cbccab`, with the requester changes from Jopia PR #99 (`9b2c737`) applied locally. The equivalent morning UI patch was already present, so it was not duplicated. Existing private handoffs and layouts were preserved. Changes are saved but not committed or pushed in this rollout.

Additional frontend fixes: detail-panel controls and Save details fit at phone width; attachment file inputs are visually hidden while remaining labelled; detail/upload/remove operator actions map to the existing `transfer:request` capability; workflow help describes the connected form. Regression tests cover the missing capability mapping and phone panel geometry.

## Database and runtime

- Fresh private custom-format backup validated with `pg_restore --list`. Its SHA-256, build digest, before/after protected fingerprints and private configuration snapshots are in ignored `build/requester-rollout-private-20261020/`; no secrets or dumps are included here.
- Applied two pending additive migrations in normal order, one at a time: `20261020000000000_add-reservation-delay-location-expiry-service`, then `20261020010000000_add-request-details-documents`. Status: 39 applied / 2 pending → 41 applied / 0 pending.
- The earlier migration intentionally adds one suspended INTERNAL `USR_SERVICE_EXPIRY` identity; total application users become 23 from 22. Existing user rows and all other protected existing records are unchanged. Fingerprints ignore the five newly added null reservation columns and exclude the new service identity when comparing old records.
- Final protected counts include 9 institutions, 7 account-audit rows, 1 onboarding application, 535 components, 598 commands and 27 reservations. No pending V1/V2 commands or population writer lock. New request-detail, request-document and location-evidence tables are empty; private document storage contains no uploaded bytes.
- API rebuilt with Node 24.17.0 as the normal user, copied to private build snapshots, and started as the normal user with the existing private configuration. Web restarted at port 5174, retaining the existing frontend flags and account switcher. Previous stopped API/web containers are preserved.
- Existing peer could not start because Docker Desktop retained a stale Docker socket bind. Recreated only that peer with the same pinned image, environment, identities and named volumes; health passed and `peer channel getinfo` returned height 1138. No chaincode install/upgrade, channel change, identity replacement, reset or volume removal.
- Restored the documented guarded UAT worker only after zero-queue/lock checks. General sync worker stays stopped; expiry evaluator and stock-checkpoint policy were not enabled. API health reports API/database READY. Its `workerFabric: DISABLED` describes the unchanged parent API environment; the separate guarded worker was verified RUNNING with `uat-worker.sh status`.
- A default-peer-identity lifecycle query was ACL-denied. No alternate identity was used and no chaincode-version claim is made from that query.

## Validation

- `npm run check:web`: passed (existing Vite bundle-size warning).
- `npm run test:web`: 479 passed; includes design-token tests.
- `npm run test:api`: 240 passed.
- Requested focused Playwright specs plus the new phone regression: 28 passed, 0 failed; pinned `mcr.microsoft.com/playwright:v1.61.1-noble`, Node 24.17.0, DejaVu fonts, normal user, `--workers=1`, network bridge. APIs are synthetic fixtures for these tests.
- Actual localhost requester check: ordinary private login, real eligible-suppliers and request-list GETs, editable supported fields, selectable synthetic document, enabled Submit for B+ Whole Blood, 390px layout fit, zero page errors. All domain mutation routes blocked and Submit never pressed; the selected file remained a browser draft.
- A+ PRBC returned no eligible bank in this host dataset. B+ Whole Blood returned one. Read-only stock inspection found only three label-current AVAILABLE units: two AB+ Whole Blood and one B+ Whole Blood, all at Mediatrix. This is a point-in-time result, not a fixture or stock replenishment. No eligible supplier is shown for products without current available stock.

Patient / Case Reference remains unavailable under RQ-20. Staff and pickup reference inputs use the accepted synthetic patterns; synthetic documents only. Submission, upload/remove and edit paths pass synthetic tests, but no live request, document upload/removal, detail edit, PIN-bound domain action or ledger transaction was exercised. Forecasts/census were not rerun. Live end-to-end acceptance is not claimed.

## Follow-up: expanded form for blood-bank accounts

The user subsequently authorized using the same expanded form for all blood-bank facility accounts. `V2Operations` now opts bank institution sessions into the existing shared form, supplier choice and detail/document payload mapping. Existing request capability checks remain in place. No API rebuild, migration or runtime configuration change was needed; the retained Vite frontend reflects the source edit.

Validation after this frontend follow-up: `check:web` passed, 479 web tests passed, and 31 browser tests passed (`blood-bank-pages`, `blood-bank-completion`, `requester-transfers`, pinned container, `--workers=1`). New synthetic cases cover all three institutions, exclusion of the requesting bank from the fixture supplier list, phone layout, and one ROLE-02 PIN-bound submission with details and a document. No live domain actions were used in those tests.

Actual local browser checks under all three existing blood-bank accounts confirmed seven editable supported fields, document buttons, RQ-20 disabled, no page errors and 390px fit. Read-only supplier checks for B+ Whole Blood returned no other bank for Mediatrix and one (Mediatrix) for each of Medix/N.L. Villa. All domain writes were blocked; no Submit was pressed. Private screenshots and results are in the existing ignored rollout directory. These changes remain saved locally, uncommitted and unpushed.

## Follow-up: synthetic request Fill Up

Added Fill Up before Cancel in the shared bank/requester form. It randomizes only requester details, future Manila required time, pickup references, notes and two fictional PDF attachments. All five manually selected supply inputs remain unchanged; patient/case remains disabled. Generated files stay in memory until explicit submission. A stable accessible name was added to the Notes textarea so its label remains consistent after prefilling.

Web build passed; 481 unit tests passed. Both new bank/requester Fill Up browser regressions passed in the pinned container after correcting styled-dropdown test selectors and the Notes accessible label. They verify repeated replacement, preserved supply choices, valid form values, button order, zero POSTs/no PIN dialog and 390px/320px fit. The other 26 affected browser cases passed in the earlier run. No live domain action, backend update or migration was performed for this follow-up. Saved locally, uncommitted.

## Publication follow-through

The local-only statements above describe the state at each validation checkpoint.
This work is included in the combined `lat-sync-20261020` delivery; use
[the final handoff](../../handoffs/LAT-TO-JOPIA-COMPLETE-EVENING-UPDATE-2026-10-20.md) for its source commit, consolidated results
and current cross-host instructions. Private runtime files and credentials
remain outside Git.
