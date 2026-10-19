# BloodLedger Software Requirements

**Status:** Approved baseline with authorized Sprint 4 synthetic capture assumptions
**Baseline date:** 2026-08-17
**Requirement owners:** Buno, Jopia, and Lat

## 1. Conventions

- `FR-*` identifies functional behavior preserved from the manuscript.
- `BR-*` identifies an implementation-level business rule.
- `NFR-*` identifies a quality attribute or constraint.
- **Must** is required for the research prototype.
- **Proposed** requires stakeholder or technical confirmation before the linked
  implementation begins.
- **Prototype assumption** is an owner-approved, versioned, synthetic decision
  used while institutional evidence is pending. It is replaceable and cannot be
  represented as clinical or Mary Mediatrix policy.
- Acceptance statements are testable targets, not evidence that a test passed.

## 2. Roles and permissions

### 2.1 Roles

The manuscript names four access tiers but also requires secondary hospitals to
submit requests and confirm transfers. This baseline therefore separates a
`Secondary Hospital User` from the inventory-holding hospital roles. ADR-013
accepted that refinement. ADR-030 adds a non-clinical institution account role
so activation does not grant transfer or custody authority.

| ID | Role | Description |
|---|---|---|
| ROLE-01 | Medical Technologist | Performs authorized scan and custody operations for an institution |
| ROLE-02 | Hospital Administrator | Oversees local inventory and approves or rejects transfer requests |
| ROLE-03 | Secondary Hospital User | Submits requests and manages receipt-side actions for a recipient institution |
| ROLE-04 | DOH/PRC Regulatory Viewer | Reads approved city-wide summaries, alerts, history, and reports |
| ROLE-05 | System Administrator | Manages application users, institutions, configuration, and system operations |
| ROLE-06 | Institution Account Administrator | Manages one activated institution's profile and users without clinical, custody, transfer, or Fabric authority |

### 2.2 Permission baseline

| Capability | Technologist | Hospital Admin | Secondary User | Regulator | System Admin | Institution Account Admin |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| View own institution inventory detail | Yes | Yes | Limited | Read-only | No by default | No by default |
| View city-wide aggregate availability | Yes | Yes | Yes | Yes | No by default | As approved |
| Register or receive a unit into local custody | Yes | Yes | Receipt only | No | No | No |
| Submit a blood request | No by default | Yes | Yes | No | No | No |
| Approve/reject outgoing transfer | No | Yes | No | No | No | No |
| Confirm dispatch | Yes | Yes | No | No | No | No |
| Confirm receipt/exception | Local receipt only | Yes | Yes | No | No | No |
| View audit history | Local | Local/full permitted | Own transfers | Read-only city-wide | Security/administration only | User/profile administration only |
| Export regulatory reports | No | Local | No | Yes | No by default | No |
| Review and decide institutional applications | No | No | No | No | Yes | No |
| Manage users and institutions | No | No | No | No | Yes | Own institution users/profile only |

Least privilege applies. The System Administrator role does not automatically
perform clinical or custody actions. Chaincode-sensitive operations must also
validate the submitting organization and attributes, not only the web session.
A pending applicant identity is not an operational role and can access only its
own application status.

## 3. Functional requirements

### FR-01 — Register blood unit by scan

The system shall register a supported blood-unit label, capturing at minimum the
unit identifier, blood type, component, collection timestamp, and expiry
timestamp without retyping encoded values. Barcode/2D-code decoding remains the
operational baseline pending approved fixtures. Under `PA-S4-01`, mobile
on-device OCR is the primary synthetic Sprint 4 path, with Code 128/Data Matrix
and synthetic QR fallback. This does not satisfy real-label or full ISBT 128
compatibility while `RQ-02` remains unresolved.

Acceptance:

- A valid, unique supported label creates one pending or committed unit record.
- A duplicate identifier creates no second unit.
- A malformed or unsupported payload creates no inventory asset and reports a
  clear validation error.
- OCR-derived values are never committed solely because text was detected;
  required fields, confidence, exact-policy validation, authentication, and
  explicit confirmation rules must pass.
- No donor or patient field is persisted.

For the interview-aligned V2 inbound workflow (`PA-S6-02`), the source-system
import assumption is removed: every inbound at every blood bank uses confirmed
OCR through `INBOUND_OCR_V1`. The V2 mutation path accepts no barcode-only,
manual-only, client-generated donation/component IDs, or raw OCR text/images;
the receiving institution is derived from authenticated custody and the
printed label expiry is authoritative.

### FR-02 — Enforce FEFO at dispatch

The system shall reject dispatch of a later-expiring available unit when an
earlier-expiring eligible unit of the same required type and component exists at
the supplying institution.

Acceptance:

- The earliest eligible unit is surfaced to the operator.
- An override is not allowed unless a future clinically approved exception rule
  is documented and audited.

### FR-03 — Display consortium inventory

The system shall present an access-controlled city-wide inventory matrix by
institution, blood type, and component, updated after accepted inventory events.

Acceptance:

- Detail visibility follows the permission matrix.
- Pending/offline data is visually distinct from ledger-confirmed data.
- The last successful synchronization time is visible.

### FR-04 — Display stock indicators

The system shall display configurable minimum-stock, safe-stock, shortage, and
predicted-surplus indicators without treating a static upper threshold as the
sole definition of distributable surplus.

Acceptance:

- Threshold values have an owner, effective date, and audit history.
- A predicted surplus is labeled with forecast time and model version.

Accepted demonstration follow-up (2026-10-15): the user's later explicit
[project stock-band decision](handoffs/LAT-OFFICIAL-DEMO-STOCK-BANDS-DECISION-2026-10-15.md)
authorizes SYNTHETIC_STOCK_CLASSIFICATION_V1 for frontend display only. Institutional
RQ-16 remains open and FR-04 remains partially implemented; these invented bands
are not clinical levels or distributable-surplus authorization.

### FR-05 — Submit blood requisition

An authorized hospital user shall submit a request containing institution,
blood type, component, quantity, urgency, request time, and permitted supporting
notes that contain no PHI.

Acceptance:

- Missing or invalid fields are rejected.
- Requests receive a stable identifier and initial `PENDING` status.
- Duplicate submissions with the same idempotency key create one request.

### FR-06 — Rank concurrent requests using RPS

The system shall compute and display a reproducible priority score for eligible
requests competing for the same constrained stock.

Acceptance:

- Clinical urgency and capped wait time are included.
- Score inputs, weights, algorithm version, and tie-break result are recorded.
- Ranking never constitutes automatic clinical approval.

### FR-07 — Generate BROA recommendation

The system shall generate an explainable redistribution recommendation when a
unit is near expiry or the approved forecast reports positive distributable
surplus.

Acceptance:

- FEFO selects only eligible units.
- Ineligible destinations and unavailable units are excluded.
- Inputs, normalized values, weights, result, and algorithm version are shown.
- A recommendation requires authorized human approval before custody changes.

### FR-08 — Evaluate near-expiry and expiry conditions

The system shall evaluate component-specific thresholds through a scheduled
application process and submit deterministic state-change transactions.

Acceptance:

- Chaincode does not depend on an internal clock or background scheduler.
- The submitted evaluation time and threshold version are validated.
- Expired units become unavailable and are never recommended.

### FR-09 — Display expiry warnings

The alert center shall show unit ID, type, component, institution, expiry time,
days/time remaining, status, and acknowledgement state for permitted users.

### FR-10 — Capture dispatch and receipt location evidence

The system shall capture timestamp, latitude, longitude, accuracy/source, and a
fallback indicator at dispatch and receipt, subject to permission and policy.

Acceptance:

- Missing GPS may use pre-registered facility coordinates only when clearly
  marked as fallback.
- Implausible or unauthorized locations are rejected or flagged for review.
- Continuous transport tracking is not performed.

### FR-11 — Track transfer lifecycle

The system shall expose the transfer states `PENDING`, `APPROVED`, `REJECTED`,
`DISPATCHED`, `IN_TRANSIT`, `DELAYED`, `RECEIVED`, `COMPROMISED`, and
`CANCELLED` where permitted.

Acceptance:

- Every transition records actor, institution, time, reason where required, and
  correlation identifier.
- Invalid, duplicate, or out-of-order transitions are rejected.

### FR-12 — Enforce role-based access

The system shall enforce the role and institution permissions in Section 2 at
the UI, API/application, and chaincode boundary appropriate to each operation.

Acceptance:

- Unauthenticated access is rejected.
- A valid session cannot perform an action outside its role or institution.
- Regulatory users cannot submit mutations.

### FR-13 — Preserve and synchronize offline scans

The system shall save valid scan events durably during ledger connectivity loss
and reconcile them after connectivity returns.

Acceptance:

- Original event time and later submission time are both preserved.
- Retries do not create duplicates.
- Events are processed in a documented deterministic order.
- Conflicts are visible and are not silently overwritten.

### FR-14 — Forecast daily demand and surplus

The system shall generate a daily forecast per blood type and component using
approved historical data and calculate a predicted distributable surplus.

Acceptance:

- Training data lineage, cleaning steps, split method, metrics, and model
  version are reproducible.
- Forecasts include generation time, horizon, uncertainty or confidence note,
  and stale/unavailable status.
- A safe fallback prevents redistribution based solely on a failed or stale
  forecast.

### FR-15 — Apply for institutional participation

An authorized institutional representative shall be able to submit a
privacy-minimized institutional application using a valid single-use
invitation. Supported categories are `SECONDARY_HOSPITAL` and `BLOOD_BANK`.

Acceptance:

- Submission creates one opaque application ID in `SUBMITTED` state and no
  operational tenant access.
- Required fields are limited to institution legal/display name, category,
  facility locality, official generic contact channel, accreditation/license
  reference, application reason, and attestations.
- Applicant verification uses the invitation plus administrator confirmation;
  no external email or SMS service is assumed.
- Submission establishes an invitation-bound pending applicant identity whose
  credential verifier is stored only in the identity layer and whose access is
  limited to that application.
- Duplicate and idempotent submissions return safe responses that do not reveal
  unrelated institutions or accounts.
- Applications, users, credentials, sessions, and verification evidence remain
  off-chain.

### FR-16 — Review and activate institutional participation

An authorized System Administrator who is not affiliated with the applicant
shall review, approve, reject, activate, suspend, and reactivate institutional
participation through separate audited actions.

Acceptance:

- Approval and activation are distinct; approval alone grants no protected
  operational access.
- Activation creates or enables the initial `ROLE-06` user and only explicitly
  approved institution-scoped permissions.
- Rejected applicants may resubmit a new version linked to the retained prior
  application; submitted or under-review applications may be withdrawn.
- Rejected, unactivated, and suspended institutions cannot view protected
  operational information, submit requests, or perform ledger mutations.
- Suspension revokes active sessions and blocks new operational mutations.
- Application approval or activation never enrolls a Fabric identity, creates
  an MSP/CA/peer, joins a channel, deploys chaincode, or changes endorsement.
- Every decision uses authentication, authorization, validation, idempotency,
  correlation, version/concurrency checks, a safe reason where applicable, and
  audit evidence.

## 4. Business rules

### 4.1 Inventory

- **BR-INV-01:** A blood-unit identifier is globally unique.
- **BR-INV-02:** Availability requires an active unit in the current
  institution's custody that is not reserved, dispatched, received elsewhere,
  compromised, cancelled out of custody, transfused, or expired.
- **BR-INV-03:** FEFO comparison uses blood type, component, eligibility, and
  expiry timestamp; blood type alone is insufficient.
- **BR-INV-04:** Expired units are `EXPIRED`/inactive and excluded from all
  availability and recommendation counts. Disposal is outside scope.
- **BR-INV-05:** Corrections are new auditable events; committed ledger history
  is never edited or deleted.
- **BR-INV-06:** A read-model value must expose whether it is pending,
  committed, failed, or conflicted.
- **BR-INV-07:** Replaceable domain values use an immutable policy version.
  Existing assets and events retain the policy version under which they were
  accepted; a later policy applies prospectively unless an authorized,
  separately audited correction is implemented.

### 4.2 Requests and transfers

- **BR-TRF-01:** A request does not reserve stock until authorized approval.
- **BR-TRF-02:** Approval must atomically validate availability and reserve the
  selected units or fail without partial reservation.
- **BR-TRF-03:** Rejection before dispatch releases reservations and requires a
  non-PHI reason.
- **BR-TRF-04:** Dispatch requires an approved request, reserved eligible units,
  authorized actor, and location/time evidence.
- **BR-TRF-05:** Receipt requires an in-transit transfer, authorized recipient,
  matching units, and location/time evidence.
- **BR-TRF-06:** `DELAYED` preserves custody and does not make units available.
- **BR-TRF-07:** `COMPROMISED` quarantines units from availability pending
  manual review; this system does not decide clinical usability.
- **BR-TRF-08:** Cancellation is prohibited after receipt and requires a reason.
- **BR-TRF-09:** An urgent request cannot silently take an existing reservation.
  Reallocation requires an explicit, authorized, audited workflow; its exact
  authority is proposed and must be approved before Sprint 3.
- **BR-TRF-10:** Completed custody requires both dispatch and receipt evidence;
  whether this uses end-user identities or institutional service identities is
  an architecture decision.

### 4.3 Algorithms

- **BR-ALG-01:** BROA is decision support, not autonomous approval.
- **BR-ALG-02:** BROA is triggered by a near-expiry condition or positive,
  current, approved predicted distributable surplus.
- **BR-ALG-03:** Initial proposed SAW criteria are urgency, stock shortage,
  supplying-node surplus, and distance. Weights remain proposed until clinical
  stakeholder approval.
- **BR-ALG-04:** RPS uses clinical urgency and capped wait time; ties use oldest
  request then stable request ID unless stakeholders approve another rule.
- **BR-ALG-05:** Every result records the algorithm/configuration version.
- **BR-ALG-06:** Minimum reserve and safety factors are configuration governed
  by authorized stakeholders, not hard-coded constants.
- **BR-ALG-07:** Forecast-derived consumption must account for deliveries,
  transfers, expiry, and corrections; raw difference between consecutive stock
  snapshots is not assumed to equal use without reconciliation.

### 4.4 Privacy, security, and audit

- **BR-SEC-01:** Patient, donor, diagnosis, treatment, and staff-identifying
  clinical data are prohibited in requests, notes, logs, databases, and ledger.
- **BR-SEC-02:** On-chain payloads use an explicit field allowlist.
- **BR-SEC-03:** Passwords, tokens, private keys, certificates, and `.env` values
  are never committed to Git or written to business audit events.
- **BR-SEC-04:** Every mutation uses authentication, authorization, validation,
  idempotency, correlation, and audit metadata.
- **BR-SEC-05:** Audit logs are access-controlled; immutability does not imply
  unrestricted visibility.

### 4.5 Institutional onboarding

- **BR-ONB-01:** Institutional application is invitation-only in the prototype;
  a single-use invitation authorizes submission but not approval or access.
  *Superseded for new synthetic applications on 2026-10-16 by
  [PA-ACCOUNT-03](#pa-account-03--public-synthetic-applications-and-sample-facilities-2026-10-16):
  any prospective synthetic Blood Bank or Requestor facility may apply without an
  invitation. Submission still authorizes neither approval nor access.*
- **BR-ONB-02:** Application IDs and institution IDs are stable opaque values;
  display names never serve as authorization scope.
- **BR-ONB-03:** Duplicate detection uses normalized institution name, category,
  locality, and institutional reference without disclosing a matching record.
- **BR-ONB-04:** Verification documents are not stored initially. The system
  records evidence type, result, reviewer, UTC review time, and a safe reference.
  PA-ACCOUNT-03 adds only references to generated synthetic document fixtures,
  always `NOT_VERIFIED`; no user file is uploaded or stored.
- **BR-ONB-05:** An applicant, affiliated administrator, or institution account
  administrator cannot approve or activate its own application.
- **BR-ONB-06:** Approval and activation are separate version-checked mutations.
  Repeated matching decisions are idempotent; conflicting or stale decisions
  fail safely.
- **BR-ONB-07:** Activation initially grants only `ROLE-06`. Clinical, custody,
  transfer, regulatory, and system roles require separate authorized assignment.
- **BR-ONB-08:** Only `ACTIVE` institutions and active users with an explicitly
  permitted role may access protected operational behavior.
- **BR-ONB-09:** Suspension revokes sessions, blocks new requests and mutations,
  and cannot silently change inventory custody or transfer state.
- **BR-ONB-10:** Normal suspension is refused while the institution has a
  dispatched or in-transit transfer. Emergency handling remains gated by
  `RQ-15`.
- **BR-ONB-11:** Notifications are stored in-application only. No external
  email, SMS, or delivery guarantee is implied.
- **BR-ONB-12:** Application approval and activation never change Fabric
  membership, MSPs, CAs, certificates, peers, channels, chaincode lifecycle, or
  endorsement policy.
- **BR-ONB-13:** Before separate Fabric membership, an activated blood bank may
  manage its profile and users and view approved application-level information.
  It cannot register inventory, hold ledger custody, endorse, or mutate Fabric;
  request permission requires a separately assigned permitted role.
- **BR-ONB-14:** An active secondary hospital may acknowledge receipt and be
  recorded as the custody destination, but cannot expose received stock as
  available or redistribute it until `RQ-09` and `RQ-10` are resolved.
- **BR-ONB-15:** Each onboarding mutation records the actor user ID, actor
  institution ID when applicable, subject application and institution IDs,
  prior and resulting status, stable reason code and safe explanation where
  required, UTC event time, correlation ID, idempotency key, and resulting
  version.
- **BR-ONB-16:** Administrator confirmation uses the institution's official
  generic contact channel through an approved out-of-band manual process. The
  application stores the confirmation result and safe reference, not message
  contents or a claim of external delivery.

Rejection reason codes are `INCOMPLETE_EVIDENCE`, `VERIFICATION_FAILED`,
`INELIGIBLE_CATEGORY`, `DUPLICATE_APPLICATION`, `OUT_OF_SCOPE`, and `OTHER`.
Suspension reason codes are `SECURITY_HOLD`, `GOVERNANCE_HOLD`,
`INSTITUTION_REQUEST`, `ELIGIBILITY_LAPSED`, and `OTHER`. `OTHER` requires a
privacy-safe explanation.

The stable onboarding error vocabulary is:

| Code | Meaning |
|---|---|
| `ONB_INVITATION_INVALID` | Invitation is missing, invalid, expired, or already consumed |
| `ONB_APPLICATION_INVALID` | Submitted fields or attestations are invalid |
| `ONB_APPLICATION_CONFLICT` | A safe duplicate or idempotency conflict exists |
| `ONB_TRANSITION_INVALID` | Requested status transition is not allowed |
| `ONB_NOT_AUTHORIZED` | Actor lacks the required role or institution scope |
| `ONB_SELF_APPROVAL_FORBIDDEN` | Actor is the applicant or affiliated with the applicant |
| `ONB_VERSION_CONFLICT` | Expected application or institution version is stale |
| `ONB_INSTITUTION_NOT_ACTIVE` | Institution is not activated for the requested operation |
| `ONB_ACTIVE_TRANSFER_BLOCKS_SUSPENSION` | Normal suspension is unsafe while a transfer is active |
| `ONB_REASON_REQUIRED` | A required rejection, withdrawal, suspension, or reactivation reason is absent |
| `ONB_NOT_FOUND` | Requested record is absent or invisible in the actor's scope |

PA-ACCOUNT-03 adds public-application, sample and deregistration codes. Their
exact meaning lives with the routes in `services/api/openapi-v2.json`.

## 5. State models

### 5.1 Blood unit

```text
PENDING_COMMIT -> AVAILABLE -> RESERVED -> IN_TRANSIT -> RECEIVED
                         |          |            |
                         |          |            +-> COMPROMISED
                         |          +-> AVAILABLE (approved release/cancel)
                         +-> EXPIRED

Any eligible active state -> EXPIRED when the validated expiry rule applies.
```

`RECEIVED` represents receipt into the destination's custody. A separate
transaction may make the unit `AVAILABLE` at that institution after required
local verification. The manuscript's simple `RECEIVED` endpoint does not by
itself define clinical availability.

### 5.2 Transfer

```text
PENDING -> APPROVED -> DISPATCHED -> IN_TRANSIT -> RECEIVED
    |          |                         |            |
    +-> REJECTED                         +-> DELAYED  +-> COMPROMISED
    +-> CANCELLED                        +-> COMPROMISED
               APPROVED -> CANCELLED (before dispatch only)
```

Allowed transitions must be represented as a single authoritative table before
Sprint 3 implementation.

Under `PA-S3-01`, the simulation-only transition table is:

| From | Allowed next state |
|---|---|
| `PENDING` | `APPROVED`, `REJECTED`, `CANCELLED` |
| `APPROVED` | `DISPATCHED`, `CANCELLED` |
| `DISPATCHED` | `IN_TRANSIT`, `COMPROMISED` |
| `IN_TRANSIT` | `DELAYED`, `RECEIVED`, `COMPROMISED` |
| `DELAYED` | `IN_TRANSIT`, `RECEIVED`, `COMPROMISED` |
| `RECEIVED` | `COMPROMISED` |

`REJECTED`, `CANCELLED`, and `COMPROMISED` are terminal. Received synthetic
units remain unavailable because `RQ-10` is unresolved.

### 5.3 Offline event

```text
CAPTURED -> VALIDATED -> QUEUED -> SUBMITTING -> COMMITTED -> PROJECTED
                    |              |              |
                    +-> REJECTED   +-> RETRY      +-> PROJECTION_RETRY
                                   +-> CONFLICT
```

### 5.4 Institutional application and participation

```text
Application:
SUBMITTED -> UNDER_REVIEW -> APPROVED
    |             |
    +-> WITHDRAWN +-> REJECTED
                  +-> WITHDRAWN

Institution after application approval:
PENDING_ACTIVATION -> ACTIVE -> SUSPENDED
                        ^           |
                        +-----------+
```

`REJECTED` and `WITHDRAWN` are terminal for that application record. A permitted
resubmission creates a new version linked to the retained prior application.
`APPROVED` is an application decision; `PENDING_ACTIVATION`, `ACTIVE`, and
`SUSPENDED` are institution participation states. Only `ACTIVE` permits
explicitly assigned operational roles.

Allowed transitions are:

| Entity | From | To | Required guard/evidence |
|---|---|---|---|
| Invitation | `ISSUED` | `CONSUMED` | One valid idempotent application submission |
| Invitation | `ISSUED` | `REVOKED` or `EXPIRED` | Authorized revocation or validated expiry |
| Application | `SUBMITTED` | `UNDER_REVIEW` | Unaffiliated System Administrator claims review |
| Application | `SUBMITTED` | `WITHDRAWN` | Applicant reason and expected version |
| Application | `UNDER_REVIEW` | `APPROVED` | Verification passed, decision reason, expected version |
| Application | `UNDER_REVIEW` | `REJECTED` | Stable rejection reason and expected version |
| Application | `UNDER_REVIEW` | `WITHDRAWN` | Applicant reason and expected version |
| Institution | `PENDING_ACTIVATION` | `ACTIVE` | Approved application, initial `ROLE-06` identity, explicit permissions |
| Institution | `ACTIVE` | `SUSPENDED` | Stable reason, expected version, and transfer guards in BR-ONB-09–10/RQ-12/RQ-15 |
| Institution | `SUSPENDED` | `ACTIVE` | Eligibility reverified, reactivation reason, expected version |

No other direct transition is allowed. Resubmission after rejection or
withdrawal creates a new `SUBMITTED` application linked to the prior record.

## 6. Non-functional requirements

| ID | Requirement | Verifiable target |
|---|---|---|
| NFR-01 | Zero PHI collection | Prohibited-field and sample-data review finds no PHI/PII |
| NFR-02 | Tamper-evident audit trail | Accepted inventory/custody mutations have immutable Fabric transaction references |
| NFR-03 | Low-barrier hardware | Supported mobile browser/camera PWA with optional compatible 2D scanner fallback; no specialized sensor required |
| NFR-04 | ISBT 128 compatibility | Approved representative label fixtures parse correctly; unsupported identifiers fail safely |
| NFR-05 | Offline resilience | Tested outage loses no accepted local event and reconnection creates no duplicate ledger event |
| NFR-06 | Dashboard latency | Committed scan change is visible within 5 seconds under documented normal test conditions |
| NFR-07 | On-premise data residency | Operational stores and backups run in the approved local environment; external services require a new decision |
| NFR-08 | Determinism | Chaincode uses no external calls, random values, local clocks, or non-deterministic iteration |
| NFR-09 | Maintainability | Supported versions, one-command validation, lint/type/test gates, and documented reset procedures |
| NFR-10 | Observability | Services expose health status and correlation-aware logs without secrets or prohibited data |
| NFR-11 | Accessibility | Status is not conveyed by color alone; core workflows are keyboard usable and have readable labels |
| NFR-12 | Recoverability | Development environment can be safely stopped, reset, recreated, and verified from documentation |
| NFR-13 | Enumeration-resistant onboarding | Duplicate, status, authentication, and authorization errors do not reveal unrelated institutions or accounts |

## 7. Requirement-to-evidence traceability

| Requirement group | Planned evidence | Target phase |
|---|---|---|
| FR-01–02, NFR-04 | Parser and FEFO unit/integration tests | Sprints 2 and 4 |
| FR-03–04, NFR-06, NFR-11 | API/UI tests and latency scenario | Sprint 5/testing |
| FR-05–07 | Request, RPS, and BROA scenario tests | Sprint 3 |
| FR-08–09 | Scheduled expiry evaluation and alert tests | Sprints 2 and 5 |
| FR-10–11 | Dispatch/receipt/exception contract tests | Sprint 3 |
| FR-12, NFR-01 | RBAC, tenant-boundary, and privacy tests | Every relevant sprint |
| FR-13, NFR-05 | Offline, retry, duplicate, ordering, and conflict tests | Sprint 4 |
| FR-14 | Backtest metrics, baselines, data-quality report | Sprint 3/testing |
| NFR-02, NFR-08 | Fabric integration and deterministic replay tests | Sprints 2–3 |
| NFR-09–10, NFR-12 | Setup, health, reset, and clean-machine validation | Sprint 1 |
| FR-15–16, BR-ONB-01–16, NFR-13 | Onboarding API, lifecycle, authorization, audit, and UI tests | Sprints 4–5/testing |

## 8. Prototype assumption register

| ID | Status | Version | Owner/date | Decision and limitation | Replacement trigger |
|---|---|---|---|---|---|
| PA-S2-01 | Accepted prototype assumption | `SYNTHETIC_INVENTORY_V1` | Jopia / 2026-07-30 | Sprint 2 supports only `A_POSITIVE` and `O_POSITIVE`, with `RED_BLOOD_CELLS` and `PLATELETS`. This is a minimal synthetic allowlist, not a claim about Mediatrix inventory. | Approved Mediatrix label fixtures and supported inventory catalogue |
| PA-S2-02 | Accepted prototype assumption | `SYNTHETIC_INVENTORY_V1` | Jopia / 2026-07-30 | Synthetic maximum collection-to-expiry intervals are 72 hours for `RED_BLOOD_CELLS` and 36 hours for `PLATELETS`; synthetic near-expiry leads are 12 and 6 hours respectively. These deliberately non-clinical values prove deterministic policy handling only. | Approved component shelf-life and near-expiry policy |
| PA-S2-03 | Accepted prototype assumption | `SYNTHETIC_INVENTORY_V1` | Jopia / 2026-07-30 | The initial committed state is `AVAILABLE`; Sprint 2 permits only `AVAILABLE -> EXPIRED`. Transfer and exception transitions remain deferred. | Approved Sprint 3 transfer/custody transition table |
| PA-S2-04 | Accepted prototype assumption | `SYNTHETIC_INVENTORY_V1` | Jopia / 2026-07-30 | `MediatrixMSP` and the `api-gateway` service identity submit for `INST_MEDIATRIX`; certificate attributes and opaque application actor attribution are both validated. | Approved application identity integration or future governed organization onboarding |
| PA-ML-01 | Accepted prototype assumption | `SYNTHETIC_FORECAST_V1` | Jopia / 2026-08-12 | Synthetic training data may be generated for `INST_MEDIATRIX`, `A_POSITIVE`/`O_POSITIVE`, and `RED_BLOOD_CELLS`/`PLATELETS` with a recorded schema, generator version, seed, time range, lineage, and `SYNTHETIC_DATA` classification. Metrics and outputs are `SIMULATION_ONLY`, use time-ordered validation, target requested demand, and do not predict Mediatrix performance. Forecast-only recommendation eligibility remains `DISABLED_UNAPPROVED_POLICY`. | Approved anonymized Mediatrix dataset, data-governance decision, and resolution of `RQ-07` |
| PA-S3-01 | Accepted prototype assumption | `SYNTHETIC_TRANSFER_V1` | Jopia / 2026-08-14 | Synthetic requests are limited to 10 units; reservation reallocation is disabled; only the versioned transition table is allowed; receipt remains unavailable; gateway-submitted actions use an immutable allowlist of opaque synthetic actors. | Approved transfer authority, receipt identity, local release, suspension, and exception policy under `RQ-04`, `RQ-09`, `RQ-10`, `RQ-12`, and `RQ-15` |
| PA-S3-02 | Accepted prototype assumption | `SYNTHETIC_LOCATION_V1` | Jopia / 2026-08-14 | Invented coordinates model only dispatch and receipt points. Accuracy must be `(0,1000]` metres, facility match radius is 500 metres, approved fallback reasons are versioned, exact off-chain points expire after 30 days, and chaincode stores only minimal digest evidence. | Approved institutional precision, retention, facility coordinates, and fallback policy under `RQ-08` |
| PA-S3-03 | Accepted prototype assumption | `SYNTHETIC_OPTIMIZATION_V1` | Jopia / 2026-08-14 | RPS normalizes urgency and capped wait before applying 70/30 weights. BROA uses the manuscript narrative 40/25/20/15 profile only as a disclosed simulation despite conflicting pseudocode. Forecast input requires explicit scenario mode, and every result is disabled for automatic approval. | Approved RPS/BROA criteria, scales, weights, reserve/safety policy, and operational data under `RQ-05`, `RQ-06`, `RQ-07` |
| PA-S4-01 | Accepted prototype assumption | `SYNTHETIC_CAPTURE_V1` | Jopia / 2026-08-17 | Mobile on-device Tesseract.js OCR is primary for synthetic fixtures; Code 128/Data Matrix and synthetic QR are fallback. Five exact allowlisted fields, per-field confidence at least 90, authenticated confirmation, no manual repair, and volatile-only image/raw-text handling are mandatory. Outputs remain `SIMULATION_ONLY`. | Approved Mediatrix label structures/fixtures, capture validation, privacy review, and `RQ-02` resolution |
| PA-S4-02 | Accepted prototype assumption | `SYNTHETIC_API_AUTH_V1` | Jopia / 2026-08-17 | A single opaque synthetic `ROLE-01` operator at `INST_MEDIATRIX` may obtain a short-lived locally signed JWT using untracked credentials. This exists only to validate API authorization and is not production identity management. | Approved user/session/identity design in the activating authentication sprint |
| PA-S6-01 | Accepted prototype assumption | `INTERVIEW_DERIVED_CORE_V2` | Jopia / 2026-09-12 | V2 models all eight ABO/Rh groups, four component types, opaque component IDs, encrypted off-chain Donation No. references, hard FEFO, local release, reconciliation holds, durable commands, and versioned census output. Near-expiry, operational RPS/BROA, issuer rules, and official reporting order remain disabled until approved. | Approved issuer/clinical/operational/reporting decisions recorded against the applicable `RQ-*` |
| PA-S6-02 | Accepted prototype assumption | `INBOUND_OCR_V1` | Jopia / 2026-09-12 | Mediatrix inbound inventory is captured from the printed label through confirmed OCR; no source-system import is assumed. Fields require at least 90% OCR confidence, explicit operator confirmation, issuer-specific Donation No. validation, and label expiry authority. Exact values remain encrypted off-chain and all outputs are `SIMULATION_ONLY`. | Approved label fixtures, issuer policies, privacy review, and `RQ-02`/`RQ-03` resolution |
| PA-DEF-01 | Accepted prototype assumption | `SYNTHETIC_BROA_CANDIDATES_V1` | Jopia / 2026-10-15 | Read-only BROA explanation candidates are destinations with `PENDING` V2 requests for the same blood type and component, from any supplier. Urgency is the highest pending urgency (routine 1, urgent 2, critical 3); stock shortage is the summed pending quantity; distance comes from an invented synthetic table ([policy](../services/api/policy/synthetic-broa-candidates-v1.json)), and a destination without a distance is excluded. Results stay `SIMULATION_ONLY` and `DISABLED_UNAPPROVED_POLICY`; no approval, reservation or dispatch follows. | Approved candidate rules, measured locations and shortage evidence |
| PA-DEF-02 | Accepted prototype assumption | `LABEL_IDENTITY_READ_V1` | Jopia / 2026-10-15 | Component list and detail reads return `labelIdentity`: the exact recorded printed-label Donation No., decrypted on the server, for components the caller's institution currently holds (ROLE-01/02/03; no masking); unit history (PA-DEF-03) also shows it for units in that institution's own ledger-committed custody events. Values are never reformatted; synthetic Mediatrix labels follow `MMYY-MM-NNNN` (for example `MM26-08-4064`) and other issuers keep their enabled policy format. Components from one donation share the value and are distinguished by component type and opaque `componentId`, which remains the command key. Missing or unreadable values are `UNAVAILABLE` and never derived. Client-side search and the browser-generated `SIMULATION_ONLY` inventory PDF may use the value; server-side label queries, URLs, logs, ledger payloads, regulatory aggregates and reservation/transfer reads may not. Not an ISBT 128 claim. | Approved label fixtures, issuer policies, privacy review and `RQ-02` resolution |
| PA-DEF-03 | Accepted prototype assumption | `UNIT_HISTORY_READ_V1` | Jopia / 2026-10-15 | Blood Unit Transactions read only `app.v2_commands` for registration, OCR-matched receipt, transfer receipt, dispatch and local-release completion events acted on by the caller's institution (ROLE-01/02/03). Rows are one event per unit, ordered by accepted time descending and paged by event. Direction is relative to the acting institution. Transaction ID is the durable command, Scan ID is the confirmed OCR capture, Method is `OCR`, `WEB_COMMAND` or not recorded, and Status separates `CONFIRMED`, projection-pending, pending, failed and conflict. Blockchain ID is the actual Fabric transaction or none. Missing membership, method or label stays explicitly unavailable. Search is client-side over loaded rows; the browser PDF covers loaded rows. | Approved event coverage, custody-direction rules and history retention policy |
| PA-DEF-04 | Accepted prototype assumption | `TRANSFER_SUMMARY_READ_V1` | Jopia / 2026-10-15 | The Transfers table reads one row per reservation in the existing reservation scope, including local releases flagged `LOCAL_RELEASE` with destination `NOT_APPLICABLE`. Product and requested units come from the linked request (or the local-release reserve command); allocated units come from the committed selection snapshot; current unit-status counts are shown separately. Priority is the recorded request urgency (`ROUTINE`, `URGENT`, `CRITICAL`). Missing linkage is `UNAVAILABLE`. | Approved transfer-table semantics and reporting rules |
| PA-DEF-05 | Accepted prototype assumption | `ACTIVITY_HISTORY_READ_V1` | Jopia / 2026-10-15 | ROLE-02 Activity History lists every V2 command and off-chain acknowledgement its institution recorded, newest first and paged. Request, Transfer, Scan and Blockchain IDs come only from recorded command fields and foreign-key projections. The actor is shown by kind, opaque reference, the DB-constrained synthetic display name and current role (not proof of role at the event); unknown actors stay `UNKNOWN`. Off-chain events are `OFF_CHAIN_RECORDED` with ledger `NOT_APPLICABLE`. | Privacy review of operator display identity and an approved audit retention policy |
| PA-DEF-06 | Accepted prototype assumption | `SYNTHETIC_PRC_SUPPLY_V1` | Jopia / 2026-10-15 | Resolves `RQ-17` for simulation only. A blood-bank ROLE-02 operator records one off-chain PRC supply request per product line. The synthetic PRC account acknowledges it in-system with a PRC-entered reference, then fulfils or declines it; the requester may cancel before acknowledgement. Requests never change inventory; supplied units enter only through confirmed inbound OCR capture. See [the decision](#pa-def-06--synthetic-prc-supply-requests-2026-10-15). Not PRC or Mediatrix policy. | Approved PRC supply procedure, reference format, deadlines and visibility, or a real PRC integration |
| PA-DEF-07 | Accepted prototype assumption | `SYNTHETIC_STOCK_CHECKPOINT_V1` | Jopia / 2026-10-19 | Each active blood bank's stock is recorded automatically at 09:00 and 16:00 Asia/Manila through the existing census store, as a complete blood-type × component matrix of label-valid (unexpired) `AVAILABLE`/`RESERVED` units, in the synthetic `DOH_CENSUS_COLUMN_ORDER_V1` column order. A slot is recorded only within 30 minutes of its time; the first capture stands and a missed slot stays missing. See [the decision](#pa-def-07--automatic-stock-checkpoints-2026-10-19). Not a DOH-approved format or a regulatory submission. | Approved DOH report format and order, near-expiry/eligibility rules under `RQ-03`, and an operational schedule |
| PA-ACCOUNT-03 | Accepted prototype assumption | `SYNTHETIC_PUBLIC_APPLICATION_V1` | User via Lat handoff; implemented by Jopia / 2026-10-16 | Public synthetic Blood Bank and Requestor applications without an invitation; complete four-step synthetic form; ten-facility synthetic Fill Up catalog `SYNTHETIC_FACILITY_CATALOG_V1` with server-side claims; non-destructive deregistration releases a sample. PRC review, approval and separate activation remain. See [the decision](#pa-account-03--public-synthetic-applications-and-sample-facilities-2026-10-16). Resolves `RQ-13` for simulation only. | Approved applicant verification, abuse-prevention and recovery controls, real document handling and `RQ-14` retention |

| PA-OCR-01 | Accepted prototype assumption | `SYNTHETIC_LABEL_LAYOUT_V1` | Jopia / 2026-10-17 | Three fictional label layouts (`MEDIATRIX`, `MEDIX`, `NLVILLA`) and their field semantics, used only to collect, review and benchmark the private OCR research corpus. They copy no real hospital label and use the existing synthetic Donation No. grammars. Extraction stays preview-only and non-submittable. `INBOUND_OCR_V1`, issuer policy and both OCR flags are unchanged. See [the decision](#pa-ocr-01--synthetic-label-layouts-for-the-ocr-corpus-2026-10-17). Not Mediatrix, Medix or N.L. Villa policy. | Approved institution label references for each bank and resolution of `RQ-02`, `RQ-03` and `RQ-19` |
| PA-OCR-02 | Accepted prototype assumption | `SYNTHETIC_CAPTURE_LABEL_V2` | Jopia / 2026-10-18 | The synthetic five-line capture label may also print readable value forms: blood type and component with spaces instead of underscores, and dates as `YYYY-MM-DD`, meaning 00:00 UTC on that date. The device parser maps each form to exactly one V1 value, so the API payload, `INBOUND_OCR_V1`, the 90% per-field gate and operator confirmation are unchanged. Fictional labels only. See [the decision](#pa-ocr-02--readable-synthetic-capture-label-2026-10-18). | Approved real label structures and `RQ-02` resolution |
| PA-OCR-03 | Accepted prototype assumption | `INBOUND_OCR_CORRECTED_V1` | Jopia / 2026-10-19 | An OCR intake may carry operator corrections: every field states what OCR read and its score; uncorrected fields must equal that read at ≥ 90; corrected fields need a reason and keep no confidence; at least one field stays an unchanged OCR read; a corrected Donation No. is entered twice. Off by default. Implements ADR-050 and resolves `RQ-19` for corrected OCR capture only. See [the decision](#pa-ocr-03--corrected-ocr-intake-2026-10-19). | Approved correction authority, audit retention and any manual or import path under a further decision |
| PA-OCR-04 | Accepted prototype assumption | `INBOUND_OCR_CORRECTED_V2` | User acting as Jopia / 2026-10-19 | Operator may review all five fields after an OCR attempt, including no recognized fields. Original evidence and correction reasons stay separate; Donation No. double-entry and bank operator PIN are required. Separate opt-in and additive migration; V1 contracts unchanged. See the PA-OCR-04 decision below. | Scanner-free Manual mode, CSV import, real-label and institutional authority remain unresolved |

Prototype-assumption versions are immutable. A replacement adds a new version,
marks the earlier one superseded for new operations, preserves historical
interpretation, and records compatibility, migration, dataset, and model impact.

## 9. Open requirement decisions

These do not all block Sprint 1, but each must be accepted before its target
sprint:

| ID | Question | Needed before |
|---|---|---|
| RQ-01 | Which institutions have approved application participation? Active secondary hospitals may see approved city-wide aggregates plus only their own requests, transfers, receipt records, profile, and users; what institution-specific exceptions are approved? | Sprint 5 |
| RQ-02 | Which Mediatrix blood types/components and ISBT 128 data structures replace the minimal `PA-S2-01` synthetic allowlist? | Sprint 4 or before replacing `SYNTHETIC_INVENTORY_V1` |
| RQ-03 | What clinically approved component shelf-life and near-expiry thresholds replace `PA-S2-02`? | Before any clinical or operational interpretation |
| RQ-04 | Who may reallocate an approved reservation for a more urgent request? | Before enabling reallocation or operational transfer use |
| RQ-05 | What are the final RPS scale, weights, wait cap, and tie-break rule? | Before operational RPS use |
| RQ-06 | What are the final BROA criteria, normalization, weights, and eligibility constraints? | Before operational BROA use |
| RQ-07 | What forecast metric and minimum accuracy justify operational use? | Before operational forecast use/testing |
| RQ-08 | What precision and retention apply to location evidence? | Before real location capture |
| RQ-09 | Does receipt require two human signatures or institutional service identities plus authenticated user attribution? | Before operational receipt |
| RQ-10 | What local verification changes a received unit to available inventory? | Before received stock can become available |
| RQ-12 | Should pending requests and approved-but-undispatched transfers be cancelled, frozen, or explicitly reassigned when an institution is suspended? | Before institution suspension affects transfers |
| RQ-13 | What applicant verification, abuse prevention, and recovery controls are required before public self-service application can supplement invitation-only onboarding? | Before enabling public application |
| RQ-14 | What retention period and access policy apply to onboarding verification evidence and rejected applications? | Sprint 4 |
| RQ-15 | Who may authorize emergency suspension while a transfer is dispatched or in transit, and how is safe receipt/custody resolution assigned? | Before operational in-transit suspension |
| RQ-16 | What institutionally approved minimum-stock and safe-stock levels, shortage rule and surplus indicator replace the unavailable `FR-04` dashboard classification (Critical, Low, Adequate, Surplus)? This covers unit of measure, institution, blood-group and component scope, boundary comparisons, zero and missing-coverage handling, freshness tolerance, and the owner, approver, effective date and audit reference. The `SYNTHETIC_OPTIMIZATION_V1` and V2.1 surplus safety allowance and minimum reserve are not stock-classification thresholds. | Before operational dashboard stock classification or full `FR-04` acceptance; accepted project-only demonstration exception is recorded under FR-04 |
| RQ-18 | Which request decisions beyond approval are allowed, and with what rules? Rejection by the supplying ROLE-02 (reason codes, terminal state), cancellation of a still-pending request by its requester, and partial offers (allowed at all, and how the remainder is handled). The ledger request asset has no reject or cancel transition today; enabling them needs new chaincode functions and a lifecycle upgrade. | Before any request reject, cancel or partial-offer control |
| RQ-19 | Should any intake path other than confirmed OCR capture exist: manual Donation No. entry or bulk CSV import? ADR-035 currently forbids unverified manual or system-import records. A new path needs its verification evidence, operator authority, confidence and confirmation rules and an ADR superseding ADR-035. **Partly resolved for simulation on 2026-10-19:** operator correction of an OCR capture is allowed by ADR-050 / `PA-OCR-03`. PA-OCR-04 additionally permits all-field review after OCR for simulation. Scanner-free manual entry and CSV import stay open. | Before enabling fully manual intake or Inventory CSV import |

Unanswered questions must not be guessed by a coding agent. The relevant task is
blocked or implemented behind an explicitly approved prototype assumption.

### Resolved requirement decisions

| ID | Resolution | Date/owner | Remaining replacement gate |
|---|---|---|---|
| RQ-11 | Mobile OCR is primary for the Sprint 4 synthetic PWA, with mandatory per-field confidence of at least 90, exact validation, authenticated confirmation, volatile-only image/raw-text handling, and Code 128/Data Matrix/synthetic QR fallback under `PA-S4-01`. | 2026-08-17 / Jopia | `RQ-02` and approved institutional fixtures/privacy evidence before real-label or ISBT claims |
| RQ-17 | Resolved for simulation by `PA-DEF-06` (`SYNTHETIC_PRC_SUPPLY_V1`): off-chain PRC supply requests recorded by blood-bank ROLE-02 operators, one product line each, with a required-by deadline, PRC in-system acknowledgement and reference, and a five-state lifecycle. No free-text note, external PRC connection or inventory effect. | 2026-10-15 / Jopia | Approved PRC procedure, reference format, deadline and visibility rules, or a real PRC integration |
| RQ-13 | Resolved for simulation by `PA-ACCOUNT-03` (`SYNTHETIC_PUBLIC_APPLICATION_V1`): public synthetic entry with same-origin checks, a 16 KiB body limit, persistent per-client and global rate limits, strict field allowlists, idempotency, scrypt applicant passwords, scoped applicant sessions and PRC review before any access. Recovery is limited to the existing applicant status session; no self-service credential recovery exists. | 2026-10-16 / user decision; Jopia | Approved real applicant verification, abuse prevention, recovery and data-collection authorization before any real institution applies |

## PA-ACCOUNT-01 — Approved synthetic institution accounts (2026-10-08)

**Accepted by Jopia in the implementation request; SIMULATION_ONLY.** Links:
FR-01, FR-03–16, BR-SEC-03–05, BR-ONB-01–16, NFR-01/13, BL-WEB-01,
BL-API-02, BL-WEB-05/06 and BL-TST-02. Supersedes Section 2's login/role
coupling: roles remain operator capability profiles, while the six requested
institutions each have one primary interactive account. Technologists cannot
approve transfers. PRC has explicitly assigned off-chain onboarding capabilities
in addition to regulatory reads, superseding FR-12's blanket regulatory-mutation
restriction solely for these administrative actions. DOH remains read-only.

Medix/N.L. Villa may perform synthetic inventory/custody actions under ADR-037's
packaged actor policy; this prospectively supersedes BR-ONB-13 for these selected
accounts only. No additional Fabric organization or peer is authorized. New
onboarding activation grants ROLE-06 only; operational assignment and governed
Fabric policy changes are separate. PRC may not self-approve, assign itself bank
roles or change Fabric policy. Internal maintenance remains separate.

Every privileged command needs operator PIN verification bound to session,
institution, action, canonical body digest and idempotency key. Synthetic PINs
are eight random digits, salted/hashed off-chain; five failed attempts lock for
15 minutes. Verification expires after two minutes; retries preserve original
actors and durable results. No real staff identifiers or plaintext PIN fixtures.
Normal suspension is additionally refused while requests, reservations or queued
mutations are unresolved. RQ-12/15 emergency behavior remains deferred.

PA-ACCOUNT-02 (**Accepted**) allows synthetic onboarding under a 30-day retention
assumption: verification metadata and closed/rejected application detail are
purged 30 days after closure; minimal non-secret decisions/references remain.
Only authorized PRC reviewers and scoped applicants can access the records.
No documents/messages or real institutional evidence are collected; RQ-14
remains open for real data. Replacement requires a superseding policy.

## PA-ACCOUNT-03 — Public synthetic applications and sample facilities (2026-10-16)

**Accepted; SIMULATION_ONLY.** The user selected public application entry for
both Blood Bank and Requestor facilities and a reusable Fill Up sample pool
(Lat handoff, 2026-10-16). Jopia implemented it under
`SYNTHETIC_PUBLIC_APPLICATION_V1` and [ADR-048](ARCHITECTURE.md#15-architecture-decision-register).
It supersedes BR-ONB-01 for new applications and resolves `RQ-13` for
simulation only. It changes who may apply, not who may approve: PRC review,
approval, separate activation, the `ROLE-06`-only initial grant, operator PIN
authorization and account-category boundaries are unchanged. Submission creates
no institution, login, operator, role, Fabric identity, peer or stock ownership.
It is not a real-institution onboarding or data-collection authorization.

| Rule | Decision |
|---|---|
| Entry | `POST /api/v2/onboarding/public-applications`, unauthenticated and same-origin, `BLOOD_BANK` or `REQUESTOR` only. The invitation route remains for existing invitation-based records and is deprecated. |
| Form | Facility, Qualification, Primary account and Documents/declaration fields from the field map, each with a strict pattern or enum. Unknown fields are rejected with field-path details, never dropped. Category-specific qualification keys may not be mixed. |
| Personal data | Not collected. Full name and employee ID are replaced by a `SYNTH-PERSON-…` role-holder reference; professional-license numbers by `SYNTH-PRCLIC-NNNNNN`; phones by `SYN-NNN-NNNN`; emails are generic `.bloodledger` addresses. |
| Documents | Each slot accepts only its generated synthetic fixture ID (kind `SYNTHETIC_FIXTURE`, `NOT_VERIFIED`). No upload or user file storage. Fixtures download as labelled text. |
| Credentials | The applicant password (12–128, scrypt) opens only the applicant session. The requested login email must share the official email domain; activation must provision exactly that login, with the institution password and PIN still entered by PRC. |
| Sample catalog | `SYNTHETIC_FACILITY_CATALOG_V1`: `SAMPLE_BANK_01`–`05` and `SAMPLE_REQUESTOR_01`–`05`, invented facilities. IDs are catalog references, not institution IDs, approvals or credentials. |
| Sample reuse | Selection is not consumption. A successful submission claims the sample (`APPLICATION_IN_PROGRESS`); activation makes it `REGISTERED`. Rejection, withdrawal, deregistration, or the purge of an approval never activated (`APPROVAL_LAPSED`) releases it; suspension, logout, failed requests and failed deregistration do not. Claims are database rows enforced by a partial unique index and advisory locks, so all browsers and hosts sharing the database agree. A later registration is a new instance (`-i<n>` login domain), application, institution and credentials. Exhaustion is explicit; manual application remains possible, but catalog identity values are reserved. |
| Deletion | `POST /onboarding/institutions/{id}/deregister`: PRC, PIN-verified, only for onboarded, already suspended institutions without non-terminal custody, open PRC supply requests, or pending commands, transfers or reservations. `DEREGISTERED` is terminal. It retires the account and operators and keeps all domain, ledger and audit history. |
| Retention | Applicant detail keeps the PA-ACCOUNT-02/ADR-039 30-day purge, anchored on closure by approval or rejection (not activation). Activation after that purge is refused with `ONB_APPLICATION_DETAIL_PURGED`; the facility applies again. The facility profile (facility facts, qualification without capability declarations, document references, login email) is copied at activation and purged 30 days after deregistration. Claims, decisions and references remain as minimal linkage. |

`RQ-14` (real retention) remains open. Approved real applicant verification,
abuse controls, credential recovery and real institutional evidence are still
required before any real facility applies.

## PA-DEF-07 — Automatic stock checkpoints (2026-10-19)

**Accepted by Jopia; SIMULATION_ONLY.** Lat's Compliance Reports page needs
saved stock records instead of its October 15 design examples. The census store
already persisted 09:00/16:00 snapshots, but stayed disabled pending an approved
DOH report format, and nothing scheduled it. This assumption enables it for
simulation under `SYNTHETIC_STOCK_CHECKPOINT_V1`.

| Rule | Decision |
|---|---|
| Schedule | 09:00 and 16:00 Asia/Manila (01:00 and 08:00 UTC) every day, run by the command worker. |
| Who | Every institution with `status = ACTIVE` and `account_category = BLOOD_BANK`. Requesters, PRC and DOH hold no stock and are not recorded. |
| Eligible stock | `AVAILABLE` and `RESERVED` units whose printed expiry is after the capture time. Units past expiry but not yet evaluated are excluded; so are dispatched, in-transit, received, released, compromised and expired units. |
| Content | The complete 8 blood types × 4 V2 component types matrix (whole blood, packed red cells, fresh frozen plasma, platelets; zero-filled; cryoprecipitate is not part of the census), the actual `capturedAt`, the slot's `scheduledFor`, the policy version and a source digest. Column order is the synthetic `DOH_CENSUS_COLUMN_ORDER_V1` (O, A, B, AB positive, then negative), which is not a DOH-approved order. |
| Duplicates | One record per institution, slot and policy. The first capture of a slot stands; a later run in the same window returns it unchanged. |
| Missed or late runs | A slot is recorded only between its time and 30 minutes after it. After that it stays missing: present stock is never labelled with a past slot. The manual catch-up route follows the same window and otherwise returns `409 CHECKPOINT_WINDOW_CLOSED`. |
| Reads | The existing `GET /api/v2/reports/doh-census`, detail and TSV copy routes, in the existing role scopes. Copy uses the saved matrix, never current inventory. |
| Activation | `BLOODLEDGER_DOH_REPORT_POLICY_VERSION=SYNTHETIC_STOCK_CHECKPOINT_V1` and `BLOODLEDGER_DOH_BLOOD_TYPE_ORDER` set to the eight types in that order, on the API and the worker. Without both, the feature stays disabled as before. |
| Boundary | Automatic recording is not regulatory submission, verification or a DOH-approved report. `RQ-03` stays open. |

Implemented in `services/api/src/census-worker.ts` (`checkpointSlots`,
`checkpointWindowOpen`, `checkpointInstitutionIds`), `worker-main.ts` and the
catch-up route, with unit tests and a disposable-database probe. The additive
migration `20261019000000000_allow-synthetic-stock-checkpoint-policy.js` widens
the census policy check to this one version. Census records stay immutable.

## PA-DEF-06 — Synthetic PRC supply requests (2026-10-15)

**Accepted by Jopia; SIMULATION_ONLY.** Resolves `RQ-17` for the prototype
only, under `SYNTHETIC_PRC_SUPPLY_V1` and ADR-044. It records how a blood bank
asks the Philippine Red Cross (PRC) for stock inside BloodLedger. It is not PRC
or Mediatrix policy, and it is superseded, not edited, when approved PRC
evidence arrives.

| Rule | Decision |
|---|---|
| Record type | An off-chain coordination record in PostgreSQL. It is not a Fabric custody event (PRC is an application user, not a peer, under ADR-001/ADR-002), and it never changes inventory, FEFO, census or forecasts. Units PRC supplies enter stock only through the existing confirmed inbound OCR capture. |
| Who submits | A `BLOOD_BANK` institution account through a verified ROLE-02 operator (PIN verification, idempotency key, correlation ID). ROLE-01 can read its institution's requests. Requester (ROLE-03) and DOH accounts cannot submit. |
| Product lines | Exactly one blood type and component (the V2.1 vocabulary, including cryoprecipitate) per request. Several products means several requests, and each request is one table row. |
| Units | `requestedQuantity` is an integer from 1 to 10, matching the synthetic transfer cap. At fulfilment PRC records `fulfilledQuantity` (1 to the requested quantity); a smaller number means partly fulfilled. Neither number is a receipt or usable-stock claim. |
| Urgency | `ROUTINE`, `URGENT` or `CRITICAL`, the same enum as transfer requests. |
| Required by | Mandatory UTC timestamp, at least 1 hour and at most 30 days after submission, shown in Asia/Manila. It is never inferred from creation time or expiry, and it can't be edited: cancel and resubmit instead. |
| Coordination note | **Not collected in V1.** Free text could carry patient or donor details. The form's note field is removed until an approved, privacy-reviewed field exists. |
| PRC acknowledgement and reference | A synthetic PRC operator with the new `prc-supply:respond` capability (PRC reviewer profile, PIN-verified) acknowledges the request in BloodLedger and enters the PRC reference: `^[A-Z0-9][A-Z0-9-]{2,31}$`, unique across PRC supply requests. Provenance is `PRC_RECORDED_IN_SYSTEM`. Until then the reference is null and shown as "Awaiting PRC acknowledgement". No reference is generated, and no external PRC system is contacted. |
| Lifecycle | `SUBMITTED` → `ACKNOWLEDGED` (PRC, with reference) → `FULFILLED` (PRC, with fulfilled quantity). PRC may move `SUBMITTED` or `ACKNOWLEDGED` to `DECLINED` with a reason code: `NO_STOCK`, `OUT_OF_SCOPE`, `DUPLICATE_REQUEST` or `DEADLINE_NOT_FEASIBLE`. The requester may move `SUBMITTED` to `CANCELLED`. `FULFILLED`, `DECLINED` and `CANCELLED` are terminal. This status is coordination status only, separate from command, reservation and stock status. |
| Visibility | The requesting institution's ROLE-01/02 see their own requests. The PRC account sees all requests. Other hospitals, requesters and DOH see none in V1; DOH aggregates are deferred. |
| Mutations | Every action is PIN-verified, idempotent (the same key and body replays the result), version-checked (`expectedVersion`), correlated and audited in `app.account_audit`. It is recorded synchronously off-chain: there is no ledger queue, and the ledger status is not applicable. The request detail carries its audited history. Activity History V1 never includes PRC events; the opt-in `ACTIVITY_HISTORY_READ_V2` contract (ADR-045) shows the requesting institution's PRC coordination events, including PRC's responses on its requests (amended 2026-10-15). |
| Reads | A cursor-paged list, newest submission first, plus a detail read, both in the scopes above. Search runs client-side over loaded rows. PDF export covers loaded rows with the SIMULATION_ONLY marking. |
| Deferred | Free-text notes, multi-product requests, edits, DOH aggregates, escalation and SLA rules, a real PRC integration, and a PRC issuer label policy for OCR intake. |

Implemented on 2026-10-15: `GET`/`POST /api/v2/prc-supply-requests`,
`GET /api/v2/prc-supply-requests/{requestId}` and
`POST /api/v2/prc-supply-requests/{requestId}/{cancel|acknowledge|fulfil|decline}`.
Operator capabilities are `prc-supply:request` and `prc-supply:cancel` (bank
ROLE-02) and `prc-supply:respond` (PRC reviewer). The additive migration
`20261015000000000_create-prc-supply-requests.js` and
`services/api/openapi-v2.json` are authoritative for the exact shape and error
codes.

## PA-OCR-03 — Corrected OCR intake (2026-10-19)

**Accepted by Jopia; SIMULATION_ONLY.** Implements ADR-050 under `RQ-19`. Lat's
scanner lets operators review and correct OCR fields, but any edit made the
draft unsubmittable. This contract lets a reviewed correction be submitted
without treating an OCR score as evidence for a value the operator typed.

| Rule | Decision |
|---|---|
| Contract | `capturePolicyVersion: INBOUND_OCR_CORRECTED_V1`, schema in [`contracts/inbound-ocr-corrected-v1.schema.json`](../contracts/inbound-ocr-corrected-v1.schema.json), on the existing `POST /api/v2/inbound-captures`. `INBOUND_OCR_V1` is unchanged. Off unless `BLOODLEDGER_CORRECTED_INTAKE_ENABLED=true`; otherwise `403 CORRECTED_INTAKE_DISABLED`. |
| Values | The top-level values are the final, operator-confirmed values and pass every `INBOUND_OCR_V1` value rule (issuer format, enums, UTC times, expiry after collection). |
| Per field | Each of the five fields reports `ocrValue`, `ocrConfidence` and `corrected`. An uncorrected field must equal its OCR read at ≥ 90. A corrected field needs a reason: `OCR_MISREAD` (read differs), `OCR_NOT_READ` (no read) or `OCR_LOW_CONFIDENCE` (read matches but scored below 90). |
| OCR anchor | At least one field is corrected (otherwise use `INBOUND_OCR_V1`) and at least one stays an unchanged OCR read. Fully manual entry stays unsupported. |
| Donation No. | A corrected Donation No. is entered twice (`donationNumberConfirmation`) and must match; an unchanged one carries no confirmation. |
| Evidence | The server, not the client, sets `OPERATOR_CONFIRMED` for a corrected blood type or component, and `OCR_LABEL` otherwise. A corrected field keeps no confidence in the capture record. |
| Provenance | Per field: source (`OCR_LABEL`/`OPERATOR_CORRECTED`), keyed HMAC digests of the OCR read and the final value, the original OCR score and the reason, in the insert-only `app.v2_capture_field_provenance` (updates and deletes refused). Raw OCR text and Donation No. values are never stored. The provenance is bound into the capture evidence digest recorded on the ledger. |
| Authority and audit | The same bank roles and PIN-verified operator as any intake, with idempotency, correlation and the command audit trail. A retry with the same key and body replays; a different correction under the same key is `409 V2_IDEMPOTENCY_CONFLICT`. |
| Not changed | Chaincode, the 90% gate for OCR-sourced values, J5 for `INBOUND_OCR_V1` (clients still cannot claim `OPERATOR_CONFIRMED` there), and `RQ-02`. |

Implemented in `services/api/src/inbound-ocr-policy.ts`
(`validateCorrectedInboundInput`), the capture route, the projection and the
additive migration `20261019010000000_allow-corrected-ocr-intake.js`, with route
tests and a disposable-database probe. The web client wiring is Lat's.

## PA-OCR-02 — Readable synthetic capture label (2026-10-18)

**Accepted by Jopia; SIMULATION_ONLY.** Phone-camera OCR was first measured on
2026-10-18, before the defense demonstration. On the five-line synthetic
capture label, Tesseract.js 7 read the values correctly but rarely reported 90%
confidence on full UTC timestamps (`2026-10-18T00:00:00.000Z`) or underscore
values (`A_POSITIVE`) once an image was slightly blurred or tilted. In a
rendered test, no blurred or 1.5°-tilted date line out of 90 passed. The cause
is the printed form, not the confidence rule, so this assumption adds readable
forms under `SYNTHETIC_CAPTURE_LABEL_V2` and keeps the rule.

| Rule | Decision |
|---|---|
| Scope | The synthetic five-line capture label only (`DONATION NO`, `BLOOD TYPE`, `COMPONENT`, `COLLECTED AT`, `EXPIRES AT`). It is not a real-label format and does not change `PA-OCR-01` corpus layouts, issuer policy, `RQ-02` or `RQ-03`. |
| Readable forms | Blood type `A POSITIVE` … `O NEGATIVE` (one space) maps to `A_POSITIVE` … `O_NEGATIVE`. A component printed as uppercase words separated by single spaces maps to the same words joined by underscores, and must then be an enum value. A date `YYYY-MM-DD` maps to `YYYY-MM-DDT00:00:00.000Z`, the instant every V1 synthetic label already prints. V1 forms remain valid, and each field may use either form. |
| Closed grammar | Mapping is exact and case-sensitive. Any other spelling, spacing or character, including `0` read for `O`, is left as printed and fails validation. It is never a repair of misread text. |
| Unchanged | Exactly five lines, at least 90% confidence per field, explicit operator confirmation, no manual repair, volatile image and raw text, the `INBOUND_OCR_V1` payload and the API, database and chaincode. Manual review drafts still need full UTC timestamps. |
| Evidence | The printed form is not recorded separately in the capture evidence; the payload is identical either way. Rendered-image measurements are not physical-camera evidence and support no accuracy claim. |

Implemented in `apps/capture-pwa/src/capture-policy.ts`
(`normalizePrintedValue`), with unit tests and a browser test of a readable
label in `apps/web/e2e/scanner-ocr-workflows.spec.ts`.

## PA-OCR-01 — Synthetic label layouts for the OCR corpus (2026-10-17)

**Accepted by Jopia; SIMULATION_ONLY.** Real label references for Mediatrix,
Medix and N.L. Villa are not available, and the OCR pilot plan
(`OCR_PILOT_PLAN_V2`) cannot be collected without accepted layouts. This
assumption defines fictional layouts and how to annotate them, under
`SYNTHETIC_LABEL_LAYOUT_V1`. It does not resolve `RQ-02`, `RQ-03` or `RQ-19`.
When approved institution references arrive, it is superseded, not edited.

| Rule | Decision |
|---|---|
| Use | Only for collecting, reviewing and benchmarking the private OCR corpus, offline or in the isolated browser runner. It is not a capture contract. Extraction results stay preview-only and non-submittable. `INBOUND_OCR_V1`, ADR-035 and issuer policy are unchanged. `VITE_BLOODLEDGER_LABEL_EXTRACTION_PREVIEW` and `VITE_BLOODLEDGER_OUTBOUND_VERIFICATION_READY` stay off. A result under this assumption describes these fictional layouts only, never real labels from any hospital. |
| Layouts | One fictional layout per bank code: `MEDIATRIX`, `MEDIX` and `NLVILLA`. Each prints the five field headings, the bank code and a visible `SYNTHETIC - NOT A HOSPITAL LABEL` marker. No logo, seal, address, licence number or copy of a real label design, including the supplied reference photograph. Generic heading words are allowed. The three layouts differ in heading wording, field order and value placement (beside or below the heading), so per-bank results measure layout handling. Manufacturer-style lot, catalog and barcode text may appear only as a distractor. |
| Profile versions | Lat defines each layout as a profile with an ID, a version and a SHA-256 of its layout definition. A profile that follows this table is accepted for corpus use once it is frozen and recorded in the corpus manifest; no further Jopia sign-off is needed. Any change is a new version, and each label keeps the version it was photographed under. The existing `MEDIATRIX_BAG_PREVIEW` draft and the `*_REFERENCE_PENDING` entries are not these profiles. |
| Donation No. | The existing synthetic grammars, with invented values only: `MMYY-MM-NNNN` for `MEDIATRIX`, `SYNMEDIX-NNNN-NNNN` for `MEDIX`, `SYNNLVILLA-NNNN-NNNN` for `NLVILLA`. The issuer comes from the grammar, never from the bank code, marker or layout. |
| Blood type | Written as `A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+` or `O-`, mapped one-to-one to the V2 enum (`A_POSITIVE` to `O_NEGATIVE`). Any other mark is annotated `ambiguous`. |
| Component | Written as an abbreviation or its full name: `WB` (whole blood), `PRBC` (packed red blood cells), `FFP` (fresh frozen plasma), `PLT` (platelets) or `CRYO` (cryoprecipitate). Each maps one-to-one to the V2.1 enum. These are codes for the fictional labels, not a statement about any institution's labels. A missing or illegible component is annotated `absent` or `unreadable`. It is never inferred from bag colour, volume or other text. |
| Dates | Written as `YYYY-MM-DD HH:MM` (24-hour) or `YYYY-MM-DD` alone. Each layout prints `Times: Asia/Manila (UTC+08:00)`, so the corpus converts a full date and time to UTC. That caption applies to these fictional layouts only. It does not approve reading real printed times as Asia/Manila; ADR-010 still governs only storage and display. A date-only value has `DATE` precision and is never given a time. Expiry follows collection. |
| Date-only and short dates | Date-only values may appear and are scored, but stay non-submittable while `RQ-03` is open. The 180 planned labels use four-digit years. Two-digit or day/month-ambiguous dates belong only to a separately counted negative class, annotated `ambiguous`. |
| Annotation | Each field records its state (`present`, `absent`, `obscured`, `ambiguous` or `unreadable`), the canonical enum or UTC value, date precision (`INSTANT` or `DATE`) and a region in source pixels. Reviewers annotate what the photograph shows; a planned value is not ground truth. Two independent reviewers resolve and record their disagreements. |
| Negative cases | The plan's six classes (`missing_field`, `conflicting_dates`, `duplicate_identifier`, `manufacturer_barcode`, `unknown_layout`, `prohibited_personal_text`) are reported separately from the 180 planned labels, and each case stays within one split. `prohibited_personal_text` uses an obviously fictional placeholder such as `PATIENT: TEST`, never a real name or detail. |
| Writers and privacy | People write fictional values by hand and are recorded only by opaque code (`WRITER_01` to `WRITER_05`), with no names, signatures or employee IDs. Handwriting samples, photographs, transcriptions and predictions are private research data under Buno's custody process and stay out of Git. Never photograph a real issued blood unit or label. |
| Activation | Nothing under this assumption activates a profile, supports a claim for any hospital or feeds the application. Activation still needs an accepted real profile and contract, camera-device evidence and a held-out report. |

## PA-OCR-04 — Fully reviewed intake after an OCR attempt (2026-10-19)

**Accepted for simulation by the user acting as Jopia in this chat.** The user
requested implementation after the unchanged-OCR-field rule blocked a fully
corrected preview. This additive decision under RQ-19 does not change PA-OCR-03.

`INBOUND_OCR_CORRECTED_V2` permits correction of all five fields after OCR ran,
including when none were recognized. It requires `ocrAttempted: true`, a workflow
attestation rather than proof of image content or accuracy. At least one field
is corrected; no unchanged OCR field is required. Unchanged fields still need
>=90 engine scores. Corrected fields retain original values/scores or null/null
when unread, with exact reasons and operator provenance, never a score assigned
to an edited final value. Corrected Donation No. double-entry, exact UTC dates,
issuer/product rules, bank ROLE-01/02, capability/PIN, idempotency, frozen retry,
version/state and queued-versus-committed rules remain in force.

Default-off flags: `BLOODLEDGER_REVIEWED_INTAKE_ENABLED` and
`VITE_BLOODLEDGER_REVIEWED_INTAKE_READY`. An additive policy-constraint migration
is required. Images/crops/unrestricted text remain volatile. The legacy ledger
`captureMethod: OCR` denotes the scanner workflow, not recognition of final
values; V2 policy and per-field provenance explicitly distinguish operator
review. History V1 vocabulary is unchanged. No Fabric change is required.

Scanner-free Manual mode, CSV import, requester registration, real-label and
institutional/clinical authority remain outside this decision. V1 contracts are
unchanged. The user's instruction to resolve this local blocker authorizes its
scoped retained-host activation with backup and protected-count checks. No live
intake is authorized as part of implementation/validation.
