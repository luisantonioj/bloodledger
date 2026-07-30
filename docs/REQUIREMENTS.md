# BloodLedger Software Requirements

**Status:** Approved requirements baseline; onboarding implementation deferred
**Baseline date:** 2026-07-30
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
timestamp without retyping encoded values. Barcode/QR decoding is the accepted
baseline. OCR is a proposed alternative or supplement and does not satisfy this
requirement until `RQ-11` is resolved and its output is independently validated.

Acceptance:

- A valid, unique supported label creates one pending or committed unit record.
- A duplicate identifier creates no second unit.
- A malformed or unsupported payload creates no inventory asset and reports a
  clear validation error.
- OCR-derived values, if later approved, are never committed solely because text
  was detected; required fields and confidence/confirmation rules must pass.
- No donor or patient field is persisted.

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
- **BR-ONB-02:** Application IDs and institution IDs are stable opaque values;
  display names never serve as authorization scope.
- **BR-ONB-03:** Duplicate detection uses normalized institution name, category,
  locality, and institutional reference without disclosing a matching record.
- **BR-ONB-04:** Verification documents are not stored initially. The system
  records evidence type, result, reviewer, UTC review time, and a safe reference.
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
| NFR-03 | Low-barrier hardware | Supported web terminal plus compatible USB/Bluetooth 2D scanner; no specialized sensor required |
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
| PA-ML-01 | Accepted planning assumption | Assigned ML sprint version | ML owner / activating sprint | Synthetic training data may be generated with a recorded schema, generator version, seed, time range, lineage, and `SYNTHETIC_DATA` classification. Metrics are `SIMULATION_ONLY`, use time-ordered validation, and do not predict Mediatrix performance. | Approved anonymized Mediatrix dataset and data-governance decision |

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
| RQ-04 | Who may reallocate an approved reservation for a more urgent request? | Sprint 3 |
| RQ-05 | What are the final RPS scale, weights, wait cap, and tie-break rule? | Sprint 3 |
| RQ-06 | What are the final BROA criteria, normalization, weights, and eligibility constraints? | Sprint 3 |
| RQ-07 | What forecast metric and minimum accuracy justify operational use? | Sprint 3/testing |
| RQ-08 | What precision and retention apply to location evidence? | Sprint 3 |
| RQ-09 | Does receipt require two human signatures or institutional service identities plus authenticated user attribution? | Sprint 3 |
| RQ-10 | What local verification changes a received unit to available inventory? | Sprint 3 |
| RQ-11 | Will OCR supplement or replace barcode/QR capture, and what confidence, confirmation, label-fixture, privacy, and fallback rules make it acceptable? | Before Sprint 4 |
| RQ-12 | Should pending requests and approved-but-undispatched transfers be cancelled, frozen, or explicitly reassigned when an institution is suspended? | Sprint 3 |
| RQ-13 | What applicant verification, abuse prevention, and recovery controls are required before public self-service application can supplement invitation-only onboarding? | Before enabling public application |
| RQ-14 | What retention period and access policy apply to onboarding verification evidence and rejected applications? | Sprint 4 |
| RQ-15 | Who may authorize emergency suspension while a transfer is dispatched or in transit, and how is safe receipt/custody resolution assigned? | Sprint 3 |

Unanswered questions must not be guessed by a coding agent. The relevant task is
blocked or implemented behind an explicitly approved prototype assumption.
