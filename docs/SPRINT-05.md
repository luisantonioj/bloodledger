# Sprint 5 — Controlled Frontend Migration and Application API

**Status:** Authorized by Jopia on 2026-08-20; implementation in progress

**Sprint authorization:** Jopia / 2026-08-20
**Accountable owner:** Lat (final Sprint Review confirmation remains required)
**API owner/validator:** Jopia (self-validation must be disclosed)
**Review participants:** Jopia, Buno, and Lat
**Planning branch:** `codex/sprint-05-planning`
**Implementation branch:** `codex/sprint-05-implementation`
**Target window:** 2026-08-20 through 2026-08-26 (seven calendar days); the
original Gantt window remains preserved as elapsed planning history
**Policy baseline:** accepted Sprint 2–4 synthetic policies plus Jopia-accepted
`SYNTHETIC_WEB_ACCESS_V1` for `RQ-01`

## 1. Sprint goal

Complete Gantt tasks 77–80 as one simulation-only application slice: migrate the
accepted BloodLedger mockup into the official component-based React application
under `apps/web/`, expand the existing Fastify service into the versioned
application API, replace runtime mock data with access-controlled
PostgreSQL/Fabric-backed views, and demonstrate authenticated inventory, alert,
request, transfer, audit, and regulatory-report workflows.

The web application must preserve the accepted mockup's visual language while
using the official repository's architecture, requirements, role model, and
machine-readable contracts. It must distinguish pending, committed, stale,
offline, failed, and conflicted data honestly and reflect a committed scan in
the dashboard within five seconds under documented normal test conditions.

This sprint does not demonstrate clinical safety, real Mediatrix policy,
regulatory compliance, production identity management, operational forecast or
BROA/RPS approval, full ISBT 128 compatibility, a multi-peer consortium, or
institutional onboarding.

## 2. Entry gates and source reconciliation

Jopia closed the Sprint 5 entry gates on 2026-08-20 with this evidence:

1. Sprint 4 was accepted for its simulation-only scope with physical Android OCR
   evidence explicitly deferred, recorded in commit `b962eb4` and immutable tag
   `sprint-04-accepted-2026-08-20`.
2. The replacement Sprint 5 window is 2026-08-20 through 2026-08-26. The elapsed
   Gantt dates remain unchanged as research/planning history.
3. Jopia accepted the immutable `SYNTHETIC_WEB_ACCESS_V1` assumption below for
   `RQ-01`. No unrecorded institution-specific exception may be invented.
4. The approved visual subset of the local mockup is frozen as
   `MOCKUP_VISUAL_2026-08-20` in `docs/frontend/MOCKUP_REFERENCE.md`, aggregate
   SHA-256 `1e625671c6122c73a50cddae4d85ddc0602879ecd521bb72831e1c3df8a27b48`.
   Unsafe fixtures, credentials, scanner behavior, and deferred onboarding pages
   are deliberately outside that visual snapshot.
5. Jopia's instruction to proceed accepts this plan's application-session, web
   packaging, polling, same-origin, and API decisions as the Sprint 5 baseline
   unless a later accepted ADR explicitly supersedes one.

External reference repositories, reviewed on 2026-08-20:

| Reference | Repository | Sprint 5 use |
|---|---|---|
| BloodLedger frontend mockup | [`luisantonioj/bloodledger-frontend`](https://github.com/luisantonioj/bloodledger-frontend) | Visual layout, interaction, page, and component reference; use the approved frozen snapshot rather than assuming the remote default branch matches reviewed local work |
| Google Labs DESIGN.md | [`google-labs-code/design.md`](https://github.com/google-labs-code/design.md/tree/main) | Format specification and validation reference for `docs/DESIGN.md`; it does not define BloodLedger's React architecture, requirements, or runtime behavior |

These URLs are discovery references, not floating implementation dependencies.
The approved mockup snapshot identifies the exact visual source, while the
committed `docs/DESIGN.md` identifies the exact design-format interpretation
used by this sprint. A later remote change does not silently alter Sprint 5.

Source precedence and conflicts:

- The Gantt and manuscript are research inputs. Their React, Node.js, REST, and
  JWT direction is retained, but repository decisions control implementation.
- The Gantt/manuscript's four tiers are superseded by ADR-013 and ADR-030. The
  API and UI enforce `ROLE-01` through `ROLE-06`, not a four-role approximation.
- `docs/DESIGN.md` is the official visual-system home. The mockup remains a
  visual and interaction reference where it agrees with that file and higher-
  precedence requirements; it is not a runtime foundation. Its React 18 UMD
  scripts, in-browser Babel, `window.*` data, mock API fallback, Google/CDN
  assets, names, credentials, topology text, and browser-only writes are not
  copied into the official application.
- The shared frontend-structure discussions are design guidance, not a role or
  institution authority. Their feature-first organization, centralized
  permissions, and selective view variants are retained; their four-role and
  per-role naming examples are superseded by the official six-role matrix.
- Hospital participants are called institutions or blood banks. "Chapter" is
  reserved for the Philippine Red Cross Lipa Chapter and is not used as a
  generic label for every hospital tenant.
- The official one-Mediatrix-peer topology supersedes mock/manuscript content
  that presents PRC, DOH, or other hospitals as active Fabric peers or requires
  multi-organization endorsement.
- The existing Fastify API and Fabric Gateway client remain the backend
  boundary. Express, Postman, and Hyperledger Explorer are not new acceptance
  dependencies; automated OpenAPI, API, browser, PostgreSQL, and Fabric tests
  provide the reproducible evidence.
- The shared "Frontend Migration Strategy" conversation is a planning input,
  not an authoritative specification. Its reference-repository and controlled-
  migration approach is adopted only where it agrees with the repository
  baseline: repositories remain separate, migration is feature-by-feature, and
  the official application owns routing, services, types, state, and security.

### Proposed `SYNTHETIC_WEB_ACCESS_V1`

If real participation decisions are unavailable, this immutable assumption
allows only synthetic demonstrations:

- `INST_MEDIATRIX` is the sole inventory-holding institution and sole
  chaincode-authorized application scope.
- Approved synthetic secondary institutions may see city-wide aggregates and
  only their own requests, transfers, receipt evidence, profile, and users.
- `ROLE-04` sees approved city-wide aggregates, alerts, audit summaries, and
  simulation reports read-only; it cannot submit mutations.
- `ROLE-05` sees security/administration surfaces only and receives no clinical,
  custody, inventory, transfer, or Fabric authority by default.
- `ROLE-06` manages only its activated institution's safe profile/user metadata
  and receives no inventory, custody, transfer, regulatory, or Fabric authority.
- All accounts, institutions, inventory, transfers, locations, alerts, and
  reports are opaque synthetic fixtures classified `SIMULATION_ONLY`.
- Forecast, BROA, and RPS outputs remain `DISABLED_UNAPPROVED_POLICY` and never
  approve or submit a transfer.

Real institution approval or exceptions replace this policy prospectively; they
do not silently reinterpret synthetic evidence.

## 3. Selected work mapped to Gantt

### 77 — Sprint Planning

#### S5-01 — Approve scope, decisions, interfaces, and owners

- Close the entry gates, confirm the seven-day window and ownership, and record
  the accepted mockup snapshot.
- Approve the controlled-migration boundary: shared application shell plus
  login, dashboard, inventory, transfers, alerts, consortium, audit, reporting,
  and profile. Account/application onboarding and the mockup scanner are not
  selected Sprint 5 pages.
- Accept or replace `SYNTHETIC_WEB_ACCESS_V1` and record the replacement trigger.
- Add the approved architecture decisions for the web workspace, revocable JWT
  session, polling policy, and same-origin deployment before implementation.
- Update the backlog to `Selected` only for `BL-API-01` and `BL-WEB-01` through
  `BL-WEB-04`. Do not mark an item `Done` from planning evidence.

### 78 — React Dashboard (Component-Based)

#### S5-02 — Establish the migration contract and activate the web workspace

Before porting page code, add a reviewable frontend migration register under
`docs/frontend/` containing:

- the accepted mockup commit, tag, or snapshot identifier and its repository;
- a component map from the mockup shell, tokens, and reusable controls to their
  official `apps/web/src/` destinations;
- a page map for every selected and explicitly deferred mockup page;
- the audience composition for each page: shared institution-scoped view,
  regulatory view, administration view, or explicitly unavailable;
- the responsible owner, linked backlog/requirement IDs, required API contract,
  migration status, and acceptance evidence for each entry; and
- source-precedence and retirement rules stating that the mockup remains a
  frozen design reference rather than an application dependency.

The register is tracking evidence, not a second requirements source.
`docs/DESIGN.md` owns the reviewed tokens and visual rationale; stable behavior,
permissions, terminology, and runtime contracts continue to live in their
authoritative repository homes.

Create `apps/web/` as a React 19, TypeScript, Vite, npm-workspace application.
Use the versions already accepted and locked by the official repository unless
the dependency graph is explicitly revalidated and the architecture baseline
is updated.

Organize `apps/web/src/` by feature and responsibility rather than by hospital
or role:

```text
app/                 routing, providers, and application bootstrap
auth/                session, roles, permissions, and protected routes
config/              permission-driven navigation
components/          shared UI and layout components
features/            dashboard, inventory, transfers, alerts, consortium,
                     audit, reporting, and profile
services/api/        typed same-origin API client and feature services
hooks/               session, permission, and shared query hooks
styles/              tokens and global styles migrated from the mockup
types/                cross-feature public UI types only
```

Each feature owns its page, feature components, API adapter, types, and tests.
Create view variants only when the information purpose or workflow is materially
different. Do not create folders or duplicate pages for individual hospitals or
for every role.

The dashboard feature uses one route/page entry and a server-principal-driven
composition resolver:

- all permitted hospital blood-bank users receive the same hospital dashboard
  composition and visual language;
- the displayed institution name, local inventory, requests, transfers,
  alerts, freshness, and available actions are scoped to the authenticated
  institution and permission set, so each hospital has distinct content without
  a distinct implementation;
- PRC Lipa Chapter receives a separate read-only regulatory composition for
  approved city-wide summaries, shortages, transfer history, audit summaries,
  and reports; it does not receive hospital inventory-write controls or a
  fabricated supply-hub/peer workflow;
- DOH regulatory users use the regulatory composition with only the modules
  authorized by the same official `ROLE-04` contract; and
- system and institution-account administrators receive only their approved
  non-clinical landing/profile surfaces while the deferred management pages
  remain unavailable.

Composition selection uses verified role, permission, institution category,
and activation state—not institution display names or hard-coded hospital IDs.
Small differences such as actions, columns, and navigation are permission-
driven within shared views. A separate view requires a genuinely different
regulatory, operational, or administrative purpose.

Port, rather than copy wholesale, the mockup's:

- CSS tokens, typography roles, density, cards, tables, status vocabulary, and
  desktop application shell;
- reusable button, chip, modal, stat, table, toast, and hand-built chart patterns;
- dashboard, inventory, transfer, alert, consortium, audit, reporting, login,
  and profile layouts relevant to the selected backlog items; and
- terse operational copy only where it agrees with authoritative terminology.

Use ES modules and typed API models. Do not retain global `window` collections,
in-browser Babel, runtime CDN scripts, mock API fallback, a design tweaks panel,
real-person-like fixtures, or mock transaction/hash claims. Serve runtime
dependencies locally. Locally licensed font assets may be added only with their
license; otherwise use reviewed system fallbacks without changing information
hierarchy.

Perform the migration in controlled order: first the tokens, shared controls,
and shell; then the selected page layouts; then real API wiring and state/error
behavior. Each runtime page calls the official `/api/v1` boundary through typed
feature services. Synthetic fixtures are restricted to automated tests and
isolated component validation; there is no runtime fixture adapter, environment
switch, or silent fallback to mock data.

The desktop dashboard links to the existing capture PWA at a same-origin
`/capture/` path and may show scan history/status. It does not reimplement or
weaken the Sprint 4 OCR, confirmation, privacy, or offline queue.

#### S5-03 — Implement server-derived navigation and UI authorization

- Restore the current session from the API on load; derive role and institution
  only from the verified server principal.
- Render navigation and write actions from the six-role permission matrix.
  Hidden or disabled controls are usability behavior, not the authorization
  boundary; every API and chaincode-sensitive action rechecks authorization.
- Resolve dashboard and feature compositions from the server principal. Never
  let a route parameter, browser value, or caller-selected hospital switch the
  active institution scope.
- Reuse the hospital shell and widgets across blood banks while binding every
  query, mutation, empty state, heading, and status count to the authenticated
  institution. PRC/DOH regulatory views consume aggregate-only contracts and
  expose no operational mutation controls.
- Provide explicit loading, empty, error, offline/degraded, unauthorized,
  pending, committed, stale, failed, and conflicted states.
- Use Asia/Manila for display and UTC values from the API for ordering/audit.
- Keep status text/icons in addition to color, provide readable labels, keyboard
  access, modal focus management, and non-destructive error recovery.

#### S5-04 — Connect selected application views

- Hospital dashboard: one shared composition across permitted blood banks with
  authenticated-institution headings, permitted local detail, request/transfer
  status, alerts, forecast freshness/model version, sync health, and last
  successful projection. Data differs by institution; layout does not fork.
- PRC/DOH dashboard and consortium: a distinct read-only regulatory composition
  containing only approved city-wide aggregates, shortage/alert summaries,
  transfer history, audit summaries, and simulation reports. PRC remains an
  application observer rather than a Fabric peer or operational blood bank.
- Inventory and alerts: filterable committed inventory, pending scan status,
  synthetic threshold provenance, expiry warnings, and permitted acknowledgement.
- Requests and transfers: request submission, RPS explanation, human
  approval/rejection, FEFO selection evidence, status timeline, exception state,
  and explicit dispatch/receipt location capture under `PA-S3-01`/`PA-S3-02`.
- Audit: permitted application events plus ledger transaction references without
  exposing exact location, secrets, certificates, or unrelated institutions.
- Regulatory reporting: read-only simulation aggregates and CSV export clearly
  labeled as prototype evidence, not an official DOH/PRC filing or compliance
  determination.
- Refresh dashboard, inventory, alerts, requests, and transfers every two
  seconds while visible, pause when the page is hidden, and back off on repeated
  failure. A manual retry remains available.

Transfer actions are not queued in the browser. If the API/Fabric boundary is
unavailable, the UI keeps the last confirmed state, blocks the mutation with a
safe degraded-state message, and permits retry with the same idempotency key.
Only the Sprint 4 scan flow has offline acceptance semantics.

### 79 — RESTful API Layer (Node.js + JWT Auth and RBAC)

#### S5-05 — Add revocable application sessions

Extend `services/api/` without weakening `/api/v1/simulation/session` or the
capture PWA contract:

- `POST /api/v1/auth/session` verifies an opaque username and password, creates
  a database session, sets a signed 15-minute JWT in an `HttpOnly`, same-origin,
  `SameSite=Strict` cookie, and returns a safe principal.
- `GET /api/v1/auth/session` restores the safe principal.
- `DELETE /api/v1/auth/session` revokes the database session and clears the
  cookie idempotently.
- Every JWT contains an opaque user ID, institution ID, role ID, session ID,
  issued/expiry time, and policy version. Verification also checks the active
  user, institution, and session rows so suspension/logout takes effect.
- Mutation routes validate `Origin`/same-origin use in addition to strict cookie
  policy. Secure cookies are mandatory outside isolated localhost testing.
- Password verifiers use a reviewed, parameterized one-way password-hashing
  implementation with a unique salt. Plaintext credentials, JWTs, hashes, and
  session secrets never enter logs, fixtures, Git, or business audit records.

Development bootstrap uses only opaque synthetic users and untracked
credentials. The login form does not allow a caller to choose or override its
role or institution.

#### S5-06 — Expand the authoritative OpenAPI and persistence contracts

Update `services/api/openapi.json` before handlers. The versioned `/api/v1`
contract covers:

- authenticated session create/read/delete;
- dashboard summary and health/freshness metadata;
- scoped inventory, scan status, alerts, and alert acknowledgement;
- transfer request create/list/read, approval/rejection, and allowed transfer
  transition actions with exact schemas, expected version, event time,
  idempotency key, and correlation ID;
- read-only RPS/BROA explanations with policy version and disabled eligibility;
- scoped audit events; and
- read-only simulation report JSON and CSV export.

Successful ledger mutations return only after Fabric commit confirmation and
projection reconciliation, with the ledger transaction reference and resulting
version. An unavailable ledger returns a stable retryable error and never
creates a client-visible committed state. Scan intake retains Sprint 4's durable
`202 Accepted` behavior and separate status resource.

Add forward-only migrations for the minimum selected domains:

- institutions, opaque users, revocable sessions, and explicit role assignment;
- transfer/read projections and ledger transaction correlation;
- versioned stock thresholds and derived alert/acknowledgement records; and
- redacted application/security audit events.

Reuse the existing inventory projection, location evidence, algorithm runs,
forecast tables, and scan queue. Do not duplicate their authoritative columns
or create onboarding/application tables in this sprint. Runtime roles receive
only required table/column privileges and no DDL or destructive privileges.

After each committed transfer action, read the resulting Fabric state and
update inventory/transfer projections idempotently in a database transaction.
Projection failure is visible and retryable; it never resubmits the confirmed
ledger mutation.

#### S5-07 — Implement application orchestration and authorization

- Inventory and aggregate queries enforce detail/aggregate visibility before
  executing repository reads.
- Transfer request/transition handlers map exactly to the accepted Sprint 3
  contract and policies, including FEFO, stale version, duplicate, reason,
  location-evidence, role, institution, and state checks.
- RPS/BROA evaluation remains off-chain, explainable, versioned, synthetic, and
  unable to approve or submit a transfer automatically.
- A scheduled off-chain expiry evaluator supplies explicit UTC evaluation time
  and `SYNTHETIC_INVENTORY_V1`; chaincode validates any submitted state change.
  `RQ-03` continues to block clinical interpretation.
- Alerts and report aggregates come from committed projections and versioned
  synthetic configurations. Pending scan counts are shown separately and never
  included in committed inventory totals.
- All mutations enforce authentication, role and institution scope, exact input
  validation, idempotency, correlation, expected version, safe errors, and
  redacted audit evidence.

### 80 — Sprint Review and Final Development Demo

#### S5-08 — Validate the integrated slice and record review

Lat and Buno validate the web workspace; Jopia validates the API/database/Fabric
boundary and discloses self-validation. The final development demo uses only
synthetic data and covers:

1. login and refresh-safe session restoration for each applicable role;
2. role-specific navigation plus server denial of unauthorized and
   cross-institution requests;
3. a Sprint 4 scan moving from durable pending state to committed dashboard
   projection within five seconds under the defined normal condition;
4. request submission, RPS display, human approval, FEFO evidence, dispatch,
   and permitted transfer tracking/exception behavior;
5. stale/unavailable forecast and failed/conflicted synchronization handling;
6. read-only regulatory dashboard and CSV export; and
7. logout/session revocation without leaking credentials, tokens, prohibited
   data, or exact restricted location evidence.

Passing checks does not accept the sprint. Lat records a separate accountable-
owner decision, incomplete-item disposition, and retrospective before the
formal Testing phase begins. Jopia separately records API/database/Fabric
validation and discloses self-validation.

## 4. Excluded and deferred work

- `BL-API-02`, `BL-WEB-05`, `BL-WEB-06`, and `BL-TST-02`: invitation,
  application, review, activation, suspension/reactivation, and institution/user
  management remain deferred because `RQ-14` and their activating-sprint
  selection are open. Mockup account/application screens are references only.
- Wholesale copying, Git submodules/subtrees, synchronized dual codebases, or
  treating the mockup repository as a package/runtime dependency.
- Real user, staff, applicant, patient, donor, clinical, institutional inventory,
  or exact facility data; external email/SMS; password recovery; external IdP;
  public self-service application; and verification-document storage.
- Operational RPS/BROA/forecast thresholds, automatic transfer approval,
  reservation reallocation, received-stock release, or emergency suspension.
- Real-label/ISBT claims, OCR changes, raw image/text persistence, cloud OCR, or
  changes to Sprint 4 capture privacy rules.
- New Fabric organizations, peers, endorsement policy, MSP/CA enrollment,
  channel membership, chaincode definition upgrade, or Hyperledger Explorer.
- Official regulatory forms/compliance certification, PDF report generation,
  production deployment, UAT execution, or filling research result columns.
- Mobile redesign of the desktop dashboard, new UI framework, component library,
  chart library, client state library, or runtime CDN dependency.

## 5. Verification and exit obligations

- Unit/type/lint/build tests cover API schemas, role-policy helpers, formatters,
  state rendering, and deterministic aggregation using synthetic fixtures.
- API tests cover login, invalid credentials, expiry, logout, revoked/suspended
  session, missing/forged JWT, Origin failure, every six-role allow/deny boundary,
  institution isolation, unknown fields, prohibited fields, idempotent replay,
  conflict, stale version, invalid transition, and safe error envelopes.
- PostgreSQL tests apply all migrations to an isolated empty database and prove
  constraints, least-privilege grants, session revocation, projection
  idempotency, audit redaction, and unchanged prior migration behavior.
- Fabric integration proves request/approval/rejection, FEFO, dispatch/location,
  receipt/exception, duplicate, stale, unauthorized, projection-retry, and
  deterministic replay behavior without upgrading chaincode.
- Browser tests cover all selected pages, role navigation, keyboard-critical
  flows, loading/empty/error/offline states, polling cleanup/backoff, CSV export,
  and status text that does not rely on color alone.
- Dashboard composition tests use at least the active Mediatrix institution,
  two synthetic secondary hospitals with different records, PRC, DOH, a system
  administrator, and an institution account administrator. They prove that
  hospital dashboards retain the same structure while showing distinct scoped
  content; no hospital can retrieve another institution's restricted detail;
  PRC/DOH receive the regulatory composition; and administrative principals do
  not inherit operational data or actions.
- The NFR-06 scenario starts at a confirmed scan ledger commit and ends when the
  visible web projection reflects it; the documented normal condition must be
  at most five seconds. Pending state and commit time are recorded separately.
- Existing Sprint 1–4 checks, production dependency audit, secret scan, and
  prohibited-data scan pass. No real names, emails, employee IDs, credentials,
  tokens, raw location/image/OCR text, or generated identity material is added.
- A clean same-origin Docker run serves the web app at `/`, the existing capture
  PWA at `/capture/`, and `/api/v1` without external runtime assets.
- OpenAPI, migrations, role policy, UI types, README/setup commands, and observed
  behavior agree. No untested command is described as verified.

Sprint exit requires all selected backlog acceptance criteria, reproducible
evidence, accountable-owner review, explicit disposition of incomplete work,
and continued disclosure of every synthetic or unresolved-policy limitation.

## 6. Checkpoint commits

1. `docs(sprint-5): approve dashboard and application API plan`
2. `docs(web): record controlled mockup migration map`
3. `feat(web): activate typed React dashboard workspace`
4. `feat(auth): add revocable application sessions and RBAC`
5. `feat(api): expose inventory alert transfer and report contracts`
6. `feat(web): connect role-scoped application workflows`
7. `test(sprint-5): validate migration access latency and failure behavior`
8. `docs(sprint-5): record validation and review evidence`

Each commit body records its owner, `Sprint: S5`, applicable requirement/backlog
IDs, and `Classification: SIMULATION_ONLY` where synthetic domain behavior is
involved.

## 7. Risks and mitigations

| Risk | Required mitigation |
|---|---|
| Sprint 4 remains unaccepted | Keep this document planning-only; do not branch implementation from an unaccepted baseline |
| Elapsed Gantt dates invite false completion claims | Record a new owner-approved window and preserve the original workbook as research evidence |
| Dirty mockup cannot be reproduced | Commit/tag or snapshot the accepted design before porting; never infer which local edit is approved |
| "Migrate the frontend" is interpreted as copying every page | Use the approved component/page register; selected pages must have evidence and deferred pages remain explicitly out of scope |
| Runtime fixture mode hides an incomplete API | Permit fixtures only in tests and isolated component validation; selected runtime pages must use official typed APIs |
| Four-tier source wording weakens accepted permissions | Generate API/UI tests from the six-role official matrix and record the source conflict |
| One-week scope expands into onboarding | Keep onboarding backlog items deferred until `RQ-14` and a separate activating plan close |
| Dashboard shows synthetic data as operational | Carry classification, policy version, freshness, and disabled eligibility through API and UI |
| UI-only hiding creates an authorization gap | Enforce every rule in the API and chaincode-sensitive boundary; test direct unauthorized requests |
| Per-hospital or per-role folders duplicate the application | Keep feature-first modules, one hospital dashboard composition, permission-driven differences, and separate views only for materially different workflows |
| Institution-specific content leaks across shared views | Derive scope from the verified principal, prohibit caller-selected tenant switching, and test multiple hospitals with deliberately different synthetic records |
| PRC mockup content conflicts with the accepted topology | Use the distinct read-only regulatory composition and remove supply-hub, peer, endorsement, and operational-write claims |
| Polling causes duplicate calls or stale screens | Use one visibility-aware two-second query loop per resource family with cancellation, backoff, and last-success metadata |
| Projection failure misstates ledger outcome | Preserve transaction evidence, display projection-pending/failure, and retry projection without resubmission |
| Mockup contains prohibited or misleading fixtures | Recreate only opaque synthetic fixtures and scan candidate content before review |

## 8. Review record

**Automated checkpoint (2026-08-24):** The integrated static, unit, browser,
isolated PostgreSQL, secret-scan, infrastructure-health, and same-origin checks
are recorded in `docs/frontend/VALIDATION.md`. The selected page and component
registers record implementation with automated validation passed. This is
technical evidence only; it is not Lat's accountable-owner Sprint Review.

### Consolidated evidence package

- Baseline: accepted tag `sprint-04-accepted-2026-08-20`; Sprint 05 window
  2026-08-20 through 2026-08-26.
- Accepted synthetic decisions: `SYNTHETIC_INVENTORY_V1`,
  `SYNTHETIC_TRANSFER_V1`, `SYNTHETIC_LOCATION_V1`,
  `SYNTHETIC_OPTIMIZATION_V1`, `SYNTHETIC_CAPTURE_V1`, and
  `SYNTHETIC_WEB_ACCESS_V1`. The frozen visual reference is
  `MOCKUP_VISUAL_2026-08-20`.
- Environment: canonical WSL2 Ubuntu 24.04 working copy, Node.js `24.17.0`,
  npm `11.13.0`, pinned repository dependencies, and project-scoped Docker
  services.
- Evidence: the commands and results in `docs/frontend/VALIDATION.md` cover
  static/build/security checks, 191 unit tests, 24 browser scenarios, isolated
  PostgreSQL integrations, Fabric health, and same-origin application probes.
- Owner evidence: Yuri Lat approved the controlled Sprint 05 visual result on
  2026-08-24. Buno's web-workspace validation remains pending. Jopia's
  API/database/Fabric validation and required self-validation disclosure remain
  pending.
- Accountable decision: Lat's consolidated Sprint Review acceptance or rejection
  remains pending. Passing technical checks and visual approval do not replace
  that decision.

### Incomplete-item disposition

- Physical Android OCR evidence remains deferred from Sprint 04 to a later
  authorized physical-device evaluation. The deferral continues to block
  real-device, real-label, clinical-accuracy, and production-readiness claims.
- The NFR-06 browser result covers polling and rendering only. Full
  scan-to-Fabric-to-projection latency evidence is handed to the formal Testing
  phase and must not be inferred from the browser result.
- `BL-API-02`, `BL-WEB-05`, `BL-WEB-06`, and `BL-TST-02` remain deferred
  behind `RQ-14` and a separate activating plan; they are not Sprint 05
  failures or silently completed scope.
- Forecast readiness was honestly `UNAVAILABLE` at the checkpoint. This is an
  allowed degraded state and does not establish an operational forecast.
- All implemented behavior and evidence remain synthetic and
  `SIMULATION_ONLY`.

### Retrospective draft

- Worked well: the frozen visual reference, official design tokens,
  feature-first boundaries, typed same-origin APIs, six-role isolation tests,
  and explicit synthetic-state labels kept the migration controlled.
- Improve: owner/validator wording was inconsistent, final participant review
  was scheduled after the automated checkpoint, and the controlled NFR-06 test
  did not cover the full physical-to-ledger path.
- Follow-up: use one RACI table in the next sprint plan, schedule participant
  validation before the exit date, retain limitation wording at every handoff,
  and plan physical-device and end-to-end latency evidence only in an explicitly
  authorized phase.

### Formal Testing-phase handoff

The technical package is prepared, but handoff remains pending Buno's
web-workspace validation, Jopia's API/database/Fabric validation with
self-validation disclosed, Lat's accountable-owner decision, and acceptance of
this retrospective and incomplete-item disposition.

Empty or pending participant evidence must never be treated as a passing result.
