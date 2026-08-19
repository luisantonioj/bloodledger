# Sprint 4 — Mobile OCR Ingestion and Node.js Middleware

**Status:** Implementation and automated validation complete on 2026-08-17;
physical Android OCR gate deferred on 2026-08-18; Sprint Review acceptance pending

**Accountable owner:** Jopia  
**Assigned owner/validator:** Jopia (self-validation disclosed)  
**Branch:** `codex/sprint-04-scan-middleware`  
**Baseline:** `sprint-03-accepted-2026-08-16`  
**Policy baseline:** `SYNTHETIC_CAPTURE_V1` and `SYNTHETIC_API_AUTH_V1`

## 1. Sprint goal

Complete Gantt tasks 72–76 as one simulation-only vertical slice: an installable
mobile-first PWA captures a synthetic blood-unit label, performs OCR on the
device, requires operator confirmation, and submits only allowlisted structured
fields to an authenticated Node.js API. The API durably queues the scan in
PostgreSQL, a worker reconciles it with the accepted Fabric inventory contract,
and the client can inspect an honest pending/committed/failed/conflicted state.
The middleware also exposes the existing Sprint 3 forecasts read-only with
explicit freshness and disabled-recommendation evidence.

This sprint does not prove OCR accuracy on Mediatrix labels, complete ISBT 128
compatibility, clinical safety, real institutional authorization, production
security, or operational forecast suitability.

## 2. Entry gate and decisions

- Sprint 3 was accepted on 2026-08-16, merged into `main` as `d7c04fa`, and
  tagged `sprint-03-accepted-2026-08-16` before this branch was created.
- `RQ-11` is resolved for the simulation scope by `PA-S4-01`: mobile OCR is the
  primary capture flow, with Code 128/Data Matrix and synthetic QR decoding as
  fallback. Every capture requires exact validation and human confirmation.
- ADR-019 is accepted only for this local, synthetic PWA approach.
- `RQ-02` remains unresolved. `BL-SCN-01` and full ISBT 128 compatibility remain
  open until approved label structures and representative institutional
  fixtures exist.
- The PWA and API use synthetic authentication under `PA-S4-02`; Sprint 5 still
  owns full user, session, and institutional RBAC implementation.
- `BL-ML-01`, `BL-ML-03`, and `RQ-07` remain blocked/open. Sprint 4 reads
  simulation forecasts but does not retrain, promote, or operationalize them.

## 3. Selected work mapped to Gantt

### 72 — Sprint Planning

- Version this specification, the two prototype assumptions, interface
  boundaries, schema responsibilities, test plan, ownership, and exclusions.
- Update requirements, architecture, backlog, database guidance, repository
  entry documentation, and agent instructions before implementation.

### 73 — IoT Scan Ingestion Pipeline

Create `apps/capture-pwa/` as an installable mobile React application. It:

1. signs into the simulation environment;
2. captures a synthetic label through the rear camera or a test image;
3. runs Tesseract.js in a browser worker using locally served worker, WASM, and
   English-language assets;
4. extracts only unit ID, blood type, component, collection time, and expiry
   time;
5. blocks submission when a required field is absent, invalid, or below the
   configured confidence floor;
6. requires explicit operator confirmation without allowing free-text repair;
7. offers Code 128/Data Matrix and synthetic QR fallback decoding;
8. persists only the confirmed structured event in IndexedDB; and
9. synchronizes it idempotently when the API is reachable.

Raw images and unrestricted OCR text remain in volatile browser memory. They
must not enter IndexedDB, HTTP requests, logs, PostgreSQL, Fabric, test evidence,
or Git.

### 74 — Node.js Middleware Development

Create `services/api/` with Fastify and two process entry points: the HTTP API
and the synchronization worker. The service:

- authenticates the synthetic operator with a short-lived JWT;
- derives actor and institution scope from the verified token;
- validates exact JSON schemas and rejects unknown/prohibited fields;
- durably accepts a scan before returning `202 Accepted`;
- owns idempotency, correlation IDs, safe error codes, queue leases, retry state,
  Fabric submission, and PostgreSQL projection;
- never reports a queued event as ledger-confirmed; and
- reads Sprint 3 forecasts without invoking training, BROA, RPS, or Fabric.

The committed OpenAPI document under `services/api/openapi.json` is the
authoritative HTTP contract. The new migration is the authoritative database
contract.

### 75 — Integration Tests with Simulated Latency

Validate browser capture, privacy, API authorization, data validation,
idempotency, database permissions, worker lease/retry/recovery, Fabric replay,
projection-only recovery, forecast freshness, and simulated Gateway delays of
0, 250, 2,000, and 5,000 milliseconds. The API must return after durable queue
commit rather than wait for Fabric.

### 76 — Sprint Review and Retrospective

Jopia reviews the final evidence and separately records acceptance. Passing
tests alone does not accept the sprint. Physical-phone evidence is recorded only
after one Android Chrome run with synthetic fixtures succeeds; automated
browser evidence does not silently stand in for that run.

## 4. Synthetic capture policy

`SYNTHETIC_CAPTURE_V1` is immutable and has these rules:

- institution: `INST_MEDIATRIX`;
- actor: an opaque synthetic `ROLE-01` operator;
- supported blood types: `A_POSITIVE`, `O_POSITIVE`;
- supported components: `RED_BLOOD_CELLS`, `PLATELETS`;
- required fields: `unitId`, `bloodType`, `component`, `collectedAt`, and
  `expiresAt`;
- capture methods: `OCR`, `CODE_128_FALLBACK`, `DATA_MATRIX_FALLBACK`, and
  `SYNTHETIC_QR_FALLBACK`;
- OCR engine: Tesseract.js `7.0.0`, English model, locally served assets;
- every OCR field confidence is an integer from 0 through 100 and must be at
  least 90;
- every capture is confirmed by the authenticated operator before API intake;
- fields are not manually editable; a mismatch requires recapture or fallback;
- classification: `SYNTHETIC_DATA` at capture and `SIMULATION_ONLY` throughout
  middleware and persistence; and
- operational eligibility: `DISABLED_UNAPPROVED_POLICY`.

Fixture promotion is fail-safe rather than a clinical accuracy claim: every
clean fixture must extract all five values exactly; a degraded fixture must
either extract exactly or be blocked. No incorrectly extracted fixture may be
accepted.

## 5. Public interfaces

### Authentication

`POST /api/v1/simulation/session` is enabled only in `SIMULATION_ONLY` mode. It
accepts the synthetic operator ID and an untracked development credential, then
returns a short-lived JWT. The response and all logs exclude credentials and
token contents. The PWA retains the JWT only in memory or session storage.

### Scan intake and status

`POST /api/v1/scan-events` requires `Authorization: Bearer ...` and an
`Idempotency-Key` matching the chaincode-safe `IDEM_*` form. The JSON body is an
exact object containing:

- `captureMethod` and `capturePolicyVersion`;
- `capturedAt` and `confirmedAt` UTC timestamps;
- an exact `unit` object with the five required fields; and
- `ocrEvidence` with engine/version and per-field confidence when the capture
  method is `OCR`, otherwise `null`.

The server derives institution and actor, canonicalizes the payload, records a
SHA-256 digest, generates stable `SCAN_*` and `CORR_*` identifiers, and returns
`202` with `eventId`, `correlationId`, `status`, and `receivedAt`. An identical
replay returns the existing event. A different payload with the same key returns
`409 SCAN_IDEMPOTENCY_CONFLICT`.

`GET /api/v1/scan-events/{eventId}` returns only the caller's institution event
and one of `QUEUED`, `SUBMITTING`, `RETRY_WAIT`,
`LEDGER_COMMITTED_PROJECTION_PENDING`, `COMMITTED`, `FAILED`, or `CONFLICT`.

### Forecast read

`GET /api/v1/demand-forecasts?businessDate=YYYY-MM-DD` returns the latest
completed simulation run for the exact Asia/Manila business date. Exact-date
rows are `CURRENT`; a completed run for another date is returned as `STALE`; no
completed run is `UNAVAILABLE`. Every result preserves `SIMULATION_ONLY` and
`DISABLED_UNAPPROVED_POLICY` and cannot authorize any mutation.

### Errors and health

Errors use `{ error: { code, message, correlationId } }` with stable safe codes.
`GET /healthz` reports API, database, worker/fabric configuration, and forecast
readiness without returning secrets or claiming downstream mutations succeeded.

## 6. Database and worker contract

One forward-only Sprint 4 migration creates:

- `app.scan_events`: immutable capture fields plus mutable queue state, lease,
  retry, safe error, and ledger/projection evidence;
- `app.scan_event_attempts`: append-only safe attempt outcomes; and
- `app.inventory_projection`: the PostgreSQL query projection of committed
  Fabric inventory assets.

The runtime role receives only explicit `SELECT`, `INSERT`, and required
column-level `UPDATE` privileges. It receives no DDL or table deletion.

Queue flow:

```text
QUEUED -> SUBMITTING -> COMMITTED
                      -> LEDGER_COMMITTED_PROJECTION_PENDING -> COMMITTED
           |          -> FAILED
           |          -> CONFLICT
           +-> RETRY_WAIT -> QUEUED
```

The worker claims in stable institution/event-time/event-ID order using an
expiring PostgreSQL lease. Transient failures retry after 1, 2, 4, 8, and 16
seconds, then at a capped 30-second interval without jitter. Chaincode
idempotency is reused. If Fabric commits but projection fails, only projection
is retried; the ledger mutation is never resubmitted.

All stored timestamps use UTC. Forecast business dates are interpreted in
Asia/Manila.

## 7. Exclusions

- Real label photos, institutional inventory, donor/patient/staff information,
  cloud OCR, third-party OCR APIs, and OCR model training.
- Full ISBT 128 certification or approved production label parsing.
- Full user administration, institutional onboarding, password recovery,
  external identity provider, and production authentication.
- Transfer/request/alert APIs, dashboard, continuous camera streaming,
  geolocation, notifications, scheduler, and MQTT/message-broker deployment.
- Chaincode version/sequence changes, autonomous transfer approval, and
  operational forecast/BROA/RPS integration.

## 8. Verification and acceptance

- Generate at least 16 clean synthetic fixtures across all four supported
  type/component combinations and degraded negative fixtures for blur,
  rotation, glare, cropping, low confidence, malformed values, and prohibited
  fields.
- Prove exact clean extraction and fail-safe degraded behavior.
- Prove image/raw-text non-persistence and no external runtime asset requests.
- Prove PWA offline structured-event retention, reload recovery, identical
  replay, conflicting replay, and honest state display.
- Prove unauthenticated, expired-token, wrong-role, wrong-institution, unknown
  field, prohibited field, low-confidence, and unconfirmed requests fail safely.
- Apply all migrations to an isolated empty database and verify runtime role
  permissions, atomic intake, leases, retry recovery, attempt evidence, and
  projection idempotency.
- Prove delayed/unavailable Fabric does not delay or lose durable intake and
  recovery creates exactly one asset.
- Prove a committed-ledger/projection-failure path never resubmits Fabric.
- Prove current, stale, missing, and failed forecast handling.
- Run Sprint 1–3 regression checks, format/lint/type checks, unit/integration
  tests, production dependency audit, secret scan, and PHI/prohibited-field
  scan.
- Record one Android Chrome synthetic-device run before Sprint Review
  acceptance; if unavailable, leave that gate explicitly pending.

## 9. Checkpoint commits

1. `docs(sprint-4): authorize mobile OCR ingestion slice`
2. `feat(capture): add offline mobile OCR PWA`
3. `feat(database): add durable scan synchronization schema`
4. `feat(api): add scan and forecast interfaces`
5. `feat(sync): reconcile queued scans with Fabric`
6. `test(sprint-4): validate latency outage and recovery`
7. `docs(sprint-4): record Jopia validation evidence`

Each commit body records `Owner: Jopia`, `Sprint: S4`,
`Classification: SIMULATION_ONLY`, and the applicable requirement IDs.

## 10. Implementation and validation evidence — 2026-08-17

Jopia performed the assigned-owner validation on the canonical WSL2 host. This
is self-validation and is not the separate accountable-owner Sprint Review
acceptance required by Task 76.

### Automated and integration results

- Repository foundation, JSON/lock consistency, workspace resolution, pinned
  versions, ignore behavior, safe environment template, database static
  baseline, API privacy boundaries, and capture production build passed.
- Capture tests passed: 29 unit/policy tests and three Chromium scenarios. The
  browser run used the version-matched Playwright `1.61.1` image with digest
  `sha256:5b8f294aff9041b7191c34a4bab3ac270157a28774d4b0660e9743297b697e48`.
  It proved exact extraction for all 16 clean fixtures, fail-safe degraded and
  prohibited-label behavior, same-origin-only OCR assets, structured-only
  IndexedDB persistence, offline reload, and exactly-once replay.
- On 2026-08-19, the targeted mobile OCR reliability fix added bounded
  in-memory preprocessing, reusable OCR-worker caching, visible OCR progress
  stages, a 90-second `CAPTURE_OCR_TIMEOUT`, and a strict original-image retry
  when preprocessing fails policy validation. The retry never persists images
  or raw OCR text and does not change `SYNTHETIC_CAPTURE_V1` rules. Capture
  type/build checks passed and the pinned Chromium suite passed all three
  scenarios in 1.6 minutes.
- API/worker tests passed: 15 tests including authentication and institution
  scope, exact validation, idempotency/conflict, current/stale/unavailable
  forecast states, failed-run exclusion, lease recovery, projection-only retry,
  terminal conflict handling, and Gateway delays of 0, 250, 2,000, and 5,000
  milliseconds.
- A clean isolated PostgreSQL database applied all four migrations and passed
  atomic intake, replay/conflict, claim, attempt evidence, projection,
  failed-forecast exclusion, and runtime-role checks. Sprint 3 forecasting and
  coordination database probes also passed against the four-migration,
  seven-table schema.
- The deployable multi-stage API/PWA image built successfully and its live
  loopback smoke test passed health, same-origin PWA delivery, and synthetic
  authentication. The final production dependency audit reported zero known
  vulnerabilities. `@fastify/static` `10.1.3` and transitive
  `brace-expansion` `5.0.9` supersede the initially selected vulnerable lock
  entries.
- The real local Fabric path passed without a reset. The accepted Sprint 3
  generated identity set matched the preserved shared Docker volumes; the
  inventory contract was already committed at `0.2.0` sequence `2`. Synthetic
  event `SCAN_5A1E445C8C2AFD840CBE1F575A1B8EA4` returned from durable intake
  before the worker started, then reached `COMMITTED` on attempt 1. Evidence
  showed one scan event, two expected stage-attempt rows, one inventory
  projection, one exact Fabric asset, and an identical replay with no requeue.
  The temporary API, worker, and Fabric validation services were stopped while
  preserving database and ledger evidence.
- Sprint 1–3 regressions passed: 22 inventory/transfer tests, 32 forecasting
  tests, nine coordination tests, and eight health-contract tests. Static
  Fabric/operations checks and safe command-behavior tests passed. Gitleaks
  found no leaks in history, index, or candidate content, and the synthetic
  fixture PHI/PII term scan passed.

### Reproducible validation commands

```bash
npm run check:foundation
npm run check:database
npm run check:forecasting
npm run check:capture
npm run check:api
npm run test:capture
npm run test:api
npm run test:api:database
npm run test:forecasting:database
npm run test:coordination:database
npm run scan:secrets
npm audit --omit=dev --audit-level=high
```

Chromium validation uses the pinned Playwright container documented in
`apps/capture-pwa/README.md`. Live Fabric validation additionally requires a
healthy accepted local channel whose generated identities match the preserved
project volumes. No identity, key, password, token, raw image, or OCR text is
included in this evidence.

### Retrospective and remaining gates

- Keeping intake and reconciliation separate made it possible to prove durable
  `202` acceptance independently from Fabric latency and recovery.
- Running OCR entirely in the browser kept raw images and unrestricted text
  outside the API, database, and ledger. Exact allowlists and human
  confirmation remain mandatory because fixture success is not clinical or
  institutional accuracy evidence.
- Separate worktrees share the Docker Compose project and volumes but not
  ignored generated identities. Future live-network validation must use the
  identity set that created the preserved channel or perform only the formally
  authorized scoped Fabric reset; never mix independently generated CA roots.
- **Deferred:** the physical Android Chrome OCR run before the reliability fix
  was attempted on 2026-08-19 using synthetic text shown through a messaging
  view and plain Notepad. OCR took approximately five minutes and returned
  `CAPTURE_REQUIRED_FIELD_MISSING`; an earlier attempt also returned
  `CAPTURE_UNIT_ID_INVALID`. Fallback decoding correctly reported that no
  machine-readable code was present. No real labels, credentials, raw OCR
  text, or images were used. The gate remains open for a printed or
  transferred synthetic PNG or another supported Android device after this
  fix. A post-fix Android retry on 2026-08-19 still returned
  `CAPTURE_REQUIRED_FIELD_MISSING` on the first attempt and
  `CAPTURE_FIELD_NOT_ALLOWED` on the second. These are safe policy outcomes,
  not evidence to relax the allowlist; the physical gate remains deferred.
- **Pending:** after the Android evidence is recorded, Jopia must explicitly
  accept or reject Sprint 4 in the Sprint Review. Until then Task 76 and Sprint
  4 remain unaccepted, and Sprint 5 implementation must not begin.
