# Lat role — OCR, receipt verification and outbound V2 rollout, 2026-10-18

Classification: **SIMULATION_ONLY**. Executed in the Lat role on the **Jopia
host** (this laptop's retained stack), by the user's decision on 2026-10-18 to
run the [authorized runbook](../../handoffs/JOPIA-TO-LAT-OCR-RECEIPT-ROLLOUT-2026-10-18.md)
here. Lat's own host has not been rolled out. This is self-validation: one
person acting for Jopia and Lat. It establishes no clinical, regulatory or
production readiness.

## Authorization and deviations

R1–R4 were accepted by Jopia on 2026-10-18. The user extended R1 to this laptop
and approved two deviations after gate 1 stopped:

| Deviation | Reason | Approved |
| --- | --- | --- |
| **Three** migrations, not two: `20261016010000000_create-public-onboarding` was also pending | PR #68's rollout ran only on Lat's host. Migrations apply in filename order | User, 2026-10-18 |
| Scoped ownership repair of `services/api/build`, `services/coordination/build`, `chaincode/build` and `apps/web/dist` in the deploy worktree, using a one-shot `node:24.17.0` container with no network | The persistent containers run as root and left root-owned build output. Other root-owned paths (`network/generated`, `build/recovery`, capture-PWA output, `tsbuildinfo`) were not touched | User, 2026-10-18 |
| Web flag set through a git-ignored `apps/web/.env.local` in the deploy worktree, and the existing dev-server container restarted | On this host the web is a Vite dev-server container in the API's network namespace, not a built image, so no replacement container was needed | Recorded here |

## Target and previous state

- Target: `main` **`26fdbfb`**. The deploy worktree `build/jopia-operational-stock` moved from **`c1898a0`** to `26fdbfb`.
- Previously deployed API and web on this host: `c1898a0`. The API and web had been stopped for about six days; the Fabric peer had exited. `FABRIC_SYNC_ENABLED=false`, so the worker-Fabric path is `DISABLED`.
- Dependencies: no reinstall was needed. `tesseract.js` 7.0.0 and the `@bloodledger/coordination` link were already present.

## Gates

| Gate | Result |
| --- | --- |
| 1 Prepare | Stopped first on three pending migrations (expected two). Resumed after approval. Node 24.17.0 |
| 2 Quiesce | API, web and workers already stopped. No non-terminal V2 command, no writer lock; the single V1 scan event is `COMMITTED` |
| 3 Backup | Custom-format `pg_dump` of `bloodledger_dev`, 14,618,186 bytes, private (0600 in a 0700 ignored folder). `pg_restore --list` reads 59 table-data entries. SHA-256 `4159b328e002543b4dbafe49930d9a7be72066d13959f4824489908a6e728e55` |
| 4 Baseline | See counts below. Reservations: 21 `ACTIVE`, 3 `CANCELLED`, 2 `COMPLETED`, 2 `COMPROMISED`, 1 `IN_TRANSIT`, 1 `RECEIVED` |
| 5 Migrate | Three single steps (`BLOODLEDGER_MIGRATION_COUNT=1`), with protected counts unchanged after each. **36 applied / 0 pending**. The new tables `v2_receipt_verifications`, `onboarding_sample_claims` and `institution_profiles` are empty. `v2_outbound_policy` allows `OUTBOUND_LABEL_VERIFICATION_V1` and `_V2`. The app role has SELECT and INSERT on receipt evidence, and no UPDATE or DELETE |
| 6 API | Built as the host user. `receipt-verification.js` present. Existing persistent API container started with its retained configuration. `/healthz` READY (database READY, worker-Fabric DISABLED). Unauthenticated reservation read 401. Authenticated reservation reads 200 for both bank accounts (Mediatrix 30 rows, synthetic Medix 16 rows). **Requester read not run: no requester account exists in the private runtime config.** Counts unchanged |
| 7 Web | Dev server 200 with only `VITE_BLOODLEDGER_RECEIPT_VERIFICATION_READY=true`. Outbound, extraction-preview and public-application flags unset, so off. The read-only browser check against the real API, as the Mediatrix bank, used the pinned Playwright container on the host network and blocked every non-GET API request. **Bank Inbound shows the Incoming transfer card**, with 0 incoming in-transit transfers and the "none" message: Mediatrix's in-transit reservation is outgoing. Outbound shows the Outgoing transfer card and no receipt card. **Zero write requests, zero page errors.** Requester scanner view not checked (no requester account) |
| 8 Resume | No UAT worker runs on this host. The general sync-worker stays stopped. API and web are running. Final counts unchanged, 0 receipt-verification rows, 0 non-terminal commands |

## Protected counts (before = after)

| Table | Count |
| --- | --- |
| `app.institutions` | 7 |
| `app.application_users` | 20 |
| `app.onboarding_applications` | 0 |
| `app.account_audit` | 6 |
| `app.v2_components` | 531 |
| `app.v2_reservations` | 30 |
| `app.v2_commands` | 606 |
| `app.v2_outbound_verifications` | 0 |

## Not performed

No live receipt verification, `receive`, intake capture, outbound verification,
prepare or dispatch. No reset, population, account creation, census or forecast
run, or Fabric change. No password or PIN was displayed. The private backup,
counts, harness and screenshot stay in the ignored `build/lat-ocr-rollout-private/`.

## Remaining

- Lat's own host: run the same runbook there. Its gate 1 should show two pending migrations.
- A requester-role read-only check needs a requester account in a private config on whichever host is checked.
- A live receipt test and enabling outbound verification each need their own plan, as the runbook states.
