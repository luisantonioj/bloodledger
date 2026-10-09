# Jopia → Lat: UAT backend contract changes — 2026-10-09

Classification: **SIMULATION_ONLY**. Selected TP-08 remediation under BL-TST-01;
FR-01/02/06/08/12, NFR-05/10. Branch: `codex/jopia-uat-backend`, based on `main`
`aecb1de`. Jopia implements and self-validates; Lat owns the frontend handling and
its independent browser rerun. Machine-readable truth is
[`openapi-v2.json`](../../services/api/openapi-v2.json) (`CommandTimeOutOfWindow`)
and [`openapi.json`](../../services/api/openapi.json) (`RequestRejected`); this note
explains them and does not replace them.

No request field, response field, route, chaincode, policy, lifecycle sequence or
migration changes. The approved population package and its frozen confirmation
time remain valid.

## 1. Framework request rejections keep their 4xx status (TP-JOP-D01)

Before this change, an unreadable body returned `500 INTERNAL_ERROR`. It now returns:

| Status | `error.code` | Cause |
|---|---|---|
| 400 | `REQUEST_INVALID` | Empty or malformed JSON body, including `Content-Type: application/json` with no body |
| 413 | `REQUEST_BODY_TOO_LARGE` | Body above the 32 KiB API limit |
| 415 | `REQUEST_MEDIA_TYPE_UNSUPPORTED` | Unsupported `Content-Type` |

The envelope is unchanged (`code`, `message`, `correlationId`). The route handler
does not run, so a rejected logout does **not** revoke the session.

**Frontend action:** none expected. `requestJson` already omits `Content-Type`
when there is no body, so browser logout still returns 204. Treat these codes
as non-retryable client errors, not as a server outage.

## 2. New V2 command times must be near the server clock (TP-JOP-D02)

New commands are rejected with `400 V2_COMMAND_TIME_OUT_OF_WINDOW` when a time is
more than **300 seconds** before or after the server clock. The check runs before
any command is queued and before an OCR intake records a provisional capture.

| Route | Times checked |
|---|---|
| `POST /api/v2/transfers` | `eventTime`, `requestTime` |
| `POST /api/v2/reservations` | `eventTime` |
| `POST /api/v2/local-releases` | `eventTime` |
| `POST /api/v2/reservations/{reservationId}/{action}` | `eventTime` |
| `POST /api/v2/inbound-captures` | `eventTime` |

Reconciliation already used the server clock. `preparedAt` and label times
(`collectedAt`, `expiresAt`, `capturedAt`) are not bounded by this check.

Two cases keep their original times:

- **Retry/replay:** an `Idempotency-Key` that already has an accepted command
  replays it (`202`, `replayed: true`) at any later time. A different body under
  that key is still `409 V2_IDEMPOTENCY_CONFLICT`.
- **Approved population:** an exact operation of the active approved population
  manifest (writer lock held) keeps its frozen confirmation time, including after
  resume.

**Frontend action:** the current pattern already sends `new Date().toISOString()`
and reuses the same payload and keys on retry, which is correct. On
`V2_COMMAND_TIME_OUT_OF_WINDOW`, discard the stored attempt and show an
actionable error; the next submission must create **new** idempotency keys and
a fresh `eventTime`, because reusing the stale payload is rejected again. Show
the device-clock possibility when it repeats.

**Known limitation:** the persistent development seeder stamps a manifest at
preview. A fresh seed applied more than five minutes after its preview is
rejected without queuing. Both retained hosts are already seeded; regenerate the
preview if a new host needs it.

## 3. Proposed next: expiry display state (J4) — not implemented

**Status: Proposed.** Do not ship UI against this until Jopia records it as
Accepted in this file and in `openapi-v2.json`.

- V2 component reads gain `expiryState`: `CURRENT`,
  `LABEL_EXPIRED_PENDING_EVALUATION` (printed expiry passed, ledger still
  `AVAILABLE`/`RESERVED`) or `EXPIRED` (ledger-evaluated). `inventoryStatus`
  values do not change.
- A ROLE-01/ROLE-02 operator action queues `EVALUATE_COMPONENT_EXPIRY` with a
  server evaluation time, through the existing operator verification and command
  status flow. Chaincode FEFO already excludes label-expired units.

## Validation (Jopia self-validation)

Native Node 24.17.0 on Jopia's WSL2 host, 2026-10-09:

| Check | Result |
|---|---|
| `npm run test:api` | 135 passed, including 10 new J2/J3 tests |
| `npm run check:api` (with ripgrep 14.1.1) | Passed |
| `npm run test:development-data` | 35 passed |
| `npm run test:operations`, `npm run check:operations` | Passed, including the stale peer-socket start case |
| Chaincode, coordination, web, foundation, database checks | 42, 19 and 80 tests passed; static checks passed |
| `bash scripts/scan-secrets.sh` | Gitleaks: no leaks in history, index or candidate content |
| `bash tests/accounts/postgres-integration.sh` (disposable PostgreSQL 17.10, no network) | 150 assertions passed, including the operational-stock probe through the changed population gate |

Not run here: Lat's browser rerun and a live Fabric command after deployment to a
retained host. Deploy to the UAT host only after Buno's T0 verification window
closes (2026-10-11 16:00 Manila).
