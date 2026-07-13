# BloodLedger Product Backlog

**Status:** Sprint 0 prioritized baseline  
**Baseline date:** 2026-07-13  
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
**Status:** Selected  
**Target:** Sprint 1  
**Requirements:** NFR-09, NFR-10, NFR-12

Acceptance:

- A supported clean machine can follow documented setup steps.
- Required services can be started, inspected, stopped, and reset.
- Exact supported versions are pinned.

### BL-INF-02 — BloodLedger Fabric development network

**Priority:** Must  
**Status:** Selected  
**Target:** Sprint 1  
**Dependencies:** BL-INF-01  
**Requirements:** NFR-02, NFR-08

Acceptance:

- One Mary Mediatrix development organization, peer, orderer, CA/identity path,
  and shared channel start successfully.
- A minimal health transaction can be invoked and queried.
- Generated secrets and private keys are untracked.

### BL-INF-03 — PostgreSQL infrastructure baseline

**Priority:** Must  
**Status:** Selected  
**Target:** Sprint 1  
**Requirements:** NFR-05, NFR-07, NFR-12

Acceptance:

- PostgreSQL is healthy and accessible using non-secret documented settings.
- Migration and seed mechanisms are repeatable.
- DBeaver is optional tooling, not a runtime dependency.

### BL-INF-04 — Infrastructure verification

**Priority:** Must  
**Status:** Selected  
**Target:** Sprint 1  
**Dependencies:** BL-INF-01–03

Acceptance:

- Automated health and reset checks pass on each team member's supported host.
- Failures and fixes are documented.

## 4. EPIC-02 — Inventory ledger

### BL-INV-01 — Register unique blood unit

**Priority:** Must | **Status:** Proposed | **Target:** Sprint 2  
**Requirements:** FR-01, BR-INV-01, NFR-01, NFR-02

Acceptance: authorized registration creates one allowlisted asset and rejects a
duplicate or prohibited field.

### BL-INV-02 — Enforce unit lifecycle

**Priority:** Must | **Status:** Proposed | **Target:** Sprint 2  
**Requirements:** FR-08, BR-INV-02–06, NFR-08

Acceptance: allowed transitions succeed deterministically; invalid, duplicate,
or expired-unit operations fail without partial change.

### BL-INV-03 — Evaluate expiry safely

**Priority:** Must | **Status:** Proposed | **Target:** Sprint 2  
**Dependencies:** RQ-03  
**Requirements:** FR-08, FR-09

Acceptance: a scheduled application trigger submits a deterministic threshold
evaluation and expired units become unavailable.

## 5. EPIC-03 — Transfers and optimization

### BL-TRF-01 — Request and approval workflow

**Priority:** Must | **Status:** Proposed | **Target:** Sprint 3  
**Requirements:** FR-05, BR-TRF-01–03

Acceptance: eligible requests can be submitted, approved/rejected, and reserved
without duplicate or partial allocation.

### BL-TRF-02 — Dispatch, receipt, and exception lifecycle

**Priority:** Must | **Status:** Proposed | **Target:** Sprint 3  
**Dependencies:** BL-INV-02, RQ-09, RQ-10  
**Requirements:** FR-10, FR-11, BR-TRF-04–10

Acceptance: dispatch and receipt close the custody loop; delayed, rejected,
cancelled, and compromised cases preserve a complete audit trail.

### BL-ALG-01 — FEFO and RPS

**Priority:** Must | **Status:** Proposed | **Target:** Sprint 3  
**Dependencies:** RQ-02, RQ-05  
**Requirements:** FR-02, FR-06, BR-ALG-04

Acceptance: FEFO is a hard constraint and RPS ranking is reproducible,
versioned, explainable, and covered by contention/tie tests.

### BL-ALG-02 — BROA recommendation

**Priority:** Must | **Status:** Proposed | **Target:** Sprint 3  
**Dependencies:** BL-ALG-01, BL-ML-01, RQ-06  
**Requirements:** FR-07, BR-ALG-01–06

Acceptance: eligible destinations are ranked using approved criteria; the
result is explainable and cannot transfer a unit without approval.

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

## 7. EPIC-05 — Scan, middleware, and synchronization

### BL-SCN-01 — ISBT 128 scan parsing

**Priority:** Must | **Status:** Proposed | **Target:** Sprint 4  
**Dependencies:** RQ-02  
**Requirements:** FR-01, NFR-03, NFR-04

Acceptance: approved fixtures parse consistently and invalid/prohibited payloads
fail safely.

### BL-SYNC-01 — Durable offline queue

**Priority:** Must | **Status:** Proposed | **Target:** Sprint 4  
**Dependencies:** BL-INF-03  
**Requirements:** FR-13, NFR-05

Acceptance: outage tests demonstrate no accepted-event loss, no duplicates, and
visible pending/conflict states.

### BL-API-01 — Application orchestration API

**Priority:** Must | **Status:** Proposed | **Target:** Sprint 4/5  
**Dependencies:** inventory and transfer contracts

Acceptance: versioned OpenAPI contract covers authentication, inventory,
requests, transfers, alerts, transaction status, and consistent errors.

## 8. EPIC-06 — Dashboard and access

### BL-WEB-01 — Authentication and institutional RBAC

**Priority:** Must | **Status:** Proposed | **Target:** Sprint 5  
**Requirements:** FR-12, NFR-01

Acceptance: unauthenticated, cross-role, and cross-institution access tests fail
safely at server and ledger boundaries.

### BL-WEB-02 — Inventory and alert views

**Priority:** Must | **Status:** Proposed | **Target:** Sprint 5  
**Requirements:** FR-03, FR-04, FR-09, NFR-06, NFR-11

Acceptance: stock, shortage, expiry, forecast freshness, and synchronization
state are accessible and update within the defined test condition.

### BL-WEB-03 — Request and transfer views

**Priority:** Must | **Status:** Proposed | **Target:** Sprint 5  
**Requirements:** FR-05–07, FR-10–11

Acceptance: users complete permitted workflows and can inspect ranking and
custody evidence without exposure of prohibited data.

### BL-WEB-04 — Regulatory reports

**Priority:** Must | **Status:** Proposed | **Target:** Sprint 5  
**Requirements:** FR-03, FR-12

Acceptance: DOH/PRC users can view/export approved aggregate information but
cannot mutate operational state.

## 9. EPIC-07 — Validation and evidence

### BL-TST-01 — Requirements-traceable system tests

**Priority:** Must | **Status:** Proposed | **Target:** Testing phase

Acceptance: each requirement has passing/failing evidence, environment/version,
fixture provenance, defect record, and rerun result where applicable.

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
