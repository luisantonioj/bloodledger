# Sprint 1 — Infrastructure Provisioning

**Status:** Planned; pending team acceptance  
**Source schedule:** Updated Gantt lists June 29–July 9, 2026  
**Note:** The manuscript says June 29–July 7, and Sprint 2 begins July 8. The team
must publish one non-overlapping operational schedule before starting.

## 1. Sprint goal

Establish a reproducible local BloodLedger development environment in which
every team member can start, inspect, validate, stop, and reset PostgreSQL and a
single-organization Hyperledger Fabric development network using documented,
version-pinned commands.

## 2. Sprint 0 entry gate

Sprint 1 may begin when:

- `docs/PROJECT.md`, `docs/REQUIREMENTS.md`, `docs/ARCHITECTURE.md`, and
  `docs/BACKLOG.md` are reviewed by all proponents;
- ADR-001 through ADR-007 are accepted;
- the team agrees that PRC and DOH are read-only application users in the
  initial topology;
- prohibited data and the one-organization prototype limitation are understood;
- this sprint's goal, scope, acceptance criteria, owners, and dates are accepted;
- Docker/WSL2 or supported host prerequisites can be investigated safely; and
- no secrets or institutional production data are placed in the repository.

The algorithm weights, API endpoints, UI design system, and feature-level rules
do not block Sprint 1. They must be resolved before their relevant sprints.

## 3. Included work

- Confirm and pin supported host/runtime/tool versions.
- Establish repository directories and workspace/package conventions.
- Define safe environment-variable templates and Git exclusions.
- Provision local PostgreSQL.
- Provision one Mary Mediatrix Fabric development organization and peer.
- Provision a development orderer and CA/identity process.
- Create the BloodLedger development channel.
- Deploy/invoke/query only a minimal infrastructure health contract if needed.
- Establish migration/seed mechanisms and a reviewed infrastructure schema
  baseline; do not implement feature business behavior.
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

- The schedule no longer overlaps Sprint 2.
- Each task has one accountable owner and at least one reviewer.
- Blockers and external approvals are visible.

### S1-02 — Select and pin the environment matrix

**Backlog:** BL-INF-01  
**Decisions:** package manager, Node.js, Python, Fabric, Fabric CA, Docker,
PostgreSQL, host OS/WSL2 policy, LevelDB/CouchDB

Acceptance:

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

### S1-05 — Establish migration and seed baseline

**Backlog:** BL-INF-03  
**Dependency:** approved column-level schema subset

Acceptance:

- Migrations apply from empty state and report their version.
- Development seed data is synthetic and contains no prohibited information.
- Reapplying or rolling forward has documented behavior.

The task may create infrastructure-only tables first if the full application
schema is not ready. It must not guess columns from a diagram.

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
- A minimal health contract/transaction, if used, is explicitly disposable and
  contains no BloodLedger feature logic.

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

## 6. Architecture decisions due during Sprint 1

| Decision | Owner | Deadline | Blocking task |
|---|---|---|---|
| Final sprint dates | Scrum team | Before S1-02 | All |
| Host OS and WSL2 policy | Infrastructure owner | S1-02 | S1-04/S1-06 |
| Exact version matrix | Infrastructure owner | S1-02 | S1-04/S1-06 |
| Node package manager/workspace | Development team | S1-02 | Repository setup |
| LevelDB or CouchDB | Blockchain owner | Before S1-06 | Fabric Compose |
| Development CA and identity lifecycle | Blockchain owner | Before S1-06 | Fabric network |
| PostgreSQL schema subset | Data owner | Before S1-05 | Migrations |
| Ports and environment names | Infrastructure owner | Before Compose | All services |

## 7. Validation checklist

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

## 8. Sprint exit criteria

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

## 9. Risks and mitigations

| Risk | Mitigation in this sprint |
|---|---|
| Cross-platform Fabric setup fails | Declare one supported host policy, validate early, document deviations |
| Generated crypto is committed | Git exclusions plus automated secret/private-key scan |
| Single peer is presented as a consortium | Use the wording in ADR-001 and PROJECT.md |
| Reset deletes unrelated data | Scope resources by project and require explicit confirmation |
| Full schema design delays infrastructure | Use an approved minimal migration baseline; defer domain columns rather than guessing |
| Version drift | Pin versions and record validation outputs |

## 10. Review record

To be completed during Sprint 1:

- Review date:
- Demonstrated by:
- Reviewed by:
- Environment(s):
- Passed exit criteria:
- Incomplete items:
- Evidence links:

## 11. Retrospective

To be completed during Sprint 1:

- What helped:
- What slowed us down:
- What we will change next sprint:
- New risks or decisions:
