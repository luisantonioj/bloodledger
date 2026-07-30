# Sprint 2 — Deterministic Inventory Ledger

**Status:** Proposed planning baseline; implementation not authorized

**Planning started:** 2026-07-30

## 1. Sprint goal

Establish a deterministic, privacy-minimized Fabric inventory contract that can
register one authorized blood-unit asset, reject duplicates and prohibited
fields, and enforce the approved inventory lifecycle without adding transfer,
API, scanning, forecasting, recommendation, or user-interface behavior.

## 2. Entry and decision gates

Sprint 2 implementation begins only after:

- Sprint 1 S1-09 evidence and S1-10 accountable-owner review are accepted;
- BL-INV-01 and BL-INV-02 satisfy the backlog definition of `Ready` and are
  selected into this sprint;
- `RQ-02` identifies the prototype's supported blood types, components, and the
  minimum normalized fields delivered by the later scan boundary;
- the initial on-chain state, complete allowed inventory transition table,
  transaction authorization attributes, immutable event fields, and stable
  error-code vocabulary are approved; and
- the on-chain allowlist and privacy classification are reviewed against
  FR-01, BR-SEC-01, and BR-SEC-02.

`BL-INV-03` remains gated by `RQ-03`. If clinically approved component
shelf-life and near-expiry thresholds are not available, expiry behavior is not
implemented or guessed; the incomplete item returns to the backlog.

## 3. Included work

- Activate the root `chaincode/` workspace for one deployable package containing
  an `InventoryContract`.
- Define a versioned, explicit on-chain blood-unit and inventory-event allowlist
  using stable IDs, UTC timestamps supplied as validated transaction input,
  institution scope, correlation/idempotency evidence, and concurrency version.
- Implement authorized registration with global unit-ID uniqueness, duplicate
  idempotency, input validation, stable safe errors, and one auditable event.
- Implement only the approved Sprint 2 inventory transitions and reject stale,
  duplicate, unauthorized, and invalid transitions without partial state.
- Package, install, approve, commit, invoke, query, and deterministically replay
  the domain contract on the Sprint 1 development network.
- Document contract commands and machine-readable interfaces after they are
  tested.

## 4. Excluded work

- Barcode/QR parsing, OCR, REST endpoints, PostgreSQL domain tables, offline
  synchronization, and React screens.
- Transfer request, reservation, dispatch, receipt, location, RPS, BROA, and
  forecasting behavior.
- An internal chaincode scheduler, local-clock decisions, database/network
  calls, random values, unstable iteration, or autonomous clinical decisions.
- Patient, donor, diagnosis, treatment, employee, or other PHI/PII fields.
- Expiry thresholds or component behavior not approved through `RQ-02` and
  `RQ-03`.

## 5. Proposed tasks

### S2-01 — Approve Sprint 2 contract decisions

**Backlog:** BL-INV-01, BL-INV-02, BL-INV-03

Record the owners, dates, demonstration plan, resolved `RQ-02`/`RQ-03` outcomes,
allowlist, authorization rules, initial state, transition table, events, and
stable errors. Mark BL-INV-03 deferred if RQ-03 remains unresolved.

### S2-02 — Establish domain chaincode package

Create the TypeScript workspace, deterministic build/lint/type/test interface,
contract metadata, and lifecycle packaging without modifying the disposable
Sprint 1 health contract.

### S2-03 — Register a unique blood unit

**Backlog:** BL-INV-01  
**Requirements:** FR-01, BR-INV-01, BR-SEC-01–04, NFR-01, NFR-02

Implement the approved allowlisted asset, institution/identity authorization,
global uniqueness, idempotent duplicate handling, validation, audit metadata,
and event emission.

### S2-04 — Enforce inventory lifecycle

**Backlog:** BL-INV-02  
**Requirements:** FR-08, BR-INV-02–06, BR-SEC-04, NFR-08

Implement the approved current-state/version checks and transition table.
Invalid, duplicate, stale, or unauthorized submissions must leave state and
events unchanged.

### S2-05 — Evaluate expiry if approved

**Backlog:** BL-INV-03  
**Requirements:** FR-08, FR-09, BR-INV-04, NFR-08

Only after RQ-03 is resolved, accept an application-supplied evaluation time and
approved threshold/configuration version, validate them deterministically, and
make eligible expired units unavailable. The scheduler remains off-chain.

### S2-06 — Deploy and validate

Deploy the selected contract to `bloodledger-dev`, verify lifecycle/query/event
behavior, run deterministic replay and authorization/failure tests, and confirm
that generated packages, identities, and secrets remain untracked.

### S2-07 — Review and retrospective

Demonstrate every selected acceptance criterion, return incomplete items to the
backlog with cause and owner, and record evidence and lessons without claiming
clinical validation or production readiness.

## 6. Test and exit obligations

- Link tests to FR-01, FR-08, BR-INV-01–06, BR-SEC-01–04, NFR-01, NFR-02, and
  NFR-08 as applicable.
- Cover valid registration; field and timestamp boundaries; prohibited fields;
  unauthorized MSP, enrollment, role, and institution; duplicate/idempotent
  submission; stale version; every allowed and invalid transition; missing
  state; deterministic replay; stable serialization/event output; and no
  partial state or event on failure.
- Use synthetic identifiers and operational metadata only.
- Prove the chaincode has no clock, scheduler, randomness, external call,
  database access, ML/algorithm execution, or unstable ordering.
- Re-run the applicable Sprint 1 foundation, secret, package, network health,
  restart, and project-scoped reset checks.
- Each assigned task owner validates applicable evidence on the supported
  environment.
- Exit only when selected backlog acceptance criteria have reproducible evidence
  and the sprint accountable owner accepts the Sprint Review.

## 7. Ownership and open decisions

Jopia remains the proposed accountable owner until the team approves the Sprint
2 ownership matrix. Each assigned owner validates their task; Buno and Lat may
review or participate without blocking acceptance. The accountable owner
accepts the consolidated Sprint Review, and self-validation is disclosed when
the same person holds both roles. This proposal does not resolve clinical or
domain choices. Required owner decisions are:

- `RQ-02`: supported blood types, components, and normalized scan fields;
- `RQ-03`: component shelf-life and near-expiry thresholds;
- initial committed inventory state and the exact Sprint 2 transition subset;
- chaincode caller attributes and institution-authorization mapping; and
- the versioned on-chain field, event, and error contracts.
