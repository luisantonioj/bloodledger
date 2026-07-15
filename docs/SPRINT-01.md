# Sprint 1 — Infrastructure Provisioning

**Status:** Approved; ready for infrastructure implementation

**Planning dates:** June 29–July 9, 2026

**Schedule authority:** `Updated_BloodLedger_Gantt.xlsx`
**Approval recorded:** 2026-07-13

The Gantt dates are the approved planning guide. Actual implementation and
validation dates depend on the team and are recorded separately in the Sprint
Review.

## 1. Sprint goal

Establish a reproducible local BloodLedger development environment in which
every team member can start, inspect, validate, stop, and reset PostgreSQL and a
single-organization Hyperledger Fabric development network using documented,
version-pinned commands.

## 2. Sprint 0 entry gate

Sprint 1 is approved to begin. The following decisions are recorded:

- the Sprint 0 repository baseline is accepted for implementation planning;
- ADR-001 through ADR-018 and ADR-020 through ADR-025 are accepted;
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
| Host | Windows 11 + WSL2 Ubuntu 24.04 LTS | S1-02 clean-host check |
| Docker bundle | Desktop 4.82.0 + Engine 29.6.1 + Compose 5.3.0 | S1-02 on remaining supported hosts |
| Scripts | Bash in WSL2 | S1-08 on every host |
| Package management | npm workspaces | S1-02/version evidence |
| Fabric | 2.5.16 LTS + Fabric CA 1.5.15 | S1-06/S1-07 |
| State database | LevelDB | S1-06 configuration inspection |
| PostgreSQL | 17.10; migration/bootstrap only | S1-04/S1-05 |
| Identity model | Fabric CA development identities | S1-06 and secret scan |
| Health transaction | Disposable infrastructure-only contract | S1-07 |
| DBeaver | Optional | Connection check only, if used |
| Spec Kit/custom skills | Deferred | Reconsider only after repeated need |
| Network identifiers and ports | `network/README.md` baseline; permit documented local overrides after collision check | Before Compose is finalized |
| PostgreSQL bootstrap | `database/README.md` baseline | S1-04/S1-05 |
| Reset safety | Three-tier policy in `docs/LOCAL-DEVELOPMENT.md` | S1-08/S1-09 |

## 8. Validation checklist

- [ ] Documentation baseline reviewed.
- [ ] Exact versions pinned and reproducible.
- [ ] Clean setup succeeds on each supported host.
- [ ] PostgreSQL health and query succeed.
- [ ] Fabric orderer, peer, and CA/identity path are healthy.
- [ ] Channel exists and peer membership is verified.
- [ ] Minimal invoke/query validation succeeds, if adopted.
- [ ] Normal restart preserves intended state.
- [ ] Explicit reset recreates a clean environment.
- [ ] No secret, private key, wallet, generated certificate, or real data is tracked.
- [ ] README quick start matches tested commands.
- [ ] Known failures and fixes are documented.
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

To be completed during Sprint 1:

- Review date:
- Actual implementation dates:
- Demonstrated by:
- Reviewed by:
- Environment(s):
- Passed exit criteria:
- Incomplete items:
- Evidence links:

## 12. Retrospective

To be completed during Sprint 1:

- What helped:
- What slowed us down:
- What we will change next sprint:
- New risks or decisions:
