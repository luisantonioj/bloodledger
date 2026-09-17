# LAT Sprint 6 Frontend Handoff

**Status:** Proposed integration handoff; the verified backend revision is
pushed, while owner acceptance and browser UAT remain pending

**Backend scope:** PR #11 on `codex/ml-v4-verification`; implementation commit
`3b890f0` incorporates BUNO's correction commit `f58b905`, and documentation
follow-up commit `19aa11c` pins the currently pushed frontend baseline.

**Classification:** `SIMULATION_ONLY`

This document summarizes the backend contract for LAT. The machine-readable
contracts remain authoritative:

- [V2 OpenAPI](../services/api/openapi-v2.json)
- [V1/API OpenAPI](../services/api/openapi.json)
- [Inbound OCR V2.1 schema](../contracts/inbound-ocr-v2-1.schema.json)
- [Core V2.1 schema](../contracts/core-v2-1.schema.json)
- [Inbound OCR policy](./INBOUND-OCR-REGISTRATION.md)
- [ML V4 runtime contract](./ML-RUNTIME-INTEGRATION-V4.md)

The exact currently pushed frontend baseline is
`3b890f0` is the exact combined backend implementation revision for frontend
development. The branch also carries documentation-only follow-ups for this
handoff; LAT should pin `3b890f0` (or a later branch revision containing it)
until PR #11 is merged. The main merge commit replaces it after merge.

## Contract and version headers

Mutating V2 endpoints require an `Idempotency-Key` matching
`^IDEM_[A-Z0-9_-]{1,59}$`. Reusing a key with a different payload returns
`V2_IDEMPOTENCY_CONFLICT`. The optional
`X-BloodLedger-Contract-Version` header defaults to `V2`; set it to
`V2.1` for the additive `CRYOPRECIPITATE` vocabulary. This version rule
applies to inbound capture, transfer submission, reconciliation, local
release, and reservation actions.

## Component reads and inbound OCR

`GET /api/v2/components` returns exactly
`{ scope: "INSTITUTION", components, classification: "SIMULATION_ONLY" }`.
Reads are institution-scoped and never expose plaintext or encrypted Donation
No. values, OCR text, images, patient data, or donor data. V2 excludes
`CRYOPRECIPITATE`; V2.1 includes it. The same header rule applies to
`GET /api/v2/components/{componentId}`.

`POST /api/v2/inbound-captures` is the only V2 registration path. It accepts
the fields in `InboundOcrCapture` with `captureMethod: "OCR"` and
`capturePolicyVersion: "INBOUND_OCR_V1"`. The current enabled issuer list is
`[ "INST_MEDIATRIX" ]`; no external issuer display-name mapping is approved.
The UI may display that configured institution identifier and must treat any
other issuer as unavailable until an allowlist and safe display name are
approved.

The receiving custody institution always comes from the authenticated session.
The operator must confirm every required field at 90% or higher confidence.
Printed expiry is authoritative and must be later than collection time. Safe
validation/conflict codes include `INBOUND_OCR_INPUT_INVALID`,
`INBOUND_OCR_POLICY_MISMATCH`, `INBOUND_ISSUER_UNAPPROVED`,
`INBOUND_DONATION_NUMBER_INVALID`, `INBOUND_OCR_CONFIDENCE_LOW`,
`INBOUND_EXPIRY_INVALID`, `INBOUND_COMPONENT_CONFLICT`,
`INBOUND_RECEIPT_REQUIRED`, `V2_KEYS_UNAVAILABLE`, and
`V2_PROJECTION_UNAVAILABLE`.

The existing Capture PWA still uses the older
`SYNTHETIC_CAPTURE_V1`/`/api/v1/scan-events` flow. Migration to the V2
inbound contract is LAT work and is not represented as complete here.

## Offline queue and privacy gate

Only confirmed, allowlisted synthetic fields may be retained for offline
retry: contract version, issuer identifier, blood type and evidence,
component type and evidence, collection/expiry/event/capture/confirmation
timestamps, correlation identifier, OCR engine/version and numeric field
confidence, plus the generated idempotency key and synchronization status.
Raw images, unrestricted OCR text, exact Donation No. values, patient/donor
data, and credentials must never enter browser storage.

The current V2 backend does not freeze a browser retention period or cleanup
operation. LAT must keep offline capture marked pending until the owner-approved
retention/cleanup rule is recorded. Replays use the generated idempotency key;
because V2 also requires `donationNumber` and that exact value may not be
persisted in browser storage, offline V2 replay is currently blocked pending an
approved secure handling mechanism. The server returns the durable
`statusUrl` and command state.

## Commands and polling

Every queued mutation returns a command envelope with `commandId`,
`resourceType`, `resourceId`, `status`, `statusUrl`,
`acceptedAt`, `correlationId`, nullable `safeErrorCode`,
`classification`, and `replayed`. Poll
`GET /api/v2/commands/{commandId}` at the agreed frontend cadence. The
possible states are `QUEUED`, `SUBMITTING`, `RETRY_WAIT`,
`LEDGER_COMMITTED_PROJECTION_PENDING`, `COMMITTED`, `FAILED`, and
`CONFLICT`.

The recommended frontend behavior is two seconds initially with exponential
error backoff capped at 30 seconds; this recommendation requires LAT/JOPIA
confirmation. Stop on `COMMITTED`, `FAILED`, or `CONFLICT`, pause while
offline, and stop authenticated polling after logout or session loss.
`LEDGER_COMMITTED_PROJECTION_PENDING` remains visible as pending. Projection
retries must never resubmit a transaction already committed by Fabric.

## Transfer, local release, and reconciliation workflows

The request and custody sequence is:

1. `ROLE-03` submits `POST /api/v2/transfers` with
   `transferId`, source `INST_MEDIATRIX`, the authenticated destination,
   blood type, component type, integer quantity, urgency, request time, event
   time, and correlation ID.
2. The resulting command is processed into a reservation. The canonical
   action endpoint is
   `POST /api/v2/reservations/{reservationId}/{action}`.
3. Supported actions are `prepare`, `dispatch`, `transit`, `receive`,
   `cancel`, `compromise`, and `local-release-complete`.
   `prepare` requires `preparedAt`, `preparedEvidenceDigest`, and
   `preparedEvidenceId`; `compromise` requires `reasonCode`; all actions
   require `expectedVersion`, `eventTime`, and `correlationId`.
4. Roles are: prepare/dispatch/transit/local-release-complete
   `ROLE-01` or `ROLE-02); receive `ROLE-03`; cancel any of
   `ROLE-01`, `ROLE-02`, or `ROLE-03`; compromise any of those three
   roles.

`POST /api/v2/local-releases` is restricted to `ROLE-01` and `ROLE-02`
and requires `releaseId`, blood type, component type, positive integer
quantity, event time, and correlation ID. It queues
`RESERVE_LOCAL_RELEASE`; completion uses the reservation action
`local-release-complete`.

`POST /api/v2/reconciliation` is restricted to `ROLE-01` and `ROLE-02`
and requires `caseId`, `componentId`, `reasonCode`, and correlation ID.
All three mutation families require the idempotency header and return the
same command envelope.

Legacy `/api/v2/transfers/{transferId}/{action}` aliases such as
`approve`, `prepare`, `dispatch`, `receipt`, and `reject` are
intentionally rejected with `V2_CANONICAL_WORKFLOW_REQUIRED`. The frontend
must use the reservation endpoint and must not treat the legacy route as a
successful 202 workflow.

## Forecast Analytics handoff

The active runtime is `SYNTHETIC_FORECAST_V4_RUNTIME_V1`,
`bloodledger-weighted-average-7-1.0.0`, one-day horizon, and up to 20 series:
four positive blood groups by five components. Historical V1 reads remain
available only through explicit `datasetVersion` selection; the recommended
first LAT scope is active V4 only.

Forecast envelopes use `CURRENT`, `STALE`, and `UNAVAILABLE`; each item
uses `AVAILABLE`, `STALE`, and `UNAVAILABLE`. Missing or unsupported
series remain absent/unavailable and are never displayed as zero. Null lower
and upper values display as “Uncertainty unavailable”. The UI should show
dataset/model identity, requested dates, unavailable reason, and
`SIMULATION_ONLY`. These semantics still require BUNO's human research
re-review.

## Readiness and remaining gates

Verified locally on implementation commit `3b890f0` and its documentation
follow-ups: BUNO's four producer corrections,
fresh/upgrade migrations, cross-institution scope, replay/conflict behavior,
null and requested-date handling, API/coordination/chaincode tests, static
boundaries, JSON formatting, and secret scanning. The exact pushed frontend
baseline, LAT implementation, browser UAT, approved offline retention rule,
BUNO human re-review, JOPIA acceptance, and real-Fabric restart/submission-count
evidence remain pending. All outputs remain simulation-only; `RQ-07` and
clinical, operational, institutional, UAT, regulatory, and production gates
remain open.
