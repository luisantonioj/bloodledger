# Sprint 1 — Infrastructure Provisioning

**Status:** Implementation complete on Jopia host; cross-machine validation and
Sprint Review in progress

**Planning dates:** June 29–July 9, 2026

**Schedule authority:** `Updated_BloodLedger_Gantt.xlsx`
**Approval recorded:** 2026-07-13
**Implementation-readiness decisions recorded:** 2026-07-15
**Actual implementation start:** 2026-07-15
**Infrastructure implementation completed:** 2026-07-16
**Independent repository audit:** 2026-07-30

The Gantt dates are the approved planning guide. The actual implementation
start is recorded above; remaining execution and validation dates depend on the
team and are recorded separately in the Sprint Review.

## 1. Sprint goal

Establish a reproducible local BloodLedger development environment in which
every team member can start, inspect, validate, stop, and reset PostgreSQL and a
single-organization Hyperledger Fabric development network using documented,
version-pinned commands.

## 2. Sprint 0 entry gate

Sprint 1 is approved to begin. The following decisions are recorded:

- the Sprint 0 repository baseline is accepted for implementation planning;
- ADR-001 through ADR-018 and ADR-020 through ADR-029 are accepted;
- the team agrees that PRC and DOH are read-only application users in the
  initial topology;
- prohibited data and the one-organization prototype limitation are understood;
- this sprint's goal, scope, acceptance criteria, owners, and Gantt dates are
  accepted;
- Windows 11, WSL2, Ubuntu 24.04 LTS, and Bash form the canonical workflow;
- LevelDB, npm workspaces, Fabric CA, the migration-only PostgreSQL baseline,
  infrastructure-only health contract, network identifiers, identity model,
  and reset-safety policy are selected; and
- no secrets or institutional production data are placed in the repository.

OCR is recorded as a proposed alternative or supplement to barcode/QR capture.
It does not change Sprint 1 and must be evaluated before Sprint 4. Algorithm
weights, API endpoints, UI design, and feature-level rules also do not block
Sprint 1.

## 3. Included work

- Confirm and pin supported host/runtime/tool versions.
- Establish repository directories and workspace/package conventions.
- Define safe environment-variable templates and Git exclusions.
- Provision local PostgreSQL.
- Provision one Mary Mediatrix Fabric development organization and peer.
- Provision a development orderer and CA/identity process.
- Create the BloodLedger development channel.
- Deploy, invoke, and query a disposable infrastructure-only health contract.
- Establish the migration mechanism and a minimal bootstrap migration; do not
  create the complete application schema or feature business behavior.
- Add start, stop, health, log, and reset procedures.
- Validate the process on every supported team machine.
- Record review evidence, problems, decisions, and retrospective actions.

## 4. Excluded work

- Inventory or transfer business chaincode.
- BROA, RPS, forecasting, geo-tagging, or expiry business logic.
- Scan parsing and offline synchronization behavior.
- REST feature endpoints or authentication workflows.
- React feature screens.
- Production deployment or multi-organization endorsement claims.
- Real hospital, patient, donor, staff, or research-participant data.

## 5. Sprint tasks

### S1-01 — Confirm sprint plan and owners

**Backlog:** BL-INF-01  
**Output:** Accepted scope, dates, owners, and demonstration plan

Acceptance:

- Planning dates and actual execution dates are recorded separately.
- Jopia is the accountable owner and Buno and Lat are reviewers.
- Blockers and external approvals are visible.

### S1-02 — Select and pin the environment matrix

**Backlog:** BL-INF-01  
**Approved targets:** `docs/ARCHITECTURE.md` Section 3.1

Acceptance:

- Approved targets are installed or any necessary deviation is recorded as an
  architecture decision.
- Versions are mutually compatible and tested, not labeled "latest."
- Version files and documentation report the same values.
- Optional GUI tools such as DBeaver are distinguished from runtime needs.

### S1-03 — Establish repository and security rules

**Backlog:** BL-INF-01

Acceptance:

- Planned directories have documented ownership and activation sprint.
- `.gitignore` excludes environment secrets, generated identities, wallets,
  private keys, logs, build output, and local database volumes.
- `.env.example` contains names and safe examples only.
- A secret scan finds no credential or generated private key.

### S1-04 — Provision PostgreSQL

**Backlog:** BL-INF-03

Acceptance:

- PostgreSQL starts with a health check and non-production credentials.
- Connection works from documented CLI/tooling and optionally DBeaver.
- Data persists across normal restart and is removed only by explicit reset.

### S1-05 — Establish migration and bootstrap baseline

**Backlog:** BL-INF-03  
**Architecture:** ADR-017

Acceptance:

- A minimal bootstrap migration applies from empty state and reports its status.
- The complete domain tables are not created in Sprint 1.
- Any development seed data is synthetic and used only when needed to validate
  migration behavior.
- Reapplying or rolling forward has documented behavior.

Domain migrations begin only after their relevant requirements and column-level
design are approved. A manuscript diagram is not sufficient authority to guess
columns.

### S1-06 — Provision the Fabric development network

**Backlog:** BL-INF-02  
**Architecture:** ADR-001, ADR-002, ADR-007

Acceptance:

- One Mary Mediatrix development organization/peer and a development orderer
  are healthy.
- Identity/MSP and TLS material are generated reproducibly and remain untracked.
- The network is clearly labeled development-only.

### S1-07 — Create channel and connectivity validation

**Backlog:** BL-INF-02

Acceptance:

- The peer joins the approved development channel.
- Channel and peer information can be queried.
- The disposable infrastructure health contract can be installed, invoked, and
  queried and contains no BloodLedger feature logic.

### S1-08 — Add operational commands

**Backlog:** BL-INF-04

Acceptance:

- Start, stop, status/health, logs, and reset actions are documented.
- Commands are non-interactive where practical and fail with useful messages.
- Reset requires explicit intent and affects only project-owned resources.

### S1-09 — Validate clean setup

**Backlog:** BL-INF-04

Acceptance:

- Each proponent validates on a supported machine or records a blocker.
- Evidence includes version output, service health, channel query, PostgreSQL
  query, restart, and reset/recreate results.
- Setup instructions are corrected from the validation evidence.

### S1-10 — Review and retrospective

**Backlog:** BL-INF-04

Acceptance:

- The team demonstrates the sprint exit criteria.
- Incomplete items return to the backlog with cause and owner.
- Decisions and troubleshooting lessons update authoritative documentation.

## 6. Ownership matrix

The ownership mapping refines the Gantt's broader assignments. Jopia is
accountable for every Sprint 1 task; Buno and Lat review the work and evidence.

| Task | Accountable | Reviewer/participants |
|---|---|---|
| S1-01 Sprint plan | Jopia | Buno and Lat |
| S1-02 Environment matrix | Jopia | Buno and Lat |
| S1-03 Repository/security rules | Jopia | Buno and Lat |
| S1-04 PostgreSQL | Jopia | Buno and Lat |
| S1-05 Migration/bootstrap | Jopia | Buno and Lat |
| S1-06 Fabric network and CA | Jopia | Buno and Lat |
| S1-07 Channel/health contract | Jopia | Buno and Lat |
| S1-08 Operational commands | Jopia | Buno and Lat |
| S1-09 Cross-machine validation | Jopia | Buno and Lat |
| S1-10 Review/retrospective | Jopia | Buno and Lat |

## 7. Approved decisions and validation obligations

| Decision | Approved selection | Validation due |
|---|---|---|
| Sprint dates | June 29–July 9, 2026 planning guide | Record actual execution dates in review |
| Host and tool versions | `docs/ARCHITECTURE.md` Section 3.1 | S1-02 clean-host and compatibility checks |
| Scripts | Bash in WSL2 | S1-08 on every host |
| Package management and migration tools | ADR-015, ADR-022, and ADR-027 | S1-02/S1-05 lockfile and migration evidence |
| Fabric topology, orderer bootstrap, consensus, and state database | ADR-001, ADR-002, ADR-008, ADR-029, and `network/README.md` | S1-06/S1-07 |
| Identity model | ADR-016, ADR-021, and `network/README.md` | S1-06 and secret scan |
| Health transaction and node health | ADR-018, ADR-023, ADR-026, ADR-028, and `network/README.md` | S1-06/S1-08 |
| PostgreSQL bootstrap | ADR-017, ADR-022, and `database/README.md` | S1-04/S1-05 |
| Secret scanner | ADR-027 and `docs/LOCAL-DEVELOPMENT.md` | S1-02/S1-03/S1-09 |
| Network identifiers and ports | ADR-020 and `network/README.md` | Before Compose is finalized |
| Reset safety | ADR-024 and `docs/LOCAL-DEVELOPMENT.md` | S1-08/S1-09 |
| DBeaver | Optional | Connection check only, if used |
| Spec Kit/custom skills | Deferred | Reconsider only after repeated need |

## 8. Validation checklist

- [x] Documentation baseline reviewed.
- [x] Exact versions pinned and reproducible on Jopia's supported host.
- [ ] Clean setup succeeds on each supported host.
- [x] PostgreSQL health and query succeed on Jopia's supported host.
- [x] Fabric orderer, peer, and CA/identity path are healthy on Jopia's
  supported host.
- [x] Channel exists and peer membership is verified on Jopia's supported host.
- [x] Minimal invoke/query validation succeeds on Jopia's supported host.
- [x] Normal restart preserves intended state on Jopia's supported host.
- [x] Explicit reset recreates a clean environment on Jopia's supported host.
- [x] No secret, private key, wallet, generated certificate, or real data is
  tracked at audited revision `dcfff71b57cda1daaf01a1a1c490217485c3cfea`.
- [x] README quick start matches Jopia-host tested commands.
- [x] Known failures and fixes observed on Jopia's host are documented.
- [ ] Sprint review evidence and retrospective are recorded.

## 9. Sprint exit criteria

Sprint 1 is complete only when a team member can start from the documented
prerequisites and independently:

1. clone the repository;
2. create local configuration from the safe template;
3. start PostgreSQL and the Fabric development network;
4. verify service health, the channel, and a minimal query/transaction;
5. stop and restart without unintended loss;
6. perform an explicit project-scoped reset; and
7. confirm that no secrets or generated identity material are tracked.

The final command names will be written during Sprint 1 after they are tested.
This planning document intentionally does not invent commands that do not yet
exist.

## 10. Risks and mitigations

| Risk | Mitigation in this sprint |
|---|---|
| Cross-platform Fabric setup fails | Declare one supported host policy, validate early, document deviations |
| Generated crypto is committed | Git exclusions plus automated secret/private-key scan |
| Single peer is presented as a consortium | Use the wording in ADR-001 and PROJECT.md |
| Reset deletes unrelated data | Scope resources by project and require explicit confirmation |
| Full schema design delays infrastructure | Use the approved bootstrap-only migration baseline; defer domain columns |
| Version drift | Pin versions and record validation outputs |

## 11. Review record

- Review date: Pending final team review; independent repository audit completed
  2026-07-30.
- Actual implementation dates: 2026-07-15 through 2026-07-16.
- Demonstrated by: Jopia on the supported host recorded below.
- Reviewed by: Pending Buno and Lat evidence review and final team acceptance.
- Passed exit criteria: Proven on Jopia's supported host; not yet proven on every
  proponent host as required by S1-09.
- Incomplete items: concise safe validation summaries for Buno and Lat, any
  evidence-driven corrections, and the S1-10 review/retrospective acceptance.

### Host validation results

| Validator | Environment and effective versions | Result | Blocker/deviation and safe evidence summary | Reviewed |
|---|---|---|---|---|
| Jopia | Windows 11 `22631.6199`; WSL `2.7.10.0`/Ubuntu `24.04.4`; Docker Desktop `4.82.0`, Engine `29.6.1`, Compose `5.3.0`; Node `24.17.0`/npm `11.13.0`; Fabric `2.5.16`, Fabric CA `1.5.15`; PostgreSQL `17.10` | Proven on supported host, 2026-07-16 | Revision `c8443bcdbf542d6021635bc793dd44df5a38238c`; WSL filesystem path; default loopback ports; bootstrap/status, PostgreSQL roles and migration, channel/lifecycle, committed event/query probe, normal restart, Level 1 preservation/recreation, Level 2 empty-state recreation, and Gitleaks passed. Git `2.43.0` is the recorded compatible deviation. Docker Desktop initially was not open; opening it resolved the prerequisite without a project change. | Pending |
| Buno | Initial supported-laptop setup reported complete; exact environment and versions not recorded | Partially proven | Repository audit did not find a safe host summary. Record the tested revision, versions, working-copy path, command results, restart/reset outcomes, secret-scan digest, and any deviation. A Codex account is not required. | Pending |
| Lat | Initial supported-laptop setup reported complete; exact environment and versions not recorded | Partially proven | Repository audit did not find a safe host summary. Record the tested revision, versions, working-copy path, command results, restart/reset outcomes, secret-scan digest, and any deviation. A Codex account is not required. | Pending |

### Independent audit results — 2026-07-30

The audit inspected revision
`dcfff71b57cda1daaf01a1a1c490217485c3cfea`. It did not implement corrections,
bootstrap services, or perform a destructive reset.

| Task | Classification | Evidence |
|---|---|---|
| S1-01 | Proven | Approved scope, dates, ownership, blockers, and demonstration obligations are recorded in this document. |
| S1-02 | Partially proven | `npm run check:foundation` and `scripts/bloodledger-dev.sh doctor` passed with pinned versions on Jopia's host. Buno and Lat version summaries remain absent. |
| S1-03 | Proven | Foundation ignore/template checks passed; `npm run scan:secrets` scanned 17 commits plus index and candidate content with Gitleaks `8.30.1` at the ADR-027 digest and found no leaks; tracked-path inspection found no generated identity or private-key path. |
| S1-04 | Proven | Commit `6549264`, the static database check, and the 2026-07-16 Jopia-host PostgreSQL health, role, query, persistence, and recreation evidence. |
| S1-05 | Proven | Commit `6549264`, `npm run check:database`, and recorded apply/status/reapply/recreate evidence prove one bootstrap migration and zero domain tables. |
| S1-06 | Proven | Commits `64a3406`, `8a3fd42`, and `0ca3fa6`; Fabric identity/node static checks passed; Jopia-host health and recreation evidence is recorded above. |
| S1-07 | Proven | Commits `8fcbfda`, `fd7ff18`, and `6f73956`; channel and health-contract checks passed; all eight deterministic, authorization, duplicate, boundary, and exclusion tests passed. |
| S1-08 | Proven | Commits `bc62acc` and `c8443bc`; static and command-behavior tests passed; both reset previews enumerated only approved project resources without changing them. |
| S1-09 | Partially proven | Jopia's supported-host validation is proven. Buno and Lat reported initial runs, but their required safe summaries are not recorded. |
| S1-10 | Not proven | Final demonstrator/reviewer acceptance, incomplete-item disposition, and retrospective remain open. |

### Exit-criterion audit

All seven exit actions are proven by Jopia's 2026-07-16 supported-host evidence:
configuration from the safe template, bootstrap, consolidated health and query,
restart preservation, project-scoped resets and recreation, and secret scanning.
The repository history establishes the cloneable revision. Sprint completion
nevertheless remains open because S1-09 separately requires evidence from each
proponent and S1-10 requires final review.

The 2026-07-30 live read-only audit ran `doctor` successfully. Consolidated
`status` correctly failed because the current local `peer0-mediatrix` container
was absent while other services were present. This is current local runtime
state, not a contradiction of the recorded 2026-07-16 clean-host evidence; no
bootstrap or reset was performed to alter it.

## 12. Retrospective

- What helped: one repository-level command interface, pinned dependencies and
  images, deterministic health-contract tests, explicit reset tokens, and
  concise troubleshooting records made Jopia-host evidence reproducible.
- What slowed us down: Docker Desktop availability, idempotent probe reuse,
  temporary CA client state, reset-volume validation, and treating Codex access
  as if it were required for human host validation.
- What we will change next sprint: define the evidence summary before execution,
  collect each owner's safe results immediately, and keep implementation,
  independent audit, and human acceptance as distinct gates.
- New risks or decisions: Buno and Lat do not need Codex accounts to validate.
  Their retained screenshots may support concise summaries but are not committed
  by default; missing checklist evidence is rerun only on the affected host.
