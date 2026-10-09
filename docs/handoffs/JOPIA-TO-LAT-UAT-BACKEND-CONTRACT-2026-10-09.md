# Jopia → Lat: UAT backend contract changes — 2026-10-09

Classification: **SIMULATION_ONLY**. Selected TP-08 remediation under BL-TST-01;
FR-01/02/06/08/12, NFR-05/10. Branch: `codex/jopia-uat-backend`, based on `main`
`aecb1de`. Jopia implements and self-validates; Lat owns the frontend handling and
its independent browser rerun. Machine-readable truth is
[`openapi-v2.json`](../../services/api/openapi-v2.json) (`CommandTimeOutOfWindow`)
and [`openapi.json`](../../services/api/openapi.json) (`RequestRejected`); this note
explains them and does not replace them.

Sections 1, 2 and the reconciliation retry fix change no request or response
field. Section 3 adds one response field (`expiryState`) and one route using an
already provisioned operator capability. There are no chaincode, policy,
lifecycle sequence or migration changes. The approved population package and its
frozen confirmation time remain valid.

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

## 3. Expiry display state and evaluation action (J4, TP-JOP-D04)

**Status: Accepted by Jopia and implemented on 2026-10-09.** Contract:
`ComponentProjection.expiryState` and `POST /components/{componentId}/expiry`
(`ExpiryEvaluationRequest`) in `openapi-v2.json`.

### Read state

`GET /api/v2/components` and `GET /api/v2/components/{componentId}` now always
include `expiryState`, computed from the server clock at read time.
`inventoryStatus` values do not change.

| `expiryState` | Meaning |
|---|---|
| `CURRENT` | Printed label expiry not yet reached |
| `LABEL_EXPIRED_PENDING_EVALUATION` | Label expiry at or before now; ledger still `AVAILABLE` or `RESERVED` |
| `EXPIRED` | Ledger-evaluated (`inventoryStatus` is `EXPIRED`); appears in V2 alerts |
| `LABEL_EXPIRED_NOT_IN_INVENTORY` | Label expiry passed for another status, for example `IN_TRANSIT` |

Chaincode FEFO already excludes label-expired units from reservation. Do not
present a `LABEL_EXPIRED_PENDING_EVALUATION` unit as usable stock.

### Evaluation action

`POST /api/v2/components/{componentId}/expiry` with body
`{ "correlationId", "expectedVersion" }`, where `expectedVersion` is the
component's `inventoryVersion`. Use the standard `Idempotency-Key` and
operator-verification flow; the server sets `evaluationTime`. Response is
`202` with a command envelope; acceptance is not ledger commitment, so poll the
command status. A committed command moves the unit to `EXPIRED`, which then
appears in the V2 alert list for acknowledgement.

- Allowed: ROLE-01/ROLE-02 operators with `inventory:expiry`, own custody only,
  `AVAILABLE` stock whose label expiry has been reached.
- `409` codes: `COMPONENT_LABEL_NOT_EXPIRED`,
  `COMPONENT_EXPIRY_RESERVATION_ACTIVE` (cancel the reservation first),
  `COMPONENT_ALREADY_EXPIRED`, `COMPONENT_EXPIRY_TRANSITION_INVALID`,
  `COMPONENT_VERSION_CONFLICT` (refresh), `V2_1_CONTRACT_REQUIRED`,
  `V2_IDEMPOTENCY_CONFLICT`.
- A retry with the same key replays the original evaluation time.
- During an active approved population run the writer lock rejects it, so T0
  counts cannot change.

**Frontend action (Lat):**

1. Map `POST /api/v2/components/{id}/expiry` to `inventory:expiry` in
   `apps/web/src/auth/operator-actions.ts`.
2. Show `expiryState` in inventory and detail views.
3. Offer the action only for `LABEL_EXPIRED_PENDING_EVALUATION` with
   `inventoryStatus` `AVAILABLE`; for `RESERVED`, point to cancelling the
   reservation.

### Reconciliation retry (TP-JOP-D08)

A retry of `POST /api/v2/reconciliation` with the same `Idempotency-Key` and body
used to return `409 V2_IDEMPOTENCY_CONFLICT`, because the server-set event time
changed the command digest. It now replays the original command. The request
shape is unchanged.

### UAT data timing

| Host | Label expiry of current stock (Asia/Manila) | On 2026-10-12 |
|---|---|---|
| Lat, Buno V2 scenario | Reserved: Oct 13 08:00–09:00; available: Oct 16 or later | All valid |
| Jopia, retained T0 data | 1 available: Oct 8; 36 reserved: Oct 11 08:00–09:00; 52 available: Oct 13 | 37 label-expired, all 36 reservations holding expired stock |

This favours Lat's host for UAT. It is an input to the host decision, not the decision.

## Validation (Jopia self-validation)

Native Node 24.17.0 on Jopia's WSL2 host, 2026-10-09:

| Check | Result |
|---|---|
| `npm run test:api` | 140 passed, including 10 J2/J3 tests and 5 J4/reconciliation tests |
| `npm run check:api` (with ripgrep 14.1.1) | Passed |
| `npm run test:development-data` | 35 passed |
| `npm run test:operations`, `npm run check:operations` | Passed, including the stale peer-socket start case |
| Chaincode, coordination, web, foundation, database checks | 42, 19 and 80 tests passed; static checks passed |
| `bash scripts/scan-secrets.sh` | Gitleaks: no leaks in history, index or candidate content |
| `bash tests/accounts/postgres-integration.sh` (disposable PostgreSQL 17.10, no network) | 150 assertions passed, including the operational-stock probe through the changed population gate |

Not run here: Lat's browser rerun and a live Fabric command after deployment to a
retained host. Jopia's retained general worker is disabled, so a live
`EVALUATE_COMPONENT_EXPIRY` submission is deferred to the J5 rehearsal. Deploy to the UAT host only after Buno's T0 verification window
closes (2026-10-11 16:00 Manila).
