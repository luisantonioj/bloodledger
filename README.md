# BloodLedger

BloodLedger is a research prototype for real-time blood inventory coordination
and traceable inter-hospital redistribution in Lipa City. The planned system
combines mobile OCR with barcode/2D-code fallback, an on-premise PostgreSQL application store, a
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
assumptions. Jopia accepted Sprint 3 on 2026-08-16 after reviewing its final
evidence on the isolated experiment branch. The forecasting, transfer,
dispatch/receipt location evidence, FEFO/RPS, and BROA vertical slice remains
governed by immutable synthetic policies. Forecasts and algorithm results remain
`SIMULATION_ONLY` with operational recommendation eligibility disabled. This is
a research prototype, not a production or clinically validated system.

Sprint 4 is authorized on `codex/sprint-04-scan-middleware`. It adds an
installable mobile capture PWA, on-device synthetic-label OCR with mandatory
confirmation, a durable PostgreSQL scan queue, Node.js middleware/Fabric
reconciliation, and read-only forecast freshness. Raw label images do not leave
the device, and real-label/ISBT and operational-use claims remain blocked.

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
- Sprint 4 accepts on-device OCR as the primary synthetic-label flow, with
  Code 128/Data Matrix and synthetic QR fallback. This does not establish full
  ISBT 128 compatibility or authorize real institutional label capture.
- The topology is designed for future expansion but is not a deployed
  multi-organization consortium.

## Technology direction

- Windows 11 with WSL2 Ubuntu and canonical Bash scripts
- Docker Desktop with its bundled Engine and Compose plugin
- Hyperledger Fabric LTS with Fabric CA
- Node.js with npm workspaces and one root lockfile
- PostgreSQL
- Python 3.13 for the Sprint 3 forecasting experiment
- React for the Sprint 4 capture PWA and later Sprint 5 web application

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
| [Sprint 3 continuation](docs/SPRINT-03.md) | Transfer, location, optimization, forecasting, gates, and exit obligations |
| [Sprint 4 plan](docs/SPRINT-04.md) | Mobile OCR, durable scan synchronization, API/forecast interfaces, validation, and acceptance gates |
| [Local development](docs/LOCAL-DEVELOPMENT.md) | Planned WSL2 workflow, version evidence, reset safety, and troubleshooting |
| [Fabric network](network/README.md) | Network identifiers, ports, CA identities, generated material, and health contract |
| [Development database](database/README.md) | PostgreSQL roles, migrations, forecast/location/algorithm simulation schema, and persistence |
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
├── apps/capture-pwa/       # Sprint 4 mobile capture
├── apps/web/               # Sprint 5
├── services/api/           # Sprint 4 scan/sync/forecast slice; expanded later
├── services/forecasting/   # Sprint 3
├── services/coordination/  # Sprint 3 location/RPS/BROA worker
├── chaincode/              # Sprint 2 inventory + Sprint 3 transfer contracts
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

Sprint 4 remains isolated in its own worktree. After the normal bootstrap,
populate the additional empty `SPRINT4_OPERATOR_CREDENTIAL` and
`SPRINT4_JWT_SECRET` entries in that worktree's untracked `.env`, then use the
focused commands:

```bash
npm run check:capture
npm run test:capture
npm run check:api
npm run test:api
npm run test:api:database
docker compose --profile sprint4 up --detach --build api sync-worker
```

Sprint 5 adds a focused dashboard development server:

```bash
npm run check:web
npm run test:web
npm run dev --workspace @bloodledger/web
```

The development dashboard is available at `http://127.0.0.1:5174`. The built
API image uses one loopback origin instead: dashboard at `/`, capture at
`/capture/`, and the versioned API at `/api/v1` on port `3000` by default.
Live login still requires migrated PostgreSQL state and separately provisioned
opaque synthetic accounts.

The JWT secret must contain at least 32 characters and the synthetic operator
credential at least 12. Neither value belongs in Git, logs, screenshots, or
Sprint evidence. The API is host-loopback-bound by default.

## Security and research-data notice

Do not commit real patient, donor, employee, interview, survey, hospital
inventory, credential, certificate, private-key, or location data. Development
uses synthetic fixtures unless an explicitly approved anonymized dataset is
introduced under a documented research-data process.
