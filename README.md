# BloodLedger

BloodLedger is a research prototype for real-time blood inventory coordination
and traceable inter-hospital redistribution in Lipa City. The planned system
combines barcode/QR scanning, an on-premise PostgreSQL application store, a
permissioned Hyperledger Fabric ledger, demand forecasting, explainable
redistribution recommendations, and a web dashboard.

## Current status

The Sprint 0 baseline and Sprint 1 planning decisions are approved. Sprint 1 is
complete under the assigned-owner validation policy: the
repository foundation, PostgreSQL migration baseline, one-organization Fabric
development network, development channel, disposable health contract, and
S1-08 operational command interface are implemented, Jopia's canonical-host
evidence is recorded, and Jopia accepted the Sprint Review on 2026-07-30.
Additional Buno or Lat host evidence is optional. Sprint 2 is complete and was
accepted by Jopia on 2026-07-30 under versioned synthetic prototype
assumptions. Sprint 3 is now an isolated Jopia-owned ML experiment using
`SYNTHETIC_FORECAST_V1`: it forecasts requested demand for the Sprint 2 subset
and persists only `SIMULATION_ONLY` outputs with operational recommendation
eligibility disabled. This is a research prototype, not a production or
clinically validated system.

The roadmap now includes invitation-based institutional application and
administrator activation for later API/web sprints. Application approval is
separate from Fabric membership and does not change the one-organization
prototype topology.

Sprint 2 was completed under the versioned `SYNTHETIC_INVENTORY_V1` prototype
assumptions while Mediatrix data-gathering approval is pending. The values are
non-clinical software-test inputs and must be superseded rather than silently
edited when approved institutional evidence arrives.

The documents have been drafted from the revised manuscript, updated research
proposal, summary of revisions, and updated Gantt workbook. Sprint 0 becomes
formally complete with the decisions recorded in `docs/ARCHITECTURE.md` and the
entry gate in `docs/SPRINT-01.md`.

## Prototype scope

- Mary Mediatrix Medical Center is the sole operational Fabric peer organization
  and inventory-holding primary institution in the initial prototype.
- Secondary institutions use the application to request and track transfers.
- PRC Lipa and DOH CHD Calabarzon have read-only application access.
- The system stores operational blood-unit and custody metadata only.
- Patient records, donor names, PHI, blood disposal, continuous GPS tracking,
  cold-chain sensing, and autonomous transfer approval are out of scope.
- OCR is under consideration as a later alternative or supplement to barcode/QR
  label capture. It is not part of Sprint 1 and is not yet an approved
  replacement for ISBT 128-compatible scanning.
- The topology is designed for future expansion but is not a deployed
  multi-organization consortium.

## Technology direction

- Windows 11 with WSL2 Ubuntu and canonical Bash scripts
- Docker Desktop with its bundled Engine and Compose plugin
- Hyperledger Fabric LTS with Fabric CA
- Node.js with npm workspaces and one root lockfile
- PostgreSQL
- Python 3.13 for the active Sprint 3 forecasting experiment
- React for the later Sprint 5 web application

DBeaver is optional database-inspection tooling. It is not needed by the
runtime or repository-foundation checks.

Exact approved targets, compatibility notes, and selection sources live only in
`docs/ARCHITECTURE.md` Section 3. Sprint 1 records effective host versions and
deviations separately.

## Documentation map

| Document | Purpose |
|---|---|
| [Project context](docs/PROJECT.md) | Vision, institutions, users, scope, constraints, terminology, and risks |
| [Requirements](docs/REQUIREMENTS.md) | Roles, functional requirements, business rules, states, NFRs, traceability, and open questions |
| [Architecture](docs/ARCHITECTURE.md) | Components, data ownership, Fabric topology, synchronization, security, and decisions |
| [Product backlog](docs/BACKLOG.md) | Prioritized outcomes and sprint roadmap |
| [Sprint 1 plan](docs/SPRINT-01.md) | Infrastructure sprint entry gate, tasks, decisions, validation, and exit criteria |
| [Sprint 2 record](docs/SPRINT-02.md) | Accepted deterministic inventory-ledger scope, evidence, and review |
| [Sprint 3 experiment](docs/SPRINT-03.md) | Simulation-only forecast scope, gates, tasks, and exit obligations |
| [Local development](docs/LOCAL-DEVELOPMENT.md) | Planned WSL2 workflow, version evidence, reset safety, and troubleshooting |
| [Fabric network](network/README.md) | Network identifiers, ports, CA identities, generated material, and health contract |
| [Development database](database/README.md) | PostgreSQL roles, migrations, simulation forecast schema, and persistence |
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
├── chaincode/              # Sprint 2 inventory contract
├── database/               # Sprint 1+
├── network/                # Sprint 1+
├── scripts/                # Sprint 1+
└── tests/                  # grows with each sprint
```

Operational directories may contain planning documentation before implementation.
Configuration, scripts, migrations, contracts, and application files are added
only when their sprint work is authorized and validated.

## Sprint 1 readiness

The team has approved:

1. the Gantt schedule of June 29–July 9, 2026;
2. the one-organization Fabric topology;
3. ADR-001 through ADR-018 and ADR-020 through ADR-028;
4. the version targets and WSL2/Bash workflow;
5. the migration/bootstrap-only PostgreSQL scope;
6. Sprint 1 assigned-owner validation and accountable-owner exit criteria.

The actual implementation and validation dates are recorded in the sprint
header and Sprint Review.

## Local development quick start

Use Bash inside WSL2 Ubuntu 24.04 from a working copy in the WSL Linux
filesystem. Copy `.env.example` to untracked `.env`, fill the five local
password values, install the exact lockfile, and run:

```bash
npm ci --ignore-scripts
scripts/bloodledger-dev.sh doctor
scripts/bloodledger-dev.sh bootstrap
scripts/bloodledger-dev.sh status
scripts/bloodledger-dev.sh stop
```

Normal start and stop preserve state. Reset confirmation tokens, dry-run
procedures, service-specific logs, and troubleshooting are documented in
`docs/LOCAL-DEVELOPMENT.md`. Fabric identifiers and database rules remain
authoritative in `network/README.md` and `database/README.md`.

## Security and research-data notice

Do not commit real patient, donor, employee, interview, survey, hospital
inventory, credential, certificate, private-key, or location data. Development
uses synthetic fixtures unless an explicitly approved anonymized dataset is
introduced under a documented research-data process.
