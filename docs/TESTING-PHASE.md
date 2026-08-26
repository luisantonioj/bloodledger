# Formal Testing Phase — Integrated Validation and UAT Preparation

**Status:** Authorized by Lat on 2026-08-26; planning and entry-gate
reconciliation in progress
**Accountable owner:** Lat
**Technical boundary owner/validator:** Jopia (self-validation must be disclosed)
**UAT and analysis coordinator:** Buno
**Review participants:** Jopia, Buno, and Lat
**Planning branch:** `codex/testing-phase-planning`
**Accepted implementation baseline:** merge commit `7c87c67` and tag
`sprint-05-accepted-2026-08-24`
**Classification:** `SIMULATION_ONLY`

## 1. Phase goal

Validate the accepted BloodLedger research prototype as an integrated system
against the implemented portions of `FR-01` through `FR-14` and `NFR-01`
through `NFR-12`, preserve reproducible requirement-to-evidence traceability,
evaluate BROA/RPS only under accepted synthetic policies, prepare a controlled
UAT package, and record every defect, rerun, limitation, and blocked result.

This phase does not authorize production deployment, clinical use, real
institutional inventory or labels, operational forecast/optimization claims,
new Fabric organizations, onboarding implementation, or research participation
without the required approvals.

## 2. Source reconciliation and schedule

The Gantt research source assigns:

| Gantt task | Original activity | Original dates | Testing-phase interpretation |
|---|---|---|---|
| 81 | System Testing, including ML forecast accuracy | 2026-08-17–22 | Requirements-traceable integrated testing; forecast evidence remains synthetic and cannot establish operational accuracy while `RQ-07` is open |
| 82 | UAT with blood-bank personnel and survey | 2026-08-23–28 | Prepare immediately; execute only after participant, consent, instrument, and research-data gates close |
| 83 | Defect remediation and deployment sign-off | 2026-08-29–31 | Defect triage, rerun, and prototype review only; it does not authorize deployment |

The original August 17–31 window remains preserved as elapsed planning history.
A replacement execution window must be approved by Lat after the entry gates
below are dispositioned; technical preparation may proceed from 2026-08-26.

Repository baselines supersede conflicting research-source implementation
claims:

- the accepted topology has one Mediatrix Fabric organization/peer; PRC, DOH,
  and secondary hospitals are application users, not peer operators;
- authorization uses the official six-role matrix, not the manuscript's
  four-tier summary;
- forecasting, BROA, RPS, and expiry evaluation run off-chain and cannot approve
  or submit transfers autonomously;
- `SYNTHETIC_CAPTURE_V1` does not establish real ISBT 128 compatibility;
- deployment, parallel clinical operation, and production sign-off require
  separate institutional, privacy, safety, and operational gates; and
- the repository success criterion says at least `3.50` mean, while the
  manuscript interpretation table makes `3.51` the lower bound of “Agree.”
  No UAT readiness conclusion may be calculated until the owners reconcile that
  boundary and version the accepted interpretation.

The manuscript's empty Result columns remain research placeholders. Planning or
automated evidence does not populate them.

## 3. Entry gates

### Closed

- Sprints 1–5 are accepted for their documented prototype scopes.
- The merged baseline and immutable synthetic policy versions are identified.
- Sprint 05 static, unit, browser, isolated PostgreSQL, Fabric health,
  same-origin, secret-scan, and visual-review evidence is reproducible.
- Raw UAT responses, consent forms, recordings, transcripts, credentials,
  images, OCR text, and institutional records are prohibited from Git.

### Open

| Gate | Required decision or evidence | Effect while open |
|---|---|---|
| TP-G01 | Lat approves the replacement execution window and this selected scope | Plan may be drafted; formal exit date is unset |
| TP-G02 | Owners reconcile the UAT acceptance boundary (`3.50` versus `3.51`) and approve the final instrument | No UAT score may be classified |
| TP-G03 | Institutional/research authorization, voluntary consent process, participant eligibility, facilitator, and external raw-data custodian are confirmed | No participant recruitment, UAT session, or raw response collection |
| TP-G04 | A supported Android device and approved synthetic PNG/printed fixture are available | Physical OCR result remains `BLOCKED` or `NOT_RUN` |
| TP-G05 | `RQ-07` is resolved with an approved dataset, metric, and minimum accuracy threshold | Forecast tests may prove reproducibility and simulation metrics only |
| TP-G06 | `RQ-14` plus `BL-API-02`, `BL-WEB-05`, and `BL-WEB-06` are activated | `BL-TST-02`, `FR-15`–`16`, and `NFR-13` remain out of executed scope |

An open gate produces an explicit `BLOCKED` or `NOT_RUN` result, never a pass.

## 4. Selected work mapped to Gantt

### 81 — System Testing

#### TP-01 — Freeze the baseline and evidence contracts

- Record the baseline commit, tag, environment, exact tool versions, synthetic
  policy/configuration versions, and fixture hashes.
- Create a requirement traceability register and defect register before results
  are recorded.
- Permit only `PASS`, `FAIL`, `BLOCKED`, and `NOT_RUN`; empty evidence is
  not a pass.

#### TP-02 — Run the clean regression and security baseline

- Run every applicable static, type, lint, build, unit, database, browser,
  Fabric, operations, dependency-audit, secret, and prohibited-data check.
- Use project-scoped Docker services and a clean same-origin `/`, `/capture/`,
  `/api/v1`, and `/healthz` run.
- Record commands, exit codes, versions, fixture lineage, and durable evidence;
  do not paste secrets or generated identities.

#### TP-03 — Execute requirements-traceable integrated scenarios

- Cover success, boundary, authorization, duplicate, stale-state, retry,
  ordering, conflict, offline, recovery, and failure behavior.
- Prove six-role and cross-institution isolation with deliberately distinct
  synthetic hospital records.
- Prove the scan queue, Fabric commit, PostgreSQL projection, dashboard state,
  request/approval, FEFO, dispatch, delay/resume, receipt/compromise, audit,
  regulatory read-only, CSV, logout, and revoked-session paths.
- Record defects immediately and rerun affected requirements after remediation.

#### TP-04 — Close or preserve physical and latency deferrals

- Repeat the Sprint 04 Android Chrome test using only the approved synthetic
  fixture; never use a real blood label.
- Measure `NFR-06` from confirmed Fabric commit through worker projection to
  visible dashboard state under a documented normal condition.
- Record pending intake and Fabric commit time separately. The accepted limit is
  at most five seconds from commit to visible projection.
- If the device or end-to-end boundary is unavailable, preserve the deferral and
  associated claim restrictions.

#### TP-05 — Validate forecasting, RPS, and BROA scenarios

- Use fixed synthetic scenario IDs, seeds, configuration versions, and expected
  orderings.
- Cover urgency, wait time, FEFO, expiry, scarcity, distance, eligibility,
  constraints, ties, contention, stale/missing forecasts, and failure cases.
- Preserve time-ordered forecast validation and simple baselines.
- Report simulation metrics and limitations; do not call them Mediatrix
  accuracy or operational suitability while `RQ-05`–`07` remain open.

### 82 — User Acceptance Testing

#### TP-06 — Prepare the gated UAT package

Buno coordinates an owner-reviewed package containing participant eligibility,
consent and facilitation procedures, the versioned five-area instrument,
synthetic guided workflows, browser/device versions, accessibility support,
withdrawal procedure, anonymization, raw-data custody outside Git, weighted-mean
calculation, qualitative coding approach, and defect/escalation handling.

The guided prototype may cover sign-in, a synthetic scan, dashboard review,
requisition, alert, transfer/audit inspection, and logout. It must not represent
synthetic outputs as real clinical recommendations.

#### TP-07 — Execute UAT only after gate approval

Only approved participants may perform the approved protocol. Raw responses,
identities, consent artifacts, recordings, and transcripts stay outside this
repository. The repository may later receive only approved anonymized aggregates,
instrument/version identifiers, sample size, limitations, and the accountable
review decision.

### 83 — Defect Remediation and Prototype Sign-off

#### TP-08 — Triage, remediate, and rerun

- Classify defects by severity, affected requirements, privacy/security impact,
  owner, disposition, fix commit, and rerun evidence.
- A failed security, authorization, prohibited-data, durability, or deterministic
  ledger test blocks phase acceptance.
- Scope changes require backlog selection and owner approval; they are not
  hidden inside test remediation.

#### TP-09 — Consolidate review and handoff

Lat records the accountable review after Jopia discloses technical
self-validation and Buno records UAT/data-analysis validation. The review lists
passes, failures, blocked/not-run cases, accepted limitations, deferred work,
and the disposition of every defect.

Testing-phase acceptance is prototype evidence only. Deployment remains a
separate, unauthorized gate.

## 5. Requirement traceability scope

| Requirement group | Required evidence | Limitation/gate |
|---|---|---|
| `FR-01`–`02`, `NFR-03`–`04` | Parser, confirmation, duplicate, FEFO, fallback, and physical synthetic-device evidence | Real labels and full ISBT compatibility remain blocked by `RQ-02` |
| `FR-03`–`04`, `FR-08`–`09`, `NFR-06`, `NFR-11` | Scoped inventory/alerts, expiry evaluation, accessibility, polling, and full commit-to-display timing | Clinical thresholds remain synthetic under `RQ-03` |
| `FR-05`–`07` | Request, RPS, BROA, FEFO, human approval, contention, tie, and explainability scenarios | Operational criteria remain blocked by `RQ-05`–`07` |
| `FR-10`–`11` | Dispatch, receipt, fallback, delay, resume, rejection, cancellation, and compromise custody evidence | Real location precision/retention and receipt policy remain blocked by `RQ-08`–`10` |
| `FR-12`, `NFR-01` | Six-role allow/deny, tenant isolation, revoked sessions, audit redaction, prohibited-field/data scan | Synthetic principals only |
| `FR-13`, `NFR-05` | Offline intake, ordering, exactly-once reconciliation, conflict, lease recovery, and projection-only retry | Project-scoped test outage only |
| `FR-14` | Lineage, time-ordered validation, simple baselines, reproducible metrics, stale/missing behavior | No operational accuracy conclusion while `RQ-07` is open |
| `NFR-02`, `NFR-08` | Fabric transaction references, authorization, invalid transitions, and deterministic replay | One-organization prototype |
| `NFR-07`, `NFR-09`–`12` | Local residency, pinned versions, checks, health/log redaction, keyboard/status evidence, stop/reset/recreate | Supported development environment only |
| `FR-15`–`16`, `NFR-13` | No executed evidence in this phase | `BL-TST-02` remains blocked by TP-G06 |

## 6. Evidence and defect records

Each executed test record includes:

- stable test ID and linked requirement/rule;
- baseline commit/tag and exact environment/tool versions;
- synthetic fixture/configuration ID, version, seed, and hash where applicable;
- preconditions, command or human procedure, and expected result;
- observed result and `PASS`/`FAIL`/`BLOCKED`/`NOT_RUN`;
- safe artifact reference or aggregate, execution time, owner, and validator;
- defect ID and fix/rerun reference when applicable; and
- limitation and claim boundary.

Each defect record includes stable ID, discovery date, severity, affected
requirements, safe reproduction, expected/actual behavior, privacy/security
impact, owner, status, disposition, fix commit, and rerun evidence. Defect
evidence must never contain credentials, prohibited data, raw research data,
raw location evidence, images, or OCR text.

## 7. Exit criteria

- `BL-TST-01` is complete only when every in-scope requirement has an explicit
  result and all failures have a recorded disposition and rerun where fixed.
- `BL-ALG-VAL-01` is complete only for the accepted synthetic scope and cannot
  close `RQ-05`–`07`.
- `BL-UAT-01` remains incomplete until approved participants complete the
  approved protocol and only authorized aggregate evidence is reviewed.
- `BL-TST-02` remains unselected and blocked.
- No critical security, privacy, authorization, durability, deterministic-ledger,
  or prohibited-data failure is accepted without remediation and passing rerun.
- Physical Android OCR and full `NFR-06` evidence are either passed with exact
  conditions or explicitly deferred with unchanged claim restrictions.
- Lat records the accountable review, incomplete-item disposition,
  retrospective, and next-phase decision.
- Passing this phase does not authorize production, clinical use, regulatory
  acceptance, or deployment.

## 8. Checkpoint commits

1. `docs(testing): authorize formal validation plan`
2. `test(system): add requirement traceability and defect contracts`
3. `test(system): record clean regression and integrated evidence`
4. `test(system): validate physical capture latency and recovery`
5. `test(algorithms): record synthetic forecast RPS and BROA scenarios`
6. `docs(uat): prepare gated participant protocol`
7. `fix(testing): remediate and rerun accepted defects`
8. `docs(testing): record review and phase disposition`

Every commit records the owner, phase, linked requirements/backlog IDs, and
`Classification: SIMULATION_ONLY` where applicable.

## 9. Risks and controls

| Risk | Required control |
|---|---|
| Elapsed Gantt dates are reported as completed work | Preserve original dates and record an owner-approved replacement window |
| Manuscript topology or four-tier wording drives tests | Test the accepted one-peer/six-role repository contracts |
| Automated checks are treated as UAT | Keep technical and participant evidence separate |
| Synthetic metrics are called clinical accuracy | Report simulation metrics and unresolved `RQ-*` gates |
| Participant or consent data enters Git | Store raw research artifacts with the approved external custodian only |
| Testing mutates the accepted baseline silently | Fix on a scoped branch, link defects, and rerun affected requirements |
| A blocked test is counted as passing | Use explicit four-state results and disclose all blockers |
| Testing acceptance is treated as deployment approval | Require a separate deployment plan and institutional gates |

## 10. Review record

Populate only after execution. Empty fields and unexecuted manuscript Result
columns are not evidence.

- Replacement window approval:
- UAT threshold/instrument decision:
- Participant/research authorization:
- Technical environment and baseline:
- Requirement results:
- Defect and rerun summary:
- Buno validation:
- Jopia validation and self-validation disclosure:
- Lat accountable decision:
- Incomplete-item disposition and retrospective:
