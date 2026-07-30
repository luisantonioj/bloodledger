# BloodLedger Project Context

**Status:** Approved product-scope baseline
**Baseline date:** 2026-07-30
**Owners:** Buno, Jopia, and Lat

## 1. Purpose of this document

This document is the implementation-facing summary of BloodLedger's vision,
scope, users, constraints, and research context. It does not replace the thesis
manuscript or research proposal. When implementation work begins, this file is
the authoritative source for project scope and terminology.

## 2. Product vision

BloodLedger is a web-based prototype for real-time blood inventory coordination
and traceable inter-hospital redistribution in Lipa City. It combines barcode or
QR scanning, an on-premise application database, a permissioned Hyperledger
Fabric ledger, a demand-forecasting service, and a shared dashboard.

The prototype is intended to reduce four operational failures:

1. inaccurate inventory caused by delayed manual recording ("ghost stock");
2. slow coordination through calls and consumer messaging applications;
3. loss of custody visibility after a blood unit is dispatched; and
4. preventable wastage caused by reactive expiry management.

BloodLedger is a decision-support and coordination system. It does not replace
clinical judgment, blood compatibility procedures, institutional approval, or
transport and cold-chain protocols.

## 3. Study objectives

- Digitize blood-unit movements through barcode or QR scans.
- Provide near-real-time stock visibility and structured blood requests.
- record inventory and custody events in a tamper-evident ledger.
- Verify dispatch and receipt using time and location evidence.
- Recommend redistribution using FEFO, request priority, demand forecasting,
  and multi-criteria scoring.
- Generate operational and regulatory summaries without collecting PHI.

## 4. Prototype deployment model

### 4.1 Active operational institution

Mary Mediatrix Medical Center is the sole active blood-bank institution and
sole operational Fabric peer organization in the approved prototype scope. It
registers inventory, approves or rejects outgoing transfers, and performs
dispatch and receipt operations applicable to its custody.

### 4.2 Secondary recipient institutions

The following institutions are modeled as dashboard participants without active
Fabric peers in the initial prototype:

- Metro Lipa Medical Center;
- Lipa City District Hospital;
- San Antonio Medical Center;
- Divine Love Medical Center; and
- Ospital ng Lipa.

They may view permitted inventory information, submit requisitions, and track
their transfers. Their precise participation remains subject to institutional
approval and seed-data validation.

### 4.3 Deferred candidate primary institutions

- Medix Medical Hospital; and
- N.L. Villa Memorial Medical Center.

They are future candidates for independent Fabric organizations and peers. They
are not represented as active consortium peers in the initial prototype.
They may later use the ordinary institutional application workflow to become
application participants, but application approval does not grant Fabric
membership.

### 4.4 Regulatory observers

- Philippine Red Cross Lipa Chapter; and
- Department of Health CHD Calabarzon.

Both receive read-only city-wide reporting and audit access through the
application. They do not submit ledger mutations in the initial prototype.

## 5. Target users

| User | Primary needs |
|---|---|
| Medical Technologist | Scan units, view permitted inventory, dispatch or receive units as authorized |
| Hospital Administrator | Manage local inventory oversight and approve or reject transfers |
| Secondary Hospital User | View permitted availability, submit requests, track and acknowledge transfers |
| DOH/PRC Regulatory Viewer | Read city-wide summaries, alerts, transfer history, and reports |
| System Administrator | Manage application users, configuration, and system operations |
| Institution Account Administrator | Manage an activated institution's profile and users without clinical, custody, or transfer authority |

The exact permissions are defined in `docs/REQUIREMENTS.md`.

## 6. Core capabilities

- ISBT 128-compatible barcode/QR scan ingestion.
- A documented OCR feasibility option that may later supplement or replace the
  scanner path only after recognition accuracy, verification UX, and safety
  constraints are approved.
- Local event capture during connectivity loss and later synchronization.
- Blood-unit inventory and lifecycle tracking.
- City-wide inventory matrix with access-controlled detail.
- Digital requisition, approval, dispatch, receipt, and exception tracking.
- FEFO dispatch enforcement.
- Near-expiry and shortage alerts.
- Request Priority Scoring (RPS) for concurrent demand.
- Blood Redistribution Optimization Algorithm (BROA) recommendations.
- Daily per-blood-type/component demand forecasting.
- Immutable inventory and custody audit events.
- Read-only regulatory dashboards and report export.
- Invitation-based institutional application, administrator review, activation,
  suspension, and application-status tracking in the later API/web sprints.

## 7. Primary user flows

### 7.1 Register a blood unit

1. An authorized user scans an ISBT 128 label.
2. The application parses and validates the supported fields.
3. The event is stored locally with an idempotency identifier.
4. When ledger connectivity is available, the event is submitted to Fabric.
5. The dashboard projection is reconciled with the committed result.

### 7.2 Request and transfer blood

1. A secondary hospital submits type, component, quantity, and urgency.
2. The system ranks competing requests using RPS.
3. A hospital administrator approves or rejects a request.
4. Approved units are reserved using FEFO.
5. Dispatch records time and permitted location evidence.
6. The recipient confirms receipt or records an allowed exception.
7. The ledger preserves the custody trail and the dashboard updates.

### 7.3 Recommend redistribution

1. A scheduled application process identifies near-expiry units or a predicted
   distributable surplus.
2. FEFO selects eligible units.
3. BROA ranks eligible destinations using approved inputs and weights.
4. The system presents an explainable recommendation.
5. An authorized human decides whether to approve the transfer.

### 7.4 Operate during an outage

1. The user is clearly informed that the system is offline or degraded.
2. Valid scan events are saved to a durable local queue.
3. On reconnection, events are submitted in a deterministic order.
4. Duplicate, stale, or conflicting events are rejected or flagged for review.

### 7.5 Apply as an institution

1. An authorized institutional representative uses a single-use invitation to
   submit a privacy-minimized application.
2. A system administrator who is not affiliated with the applicant verifies and
   reviews the application.
3. Approval records eligibility for application participation but does not
   create operational access.
4. A separate activation action creates the initial non-clinical institution
   account administrator and enables only approved application permissions.
5. Fabric organization membership, certificates, peers, channel membership, and
   endorsement remain a separate deferred governance and infrastructure path.

## 8. In scope

- A prototype deployed primarily at Mary Mediatrix Medical Center.
- Inventory metadata: unit identifier, blood type, component, collection and
  expiry timestamps, custody institution, status, and transaction timestamps.
- Barcode/QR scanning using existing terminals and a compatible 2D scanner.
- Planning and evaluation of OCR as an alternative label-capture method; OCR
  implementation is not included until a later sprint decision is accepted.
- On-premise, Docker-based application and infrastructure services.
- One operational Fabric peer organization designed for later expansion.
- Dashboard participation by modeled secondary institutions.
- Future onboarding of approved secondary hospitals and blood banks as
  application participants through invitation, review, and activation.
- Read-only DOH and PRC oversight.
- Dispatch- and receipt-time location evidence.
- Historical DOH stock snapshots for forecasting, subject to access approval.
- Parallel validation with existing manual processes during deployment.

## 9. Out of scope

- Patient records, diagnoses, transfusion records containing patient identity,
  donor names, employee identifiers, or other PHI/PII.
- Blood collection, donor screening, cross-matching, clinical compatibility,
  transfusion decision-making, or treatment guidance.
- Generation or printing of official ISBT 128 labels.
- Blood disposal workflow; expired units are only made inactive/unavailable.
- RFID, continuous vehicle GPS tracking, indoor tracking, cold-chain sensors,
  smart refrigeration, or automated transport dispatch.
- A native mobile application.
- Provincial, national, or production-grade consortium rollout.
- Automatic Fabric organization, CA, peer, channel, or endorsement provisioning
  from an institutional application.
- Full regulatory accreditation or replacement of official systems of record.
- Autonomous approval of redistribution recommendations.

## 10. Constraints and assumptions

- The prototype is web-based and intended for existing hospital terminals.
- Operational data remains on-premise within the local environment.
- Internet or consortium connectivity may be intermittent; local LAN services
  are assumed available for offline capture.
- Initial forecasting quality depends on the completeness of at least 12 months
  of historical 9:00 AM and 4:00 PM DOH submissions.
- Manual historical stock differences do not directly prove consumption;
  replenishments and corrections must be accounted for before model training.
- Distance is initially based on a reviewed static facility-distance table.
- Location capture requires explicit user permission and a documented fallback.
- The prototype topology demonstrates Fabric integration, not decentralized
  multi-organization governance.
- All dates and times are stored in UTC and rendered in Asia/Manila time unless
  a later accepted architecture decision changes this convention.
- While institutional data-gathering approval is pending, later-sprint domain
  values may be implemented only as explicitly approved, versioned prototype
  assumptions using synthetic evidence. These values prove software behavior;
  they are not Mary Mediatrix policy, clinical guidance, or validation evidence.
- A prototype assumption has an owner, effective date, affected requirements,
  limitations, replacement trigger, and immutable version. New stakeholder
  evidence creates a superseding version rather than silently changing existing
  ledger events, datasets, models, or test results.

## 11. Success criteria

- A valid scan is recorded once and appears on the dashboard within the target
  latency under normal conditions.
- No scan event is lost during a tested connectivity interruption.
- Invalid lifecycle transitions and unauthorized mutations are rejected.
- A complete transfer has traceable approval, dispatch, and receipt evidence.
- Expired units cannot be offered or recommended.
- BROA and RPS results are reproducible and explain their input scores.
- No prohibited patient or donor data is present in application or ledger data.
- Intended users rate the prototype at or above the study's accepted UAT
  threshold of 3.50 mean on the five-point scale.

## 12. Key terms

| Term | Meaning in BloodLedger |
|---|---|
| BROA | Blood Redistribution Optimization Algorithm; an explainable recommendation pipeline |
| FEFO | First-Expired, First-Out unit-selection rule |
| RPS | Request Priority Scoring for competing requisitions |
| Predicted Distributable Surplus | Current stock less forecast usage, safety allowance, and minimum reserve; final formula requires clinical validation |
| Primary institution | An inventory-holding institution that may operate a Fabric organization/peer |
| Secondary institution | A recipient participant using the application without an initial Fabric peer |
| Institutional application | An off-chain request for application participation; approval does not provide operational access or Fabric membership |
| Application participant | An activated institution with explicitly assigned application permissions; it need not operate a Fabric peer |
| Fabric member organization | An institution separately admitted through deferred governance and infrastructure work to operate an independent Fabric organization |
| Regulatory viewer | A read-only DOH or PRC application user |
| Ledger event | An immutable, append-only record of an accepted domain transaction |
| World state | Fabric's current materialized asset state, derived from ledger transactions |
| Read model | PostgreSQL projection optimized for application queries |
| Offline queue | Durable local records awaiting ledger submission or reconciliation |
| OCR | Optical Character Recognition; a proposed label-capture option that requires verification before use |
| PHI | Protected/personal health information; prohibited from this system |

## 13. Research and delivery risks

| Risk | Impact | Initial mitigation | Owner |
|---|---|---|---|
| Historical data is unavailable or unreliable | Forecasting cannot be validated as planned | Use an explicitly labeled simulated dataset; report limitations; never present it as institutional evidence | Research team |
| Only one active Fabric organization | Consortium/decentralization claims may be overstated | Label topology as a single-organization prototype; document expansion path | Architecture owner |
| Manual source records contain unexplained stock changes | Derived consumption is biased | Reconcile replenishments, transfers, expiry, and corrections before training | ML owner |
| Connectivity interruption | Lost or conflicting inventory events | Durable queue, idempotency keys, version checks, and recovery tests | Backend owner |
| Sensitive data is entered accidentally | Privacy breach | Field allowlists, validation, seed-data review, and security tests | Entire team |
| Location evidence is missing or spoofed | Weak custody verification | Capture accuracy/source, use facility fallback flag, and require server validation | Backend owner |
| OCR misreads blood-label data | Incorrect unit metadata could enter validation | Require confidence thresholds, field-level confirmation, fixtures, and scanner fallback before approval | Scan-ingestion owner |
| Algorithm weights lack clinical approval | Unsafe or indefensible ranking | Keep weights configurable and proposed until stakeholder sign-off; log version used | Product owner |
| Actual work differs from planning dates | Inaccurate progress reporting | Record actual implementation and validation dates in the sprint review | Scrum team |
| Scope expands to production operations | Prototype is used beyond evidence | Prominent prototype warnings and separate production-readiness gate | Project owner |

## 14. Source documents and precedence

The baseline was reconciled from:

1. `Revised-v3-Manuscript-BloodLedger-Buno-Jopia-Lat.md`;
2. `Revised Updated Research Proposal v2.1.md`;
3. `Summary of Revisions.md`; and
4. `Updated_BloodLedger_Gantt.xlsx`.

Repository precedence is:

1. accepted decisions in `docs/ARCHITECTURE.md`;
2. `docs/REQUIREMENTS.md` for behavior and rules;
3. this file for scope and terminology;
4. the current sprint document for selected work; and
5. the backlog for future work.

Contradictions are recorded rather than silently resolved. A scope change
requires team approval and coordinated updates to affected documents.
