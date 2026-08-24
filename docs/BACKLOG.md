# BloodLedger Product Backlog

**Status:** Sprints 1–4 accepted; Sprint 5 implementation and validation in progress
**Baseline date:** 2026-08-24
**Prioritization:** MoSCoW, then dependency order

## 1. Backlog rules

- An item is **Ready** only when linked requirements, acceptance criteria,
  dependencies, test approach, and required decisions are known.
- The backlog describes outcomes. The current sprint document contains the
  actionable implementation plan.
- Status values: `Proposed`, `Ready`, `Selected`, `In Progress`, `Done`,
  `Blocked`, and `Deferred`.
- `Done` requires evidence; a manuscript test case is not proof of completion.

## 2. Epic roadmap

| Epic | Outcome | Target | Priority |
|---|---|---|---|
| EPIC-01 | Reproducible infrastructure and development environment | Sprint 1 | Must |
| EPIC-02 | Deterministic inventory ledger and lifecycle | Sprint 2 | Must |
| EPIC-03 | Transfer custody, exceptions, location, RPS, and BROA | Sprint 3 | Must |
| EPIC-04 | Forecasting and predicted distributable surplus | Sprint 3 | Must |
| EPIC-05 | Scan ingestion, API orchestration, and offline synchronization | Sprint 4 | Must |
| EPIC-06 | Web dashboard, access control, alerts, and reporting | Sprint 5 | Must |
| EPIC-07 | System validation, UAT, and research evidence | Testing phase | Must |
| EPIC-08 | Pilot deployment and future consortium expansion | Later gate | Should/Deferred |

## 3. EPIC-01 — Infrastructure

### BL-INF-01 — Reproducible local environment

**Priority:** Must  
**Status:** Done

**Target:** Sprint 1  
**Requirements:** NFR-09, NFR-10, NFR-12

Acceptance:

- A supported clean machine can follow documented setup steps.
- Required services can be started, inspected, stopped, and reset.
- Exact supported versions are pinned.

**Evidence:** Jopia-host S1-02/S1-03/S1-08/S1-09 results and the 2026-07-30
independent audit in `docs/SPRINT-01.md`.

### BL-INF-02 — BloodLedger Fabric development network

**Priority:** Must  
**Status:** Done

**Target:** Sprint 1  
**Dependencies:** BL-INF-01  
**Requirements:** NFR-02, NFR-08

Acceptance:

- One Mary Mediatrix development organization, peer, orderer, CA/identity path,
  and shared channel start successfully.
- A minimal health transaction can be invoked and queried.
- Generated secrets and private keys are untracked.

**Evidence:** Jopia-host S1-06/S1-07/S1-09 results and the 2026-07-30
independent audit in `docs/SPRINT-01.md`.

### BL-INF-03 — PostgreSQL infrastructure baseline

**Priority:** Must  
**Status:** Done

**Target:** Sprint 1  
**Requirements:** NFR-05, NFR-07, NFR-12

Acceptance:

- PostgreSQL is healthy and accessible using non-secret documented settings.
- A minimal bootstrap migration can be applied, inspected, and recreated.
- Complete domain tables are deferred until their column-level designs are
  approved.
- DBeaver is optional tooling, not a runtime dependency.

**Evidence:** Jopia-host S1-04/S1-05/S1-09 results and the 2026-07-30
independent audit in `docs/SPRINT-01.md`.

### BL-INF-04 — Infrastructure verification

**Priority:** Must  
**Status:** Done

**Target:** Sprint 1  
**Dependencies:** BL-INF-01–03

Acceptance:

- Automated health and reset checks pass on the assigned owner's canonical
  supported host.
- Failures and fixes are documented.

**Evidence:** Jopia-host S1-09 results, the 2026-07-30 independent audit, and
Jopia's accountable-owner S1-10 acceptance in `docs/SPRINT-01.md`. Buno and
Lat's host summaries are optional portability evidence.

## 4. EPIC-02 — Inventory ledger

### BL-INV-01 — Register unique blood unit

**Priority:** Must | **Status:** Done | **Target:** Sprint 2
**Requirements:** FR-01, BR-INV-01, NFR-01, NFR-02

Acceptance: authorized registration creates one allowlisted asset and rejects a
duplicate or prohibited field.

**Evidence:** Implementation, supported-host validation, and Jopia's
accountable-owner acceptance are recorded in `docs/SPRINT-02.md`.

### BL-INV-02 — Enforce unit lifecycle

**Priority:** Must | **Status:** Done | **Target:** Sprint 2
**Requirements:** FR-08, BR-INV-02–06, NFR-08

Acceptance: allowed transitions succeed deterministically; invalid, duplicate,
or expired-unit operations fail without partial change.

**Evidence:** Implementation, supported-host validation, and Jopia's
accountable-owner acceptance are recorded in `docs/SPRINT-02.md`.

### BL-INV-03 — Evaluate expiry safely

**Priority:** Must | **Status:** Done | **Target:** Sprint 2
**Dependencies:** PA-S2-02; RQ-03 remains open for replacement policy
**Requirements:** FR-08, FR-09

Acceptance: a scheduled application trigger submits a deterministic threshold
evaluation and expired units become unavailable.

**Evidence:** Deterministic application-triggered evaluation under PA-S2-02,
supported-host validation, and Jopia's accountable-owner acceptance are
recorded in `docs/SPRINT-02.md`.

## 5. EPIC-03 — Transfers and optimization

### BL-TRF-01 — Request and approval workflow

**Priority:** Must | **Status:** Done | **Target:** Sprint 3
**Dependencies:** PA-S3-01
**Requirements:** FR-05, BR-TRF-01–03

Acceptance: eligible requests can be submitted, approved/rejected, and reserved
without duplicate or partial allocation.

**Evidence:** Simulation-only implementation and Jopia's accountable-owner
acceptance are recorded in `docs/SPRINT-03.md`.

### BL-TRF-02 — Dispatch, receipt, and exception lifecycle

**Priority:** Must | **Status:** Done | **Target:** Sprint 3
**Dependencies:** BL-INV-02, PA-S3-01, PA-S3-02; RQ-08–10 remain replacement gates
**Requirements:** FR-10, FR-11, BR-TRF-04–10

Acceptance: dispatch and receipt close the custody loop; delayed, rejected,
cancelled, and compromised cases preserve a complete audit trail.

**Evidence:** Simulation-only implementation and Jopia's accountable-owner
acceptance are recorded in `docs/SPRINT-03.md`.

### BL-ALG-01 — FEFO and RPS

**Priority:** Must | **Status:** Done | **Target:** Sprint 3
**Dependencies:** PA-S2-01, PA-S3-03; RQ-02/RQ-05 remain replacement gates
**Requirements:** FR-02, FR-06, BR-ALG-04

Acceptance: FEFO is a hard constraint and RPS ranking is reproducible,
versioned, explainable, and covered by contention/tie tests.

**Evidence:** Simulation-only implementation and Jopia's accountable-owner
acceptance are recorded in `docs/SPRINT-03.md`.

### BL-ALG-02 — BROA recommendation

**Priority:** Must | **Status:** Done | **Target:** Sprint 3
**Dependencies:** BL-ALG-01, BL-ML-04, PA-S3-03; BL-ML-01/RQ-06 remain operational gates
**Requirements:** FR-07, BR-ALG-01–06

Acceptance: eligible destinations are ranked using approved criteria; the
result is explainable and cannot transfer a unit without approval.

**Evidence:** Simulation-only implementation and Jopia's accountable-owner
acceptance are recorded in `docs/SPRINT-03.md`. Operational use remains gated
by the listed dependencies.

## 6. EPIC-04 — Forecasting

### BL-ML-01 — Historical data quality and lineage

**Priority:** Must | **Status:** Blocked | **Target:** Before/during Sprint 3  
**Blocker:** Approved historical dataset not present in the repository  
**Requirements:** FR-14, BR-ALG-07

Acceptance: source permission, schema, missingness, replenishment/transfer
effects, cleaning steps, and train/test boundaries are documented.

### BL-ML-02 — Demand forecast baseline

**Priority:** Must | **Status:** Proposed | **Target:** Sprint 3  
**Dependencies:** BL-ML-01, RQ-07  
**Requirements:** FR-14

Acceptance: approved simple baselines and candidate model are evaluated using
time-ordered validation and reported metrics.

### BL-ML-03 — Versioned predicted surplus

**Priority:** Must | **Status:** Proposed | **Target:** Sprint 3  
**Dependencies:** BL-ML-02, approved safety/reserve policy

Acceptance: forecast, horizon, reserve, safety allowance, stale state, and model
version are stored and displayed; failure uses a safe fallback.

### BL-ML-04 — Synthetic forecast simulation enablement

**Priority:** Must | **Status:** Done | **Target:** Sprint 3
**Dependencies:** PA-ML-01
**Requirements:** FR-14

Acceptance: a versioned generator creates the approved four synthetic series;
validation rejects invalid or prohibited data; simple baselines and one
candidate model use time-ordered evaluation; one reproducible run persists four
`SIMULATION_ONLY` forecasts without enabling operational recommendations.

This item does not complete or unblock `BL-ML-01`–`BL-ML-03` for operational
use. Approved historical data, an accuracy decision under `RQ-07`, and approved
safety/reserve policy remain replacement gates.

**Evidence:** All technical gates passed and Jopia recorded accountable-owner
acceptance on 2026-08-16 in `docs/SPRINT-03.md`.

## 7. EPIC-05 — Scan, middleware, and synchronization

### BL-SCN-01 — ISBT 128 scan parsing

**Priority:** Must | **Status:** Proposed | **Target:** Sprint 4  
**Dependencies:** RQ-02  
**Requirements:** FR-01, NFR-03, NFR-04

Acceptance: approved fixtures parse consistently and invalid/prohibited payloads
fail safely.

### BL-SCN-02 — OCR label-capture feasibility

**Priority:** Must | **Status:** Selected | **Target:** Sprint 4

**Dependencies:** PA-S4-01, ADR-019; RQ-02 remains a real-label replacement gate
**Requirements:** FR-01, NFR-01, NFR-04

Acceptance: representative synthetic label fixtures are evaluated for field
recognition accuracy, confidence behavior, user confirmation, privacy, failure
handling, and scanner fallback. The outcome explicitly accepts OCR as a
supplement, accepts it as a replacement, or rejects it for this prototype.

### BL-SYNC-01 — Durable offline queue

**Priority:** Must | **Status:** Selected | **Target:** Sprint 4
**Dependencies:** BL-INF-03  
**Requirements:** FR-13, NFR-05

Acceptance: outage tests demonstrate no accepted-event loss, no duplicates, and
visible pending/conflict states.

### BL-API-01 — Application orchestration API

**Priority:** Must | **Status:** In Progress | **Target:** Sprint 4/5
**Dependencies:** inventory and transfer contracts

Acceptance: versioned OpenAPI contract covers authentication, inventory,
requests, transfers, alerts, transaction status, and consistent errors.

**Evidence:** The Sprint 5 OpenAPI, isolated PostgreSQL integration, 76 API
tests, and same-origin route checks passed on 2026-08-24. Accountable-owner
Sprint Review remains pending; see `docs/frontend/VALIDATION.md`.

### BL-API-02 — Institutional onboarding domain and API

**Priority:** Must | **Status:** Proposed | **Target:** Sprint 4 or activating API sprint

**Requirements:** FR-15, FR-16, FR-12, BR-ONB-01–16, BR-SEC-01–05, NFR-01, NFR-13

**Dependencies:** approved column-level design, versioned OpenAPI contract,
`RQ-14`, and the activating sprint's selection

Acceptance: persistence and versioned endpoints cover invitation submission,
safe duplicate detection, review, approval/rejection, withdrawal,
resubmission, separate activation, initial `ROLE-06` handling, suspension,
reactivation, audit, idempotency, concurrency, and stable errors without
granting Fabric membership.

### BL-API-03 — Synthetic scan synchronization and forecast middleware slice

**Priority:** Must | **Status:** Selected | **Target:** Sprint 4

**Requirements:** FR-01, FR-12–14, BR-SEC-01–05, NFR-01, NFR-05, NFR-09–10

**Dependencies:** BL-SCN-02, BL-SYNC-01, PA-S4-01, PA-S4-02, accepted Sprint 3
inventory contract and simulation forecast schema

Acceptance: a versioned authenticated API durably accepts an exact confirmed
synthetic scan, exposes honest status, reconciles it exactly once with Fabric,
updates an idempotent PostgreSQL projection, and returns current/stale/missing
Sprint 3 forecasts read-only with recommendation eligibility disabled.

## 8. EPIC-06 — Dashboard and access

### BL-WEB-01 — Authentication and institutional RBAC

**Priority:** Must | **Status:** In Progress | **Target:** Sprint 5
**Requirements:** FR-12, NFR-01

Acceptance: unauthenticated, cross-role, and cross-institution access tests fail
safely at server and ledger boundaries.

**Evidence:** Six-role browser/API allow/deny, session restoration/revocation,
and multi-institution isolation checks passed on 2026-08-24. Accountable-owner
Sprint Review remains pending; see `docs/frontend/VALIDATION.md`.

### BL-WEB-02 — Inventory and alert views

**Priority:** Must | **Status:** In Progress | **Target:** Sprint 5
**Requirements:** FR-03, FR-04, FR-09, NFR-06, NFR-11

Acceptance: stock, shortage, expiry, forecast freshness, and synchronization
state are accessible and update within the defined test condition.

**Evidence:** Scoped inventory/alert state, resilient polling, acknowledgement,
and the controlled frontend NFR-06 scenario passed on 2026-08-24. The scenario
boundary remains disclosed in `docs/frontend/VALIDATION.md`.

### BL-WEB-03 — Request and transfer views

**Priority:** Must | **Status:** In Progress | **Target:** Sprint 5
**Requirements:** FR-05–07, FR-10–11

Acceptance: users complete permitted workflows and can inspect ranking and
custody evidence without exposure of prohibited data.

**Evidence:** Request, approval/rejection, FEFO, cancellation, dispatch,
transit, delay/resume, receipt, conflict, replay, and scoped evidence checks
passed on 2026-08-24. Accountable-owner Sprint Review remains pending.

### BL-WEB-04 — Regulatory reports

**Priority:** Must | **Status:** In Progress | **Target:** Sprint 5
**Requirements:** FR-03, FR-12

Acceptance: DOH/PRC users can view/export approved aggregate information but
cannot mutate operational state.

**Evidence:** Regulatory composition, aggregate-only API reads, no-mutation
browser assertions, and safe simulation CSV export passed on 2026-08-24.
Owner visual review and accountable-owner Sprint Review remain pending.

### BL-WEB-05 — Institutional application and status UI

**Priority:** Must | **Status:** Proposed | **Target:** Sprint 5 or activating web sprint

**Requirements:** FR-15, FR-16, NFR-11, NFR-13

**Dependencies:** BL-API-02 and activating sprint selection

Acceptance: an invited applicant submits the minimum safe fields, verifies the
submission, and views only its own safe status, reasons, and in-application
notifications without receiving operational access before activation.

### BL-WEB-06 — Administrator institution and user management UI

**Priority:** Must | **Status:** Proposed | **Target:** Sprint 5 or activating web sprint

**Requirements:** FR-16, FR-12, BR-ONB-05–16, NFR-11, NFR-13

**Dependencies:** BL-API-02 and activating sprint selection

Acceptance: an authorized System Administrator reviews applications and
performs separate approve/reject, activate, suspend/reactivate, and initial-user
actions with reasons, version-conflict handling, and a clear warning that
application approval does not grant Fabric membership.

## 9. EPIC-07 — Validation and evidence

### BL-TST-01 — Requirements-traceable system tests

**Priority:** Must | **Status:** Proposed | **Target:** Testing phase

Acceptance: each requirement has passing/failing evidence, environment/version,
fixture provenance, defect record, and rerun result where applicable.

### BL-TST-02 — Onboarding authorization, audit, and boundary tests

**Priority:** Must | **Status:** Proposed | **Target:** Sprints 4–5/testing

**Requirements:** FR-15, FR-16, FR-12, BR-ONB-01–16, BR-SEC-01–05, NFR-01, NFR-13

**Dependencies:** BL-API-02, BL-WEB-05, BL-WEB-06, and applicable open RQs

Acceptance: automated tests cover application validation, duplicate/idempotent
submission, unauthorized and self-approval attempts, every allowed lifecycle
decision, stale/repeated decisions, pre-activation/rejected/suspended access,
cross-role and cross-institution denial, safe errors, audit evidence, secondary
application participation without a peer, unchanged Fabric membership and
endorsement, single-organization regression, and prohibited-data/secret scans.

### BL-UAT-01 — User acceptance testing

**Priority:** Must | **Status:** Proposed | **Target:** Testing phase

Acceptance: approved participants complete guided workflows and the anonymized
survey; quantitative and qualitative analysis follows the proposal protocol.

### BL-ALG-VAL-01 — BROA/RPS scenario validation

**Priority:** Must | **Status:** Proposed | **Target:** Sprint 3/testing

Acceptance: simulated and, where approved, historical scenarios test urgency,
expiry, scarcity, distance, ties, constraints, and failure cases against
documented expected rankings.

## 10. EPIC-08 — Later/deferred work

| ID | Item | Disposition |
|---|---|---|
| BL-DEP-01 | Parallel pilot with manual logbooks | Separate institutional, privacy, and safety gate |
| BL-EXP-01 | Add independent hospital Fabric organizations | Deferred beyond initial prototype |
| BL-EXP-02 | Multi-organization endorsement/governance | Deferred until real organizations participate |
| BL-OPS-01 | Production backup, disaster recovery, monitoring, certificate rotation | Required before any production claim |
| BL-DES-01 | Formal `DESIGN.md` extracted from the existing frontend mock | Before Sprint 5, not a Sprint 1 blocker |
| BL-SPEC-01 | Feature-level Spec Kit folders | Introduce only when a later feature needs separate spec/plan/tasks |
| BL-SKL-01 | Custom agent skills | Deferred until a stable workflow repeats and can be tested |

## 11. Explicitly not in this study

- Patient/donor/clinical record management.
- Blood label generation.
- Disposal processing.
- Cold-chain sensing or continuous transport tracking.
- Autonomous transfer approval.
- Nationwide network deployment.
