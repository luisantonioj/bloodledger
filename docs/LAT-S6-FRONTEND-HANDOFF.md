# LAT Sprint 6 Frontend Handoff

**Status:** PR #14 merged at `40b8c64`; LAT frontend follow-ups implemented on
`codex/s6-frontend-followups`. Human browser UAT and owner review remain pending.

**Integration baseline:** Lat commit
`111681e26d2c91515cdea75f71faf341768cc1fa`; Jopia implementation and evidence
through `9a5d768`. The integration branch contains `main` `fbd9a84`, Lat's
seven subsequent commits, and the grouped Jopia changes without rewriting
either owner's history.

**Classification:** `SIMULATION_ONLY`

This document summarizes the backend contract for LAT. The machine-readable
contracts remain authoritative:

- [V2 OpenAPI](../services/api/openapi-v2.json)
- [V1/API OpenAPI](../services/api/openapi.json)
- [Inbound OCR V2.1 schema](../contracts/inbound-ocr-v2-1.schema.json)
- [Core V2.1 schema](../contracts/core-v2-1.schema.json)
- [Inbound OCR policy](./INBOUND-OCR-REGISTRATION.md)
- [ML V4 runtime contract](./ML-RUNTIME-INTEGRATION-V4.md)

The earlier backend implementation revision remains `3b890f0`; this handoff
adds the contracts needed to integrate that backend with Lat's frontend. The
authoritative integration evidence is in
[SPRINT-06-VALIDATION.md](./SPRINT-06-VALIDATION.md).

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

Offline V2 submission remains disabled. Exact Donation No. stays in volatile
browser memory only during active capture and confirmation. Do not place it in
IndexedDB, local/session storage, service-worker caches, URLs, logs, or
persisted request bodies, including encrypted forms. Reload requires fresh
capture and confirmation.

Generate one idempotency key per confirmed submission. Retry with the same key
and identical payload only while the payload remains in memory. After server
acceptance, persist only allowlisted tracking metadata and poll the returned
`statusUrl`; never resubmit an accepted command. If the response is lost, use
`GET /api/v2/commands?idempotencyKey={key}` while the key is available. After
page loss, recover command status before permitting fresh capture; an empty
lookup must not create a replacement submission automatically.

Clear sensitive capture state after acceptance, cancellation, logout, session
expiry, or the 15-minute confirmation timeout. Keep a terminal receipt for 24
hours after terminal observation and keep nonterminal receipts until
authenticated recovery resolves them. Delete expired terminal receipts during
startup and periodic cleanup, and clear local receipts on logout. Retained
tracking metadata must exclude Donation No., OCR text/material, images,
credentials, ciphertext, and keyed donation-reference evidence. Memory cleanup
is application cleanup and is not a forensic-erasure guarantee.

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

`GET /api/v2/commands` lists only the authenticated actor's commands in the
authenticated institution. It supports `limit`, deterministic `cursor`, and
optional exact `idempotencyKey`. The response contains safe command envelopes
only and never stored request payloads.

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

Use `GET /api/v2/reservations` and
`GET /api/v2/reservations/{reservationId}` to discover committed reservation
state. ROLE-01/02 receive source-institution reservations; ROLE-03 receives
transfers destined for its institution. Absent and out-of-scope details both
return the safe not-found response. The envelope includes safe component
references, preparation status, linked transfer or local-release ID, current
version, source/destination, and `SIMULATION_ONLY`, without Donation No. or
command payload evidence. Send the V2.1 header when a reservation contains
`CRYOPRECIPITATE`; do not silently omit that component in a V2 view.

`POST /api/v2/local-releases` is restricted to `ROLE-01` and `ROLE-02`
and requires `releaseId`, blood type, component type, positive integer
quantity, event time, and correlation ID. It queues
`RESERVE_LOCAL_RELEASE`; completion uses the reservation action
`local-release-complete`.

`POST /api/v2/reconciliation` is restricted to `ROLE-01` and `ROLE-02`
and requires `caseId`, `componentId`, `reasonCode`, and correlation ID.
All three mutation families require the idempotency header and return the
same command envelope.

Populate the reason selector from `GET /api/v2/reconciliation/reasons`. It
returns policy `SYNTHETIC_RECONCILIATION_REASONS_V1` and the seven exact safe
codes/labels recorded in `BL-DEC-S6-2026-09-19-01`. Do not provide free text.
Selecting a reason requests a reconciliation hold; it does not correct a
record, release stock, or establish clinical suitability.

Legacy `/api/v2/transfers/{transferId}/{action}` aliases such as
`approve`, `prepare`, `dispatch`, `receipt`, and `reject` are
intentionally rejected with `V2_CANONICAL_WORKFLOW_REQUIRED`. The frontend
must use the reservation endpoint and must not treat the legacy route as a
successful 202 workflow.

## Census discovery

`GET /api/v2/reports/doh-census` lists existing safe snapshot metadata only.
ROLE-01/02 receive institution-scoped snapshots; ROLE-04 receives its
authorized aggregate scope. The display order is O+, A+, B+, AB+, O−, A−, B−,
AB−, followed by calculated Total under `DOH_CENSUS_COLUMN_ORDER_V1`.

This decision confirms column display order only. Keep snapshot capture,
copy/TSV, and export controls unavailable while the response reports
`EXPORT_DISABLED_PENDING_FORMAT`. Do not substitute internal ML snapshots or
treat the order decision as approval of the full DOH report format.

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
- LAT connects permission-scoped reservation list/detail reads and source or
  destination role actions from committed IDs and versions. V2.1 reads retain
  cryoprecipitate. Prepare, dispatch, transit, receive, cancel, and local
  release completion follow the published state and role map. Compromise is
  held pending an approved incident reason-code vocabulary.
- Reconciliation reason choices come from the running API; the UI exposes no
  free text and describes the effect as a hold. Census discovery is visible
  to authorized institution and regulatory users with the versioned display
  order. Copy/export remains disabled.
- Web and Capture recover actor-scoped commands after reload or a lost
  response. Capture clears sensitive fields on acceptance, cancellation,
  logout, session expiry, or the 15-minute confirmation timeout. Terminal
  receipts expire after 24 hours; nonterminal receipts stay until recovery.
- The official session-cookie forecast path is now supported by the backend.
  The frontend retains active-V4-only presentation and truthful unavailable
  and uncertainty states.
- Census copy/export remains unavailable even though the visible blood-type
  order is now confirmed.
- Analytics consumes only the active ML V4 envelope, preserves absent/null
  semantics, and never enables recommendation or approval behavior.
- Combined PR #14 validation on LAT's host passed API 97/97, chaincode 30/30,
  web 50/50, Capture 14/14, all 21 PostgreSQL migrations and Sprint 6 probes,
  web browser 22 passed with seven retired V1 cases skipped, and Capture
  browser 3/3. The Chromium dependency was available on this host.
- LAT follow-up branch verification passed web production build, 54 web unit
  tests, 23 current web browser tests (seven retired V1 cases skipped), Capture
  PWA production build, 14 Capture unit tests, four Capture browser tests,
  and repository foundation checks. The Sprint 6 integrated-boundary script
  is restricted by its own branch-name check to the backend integration
  branch and is not a follow-up-branch test.

## LAT follow-up discrepancy register — 2026-09-23

- **JOPIA contract correction:** The running API registers
  `GET /api/v2/reconciliation/reasons`, while `services/api/openapi-v2.json`
  currently places `listReconciliationReasons` under `GET /reconciliation`.
  The frontend uses the running route; align OpenAPI and route before final
  contract acceptance.
- **JOPIA decision needed:** The reservation compromise command accepts a
  syntactically valid `reasonCode`, but there is no approved selectable
  incident vocabulary. LAT has not invented one. Keep the compromise control
  disabled until the versioned codes and labels are supplied and enforced.
- **LAT/human evidence:** Automated browser checks are technical evidence.
  Human browser UAT, visual acceptance of these follow-ups, and live
  authenticated walkthrough remain separate pending records.

## Readiness and remaining gates

Backend dependencies and real-Fabric restart/submission-count recovery are
verified through `9a5d768`, with Jopia self-validation disclosed in the
validation record. LAT's follow-up implementation awaits PR review and human
browser UAT. Buno's human research/lineage review remains open.
Full report-format approval, export/copy activation, offline V2 submission,
physical Android evidence, `RQ-07`, and all clinical, operational,
institutional, UAT, regulatory, and production gates remain open. All outputs
remain `SIMULATION_ONLY`.
