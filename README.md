# BloodLedger

BloodLedger is a research prototype for real-time blood inventory coordination
and traceable inter-hospital redistribution in Lipa City. The planned system
combines barcode/QR scanning, an on-premise PostgreSQL application store, a
permissioned Hyperledger Fabric ledger, demand forecasting, explainable
redistribution recommendations, and a web dashboard.

## Current status

The repository is in the **Sprint 0 planning baseline**. No application or
infrastructure implementation has started.

The documents have been drafted from the revised manuscript, updated research
proposal, summary of revisions, and updated Gantt workbook. Sprint 0 becomes
formally complete when all proponents review the baseline, resolve the Sprint 1
schedule, and accept the entry gate in `docs/SPRINT-01.md`.

## Prototype scope

- Mary Mediatrix Medical Center is the sole operational Fabric peer organization
  and inventory-holding primary institution in the initial prototype.
- Secondary institutions use the application to request and track transfers.
- PRC Lipa and DOH CHD Calabarzon have read-only application access.
- The system stores operational blood-unit and custody metadata only.
- Patient records, donor names, PHI, blood disposal, continuous GPS tracking,
  cold-chain sensing, and autonomous transfer approval are out of scope.
- The topology is designed for future expansion but is not a deployed
  multi-organization consortium.

## Planned technology direction

- React web application
- Node.js application/API
- PostgreSQL application database, read model, and durable sync queue
- Hyperledger Fabric ledger and deterministic chaincode
- Python forecasting/recommendation service
- Docker Compose local environment

Exact versions will be tested and pinned in Sprint 1; repository documentation
must not depend on an unspecified "latest" version.

## Documentation map

| Document | Purpose |
|---|---|
| [Project context](docs/PROJECT.md) | Vision, institutions, users, scope, constraints, terminology, and risks |
| [Requirements](docs/REQUIREMENTS.md) | Roles, functional requirements, business rules, states, NFRs, traceability, and open questions |
| [Architecture](docs/ARCHITECTURE.md) | Components, data ownership, Fabric topology, synchronization, security, and decisions |
| [Product backlog](docs/BACKLOG.md) | Prioritized outcomes and sprint roadmap |
| [Sprint 1 plan](docs/SPRINT-01.md) | Infrastructure sprint entry gate, tasks, decisions, validation, and exit criteria |
| [Agent instructions](AGENTS.md) | Task-based reading map and repository rules for AI-assisted work |

## Source-of-truth rule

Each fact should have one authoritative home:

- scope and vocabulary → `docs/PROJECT.md`;
- required behavior → `docs/REQUIREMENTS.md`;
- structural decisions → `docs/ARCHITECTURE.md`;
- future work → `docs/BACKLOG.md`; and
- selected work → the current sprint document.

When documents disagree, do not choose silently. Record the contradiction and
obtain the required decision.

## Planned repository structure

```text
bloodledger/
├── README.md
├── AGENTS.md
├── docs/
├── apps/web/               # Sprint 5
├── services/api/           # Sprint 4/5
├── services/forecasting/   # Sprint 3
├── chaincode/              # Sprint 2+
├── database/               # Sprint 1+
├── network/                # Sprint 1+
├── scripts/                # Sprint 1+
└── tests/                  # grows with each sprint
```

Directories and implementation files will be created only when their sprint
begins. This avoids presenting placeholders as completed work.

## Before Sprint 1

The proponents must:

1. review the four baseline documents and backlog;
2. confirm the one-organization Fabric topology;
3. accept or amend ADR-001 through ADR-007;
4. resolve the Gantt/manuscript Sprint 1 date conflict;
5. assign Sprint 1 owners and reviewers; and
6. approve the Sprint 1 entry and exit criteria.

## Setup

There are no setup commands yet because implementation has not begun. Tested,
version-pinned setup and validation commands are Sprint 1 deliverables. Do not
copy commands from a sample network into this README until they work against the
repository-owned BloodLedger environment.

## Security and research-data notice

Do not commit real patient, donor, employee, interview, survey, hospital
inventory, credential, certificate, private-key, or location data. Development
uses synthetic fixtures unless an explicitly approved anonymized dataset is
introduced under a documented research-data process.
