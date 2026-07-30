# Sprint 2 — Deterministic Inventory Ledger

**Status:** Complete; accountable-owner review accepted 2026-07-30

**Planning started:** 2026-07-30
**Implementation authorization:** Jopia, 2026-07-30
**Sprint Review accepted:** Jopia, 2026-07-30
**Policy baseline:** `SYNTHETIC_INVENTORY_V1` under PA-S2-01–04

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
- `PA-S2-01` identifies the synthetic supported blood types/components and the
  minimum normalized fields delivered by the later scan boundary while `RQ-02`
  remains open for Mediatrix replacement values;
- the initial on-chain state, complete allowed inventory transition table,
  transaction authorization attributes, immutable event fields, and stable
  error-code vocabulary are approved; and
- the on-chain allowlist and privacy classification are reviewed against
  FR-01, BR-SEC-01, and BR-SEC-02.

`BL-INV-03` uses the explicitly accepted synthetic `PA-S2-02` thresholds.
`RQ-03` remains open: the implementation and its evidence must be labeled
non-clinical and the synthetic version must be superseded rather than edited
when approved Mediatrix values arrive.

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
- Clinical or Mediatrix expiry claims, and unversioned component behavior.

## 5. Selected tasks

### S2-01 — Approve Sprint 2 contract decisions

**Backlog:** BL-INV-01, BL-INV-02, BL-INV-03

Record the owners, dates, demonstration plan, PA-S2-01–04 assumption decisions,
allowlist, authorization rules, initial state, transition table, events, and
stable errors. Keep `RQ-02`/`RQ-03` open as replacement triggers.

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

Accept an application-supplied evaluation time and
`SYNTHETIC_INVENTORY_V1`, validate them deterministically, and make eligible
expired units unavailable. The scheduler remains off-chain and the results are
not clinical validation.

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

Jopia is the accountable owner and validator for Sprint 2 unless the team records
a reassignment. Each assigned owner validates their task; Buno and Lat may
review or participate without blocking acceptance. The accountable owner
accepts the consolidated Sprint Review, and self-validation is disclosed when
the same person holds both roles. The accepted prototype assumptions unblock
implementation without resolving Mediatrix or clinical policy. Replacement
decisions remain:

- `RQ-02`: Mediatrix-supported blood types, components, and scan structures;
- `RQ-03`: clinically approved component shelf-life and near-expiry thresholds;
- approved application identity integration; and
- any expansion beyond `AVAILABLE -> EXPIRED`.

## 8. Implementation evidence

Implementation began on 2026-07-30 under the authorization and assumptions
recorded above. This evidence formed the accountable-owner Sprint Review:

- `@bloodledger/inventory-contract` builds, type-checks, and passes 12 linked
  deterministic unit tests covering the selected allowlist, boundaries,
  prohibited fields, authorization, duplicate/idempotent behavior, stale state,
  policy mismatch, current/near-expiry/expiry evaluation, invalid transitions,
  deterministic replay, and prohibited runtime behavior.
- The reproducible package ID is
  `bloodledger-inventory_0.1.0:3cd9f3044e3d26f3433cc24a968417a0cd95a2dbbde7e29bf9d7ebef6a7f4be8`.
- Definition `bloodledger-inventory` version `0.1.0`, sequence `1`, was approved
  and committed on `bloodledger-dev` with the single
  `MediatrixMSP.peer` endorsement policy. Lifecycle transactions
  `2d4a07f43126233873b2a47e3b8cb29fec7e582f0d7fe357dd5fbc4a75575f44`
  and `a13ca484a9fa6d39e60943897aa22ba64c5a5c8c43b40b4738171749bc783616`
  committed `VALID`.
- The scoped `api-gateway` reenrollment preserved the CA roots/database,
  channel, peer/orderer identities, and ledgers and added only the approved
  role/institution certificate attributes. Identity validation then passed.
- End-to-end validation registered, read, and expired
  `UNIT_S2VALIDATION01` through `api-gateway`; both mutations committed and the
  resulting asset reached `EXPIRED` version `2`.
- Foundation, database, Fabric identity/node/channel/health-contract,
  operations, inventory static/type/unit, existing health-contract unit, and
  operational behavior checks passed. Gitleaks `8.30.1` found no leaks in
  history, index, or candidate content.

The 2026-07-30 supported-host validation completed the previously pending
network restart and both project-scoped reset/recreation scenarios. The
implementation remains a synthetic research prototype and is not clinical
validation.

## 9. Sprint Review record

- Evidence date: 2026-07-30.
- Tested revision:
  `f4e818e1fa865dd901a02f0cf20eab06980f4793`.
- Validation environment: Jopia's canonical Windows 11/WSL2 Ubuntu `24.04.4`
  host with the working copy in the WSL Linux filesystem.
- Effective versions: Docker Desktop `4.82.0`, Engine `29.6.1`, Compose
  `5.3.0`; Git `2.43.0`; Node.js `24.17.0`; npm `11.13.0`; Fabric `2.5.16`;
  Fabric CA `1.5.15`; PostgreSQL `17.10`; Gitleaks `8.30.1`.
- Effective host ports: loopback CA `7054`/`8054`, peer `7051`, orderer `7050`,
  and PostgreSQL `5432`.
- Assigned-owner validation: technical evidence reproduced through the
  repository automation on Jopia's supported host. Jopia held both the assigned
  validator and accountable-owner roles; this self-validation is disclosed
  under the accepted validation-governance policy.
- Accountable-owner acceptance: **Accepted by Jopia, 2026-07-30.**

### Acceptance evidence

| Task | Classification | Evidence |
|---|---|---|
| S2-01 | Proven | PA-S2-01–04, the allowlist, authorization attributes, initial state, transition, event fields, stable errors, owners, dates, and demonstration obligations are versioned in the requirements, policy, contract, and this sprint. RQ-02/RQ-03 remain open replacement triggers. |
| S2-02 | Proven | The root TypeScript chaincode workspace passes format, lint, type, static-boundary, build, unit, and reproducible-package checks without changing the Sprint 1 health contract. |
| S2-03 | Proven | Linked tests cover allowed registration, all supported type/component pairs, prohibited and unknown fields, exact timestamp/identifier boundaries, duplicate/idempotent behavior, and MSP/enrollment/type/role/institution authorization. |
| S2-04 | Proven | Linked tests cover committed reads, missing state, stale state, invalid and repeated transitions, exact current-state/version checks, deterministic output, and no state/event change on failure. The only implemented transition is `AVAILABLE -> EXPIRED`. |
| S2-05 | Proven | Linked tests cover current, near-expiry, and exact-expiry boundaries using application-supplied time and `SYNTHETIC_INVENTORY_V1`; the chaincode contains no scheduler or local clock. |
| S2-06 | Proven | The package ID remained `bloodledger-inventory_0.1.0:3cd9f3044e3d26f3433cc24a968417a0cd95a2dbbde7e29bf9d7ebef6a7f4be8` across recreation. Normal restart, Level 1 Fabric-only reset, and Level 2 full development reset each ended in a healthy network and fresh valid inventory registration/read/expiry. Foundation, PostgreSQL recreation/persistence, identity, node, channel, health-contract, operations, inventory, and Gitleaks checks passed. |
| S2-07 | Proven | Jopia accepted the consolidated technical evidence, incomplete-item disposition, limitations, and retrospective on 2026-07-30. |

### Supported-host scenario results

| Scenario | Result | Safe evidence summary |
|---|---|---|
| Normal restart persistence | PASS | Peer/orderer restart and channel persistence passed; the existing inventory definition remained committed and `UNIT_S2RESTART0730` registered, read, and expired with valid commits. |
| Level 1 Fabric reset/recreate | PASS | The preview named only approved Fabric resources; PostgreSQL retained one applied migration; bootstrap recreated Fabric; the exact inventory package was redeployed; `UNIT_S2LEVEL1_0730` registered, read, and expired with valid commits. |
| Level 2 development reset/recreate | PASS | The preview named only BloodLedger Compose resources and volumes; empty PostgreSQL state correctly reported the bootstrap migration pending, migration/reapply/restart checks passed with zero domain tables, and bootstrap recreated the network; `UNIT_S2LEVEL2_0730` registered, read, and expired with valid commits. |
| Secret/generated-material controls | PASS | Ignore-path checks covered 15 sensitive/generated paths. Gitleaks `8.30.1` at digest `sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f` found no leaks in 21-commit history, index, or tracked/candidate content. |

### Incomplete-item disposition and retrospective

- No Sprint 2 acceptance criterion is incomplete. Jopia accepted the
  consolidated Sprint Review on 2026-07-30.
- RQ-02 and RQ-03 remain open by design and continue to prevent Mediatrix or
  clinical interpretation of `SYNTHETIC_INVENTORY_V1`.
- The fresh Fabric baseline issues an `api-gateway` certificate without the
  Sprint 2 attributes until the documented scoped reenrollment runs. Both reset
  validations therefore reenrolled that single generated identity before
  inventory deployment. A future sprint may integrate this explicit step into
  its authorized operational workflow, but Sprint 2 does not silently expand
  the Sprint 1 bootstrap contract.
- Keeping unique synthetic validation suffixes and recording concise evidence
  immediately made restart and destructive-reset results distinguishable
  without committing runtime data or secret-bearing logs.
