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

## Selected operational stock preparation — 2026-10-08

The user's Jopia instruction selects TP-STOCK-01 under BL-TST-01 for
[controlled OCR population](OPERATIONAL-STOCK-POPULATION.md), based on PR26/27
and the retained institution integration. This authorizes implementation and
technical self-validation; actual population requires verified source/scenario,
target, preservation and FEFO checks. No Testing-phase exit or UAT gate closes.

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

## ML thesis follow-up — 2026-09-15

The user authorized [BL-ML-05 exploration](ML-THESIS-EXPLORATION.md) on
`codex/sprint-03-ml-exploration`, using only already supplied data. This permits
local data auditing, descriptive analysis and isolated synthetic model
comparisons. It does not constitute accountable-owner review, UAT execution,
TP-G05 closure or operational model promotion. The follow-up specification owns
its protocol and evidence; the accepted runtime remains the comparison baseline.


### Workbook v4 verification follow-up — 2026-09-16

BL-ML-05 now has frozen-release verification, external thesis tables/model card,
and an isolated accepted-runtime PostgreSQL/API replay. The evidence and two
small application compatibility fixes are recorded in
[ML thesis exploration](ML-THESIS-EXPLORATION.md#v4-verification-evidence).
The 20-series study remains offline; no operational forecast gate, UAT gate or
accountable review is closed by these checks.

## ML V5 backend follow-up — 2026-09-30

The user authorized Jopia-owned V5 backend implementation from PR #19. The [candidate integration contract](ML-RUNTIME-INTEGRATION-V5.md) and [implementation plan](ML-V5-JOPIA-IMPLEMENTATION-PLAN.md) track this work. V4 remains active until Buno calculation review, Lat frontend/browser validation, synthetic institution-binding decision and explicit activation. This does not close UAT or RQ-07.


## PR #21 Jopia review follow-up — 2026-10-01

The user authorized implementation of review findings plus the read-only internal
ML census API and independent Lat frontend consumer. [The integration contract](ML-RUNTIME-INTEGRATION-V5.md#pr-21-follow-up--independent-browser-inventory-evidence)
was updated before dependent evidence records. [Jopia self-validation](ML-V5-PR21-JOPIA-VALIDATION.md)
records the reviewed head, grouped commits, API/web/coordination checks, real
isolated producer/database/cookie/browser flow, security dispositions and
remaining gates. It does not close BL-TST-02, RQ-07, RQ-14, physical OCR, full
NFR-06 or human UAT. Lat retains resulting frontend review; Buno retains research
and UAT coordination. V4 remains default, with no concrete binding, activation,
DOH capture/export policy activation, autonomous recommendation or deployment.


## Lat PR #22 incorporation review — 2026-10-07

Lat's [authoritative frontend review and reruns](frontend/VALIDATION.md#lat-pr-22-incorporation-review--2026-10-07)
record accepted grouped fixes in PR #21, a scoped dependency audit fix, passing
API/web/coordination/static/security checks, 43 mocked browser passes with seven
existing skips, and disposable database evidence. Complete real producer →
cookie → browser acceptance is BLOCKED by unavailable external pinned model and
forecasting image; Jopia's previous success is not Lat's rerun. Both GitHub PRs
remain unmerged. SIMULATION_ONLY and binding/activation, RQ-07/RQ-14, UAT,
physical OCR and full Fabric-to-browser NFR-06 gates remain unchanged.

## Lat scoped frontend testing — 2026-10-07

The independent frontend slice on `codex/lat-testing-traceability` completes
selected TP-01/TP-03/TP-08 preparation, regression and remediation. The
[traceability register](TESTING-TRACEABILITY.md) links seven scenario groups;
the [defect register](TESTING-DEFECTS.md) records five fixed frontend findings.
[Lat's self-validation](frontend/VALIDATION.md#lat-testing-phase-frontend-regression--2026-10-07)
records 14 focused browser passes, 57 full mocked browser passes with seven
existing retired-fixture skips, 62 unit passes and applicable build,
repository/security checks. This scoped evidence does not complete BL-TST-01,
TP-02's full integrated baseline, human UAT or Testing-phase acceptance. Groupmate
handoff responses are reserved for subsequent work; real V5, physical OCR,
full Fabric-to-browser latency and owner/research gates remain open.
## Jopia PR #21 incorporation re-review — 2026-10-07

[Jopia’s source re-review, native validation and runtime handoff](ML-V5-PR21-JOPIA-VALIDATION.md#jopia-incorporation-re-review-and-runtime-prerequisites--2026-10-07)
record identical incorporated patches and implementation
`60fd148740c9ce45b379bec1633923fceef39d11`. Native prerequisite/regression,
117-test forecasting, census, producer and real cookie/Chromium checks passed.
The original frozen model and exact pinned image were recovered, verified,
exported and reimported; the external transfer package and safe aggregates are
recorded there. Current audit and secret scanning passed. Grouped publication
is tracked by the follow-up draft PR. These are Jopia’s disclosed self-validation;
prior owner evidence retains its attribution. Lat’s own real browser rerun and
frontend decision remain pending, so complete live V5 acceptance remains BLOCKED.
No Testing-phase exit, binding/activation, RQ-07/RQ-14 or UAT gate is closed.

## Lat real V5 runtime follow-up — 2026-10-07

[Lat's verified transfer and real rerun](frontend/VALIDATION.md#lat-verified-runtime-transfer-and-real-v5-rerun--2026-10-07)
passed at `b5601cc`: original model/image checks, native prerequisites, isolated
producer/database and official-cookie Chromium flow without interception.
The previously unavailable artifact blocker is resolved for this isolated
boundary. Twenty forecast series, forty census combinations, verified zeros,
scope, stale/failure and logout behavior pass under Lat self-validation. V4
remains default; all binding/activation, research/UAT, physical OCR, full
Fabric-to-browser latency and phase-acceptance gates remain unchanged.

## Lat local pre-handoff preparation — 2026-10-07

[The scoped review package](frontend/LAT-PRE-HANDOFF-REVIEW.md) reconciles current
V5 and migration statuses with Lat's own passing real rerun, records exact fix
revisions and preserves requirement-level incomplete boundaries. Final web
regression passed 57 cases with seven retired V1 skips; capture passed build,
14 units and three Desktop Chromium synthetic-OCR cases. Physical Android,
V2 offline replay, full Fabric-to-browser latency, integrated phase regression
and UAT remain unexecuted or gated. Publication and groupmate handoff are not
performed; accountable phase acceptance and TP-G01–06 remain open.
## Historical synthetic inventory verification

Jopia owns source validation, deterministic generation, gateway authorization, durable recovery, direct Fabric validation and DBeaver reconciliation for the [historical import](HISTORICAL-SYNTHETIC-INVENTORY.md). Buno confirms the external source/date. Self-validation is disclosed; no source import, UAT, clinical acceptance or model activation is implied by implementation tests.

On 2026-10-07, the user supplied the selection review for that source date. Live
historical-import acceptance passed: all 20 original count rows reconciled to 486
available and 36 reserved constructed components, with 524 directly verified VALID
Fabric transactions and 522 completed-view rows. An environment restart interrupted
the import; the durable queue resumed the saved submission under its original
transaction ID and completed without duplicate component or transaction references.
The operational prototype record remained unchanged. Jopia self-validation is
disclosed; this evidence applies only to the selected synthetic snapshot and does
not close UAT, clinical/privacy gates or forecast activation.

## Persistent development environment verification

The authorized [persistent-data integration](PERSISTENT-SYNTHETIC-DEVELOPMENT.md) adds retained-environment verification to existing disposable test evidence. Jopia must disclose self-validation; Lat's independent local execution remains a separate result. This extension does not authorize human UAT, clinical policy or deployment.


Jopia's retained-host execution on 2026-10-07 passed the scoped integration at
`fee83dc`: real synthetic OCR intake, directly verified operational and historical
Fabric evidence, interrupted submission/projection recovery, safe replay, official
cookie browser inspection and ordinary restart. The authoritative results,
limitations and executable Lat handoff are in
[the persistent development runbook](PERSISTENT-DEVELOPMENT-RUNBOOK.md#verification-evidence).
This is disclosed Jopia self-validation. Lat's local re-import and six-account
preservation require local reproduction; no UAT or Testing-phase exit is claimed.

## Selected institution-account implementation — 2026-10-08

The user's subsequent Jopia blocker-repair instruction selects TP-STOCK-01
host recovery. The exact two-account Jopia baseline is handled through the
[versioned mapping](INSTITUTION-ACCOUNTS.md#jopia-two-account-baseline-recovery--2026-10-08),
separately from Yuri/Lat's six-actor target. Account migration preserves original
credential and domain evidence; actual population still requires an approved
OCR execution manifest. CRYO identity lookup reads all accepted component
types under the existing installed actor/gateway checks; the new local package
version is `institution-accounts-v2`. Immutable policy files, clinical write
authority, endorsement, retained namespaces, V4 default and V5 approval gates
remain unchanged. Record self-validation and Lat's independent acceptance
separately; no Testing-phase exit is claimed.

Jopia explicitly authorized [PR #24 account implementation](INSTITUTION-ACCOUNTS.md)
from retained integration `daf4ada29b5a0346a804815817fde64f4893a390`. This selects
BL-WEB-01 remediation, BL-API-02 backend onboarding and synthetic BL-TST-02
authorization tests under PA-ACCOUNT-01/02. Lat owns BL-WEB-05/06 frontend
integration and independent rerun. TP-G06 is relaxed solely for approved
synthetic backend evidence; full web/onboarding acceptance, institutional RQ-14,
UAT, clinical gates and Testing-phase exit remain open. Results are recorded
only after execution, with disclosed Jopia self-validation.


## Controlled operational population T0 verification — 2026-10-09

TP-STOCK-01 technical acceptance on Jopia's reviewed retained target passed:
522 added / 531 total operational units, 559 original VALID Fabric commitments,
ledger/PostgreSQL/authenticated API reconciliation, original preservation and
actual fixed-window forty-row T0 capture. Ordinary infrastructure/service
restart preserved the original census ID/capture/digest/all rows, complete
receipts and CURRENT inventory-evidence API. Results, exact hashes, tested
commands and scoped checks are in the
[Jopia timed evidence](handoffs/JOPIA-STOCK-HOST-RECOVERY-2026-10-08.md#fixed-window-t0-acceptance--2026-10-09).
This is **SIMULATION_ONLY / JOPIA_SELF_VALIDATION**. Lat's independent detail
navigation, pending/error states, scope/logout/restart acceptance remain
NOT_RUN. V4 remains default; V5 persistence/binding/job approval is separate.
This technical pass does not close BL-TST-02, RQ decisions, UAT, physical OCR,
full latency, clinical/deployment gates or Testing-phase exit.


## Lat retained stock-population package follow-up — 2026-10-09

The user authorized Jopia to review PR27/PR30, prepare a preservation-safe local
population package, coordinate new Buno dates/hashes and publish grouped work.
This extends selected TP-STOCK-01 preparation under BL-TST-01; it does not mark
Lat's population or any Testing gate complete. The [population contract](OPERATIONAL-STOCK-POPULATION.md#lat-retained-target-successor-review--2026-10-09)
owns successor-review/recovery controls. [The target-specific handoff](handoffs/JOPIA-TO-LAT-POPULATION-PACKAGE-2026-10-09.md)
records prerequisites, evidence, exact commands and unresolved inputs. A new
Buno scenario/verifier and actual Lat target/preview/execution review remain
required before local submission. Jopia self-validation and Lat local validation
are recorded separately; V4 stays default and V5 approval remains separate.

Buno's [V2 scenario evidence](handoffs/BUNO-OPERATIONAL-STOCK-522-V2-EVIDENCE.md)
publishes the proposed successor window, pinned hashes and local software
validation. This completes artifact preparation only; Jopia's review of the
successor and actual Lat target, followed by explicit execution confirmation,
remains required. No target population or Testing gate is accepted by this record.

## Jopia UAT backend hardening — 2026-10-09

Under the user's Jopia instruction, TP-08 remediation on `codex/jopia-uat-backend`
fixes [TP-JOP-D01–D03](TESTING-DEFECTS.md#jopia-backend-findings--2026-10-09):
stable framework 4xx codes, a 300-second server-clock bound on new V2 command
times (retries and exact approved population operations exempt), and peer-only
recovery from a stale Docker socket mount. The
[contract note](handoffs/JOPIA-TO-LAT-UAT-BACKEND-CONTRACT-2026-10-09.md) records
the frontend handling, the proposed J4 expiry state and the checks run. This is
**JOPIA_SELF_VALIDATION**: Lat's browser rerun and live retained-host deployment are
NOT_RUN. No chaincode, policy, lifecycle, UAT or exit gate changes.

J4 then adds read-time `expiryState` and an operator-verified
`POST /api/v2/components/{id}/expiry` that queues the existing deterministic
`EVALUATE_COMPONENT_EXPIRY` with a server evaluation time (D04, API side), and
makes reconciliation retries replay (D08). Live submission waits for J5 because
Jopia's retained general worker is disabled. D05–D07 remain open. The contract
note's data-timing check shows Jopia's retained reservations expire before
2026-10-12 while Buno's V2 data on Lat's host stays valid; this is an input to the
unrecorded UAT host decision.

J5 then ran a live V2 custody rehearsal on Jopia's retained host
([record](handoffs/JOPIA-J5-LIVE-CUSTODY-REHEARSAL-2026-10-09.md)): transfer through
OCR receipt, local release, cancellation, compromise, J4 expiry with alert
acknowledgement, and a live J3 rejection all PASS, with 18 VALID Fabric
transactions. It found and fixed TP-JOP-D09 (receipt payload) and recorded D10
(no reconciliation resolve route) and D11 (unpatched `fast-jwt` on retained
runtimes). Browser timing, Lat's UI and UAT remain NOT_RUN.

Jopia decided on 2026-10-09 that Lat's retained host is the UAT host and that the
UAT script needs issue #36. Its backend part is ported:
`BL-DEC-S6-2026-09-23-01` compromise vocabulary is enforced by the API before
queuing (chaincode check deferred), and UAT places reconciliation holds only (D10
deferred). D05 and D06 are fixed. Lat's issue #36 UI work and the UAT runbook (J9)
remain open.

J9 preparation: the [UAT host runbook](UAT-RUNBOOK.md) covers the timeline, backup,
baseline deploy with `npm ci`, the guarded worker (`uat-worker.sh`), the dry-run
checklist, the Monday 07:00 go/no-go and incident handling, with each command
marked Validated or NOT_RUN. It fixed TP-JOP-D12 (capture PWA not served on
retained hosts). Requesting-hospital receipt and the end-to-end capture scan are
still NOT_RUN live, and the expiry action cannot be demonstrated with V2 data
before 2026-10-13. The dry run itself remains NOT_RUN.
