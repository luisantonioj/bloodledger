# LAT Sprint 6 Frontend Handoff

**Status:** Frontend contract implementation complete on
`codex/s6-frontend-integration`; live cross-owner integration evidence and
human browser UAT remain pending

**Backend scope:** PR #11 on `codex/ml-v4-verification`; implementation commit
`3b890f0` incorporates BUNO's correction commit `f58b905`; subsequent
documentation commits record the handoff and verification register.

**Classification:** `SIMULATION_ONLY`

This document summarizes the backend contract for LAT. The machine-readable
contracts remain authoritative:

- [V2 OpenAPI](../services/api/openapi-v2.json)
- [V1/API OpenAPI](../services/api/openapi.json)
- [Inbound OCR V2.1 schema](../contracts/inbound-ocr-v2-1.schema.json)
- [Core V2.1 schema](../contracts/core-v2-1.schema.json)
- [Inbound OCR policy](./INBOUND-OCR-REGISTRATION.md)
- [ML V4 runtime contract](./ML-RUNTIME-INTEGRATION-V4.md)

The exact combined backend implementation revision for frontend development is
`3b890f0`. PR #11 was merged to `main` in `11afde3`; the frontend branch merged
the later `origin/main` revision `fbd9a84` in `e408817` before implementation.

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

The Capture PWA now uses the V2 inbound contract, the official session cookie,
explicit review of all five OCR fields, and the backend command envelope. It
selects V2.1 only for `CRYOPRECIPITATE`. The exact Donation No. remains
in-memory only and raw images/unrestricted OCR text are neither submitted nor
persisted.

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

The frontend polls at two seconds initially with exponential error backoff
capped at 30 seconds. It stops on `COMMITTED`, `FAILED`, or `CONFLICT`, pauses
while offline, and stops authenticated polling after logout or session loss.
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
   `ROLE-01` or `ROLE-02`; receive `ROLE-03`; cancel any of
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
`SIMULATION_ONLY`. The web client now enforces this active dataset/model and
matrix. BUNO's human research interpretation and any accuracy claim remain a
separate gate.

## Frontend implementation evidence

- Capture PWA migrated from V1 scan events to V2 inbound OCR and durable
  command status.
- Main web inventory consumes the institution-scoped V2 component envelope and
  keeps intake command counts separate from committed components.
- Main web exposes canonical V2 transfer request and local-release entry points
  only for the confirmed roles. Legacy V1 mutations are disabled.
- Reservation actions remain unavailable because no permission-scoped
  reservation list/detail read exists. Reconciliation remains unavailable
  because an approved reason-code list is not frozen.
- Census UI remains unavailable because there is no snapshot index/list read
  and the DOH copy column order is unapproved.
- Analytics consumes only the active ML V4 envelope, preserves absent/null
  semantics, and never enables recommendation or approval behavior.
- Automated evidence: web production build and 50 unit tests pass; Capture PWA
  production build and 14 unit tests pass; web browser coverage passes with
  seven retired V1 mutation fixtures skipped; Capture PWA browser coverage
  passes 3/3.

## Readiness and remaining gates

Backend behavior was verified on implementation commit `3b890f0` and its
documentation follow-ups: BUNO's four producer corrections,
fresh/upgrade migrations, cross-institution scope, replay/conflict behavior,
null and requested-date handling, API/coordination/chaincode tests, static
boundaries, JSON formatting, and secret scanning. LAT's contract-based
implementation and automated browser evidence are complete. Human browser UAT,
an approved offline retention/secure Donation No. replay rule, reservation
reads, reconciliation reason codes, census snapshot listing, the forecast
endpoint's session-cookie alignment, BUNO human re-review, and real-Fabric
restart/submission-count evidence remain pending. All outputs remain
simulation-only; `RQ-07` and
clinical, operational, institutional, UAT, regulatory, and production gates
remain open.
