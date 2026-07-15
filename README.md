# BloodLedger

BloodLedger is a research prototype for real-time blood inventory coordination
and traceable inter-hospital redistribution in Lipa City. The planned system
combines barcode/QR scanning, an on-premise PostgreSQL application store, a
permissioned Hyperledger Fabric ledger, demand forecasting, explainable
redistribution recommendations, and a web dashboard.

## Current status

The Sprint 0 baseline and Sprint 1 planning decisions are approved. Sprint 1
implementation started on 2026-07-15 with the repository foundation. No
PostgreSQL or Fabric services, migrations, chaincode, or application behavior
have been implemented yet.

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
- Python for the later Sprint 3 forecasting service
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
| [Local development](docs/LOCAL-DEVELOPMENT.md) | Planned WSL2 workflow, version evidence, reset safety, and troubleshooting |
| [Fabric network](network/README.md) | Network identifiers, ports, CA identities, generated material, and health contract |
| [Development database](database/README.md) | PostgreSQL roles, environment names, migration baseline, and persistence |
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
6. Sprint 1 owners, validation obligations, and exit criteria.

The actual implementation start is recorded in the sprint header. Remaining
execution and validation dates are recorded separately in the Sprint Review.

## Repository-foundation validation

With the approved Node.js and npm versions active, install the exact locked
packages and run the repository checks:

```bash
npm ci --ignore-scripts
npm run check:foundation
npm run scan:secrets
```

The secret scan requires Docker access and uses the official Gitleaks container
pinned in the repository. These commands validate only the S1-02/S1-03
repository foundation; they do not start or validate PostgreSQL or Fabric.
Service setup commands remain later Sprint 1 deliverables and must not be copied
from a sample network.

The intended workflow, identifiers, database decisions, and safety boundaries
are documented in `docs/LOCAL-DEVELOPMENT.md`, `network/README.md`, and
`database/README.md`.

## Security and research-data notice

Do not commit real patient, donor, employee, interview, survey, hospital
inventory, credential, certificate, private-key, or location data. Development
uses synthetic fixtures unless an explicitly approved anonymized dataset is
introduced under a documented research-data process.
