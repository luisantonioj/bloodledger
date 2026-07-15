# BloodLedger Agent Instructions

These instructions apply to the entire repository.

## 1. Current phase

BloodLedger has an approved Sprint 0 baseline and Sprint 1 implementation guide.
Sprint 1 implementation started on 2026-07-15 with the authorized S1-02/S1-03
repository-foundation batch. Remaining infrastructure tasks are not thereby
authorized or complete; do not add their code or configuration unless the user
explicitly authorizes that implementation work.

The project is a research prototype. Never describe it as production-ready,
clinically validated, regulator-approved, or a deployed multi-organization
consortium unless evidence and scope documents are formally updated.

## 2. Authoritative documents

Use one home for each type of truth:

| Question | Source |
|---|---|
| What is BloodLedger and what is in scope? | `docs/PROJECT.md` |
| What behavior and rules are required? | `docs/REQUIREMENTS.md` |
| How is it structured and why? | `docs/ARCHITECTURE.md` |
| What is planned overall? | `docs/BACKLOG.md` |
| What is selected for the current sprint? | `docs/SPRINT-01.md` or its successor |
| How should local setup and reset behave? | `docs/LOCAL-DEVELOPMENT.md` |
| What Fabric names, identities, ports, and health contract apply? | `network/README.md` |
| What PostgreSQL and migration rules apply? | `database/README.md` |
| How should an agent work? | `AGENTS.md` |
| How does a human enter the repository? | `README.md` |

When documents disagree, do not choose silently. Follow accepted architecture
decisions, then requirements, project scope, current sprint, and backlog. Report
the conflict and update all affected sources only with authorization.

The manuscript, proposal, revision summary, and Gantt are research sources. The
repository documents are the implementation baseline after proponent review.

## 3. Task-based reading map

For every task, read this file and the current sprint document.

Then read only what the task requires:

| Task | Additional reading |
|---|---|
| Scope, terminology, stakeholder question | Relevant `PROJECT.md` section |
| Feature or business-rule work | Linked `FR-*`, `BR-*`, state model, and NFRs in `REQUIREMENTS.md` |
| Infrastructure, data, API, blockchain, ML, security, or repository boundary | Relevant `ARCHITECTURE.md` section and ADRs |
| Fabric network or CA work | `network/README.md` plus linked ADRs and sprint task |
| PostgreSQL or migration work | `database/README.md` plus linked ADRs and sprint task |
| Setup, validation, troubleshooting, or reset work | `docs/LOCAL-DEVELOPMENT.md` |
| Prioritization or sprint selection | `BACKLOG.md` |
| Architecture change | All core documents affected by the decision |

Use headings and IDs as retrieval targets. Do not load the complete thesis for a
small implementation task when the repository baseline answers it.

## 4. Planning workflow

Before changing plans or specifications:

1. Identify the source claim, requirement IDs, backlog item, and target sprint.
2. Check for an accepted ADR and an open requirement decision.
3. State assumptions and contradictions explicitly.
4. Change the authoritative home first, then update cross-references.
5. Preserve IDs; do not renumber stable requirements casually.
6. Record why a material decision changed and which source it supersedes.

Do not mark a requirement, backlog item, sprint, test, or review as complete
without evidence. Empty result columns in research test tables are intentional.

## 5. Implementation workflow

When implementation is authorized:

1. Select a `Ready` or current-sprint item.
2. Read only its linked requirements, rules, ADRs, and acceptance criteria.
3. Inspect related existing code and tests.
4. State the files/components expected to change.
5. Implement the smallest coherent change.
6. Add or update tests at the appropriate level.
7. Run formatting, lint, type, unit, integration, and security checks applicable
   to the change.
8. Verify every acceptance criterion with evidence.
9. Update documentation only when behavior or an accepted decision changed.

If a required business or clinical rule is unanswered, do not invent it. Record
or reference an `RQ-*` and stop the affected behavior until a decision exists.

## 6. Privacy and safety rules

- Never add patient records, donor names, diagnoses, treatments, employee IDs,
  or other PHI/PII to code, examples, fixtures, logs, prompts, database seeds, or
  ledger payloads.
- Use synthetic data unless an approved anonymized dataset is explicitly in
  scope. Never commit interview recordings, transcripts, consent forms, survey
  raw responses, or institutional production data.
- Never commit `.env`, passwords, tokens, private keys, wallets, enrollment
  material, generated MSP secrets, or production certificates.
- Treat location evidence and institutional inventory detail as sensitive,
  access-controlled operational data.
- BloodLedger provides decision support. Never implement autonomous clinical or
  transfer approval from BROA, RPS, or forecasts.
- Do not claim medical safety, accuracy, compliance, or regulatory acceptance
  from passing software tests alone.

## 7. Architecture rules

- Current prototype: one Mary Mediatrix Fabric organization/peer. PRC, DOH, and
  secondary hospitals are application users, not active peer operators.
- Canonical development host: Windows 11 with WSL2 Ubuntu 24.04 LTS; canonical
  project scripts use Bash and the working copy should normally live in the WSL
  Linux filesystem.
- Approved package management uses npm workspaces with one lockfile.
- The initial Fabric state database is LevelDB and development identities use
  Fabric CA.
- Sprint 1 network identifiers, ports, CA identities, and disposable health
  contract are authoritative in `network/README.md`.
- Sprint 1 PostgreSQL roles and migration/bootstrap rules are authoritative in
  `database/README.md`.
- PostgreSQL is the application/read database plus a logically separate durable
  synchronization queue.
- Fabric ledger is authoritative for accepted inventory and custody history.
- Chaincode must be deterministic: no external calls, ML inference, database
  access, random values, local clock, background scheduler, or unstable ordering.
- Forecasting, BROA, RPS, and scheduled expiry evaluation run off-chain.
  Chaincode validates authorization, input/configuration evidence, current
  state, and allowed transitions before recording approved results.
- Every mutation needs authentication, role and institution authorization,
  validation, idempotency, correlation, current-state/version checks, and audit.
- A local queued event is not ledger-confirmed. The UI/API must expose pending,
  committed, failed, stale, and conflicted states accurately.
- Use UTC in storage and Asia/Manila for display.
- Do not alter an applied database migration; add a new migration.
- Sprint 1 creates only a migration/bootstrap baseline. Do not create the full
  domain schema until the relevant column-level design is approved.
- Stop preserves data. Fabric reset and full development reset must follow the
  scoped, confirmation-based policy in `docs/LOCAL-DEVELOPMENT.md`; global
  Docker prune and deletion outside project-owned paths are forbidden.
- Barcode/QR scanning remains the accepted capture baseline. OCR is proposed for
  later feasibility evaluation; do not implement or assume OCR behavior without
  resolving `RQ-11` and ADR-019.
- Avoid duplicating machine-readable contracts in prose once schemas,
  migrations, or OpenAPI become authoritative.

## 8. Coding and naming baseline

These rules become active when code begins:

- Prefer TypeScript for Node.js application and chaincode modules unless an ADR
  accepts another choice.
- Use npm workspaces with one committed lockfile, as accepted in ADR-015.
- Use descriptive English names; avoid unexplained abbreviations except domain
  terms defined in `PROJECT.md`.
- Files: lowercase kebab-case unless a selected framework requires otherwise.
- Types/classes/components: `PascalCase`; variables/functions: `camelCase`;
  environment variables/constants: `UPPER_SNAKE_CASE`.
- Database identifiers: lowercase `snake_case`.
- Stable domain IDs and enum values are uppercase strings in documentation and
  APIs unless a machine-readable contract defines another representation.
- Validate inputs at trust boundaries and return stable, safe error codes.
- Do not log entire request payloads or secrets.

## 9. Testing rules

- Link tests to `FR-*`, `BR-*`, `NFR-*`, or a sprint acceptance criterion.
- Test success, boundary, authorization, duplicate, stale-state, retry, conflict,
  and failure behavior where relevant.
- Chaincode tests must include deterministic replay and invalid transition cases.
- Offline tests must prove no loss and no duplicate, not only successful retry.
- Algorithm tests must fix input scenarios and configuration versions so results
  are reproducible and explainable.
- ML evaluation must preserve data lineage, use time-ordered validation, compare
  simple baselines, and report limitations.
- Test data is synthetic by default and contains no prohibited fields.

## 10. Documentation rules

- A fact has one authoritative home; other files link to it.
- Keep headings stable and use requirement/backlog/decision IDs.
- Write decisions as `Proposed`, `Accepted`, `Superseded`, or `Deferred`.
- Do not write untested setup commands as if they work.
- Do not use "latest" for dependencies; pin verified versions.
- When a machine-readable artifact becomes authoritative (OpenAPI, migration,
  JSON schema, Fabric YAML), summarize and link it rather than copying it.
- Split a core document only when a section has an independent lifecycle,
  frequent edit conflicts, machine-readable needs, or retrieval cost that has
  become an observed problem.

## 11. Git and repository rules

- Preserve user changes and unrelated work.
- Keep generated identities, local volumes, build artifacts, logs, coverage, and
  dependency directories out of Git.
- Do not use destructive reset or cleanup commands without explicit authority.
- Scope reset scripts to project-owned resources and require clear intent.
- Do not change architecture merely to match accidental code; record and approve
  a decision or correct the implementation.

## 12. Definition of completion

A task is complete only when:

- its linked requirement and sprint acceptance criteria are satisfied;
- relevant automated checks pass;
- privacy, authorization, and failure cases were considered;
- commands and evidence are reproducible on the supported environment;
- documentation and machine-readable contracts agree;
- no secret, generated identity, prohibited data, or unrelated change is added;
  and
- remaining risks or deferred decisions are stated plainly.
