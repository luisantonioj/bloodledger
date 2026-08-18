# BloodLedger System Architecture

**Status:** Validated baseline with authorized Sprint 4 synthetic capture/API implementation
**Baseline date:** 2026-08-17
**Scope:** Research prototype, not a production deployment design

## 1. Architecture goals

1. Preserve inventory events during connectivity interruptions.
2. Enforce deterministic and auditable inventory/custody transitions.
3. Keep patient and donor information outside every system boundary.
4. Support a single operational institution now without preventing future
   multi-organization Fabric expansion.
5. Separate operational query performance from immutable audit evidence.
6. Keep forecasting and recommendation logic reproducible and explainable.
7. Make the local environment safe to start, inspect, stop, and reset.

## 2. Context and trust boundaries

```text
Users, mobile capture PWA, and optional 2D-code fallback
        |
        v
React web application
        |
        v
Node.js application/API boundary
   |              |                 |
   v              v                 v
PostgreSQL   Fabric Gateway   Python forecasting and
read model        |           TypeScript coordination workers
and queue         v                 |
          Hyperledger Fabric       v
          (deterministic)      PostgreSQL / model artifacts

Workers never call Fabric; chaincode never calls workers or PostgreSQL.
```

Trust boundaries exist between the browser and API, API and database, API and
Fabric Gateway, organization identities and Fabric, and the application and ML
service. Authentication at one boundary does not replace authorization at the
next boundary.

## 3. Technology direction

| Area | Baseline choice | Status |
|---|---|---|
| Web | React 19.2.x, component-based web application | Accepted |
| Application/API | Node.js 24 LTS; TypeScript preferred; REST-style HTTP API | Accepted |
| Application data | PostgreSQL | Accepted |
| Ledger | Hyperledger Fabric 2.5 LTS permissioned network | Accepted |
| Chaincode | Node.js/TypeScript-compatible Fabric contract modules | Accepted |
| Forecasting | Python 3.13 service/worker | Accepted |
| Containers | Docker Compose for local prototype services | Accepted |
| Tests | JavaScript/TypeScript test runner compatible with the selected stack; Python test runner for ML | Accepted |
| Capture device | Mobile browser/camera PWA with on-device OCR primary for synthetic fixtures; Code 128/Data Matrix/synthetic QR fallback | Accepted for Sprint 4 simulation under ADR-019/PA-S4-01 |
| Fabric state database | LevelDB for the initial prototype | Accepted |
| Package manager | npm workspaces with one committed lockfile | Accepted |
| Development host | Windows 11 with WSL2 and Ubuntu 24.04 LTS; Bash is canonical | Accepted |

### 3.1 Approved version targets

The manuscript's minimums were reviewed on 2026-07-13. These are approved
targets. ADR-025 accepts the Docker bundle verified on Jopia's host on
2026-07-15. Sprint 1 task `S1-02` records actual command output on the assigned
owner's canonical supported host. Other-machine results are optional portability
evidence unless a selected task explicitly requires them.

| Software | Approved target | Manuscript value | Decision |
|---|---:|---:|---|
| Windows host | Windows 11, supported release | Windows 10/11 | Prefer Windows 11 for the team baseline |
| WSL | WSL2 | Not specified | Canonical Linux execution environment |
| Ubuntu | 24.04.4 LTS | Not specified | Stable WSL distribution with long support horizon |
| Docker Desktop | 4.82.0 | Not specified | Verified Windows packaging and WSL2 integration baseline on Jopia's host |
| Docker Engine | 29.6.1 | 24.x or higher | Bundled with Docker Desktop 4.82.0 and verified with Fabric images |
| Docker Compose | 5.3.0 | 2.20.x or higher | Use the Docker Desktop plugin, not a separate legacy binary |
| Hyperledger Fabric | 2.5.16 LTS | 2.5.x LTS | Stay on the LTS line used by the manuscript |
| Fabric CA | 1.5.15 | Not specified | Matches the Fabric 2.5 installation documentation |
| Node.js | 24.17.0 LTS | 18.x LTS | Node 18 is EOL; use the supported LTS line |
| npm | 11.13.0 bundled with Node 24.17.0 | Not specified | Avoid an additional package-manager dependency |
| `node-pg-migrate` | 8.0.4 | Not specified | Sprint 1 migration runner; pin exactly in the root lockfile |
| `pg` | 8.22.0 | Not specified | Direct PostgreSQL driver required by the migration workspace; pin exactly in the root lockfile |
| PostgreSQL | 17.10 | 15.x or higher | Mature supported major through 2029 |
| Git | 2.55.0 target; minimum 2.30 | 2.30.x or higher | Record each host's verified version |
| Gitleaks | 8.30.1 | Not specified | Run the official pinned container image for Git history plus tracked/staged content; record the resolved image digest during S1-02 |
| Python | 3.13.14 | Not specified | Conservative supported line for later ML work |
| Fabric Gateway client | `@hyperledger/fabric-gateway` 1.11.0 | Fabric SDK Node 2.5.x | Use the Gateway client API, not the legacy SDK label |
| React | 19.2.8 | 18.x or higher | Sprint 4 capture PWA; exact version locked and build-verified |
| Fastify / static plugin | 5.10.0 / 10.1.3 | Not specified | Sprint 4 HTTP boundary; static plugin security update supersedes the initially selected 9.1.3 |
| Tesseract.js | 7.0.0 | Not specified | On-device synthetic OCR under `PA-S4-01`; worker/core/language assets are served locally at runtime |
| ZXing browser | 0.2.1 | Not specified | Code 128/Data Matrix/synthetic QR fallback decoder |
| Vite / PWA plugin | 8.1.5 / 1.3.0 | Not specified | Sprint 4 PWA build and offline application shell |
| Playwright | 1.61.1 | Not specified | Automated browser/offline evidence; does not replace physical Android evidence |
| Browser | Vendor-supported Chrome or Edge; record exact UAT build | Chrome/Edge 115+ | Browser auto-updates make a fixed early planning build misleading |

Docker Desktop bundles Engine and Compose components. The accepted Jopia-host
combination is Docker Desktop `4.82.0`, Engine `29.6.1`, and Compose `5.3.0`.
Any additionally validated host must record its installed bundle output and
must not mix independently installed Compose binaries.
Later-sprint libraries remain planning targets until their sprint validates the
complete dependency graph.

### 3.2 Version-selection sources

- Hyperledger Fabric installation and version parameters:
  <https://hyperledger-fabric.readthedocs.io/en/release-2.5/install.html>
- Hyperledger Fabric peer/orderer operations health service:
  <https://hyperledger-fabric.readthedocs.io/en/release-2.5/operations_service.html>
- Hyperledger Fabric LTS policy and releases:
  <https://github.com/hyperledger/fabric>
- Fabric Gateway Node client:
  <https://www.npmjs.com/package/@hyperledger/fabric-gateway>
- Node.js supported releases:
  <https://nodejs.org/en/about/previous-releases>
- PostgreSQL version support:
  <https://www.postgresql.org/support/versioning/>
- `node-pg-migrate` package:
  <https://www.npmjs.com/package/node-pg-migrate>
- `pg` package:
  <https://www.npmjs.com/package/pg>
- Gitleaks releases and official container:
  <https://github.com/gitleaks/gitleaks/releases>
- Docker Desktop release notes:
  <https://docs.docker.com/desktop/release-notes/>
- Python releases: <https://www.python.org/downloads/>
- React versions: <https://react.dev/versions>
- Fastify static plugin compatibility and releases:
  <https://github.com/fastify/fastify-static>
- Fastify static path-normalization security advisory:
  <https://github.com/fastify/fastify-static/security/advisories/GHSA-8pvw-jcv7-9cmj>
- Git releases: <https://git-scm.com/>
- Ubuntu lifecycle: <https://ubuntu.com/about/release-cycle>

## 4. Initial repository boundaries

```text
bloodledger/
├── README.md
├── AGENTS.md
├── docs/
├── apps/
│   ├── capture-pwa/         # activated in Sprint 4
│   └── web/                 # activated in Sprint 5
├── services/
│   ├── api/                 # activated in Sprint 4/5
│   └── forecasting/         # activated in Sprint 3
├── chaincode/               # activated in Sprint 2
├── database/
│   ├── migrations/
│   └── seeds/
├── network/                 # Sprint 1 Fabric configuration, lifecycle scripts,
│   └── health-contract/     # and disposable infrastructure-only health contract
├── scripts/                 # repository-level developer operations
└── tests/
```

Sprint 1 may refine names, but a change to component boundaries requires an
updated architecture decision.

The disposable Sprint 1 health contract belongs below
`network/health-contract/`, not below the Sprint 2 domain `chaincode/` boundary.
It remains a separately named infrastructure probe and is never extended into
`InventoryContract` or `TransferContract`.

### 4.1 Directory ownership and activation

Jopia is accountable for and validates repository-boundary changes during
Sprint 1. Buno and Lat may review those changes and their evidence, but their
review is not an acceptance gate. Later sprint accountability must be confirmed
by the relevant sprint plan before a deferred directory is activated.

| Directory/component | Activation | Sprint 1 accountable/validator |
|---|---|---|
| `docs/` | Sprint 0 onward | Jopia |
| `database/` | Sprint 1 migration baseline; domain migrations later | Jopia |
| `network/` | Sprint 1 | Jopia |
| `network/health-contract/` | Sprint 1 only as a disposable infrastructure contract | Jopia |
| `scripts/` | Sprint 1 | Jopia |
| `tests/` | Sprint 1 onward, growing with each activated component | Same assigned owner as the component under test |
| `chaincode/` | Sprint 2 | Deferred to the Sprint 2 ownership plan |
| `services/forecasting/` | Sprint 3 simulation slice | Jopia (owner and validator; self-validation disclosed) |
| `services/api/` | Sprint 4 synthetic scan/sync/forecast slice; expanded later | Jopia (owner and validator; self-validation disclosed) |
| `apps/capture-pwa/` | Sprint 4 synthetic mobile capture | Jopia (owner and validator; self-validation disclosed) |
| `apps/web/` | Sprint 5 | Deferred to the Sprint 5 ownership plan |

For the canonical WSL2 workflow, the implementation working copy should be
cloned inside the WSL Linux filesystem (for example under `/home/<user>/`) rather
than developed through `/mnt/c`, unless validation demonstrates an acceptable
reason to retain a Windows-filesystem working copy.

## 5. Component responsibilities

### 5.1 Web application

- Renders access-controlled inventory, request, alert, transfer, and audit views.
- Renders invitation-based institutional application, applicant status,
  administrator review, activation, suspension, and institution/user management
  views only in the activating web sprint.
- Captures scans and permitted device location evidence through the browser/API.
- Clearly distinguishes local/pending, committed, stale, offline, failed, and
  conflicted state.
- Does not connect directly to PostgreSQL or Fabric.

The Sprint 4 capture PWA is deliberately narrower than the Sprint 5 web
application. It performs OCR/2D-code decoding on-device, keeps images and raw OCR
text volatile, persists only confirmed allowlisted synthetic fields for offline
retry, and displays scan synchronization state.

### 5.2 Node.js application/API

- Authenticates sessions and enforces role plus institution authorization.
- Owns off-chain institutional invitation, application, review, activation,
  suspension, applicant-status, and institution-account administration
  workflows.
- Keeps pending applicants outside operational tenant access and prevents
  applicant or affiliated-administrator self-approval.
- Validates request payloads using field allowlists.
- Owns orchestration, idempotency, correlation IDs, and transaction status.
- Writes durable local events before attempting ledger submission where needed.
- Uses Fabric Gateway to evaluate and submit transactions.
- Reconciles committed events into the PostgreSQL read model.
- Invokes or reads forecast/recommendation outputs.
- Runs scheduled expiry evaluation; chaincode itself is never a scheduler.

### 5.3 PostgreSQL

PostgreSQL is both the application database/read model and the durable offline
event queue. These are distinct logical responsibilities represented by
separate tables and transaction rules.

It stores users, institutions, institutional invitations/applications and
review evidence, configuration, dashboard projections, requests,
notifications, forecast outputs, and synchronization metadata. It is not the
authoritative immutable history for accepted inventory and custody mutations.

### 5.4 Hyperledger Fabric

- Validates authorized inventory and transfer state changes.
- Prevents duplicate assets and invalid transitions.
- Preserves accepted business events and their audit metadata.
- Emits domain events used to update projections.
- Does not call databases, HTTP services, map services, or ML models.
- Does not use a local clock, random values, or non-deterministic iteration.

### 5.5 Forecasting and recommendation worker

- Loads approved historical and operational data from the application boundary.
- Cleans data with reproducible lineage and data-quality reports.
- Trains/evaluates the approved baseline and candidate models.
- Writes versioned forecasts and predicted surplus values.
- Computes explainable BROA/RPS results off-chain.
- Submits an approved result and its immutable input/configuration digest for
  validation and recording; it does not mutate custody on its own.

## 6. Data ownership

| Data | Authoritative source | PostgreSQL role | On chain? |
|---|---|---|:---:|
| User accounts, password hashes, sessions | PostgreSQL/identity layer | Primary | No |
| Institutional invitations, applications, decisions, and verification references | PostgreSQL/identity layer | Primary | No |
| Institution profiles and facility coordinates | PostgreSQL configuration | Primary | Identifier/reference only if required |
| Pending offline events | PostgreSQL queue | Primary until resolved | No, until accepted |
| Blood-unit registration and custody events | Fabric ledger | Read projection and correlation | Yes |
| Current ledger asset state | Fabric world state | Query projection | Yes |
| Transfer request draft | PostgreSQL | Primary until submitted/approved | Usually no |
| Accepted transfer/custody transitions | Fabric ledger | Read projection | Yes |
| Notifications | PostgreSQL | Primary | No |
| Forecast training records | Approved research/application store | Curated data | No |
| Forecast results and metrics | PostgreSQL/model storage | Primary | No |
| Approved recommendation evidence | Fabric ledger | Full explanation in PostgreSQL | Digest/core evidence only |
| Audit transaction reference | Fabric ledger | Searchable index | Yes/reference |
| Patient, donor, diagnosis, treatment data | Not stored | Prohibited | No |

The ledger is not used as a general-purpose document database. On-chain schemas
must minimize data and use an explicit allowlist.

## 7. Conceptual PostgreSQL model

The manuscript names six core tables. The proposal additionally requires
forecast data, while offline resilience requires durable event state. The
baseline logical model is therefore:

| Table/domain | Purpose |
|---|---|
| `institutions` | Participating and modeled facilities, category, status, facility coordinates |
| `institution_applications` | Versioned invitation-based submissions, review decisions, reasons, and prior-application link |
| `institution_invitations` | Single-use invitation digest, allowed category/scope, status, and expiry |
| `users` | Application identity, role, institution, status, password hash/identity mapping |
| `blood_units` | Query projection of unit metadata, custody, lifecycle, ledger version |
| `transfer_requests` | Request details, urgency, ranking inputs, workflow state |
| `transfers` | Selected units, sender/receiver, lifecycle, location evidence references |
| `sync_events` | Durable local event payload, idempotency key, sequence, retry/conflict state |
| `ledger_transactions` | Fabric transaction ID, correlation ID, commit status, block/time reference |
| `notifications` | Alerts and user acknowledgement state |
| `demand_forecasts` | Versioned forecasts, inputs window, prediction, metrics, stale status |
| `location_evidence` | Synthetic dispatch/receipt exact-point evidence with enforced expiry; digest only on chain |
| `algorithm_runs` | BROA/RPS input snapshot, normalized scores, weights, result, version |
| `audit_logs` | Application/security audit events that do not duplicate the ledger |

This is a conceptual schema, not authorization to create all domain migrations.
Sprint 1 creates the migration mechanism and a minimal bootstrap migration used
to prove apply/status/recreate behavior. It does not create the complete domain
schema or the manuscript's six application tables before their column-level
requirements, privacy classification, keys, constraints, and ownership are
approved. Synthetic institution seed data may be added only if required to
validate the migration mechanism.

Required cross-cutting fields include stable IDs, institution scope, created and
updated timestamps, correlation and idempotency IDs, version/concurrency value,
and status. All stored timestamps use UTC.

Onboarding records use opaque public application/institution IDs. Invitation
secrets are stored only as digests. Verification documents are not stored in
the initial design; only a type, outcome, reviewer, UTC time, and safe reference
are retained. Column-level retention and indexing remain gated by `RQ-14` and
the activating API sprint.

## 8. Fabric network baseline

### 8.1 Prototype topology

- One operational member organization representing Mary Mediatrix Medical
  Center.
- One peer for the organization in the local prototype.
- One technical ordering organization (`OrdererMSP`) with one development
  ordering node/service; it is not a second hospital consortium member.
- One channel for BloodLedger prototype transactions.
- Separate Mediatrix and ordering-organization Fabric CAs as documented in
  `network/README.md`.
- TLS and MSP identities appropriate to the supported local environment.
- PRC, DOH, and secondary institutions access the application; they do not host
  peers or endorse transactions in the initial scope.

This is a single-operational-member Fabric prototype. It must not be described
as a live decentralized consortium deployment.

### 8.2 Expansion topology

Future primary blood-bank institutions may receive independent organizations,
CAs, peers, operational ownership, and multi-organization endorsement policies.
Their onboarding requires governance, certificate lifecycle, backup, monitoring,
channel, privacy, and endorsement decisions not implemented in Sprint 1.
Ordinary application approval or activation is not this Fabric onboarding
process and cannot invoke Fabric CA, channel, peer, chaincode lifecycle, or
endorsement administration.

### 8.3 Contract boundaries

Begin with one deployable chaincode package containing coherent contract modules:

- `InventoryContract` for registration and unit lifecycle; and
- `TransferContract` for requests selected for ledger recording and custody.

Sprint 3 upgrades the same package to definition version `0.2.0`, sequence `2`.
`TransferContract` atomically validates FEFO reservation and custody state.
Location capture, RPS, BROA, and forecasting remain outside endorsement. The
contract receives only approved result/input digests and minimal dispatch or
receipt evidence, never exact coordinates or model execution.

An expiry scheduler, ML model, BROA computation, RPS computation, and external
location lookup do not run inside chaincode. Chaincode validates submitted state,
authorization, configuration version/digest, and permitted transitions.
Chaincode-sensitive operations independently validate the approved
institution/caller authorization mapping; they never trust application
activation alone or query the onboarding database. Updating that mapping is an
explicit governed deployment/configuration action, not a side effect of
application approval.

Sprint 2 replaceable inventory values live in one immutable machine-readable
policy artifact packaged with the chaincode. Assets and events store its policy
version. A changed allowlist or threshold creates a new policy and chaincode
definition version/sequence; it does not edit the old policy or reinterpret
existing expiry timestamps. Structural authorization, privacy, determinism,
idempotency, concurrency, and audit rules are not configurable assumptions.

## 9. Synchronization design

1. The application assigns an idempotency key and correlation ID at capture.
2. A local database transaction validates and durably queues the event.
3. A worker claims events in stable institution/sequence order.
4. Fabric submission uses the stable business identifier and validates current
   world-state version.
5. Commit status is observed before an event is marked committed.
6. A committed ledger event updates the PostgreSQL read model idempotently.
7. Projection failure is retried without resubmitting the ledger mutation.
8. A stale or conflicting event is quarantined for explicit review.

The application never reports a local pending event as ledger-confirmed.

## 10. API design rules

- Version application endpoints under a stable prefix such as `/api/v1`.
- Use JSON schemas and a consistent error envelope.
- Require an idempotency key on mutation endpoints where client retry is likely.
- Return correlation ID and transaction status for traceability.
- Use `202 Accepted` for asynchronous ledger operations when commit is pending.
- Keep authorization server-side even if the UI hides an action.
- Do not expose raw private keys, certificates, internal database IDs, or Fabric
  connection material.
- Produce a machine-readable OpenAPI document before the API implementation
  sprint; it is not required for Sprint 1 infrastructure.
- Keep institutional application endpoints separate from operational endpoints.
  Applicant credentials may access only their own application status until
  activation.
- Treat approval, activation, rejection, withdrawal, suspension, reactivation,
  and role assignment as separate idempotent, version-checked mutations with
  stable safe errors.

## 11. Security and privacy

### 11.1 Required controls

- Field allowlists for on-chain and off-chain domain payloads.
- Password hashing using a reviewed password-hashing algorithm.
- Short-lived authenticated sessions/tokens and secure cookie/header handling.
- Role and institution authorization at API and chaincode boundaries.
- TLS for network communication outside isolated local test traffic.
- Secret injection through untracked environment/secret files.
- No generated private key or enrolled wallet material committed to Git.
- Parameterized database access and schema validation.
- Correlation-aware security and business audit logs with redaction.
- Dependency, static, and secret scanning in later CI.

### 11.2 Location data

Location evidence is operationally sensitive. Store only dispatch/receipt points,
accuracy/source, time, facility match result, and fallback flag. Do not collect a
continuous route. Exact precision and retention require approval before Sprint 3.

`PA-S3-02` temporarily supplies a synthetic-only backend boundary: exact
invented dispatch/receipt points live in PostgreSQL for 30 days, while Fabric
records the evidence ID, digest, phase, capture time, source, facility-match
result, and fallback flag. Browser permission and capture UI remain deferred to
the API/web sprint. No route or continuous location series is collected.

### 11.3 Research data separation

Interview recordings, transcripts, consent forms, and UAT raw responses are
research data and do not belong in this application repository or database.
Only anonymized/approved fixtures and aggregate results may be added later.

## 12. Forecasting and algorithms

The proposal's simple stock-difference formula is a hypothesis, not a finalized
training transformation. Stock changes may contain replenishment, transfer,
expiry, and correction effects. A data-quality investigation must precede model
training.

The forecasting baseline should be compared with simple reproducible baselines
(for example naive and rolling-average methods) using time-ordered validation.
Metrics and operational thresholds must be accepted before claims of accuracy.

Initial proposed surplus form:

```text
predicted distributable surplus =
  current eligible stock
  - forecast demand over the approved protection horizon
  - approved safety allowance
  - approved minimum reserve
```

BROA and RPS configurations are versioned data. The manuscript's narrative
weights (`0.40/0.25/0.20/0.15`) conflict with pseudocode
(`0.50/0.30/0.20`) and neither set is accepted here. Stakeholders must approve
the final criteria, directions, normalization, weights, and test scenarios.

The Sprint 3 coordination worker applies `SYNTHETIC_OPTIMIZATION_V1` off-chain.
Its RPS/BROA runs are persisted with input/configuration hashes and explainable
contributions. A forecast may enter BROA only through an explicit
`scenario_mode=true` artifact and can produce only a
`DISABLED_UNAPPROVED_POLICY` simulation result. No algorithm command invokes
Fabric or approves a transfer.

## 13. Failure behavior and observability

| Failure | Required behavior |
|---|---|
| PostgreSQL unavailable | Reject new local capture safely; do not imply persistence |
| Fabric unavailable | Keep validated events queued; show degraded/offline status |
| Fabric commit succeeds, projection fails | Retry projection only; never resubmit the mutation |
| Duplicate submission | Return the existing result or deterministic duplicate error |
| State conflict | Quarantine and show a resolvable conflict; never last-write-wins silently |
| Forecast unavailable/stale | Display stale status and disable forecast-only recommendations |
| Location unavailable | Use approved facility fallback with flag or block the transition |
| Scheduler missed | Surface unhealthy/stale evaluation state; do not pretend chaincode ran |

Every service must expose a health signal. Logs must contain service, severity,
time, correlation ID, and safe event name without secrets or prohibited data.

## 14. Environments

| Environment | Purpose | Data |
|---|---|---|
| Local development | Individual setup and automated tests | Synthetic only |
| Shared integration | Team end-to-end validation | Synthetic/approved anonymized fixtures |
| UAT prototype | Guided stakeholder testing | Approved synthetic or anonymized data |
| Pilot/parallel validation | Separate future gate; not implied by Sprint 1 | Requires institutional and privacy approval |

## 15. Architecture decision register

| ID | Status | Decision | Rationale/consequence |
|---|---|---|---|
| ADR-001 | Accepted | Treat the current network as one operational Fabric organization/peer | Reconciles approved scope; PRC second peer statements are superseded for the prototype |
| ADR-002 | Accepted | PRC and DOH are read-only application users, not peer operators | Avoids unsupported endorsement/governance claims |
| ADR-003 | Accepted | PostgreSQL is application DB/read model plus distinct durable sync queue | Supports queries and offline operation without confusing authority |
| ADR-004 | Accepted | Fabric ledger owns accepted inventory/custody event history | Preserves immutable audit evidence |
| ADR-005 | Accepted | Forecasting, BROA, RPS, and scheduling run off-chain | Required for external data access, versioning, evaluation, and deterministic chaincode |
| ADR-006 | Accepted | Chaincode validates and records approved results/state transitions | Prevents autonomous external computation inside endorsement |
| ADR-007 | Accepted | One deployable chaincode package initially, separated into contract modules | Reduces early lifecycle complexity while preserving modularity |
| ADR-008 | Accepted | Use LevelDB for the initial prototype | No accepted requirement needs rich world-state JSON queries; avoids an unnecessary service |
| ADR-009 | Accepted | Backend uses an organizational Fabric service identity with authenticated user attribution | Avoids certificate-per-user complexity while preserving user audit attribution |
| ADR-010 | Accepted | Store UTC; render Asia/Manila | Makes ordering and cross-service timestamps consistent |
| ADR-011 | Accepted | Keep exact GPS off-chain where possible; record minimal verified evidence/digest on chain | Data minimization; final schema awaits location policy |
| ADR-012 | Accepted | Monorepo with web, API, ML, chaincode, network, database, and tests | Matches small team and coordinated prototype delivery |
| ADR-013 | Accepted | Refine the manuscript's four tiers into five application roles by adding a Secondary Hospital User | Secondary request/receipt permissions otherwise have no explicit role |
| ADR-014 | Accepted | Windows 11 + WSL2 Ubuntu 24.04 LTS is the canonical host; Bash is the canonical script language | Gives the Windows-based team one Linux-compatible Fabric workflow |
| ADR-015 | Accepted | Use npm workspaces and one lockfile | Lowest additional tooling burden for the team |
| ADR-016 | Accepted | Use Fabric CA for reproducible development identities | Aligns the prototype with MSP/X.509 identity concepts and future onboarding |
| ADR-017 | Accepted | Sprint 1 creates only a migration/bootstrap baseline, not the full domain schema | Avoids guessing Sprint 2–5 fields while still proving database reproducibility |
| ADR-018 | Accepted | Use a disposable infrastructure-only health contract in Sprint 1 | Proves install/invoke/query/commit without implementing inventory behavior |
| ADR-019 | Accepted | Use mobile on-device OCR as the primary Sprint 4 synthetic capture path, with mandatory exact validation/confirmation and Code 128/Data Matrix/synthetic QR fallback | Resolves `RQ-11` only under `PA-S4-01`; raw images/raw text remain volatile and `RQ-02` still blocks real-label or full ISBT claims |
| ADR-020 | Accepted | Use the Sprint 1 network identifiers, service names, and development ports in `network/README.md` | Gives Compose, Fabric, scripts, and evidence one stable naming vocabulary |
| ADR-021 | Accepted | Use separate Fabric CA administrators, node identities, channel administrators, and an organizational API service identity | Preserves least privilege and keeps end-user enrollment out of Sprint 1 |
| ADR-022 | Accepted | Use `node-pg-migrate`, a separate migration owner/runtime role, and an `app` schema bootstrap without domain tables or seeds | Proves repeatable migrations while deferring feature schema decisions |
| ADR-023 | Accepted | The disposable `HealthContract` records and reads deterministic probe IDs only | Proves chaincode lifecycle and ledger commitment without clocks or BloodLedger feature data |
| ADR-024 | Accepted | Use separate stop, network reset, and full development reset levels scoped to the BloodLedger Compose project and repository-owned generated paths | Prevents reset operations from deleting unrelated Docker or filesystem resources |
| ADR-025 | Accepted | Use Docker Desktop 4.82.0 with bundled Engine 29.6.1 and Compose 5.3.0 as the Sprint 1 effective baseline | Supersedes the 4.81.0 planning target after Jopia-host WSL integration, Fabric image, and disposable container verification; additional-host results are optional portability evidence |
| ADR-026 | Accepted | Place the disposable Sprint 1 `HealthContract` below `network/health-contract/`, outside the Sprint 2 domain `chaincode/` boundary | Keeps infrastructure validation code separate from inventory and transfer chaincode and resolves the Sprint activation ambiguity |
| ADR-027 | Accepted | Pin `node-pg-migrate` 8.0.4, `pg` 8.22.0, and Gitleaks 8.30.1 for Sprint 1 | Makes migration and secret-scan evidence reproducible; the npm packages use the one root lockfile and Gitleaks uses its official versioned container image |
| ADR-028 | Accepted | Use the Fabric operations `/healthz` endpoint on internal peer port 9443 and internal orderer port 8443, with no host publication | Supplies deterministic Compose health checks without expanding host bindings; operations TLS may be disabled only on the isolated development Compose network |
| ADR-029 | Accepted | Start the Fabric 2.5 orderer without a system channel by using `BootstrapMethod: none` and the channel participation model; use single-consenter Raft (`etcdraft`) when S1-07 creates the application channel | Lets S1-06 prove a healthy channel-less orderer without inventing a genesis block or entering S1-07; the mutually authenticated admin endpoint remains internal and unexposed |
| ADR-030 | Accepted | Keep institutional applications, approval, activation, users, sessions, and verification evidence off-chain; application activation is separate from deferred Fabric membership | Enables controlled application participation without weakening the single-Mediatrix-MSP prototype or coupling ordinary administration to CA, peer, channel, or endorsement changes |
| ADR-031 | Accepted | Isolate pending institutional domain decisions in immutable, versioned prototype-assumption artifacts; preserve the version on ledger events, datasets, and models and supersede prospectively | Allows implementation with synthetic evidence while data-gathering approval is pending without presenting assumptions as Mediatrix or clinical policy |
| ADR-032 | Accepted | Use an installable same-origin React PWA, Fastify API, PostgreSQL durable scan queue, and separate reconciliation worker for Sprint 4 | Keeps capture local, returns after durable intake, preserves honest states, and prevents browser/database/Fabric boundary collapse |
| ADR-033 | Accepted | Use a short-lived locally signed JWT for one opaque synthetic operator under `SYNTHETIC_API_AUTH_V1` | Exercises authentication/authorization without claiming Sprint 5 identity management or committing credentials |

## 16. Sprint 1 architecture gates

Sprint 1 was approved with ADR-001 through ADR-018 and ADR-020 through ADR-029.
ADR-019 is now accepted for the bounded Sprint 4 synthetic capture decision; it
does not retroactively change Sprint 1 evidence. Before infrastructure files are
considered complete, the team must verify:

- the approved target versions on the assigned owner's canonical supported
  host;
- the pinned migration packages and official Gitleaks container on that host;
- Docker Desktop/Engine/Compose and Fabric 2.5.16 interoperability;
- the Fabric CA identity lifecycle and Git exclusions;
- the identifiers, ports, and environment-variable names in `network/README.md`
  and `database/README.md` on the canonical supported host;
- bootstrap migration apply/status/recreate behavior; and
- health, reset, and clean-machine validation commands.

Any change to an accepted ADR requires updating the Sprint 1 plan and the
authoritative operational document before the affected configuration is written.
