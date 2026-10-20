# MVP compatibility and outbound repair — 2026-10-20

SIMULATION_ONLY. Lat perspective; the user explicitly authorized the backend
compatibility repair, outbound activation and presentation work, and deployment
of the RPS awaiting-decision fix. Self-validation by the implementing agent;
no independent teammate, physical-camera or clinical validation is claimed.

## Current dispositions

| Original finding | Current disposition |
| --- | --- |
| API/running chaincode mismatch | **Repaired on Lat host.** Upgraded the existing bloodledger-inventory definition from institution-accounts-v2, sequence 6, to tc-remediation-v1, sequence 7. Existing channel, endorsement policy, identities and retained domain records preserved. |
| Only three requestable units | Dataset limitation, not a software defect. Fresh synthetic stock remains Jopia’s separate task. No stock added, removed, refreshed or dispatched. Old expired reservations must not be used for the rehearsal. |
| Outbound verification off | **Enabled on Lat host** after confirming its already-applied migrations and the compatible API/ledger. Camera/gallery controls, automatic OCR and compact preview styling now match inbound. Source-reservation matching, all-unit verification, PIN, preparation and dispatch remain separate authorized steps. |
| Forecast/surplus/BROA unavailable | **Follow-up retained; not activated or rerun.** Current-date forecast absent; Oct 15 Mediatrix results stale; surplus/BROA lack current analytics inventory evidence. Fresh bags alone do not generate forecasts or analytics evidence. Compliance checkpoints use a separate store. |
| Expiry evaluator off | **Follow-up retained; still off.** Fresh labels postpone expiry but do not activate the evaluator. The ledger compatibility prerequisite is now repaired; activating the service remains a separate decision. |
| RPS includes already-reserved requests | **Fixed, tested and deployed.** Only PENDING requests without any linked reservation are ranked. The running API now returns the same awaiting-decision set as the retained database. |

## Preservation and deployment evidence

Source baseline: branch `lat-sync-20261020`, earlier commit `c6a46b7`.
On the user’s subsequent publication request, the tested repair source and tests
were committed and pushed as **`9ec32c6`**
(`9ec32c63745898bcb3c618a4c268a26a59996eab`). This report and the updated
[conversation handoff](../../handoffs/LAT-TO-JOPIA-MVP-INVESTIGATION-AND-PLAN-ALIGNMENT-2026-10-20.md)
follow in the accompanying docs commit on the same branch. No new PR is created.

The prior local deployment is unchanged by committing/pushing: the API uses
its immutable build snapshot and Vite reads the same now-committed source.
Publication does not deploy anything on Jopia’s host. Node 24.17.0, normal
UID/GID 1000:1000; foreign-owned entries in API/coordination/chaincode builds: **0**.

1. Checked queues and writer lock: zero pending V1/V2, writer lock zero,
   598 COMMITTED commands. Confirmed **41 migrations applied, 0 pending**;
   no migration was applied by this task.
2. Saved private runtime configuration and a protected-data fingerprint.
   Quiesced API/web, the guarded UAT worker and the existing checkpoint service.
3. Took a private custom-format PostgreSQL backup and validated its listing.
   Stopped peer/orderer consistently, archived their existing data/config volumes
   read-only and checked archive listings. Backup hashes and files remain under
   ignored, private `build/mvp-repair-private-20261020/`. No restore, volume
   removal, identity regeneration or reset was performed.
4. Restarted the same peer/orderer and used the existing
   `network/scripts/deploy-tc-remediation.sh --apply bloodledger-local`.
   The script verified the existing policy, installed the normal-user-built
   package, and approved/committed sequence 7 with VALID lifecycle results.
   Package label: `bloodledger-tc-remediation-v1_f39fecc47c6f`.
5. Through the API’s existing gateway identity, evaluated the running contract
   metadata and read an existing retained component. Required methods present:
   PrepareReservation, DispatchReservation, RecordReservationReceipt,
   MarkReservationDelayed, ResumeReservation and EvaluateComponentExpiry.
   These were **evaluations only**, not domain submissions.
6. Recreated API/web with preserved configuration, a fresh API/coordination
   snapshot, and `VITE_BLOODLEDGER_OUTBOUND_VERIFICATION_READY=true`.
   API health **READY**; localhost:5174 **200**. Restored the existing checkpoint
   service and guarded UAT worker after another empty-queue check. General sync
   worker remains stopped; expiry evaluator and label-extraction preview remain
   off. No forecast/model activation occurred.

Protected before/after counts were identical, and domain/identity fingerprints
matched exactly:

| Table | Before | After |
| --- | ---: | ---: |
| institutions | 9 | 9 |
| application_users | 23 | 23 |
| onboarding_applications | 1 | 1 |
| account_audit | 9 | 9 |
| v2_components | 535 | 535 |
| v2_reservations | 27 | 27 |
| v2_commands | 598 | 598 |
| v2_census_snapshots | 0 | 0 |

Only the explicitly authorized chaincode lifecycle approval/commit changed
ledger configuration. No live request, capture, outbound verification,
preparation, dispatch, transit, receipt or expiry command was submitted.

## Outbound implementation and checks

- `apps/web/src/features/transfers/outbound-verification.tsx`: reuses the
  inbound CameraPhotoCapture component; separate side-by-side Take photo and
  Choose image buttons; recognition starts automatically; obsolete reads are
  aborted, camera tracks released, and volatile image URLs revoked.
- `unit-capture-workspace.tsx` and `global.css`: apply the same compact preview
  spacing to inbound/outbound and align outbound transfer fields/cards/buttons
  with the scanner’s existing design. No request table or other saved layout
  was replaced.
- Outbound still requires an approved source reservation. Every scanned
  Donation No. plus OCR-read component must match the reserved set. An edited
  preview does not become verified outbound OCR. No registration permission is
  added, and scanning alone never prepares or dispatches stock.
- Enabled-path browser fixtures cover automatic OCR, side-by-side buttons,
  wrong-component rejection, PIN binding, frozen retries, preparation evidence
  returned by the server, and camera cleanup on cancel/panel close.
- Read-only actual-host browser review: Mediatrix’s active outgoing reservation
  shows enabled capture controls and keeps unverified submission disabled.
  Medix and N.L. Villa show their scanner and the correct empty outgoing state:
  this retained dataset contains no source reservations for them. No JavaScript
  page errors; no domain mutations attempted. Images remain private evidence.

## RPS implementation and checks

FR-06 / ADR-046. `PostgresCoordinationReader.pendingRequests` now requires
PENDING and no linked reservation, matching dashboard decision counts and the
request table’s AWAITING_DECISION semantics. Any reservation status excludes the
request; cancellation/completion does not silently reopen it. Source/product
filters and scoring weights are unchanged. The shared reader also excludes
already-decided requests from BROA demand inputs.

`services/api/test/rps-awaiting-decision-database-probe.mjs` uses synthetic
fixtures only in a disposable database hardcoded as `bloodledger_rps_test`.
The pre-fix reader returned eight already-decided requests alongside two
awaiting decisions. The corrected reader passed with all 41 migrations:
ACTIVE, DISPATCHED, IN_TRANSIT, DELAYED, RECEIVED, CANCELLED, COMPLETED and
COMPROMISED cases excluded; product, request status and source filters passed;
CRITICAL still ranks before ROUTINE. The disposable container was removed.

After deployment, ordinary-account GET checks against the running API matched
the retained database’s exact waiting-request IDs for A+ PRBC: Mediatrix **5**,
Medix **0**, N.L. Villa **1**. All six ordinary account logins passed.

Reproduce the regression using a fresh isolated PostgreSQL 17.10 container
(tmpfs, no retained mounts or published ports), POSTGRES_DB=bloodledger_rps_test,
and the probe with Node 24.17.0. Never run fixture probes against bloodledger_dev.

## Validation

| Check | Result |
| --- | --- |
| npm run check:inventory-contract | PASS |
| npm run test:inventory-contract | 46 passed |
| npm run check:api | PASS |
| npm run test:api | 244 passed |
| npm run check:web | PASS |
| npm run test:web | 481 passed, including design-token checks |
| Outbound-enabled pinned Playwright suite, workers=1 | 3 passed |
| Focused pinned Playwright suite, workers=1 | 60 passed |
| Retained API gateway metadata + existing component evaluation | PASS |
| Protected before/after counts and fingerprints | Unchanged |
| Six ordinary logins; live bank outbound/RPS reads | PASS |
| Three-bank read-only scanner browser review | PASS |
| Secret scan: 564-commit history, index and candidate files | PASS, no leaks |
| git diff --check | PASS |

Pinned browser image: `mcr.microsoft.com/playwright:v1.61.1-noble`, mounted
DejaVu fonts, normal-user execution and normal networking. Focused command:

```bash
npx playwright test e2e/scanner-camera.spec.ts e2e/uat-workflows.spec.ts e2e/blood-bank-completion.spec.ts e2e/requester-transfers.spec.ts e2e/defense-analytics.spec.ts --workers=1
```

Enabled-path command:

```bash
npx playwright test --config playwright-outbound.config.ts --workers=1
```

The camera test initially used a canvas stream that emitted no video frame;
it was corrected to use Chromium’s established fake-device stream. The final
suite passed. No production camera code was weakened for that fixture issue.

## Remaining MVP follow-through

Jopia’s fresh synthetic stock and an explicitly bounded request → bank approval
→ outbound verification → preparation → dispatch/transit → destination receipt
rehearsal remain pending. Automated fixture/contract tests and read-only host
checks do not prove that a new live shipment completed. Do not dispatch the old
expired reservations to obtain that evidence.

Forecasting/current analytics evidence and expiry activation remain noted for
separate discussion. Existing unsupported policy-dependent features and real
label/handwriting/physical-device limitations are unchanged. This report does
not establish clinical, regulatory or production readiness.
