# Frontend Validation Conditions

This file records reproducible frontend test conditions. Requirements remain
authoritative in `docs/REQUIREMENTS.md`, and Sprint 5 acceptance remains in
`docs/SPRINT-05.md`. Passing a scenario here does not accept the sprint.

## NFR-06 controlled browser condition

The automated scenario `committed projection becomes visible within the
frontend NFR-06 budget` in `apps/web/e2e/web.spec.ts` measures the web polling
and rendering portion of NFR-06 under these conditions:

- Playwright's bundled Chromium has a visible, active dashboard page;
- the application uses its configured two-second successful polling interval;
- the first dashboard response shows one uncommitted scan separately from one
  ledger-confirmed unit;
- the test records a synthetic confirmed-ledger commit time only after that
  initial state is visible;
- from that recorded time, the same-origin dashboard projection endpoint makes
  the reconciled projection immediately available, with no injected database,
  gateway, transport, or server delay;
- the end time is recorded only after the rendered ledger-confirmed count
  increases and the rendered uncommitted count reaches zero; and
- elapsed wall-clock time must be no more than 5,000 milliseconds.

This is deterministic automated evidence for the frontend refresh/display
budget. It does not measure Fabric commit, worker scheduling, PostgreSQL
projection, physical-device capture, or production network latency. Those
boundaries require the separate clean same-origin integration evidence listed
in `docs/SPRINT-05.md` before accountable-owner review.

Run the scenario from the repository root with:

```bash
npm --workspace @bloodledger/web run test:e2e -- --grep "frontend NFR-06 budget"
```

## 2026-08-24 integrated validation checkpoint

This checkpoint was run on the canonical WSL2 Ubuntu 24.04 working copy with
Node.js `24.17.0`, npm `11.13.0`, the pinned repository dependencies, and the
local project-scoped Docker services. The implementation baseline through
`cdbc569` was under test. This evidence validates the automated Sprint 5 slice;
it does not accept the sprint or replace Lat's accountable-owner review.

The following static, build, boundary, and security checks passed:

```bash
npm run check:foundation
npm run check:inventory-contract
npm run check:forecasting
npm run check:coordination
npm run check:capture
npm run check:web
npm run check:api
npm run scan:secrets
npm run check:fabric-identities
npm run check:fabric-nodes
npm run check:fabric-channel
npm run check:fabric-health-contract
```

Gitleaks `8.30.1` found no leaks in Git history, the index, or tracked and
candidate content. The web and capture production builds completed without a
runtime CDN dependency.

The consolidated unit results were:

- inventory/transfer chaincode: 22 passing tests;
- forecasting: 32 passing tests;
- coordination policy: 9 passing tests;
- capture PWA: 25 passing tests;
- web application: 27 passing tests; and
- application API: 76 passing tests.

The full Playwright web suite passed 24 scenarios. It covered all six roles,
two distinct synthetic secondary hospitals using the shared structure,
PRC/DOH regulatory composition, administrative non-clinical composition,
session restoration/revocation, cross-institution isolation, selected transfer
and alert mutation retries, loading/empty/error states, polling cleanup and
backoff, keyboard navigation, regulatory CSV access, and the controlled NFR-06
browser condition.

The isolated PostgreSQL integrations passed for the API, forecasting, and
coordination services. Each integration created a fixed isolated database,
applied all eight forward migrations, validated its feature behavior, and
removed the database on exit. The forecasting integration's pre-feature schema
assertion was updated from the obsolete Sprint 3 count (`4|7`) to the current
forward-only migration baseline (`8|19`); its forecasting persistence,
idempotency, classification, and conflict assertions were unchanged and passed
after the correction.

The non-destructive consolidated infrastructure status passed: both Fabric CAs,
the Mediatrix peer, orderer, PostgreSQL, channel membership, committed health
contract, and fixed probe were healthy. Same-origin HTTP probes returned `200`
for `/` and `/capture/`; `/healthz` returned API and database `READY`, worker
Fabric `CONFIGURED`, classification `SIMULATION_ONLY`, and forecast readiness
`UNAVAILABLE`. `UNAVAILABLE` is an honest allowed forecast state, not evidence
of an operational forecast.

## Technical visual comparison

On 2026-08-24 every approved mockup source file matched the frozen SHA-256
values in `MOCKUP_REFERENCE.md`, including the recorded aggregate source. The
comparison did not read excluded fixtures into the official implementation.

At a `1440x1000` desktop viewport, temporary local captures covered sign-in,
dashboard, inventory, transfers, alerts, network view, audit, reports, and
profile. The authenticated captures used only the existing synthetic browser
contracts; no runtime fixture adapter or mock fallback was added.

The official surfaces retained the approved shell, hierarchy, density, palette,
typography roles, card/table language, and status vocabulary while replacing
fabricated mockup content with scoped projection and provenance evidence. The
inspection found one clipped transfer-detail action; reducing the table minimum
from `1180px` to `1100px` produced `1150px` client/scroll widths and placed the
button fully inside the viewport. The 27 web unit and 24 browser tests passed.

## Local six-role review readiness

On 2026-08-24 the owner authorized local provisioning of one opaque synthetic
account for each `ROLE-01` through `ROLE-06`. Credentials remain in an owner-only
file outside the repository; no password, cookie, salt, or verifier is evidence.

Each role passed the live same-origin sequence: login `200`, session restoration
`200`, logout `204`, and revoked-session denial `401`. A read-only database
aggregate confirmed one active user and active institution for every role. This
role-access readiness does not accept the visual result or the sprint.

### Accountable-owner visual decision

On 2026-08-24 Yuri Lat reviewed the running Sprint 05 application using the
provisioned six-role synthetic review accounts and explicitly approved the
Sprint 05 visual result. This accepts the controlled visual comparison against
`MOCKUP_VISUAL_2026-08-20`; it does not by itself accept the consolidated
Sprint Review, supersede unresolved policy decisions, or change the
`SIMULATION_ONLY` classification.

### Participant validation decisions

On 2026-08-24 Buno validated the Sprint 05 web workspace and its simulation-only
limitations. On 2026-08-24 Luis Jopia validated the Sprint 05
API/database/Fabric evidence and explicitly disclosed that this includes
self-validation of his assigned boundary.

### Accountable-owner decision and accepted limitations

On 2026-08-24 Yuri Lat accepted the Sprint 05 simulation-only scope, documented
incomplete-item disposition, retrospective, and formal Testing-phase handoff.
Lat acknowledged that physical Android OCR and full end-to-end NFR-06 latency
evidence remain deferred and that acceptance does not establish clinical,
regulatory, or production readiness.

- The NFR-06 browser scenario retains the limited boundary documented above;
  it is not an end-to-end physical scan or production latency claim.
- Physical Android OCR evidence remains the explicitly accepted Sprint 4
  deferral and is not reclassified by this checkpoint.
- All accounts, data, locations, reports, and outcomes remain synthetic and
  `SIMULATION_ONLY`; no clinical, regulatory, or production-readiness claim is
  supported.

## Testing-phase V5 frontend integration — 2026-10-01 (Asia/Manila)

Owner and technical validator: Yuri Benjamin Lat (LAT), with agent-assisted
self-validation. Requirements: FR-14, BR-ALG-07; classification:
`SIMULATION_ONLY`. This record does not accept Testing-phase completion, human
UAT, an institution binding, or V5 activation.

### Baseline and implementation

Fetched `origin/main` at `b028515b0d48c4d4819f00c87ce8866163cdc0f7`.
GitHub confirmed PR [#19](https://github.com/luisantonioj/bloodledger/pull/19)
merged at `ecd682057ee49574fd57c2f4078208c2bafb8953`, PR
[#20](https://github.com/luisantonioj/bloodledger/pull/20) merged at the main
baseline, and Buno's final [approval](https://github.com/luisantonioj/bloodledger/pull/20#pullrequestreview-5367073735)
covered `dfffe8aba7d02b0d109b2dbd27e240ddcbeb11d9`. These supersede historical
approval-pending wording for those merges, without approving activation.

The official checkout was clean on `codex/s6-frontend-integration` at `111681e`.
The new `codex/ml-v5-frontend` branch starts from fetched main. Unrelated edits
in `/home/yuri/projects/bloodledger` and the preview worktree at
`/home/yuri/.codex/worktrees/s6-mediatrix-preview-tabs/bloodledger` were preserved.
Polish commit `f61a60f` is not an ancestor of main; main has subsequent shell,
visual-parity and V4/V2 integration changes. No polish commit was cherry-picked.
Git author/committer is Yuri Benjamin Lat with the Yuri GitHub noreply address.

Tested implementation commit: `16eaf27cf74f83f9e8480048c583c7d7a69c5311`
(`feat(web): add explicit V5 simulation forecast preview`). The subsequent
frontend documentation commit records these results without changing runtime
code. The delivery PR identifies its exact final head.

The authoritative HTTP shape remains [OpenAPI](../../services/api/openapi.json),
not the producer bundle schema. The parser validates requested dataset/model,
required envelope evidence, supported explicit series identifiers, dates, UTC
instants, nonnegative finite quantities, null uncertainty, duplicate series,
status consistency, simulation classification and disabled eligibility. It
preserves forecast IDs and rejects foreign-institution rows in Analytics.
V4 remains the default with no dataset query; V5 requires the explicit selector
and query. Institution scope comes from the official cookie session. No token,
credential, institution selector, backend default or deployment change ships.

The UI clears evidence on selection/refresh, rejects outdated responses, renders
stale history and unavailable reasons without fallback, and displays origin,
target, generation UTC/Manila and frozen training cutoff separately. CURRENT
means target-window eligibility at the backend instant; refresh does not retrain
or renew freshness. V5 is next-day requested demand, with null uncertainty,
not release counts, inventory or guaranteed supply. No quantity-accuracy claim
is derived from the research secondary any-demand classification result.

### Environment and actual command results

Ubuntu 24.04.4 LTS under WSL2, Linux `6.18.33.2-microsoft-standard-WSL2`;
Node `24.17.0`, npm `11.13.0`, existing approved workspace lockfile, Vitest
`4.1.10`, Playwright `1.61.1`, Chromium `149.0.7827.55`, PostgreSQL `17.10`.
The browser suite builds and serves the application at `127.0.0.1:4174`.

| Command/scenario | Actual result | Evidence boundary |
|---|---|---|
| `npm run check:web` | PASS: TypeScript and Vite production build | Web workspace |
| `npm run test:web` | PASS: 57 tests in 17 files | Unit evidence; 7 new forecast cases |
| `npm run test:web:e2e` | PASS for executed tests: 36 passed, 7 skipped, 43 total | Mocked HTTP UI evidence; 14 new scenarios |
| `npm run check:format` | PASS | Repository JSON formatting contract, not a general source formatter |
| `npm run build --workspace @bloodledger/api` | PASS | Matching unchanged backend baseline compiled for live probe |
| `git diff --check` | PASS | Whitespace validation |
| `npm run scan:secrets` | FAIL: 11 historical findings; wrapper stops before index/candidate stages | Full-history findings remain untriaged; no full-scan pass claimed |
| Separate Gitleaks `8.30.1` candidate directory scan | PASS: no leaks | Tracked and nonignored candidate files; excludes `.env` and generated artifacts |
| Real Chromium without interception | PASS: login gate and explicit unauthenticated V5 HTTP 401 | Matching real API/PostgreSQL; no authenticated success claimed |
| Official authenticated cookie-session browser flow | BLOCKED | Owner-only synthetic credential path unavailable in this session |
| Producer → database → cookie-session browser V5 success | BLOCKED | External pinned `selected_model.json`, isolated synthetic binding/setup and synthetic web credential needed |
| Verified census inventory combinations | BLOCKED | Missing sufficient browser census evidence described below |
| Human UAT | NOT_RUN | Participant, consent, instrument/scoring and custody gates unchanged |

The seven skipped cases are existing retired V1 transfer mutation fixtures,
not successful tests. The first sandboxed browser run could not start its local
server. The first executable browser run had two failures: an old fixture
returned a different requested business date, and uncertainty text shared a
cell with its note. Current-contract fixture echoing and a separate uncertainty
text span corrected them. Final rerun: 36 passed, 7 skipped. Two initial fixture
typing errors were corrected; final typecheck passed.

Mocked cases cover V4 default, explicit V5 cookie-client request construction,
model/version/malformed responses, twenty explicit combinations, null
uncertainty, CURRENT/STALE/UNAVAILABLE/future-generation, no retained success or
fallback, Manila midnight, distinct timestamps, HTTP 401/403, network failure,
refresh, out-of-order selections, foreign institution rejection, keyboard
selection and a 390 × 844 viewport without document overflow. Existing role
allow/deny tests remain in the passing suites. The four inventory UI fixtures
exercise current-looking, stale, zero-count and absent projections; all remain
unverified for census assessment. They do not claim verified-zero support.

### Real runtime reproduction and limits

The existing untracked configuration used Compose hostname `postgres`. A host
process initially returned health 503/database unavailable. Restarting the
matching backend with a process-only loopback override made API/database READY;
no configuration file, shared inventory or forecast data was changed.

```bash
npm run build --workspace @bloodledger/api
POSTGRES_HOST=127.0.0.1 node --env-file=.env services/api/build/src/server.js
npm run dev --workspace @bloodledger/web
node tests/frontend/v5-live-browser.mjs
```

These commands were executed in this session. The probe uses actual Chromium
and HTTP, without route interception. Safe evidence is at
`/tmp/bloodledger-v5-live-browser.json`; command logs are
`/tmp/v5-e2e.log`, `/tmp/v5-live-api-local.log`, `/tmp/v5-live-web.log` and
`/tmp/v5-secrets.log` (local, uncommitted). The committed
[probe](../../tests/frontend/v5-live-browser.mjs) produces a safe aggregate and
never writes a screenshot, trace, cookie/storage state, credential or raw
forecast payload. It accepts `BLOODLEDGER_BROWSER_CREDENTIAL_PATH` for an
external owner-only JSON object containing `username` and `password`. No
credential was supplied during this run. Its successful process exit proves
only the executed unauthenticated boundary; its BLOCKED fields remain blocked.

Observed live readiness: API/database READY, worker/Fabric DISABLED,
forecastReadiness UNAVAILABLE, v2EncryptionKeys UNAVAILABLE. Existing Docker
services were PostgreSQL, orderer and two CAs; no API or peer was initially
running. Live inventory/transfers/alerts could not be inspected under an
authenticated session, so no empty/populated claim is made. Buno/Jopia's previous
backend probes do not replace this missing frontend evidence.

For a successful producer scenario, use the documented disposable setup in
[Jopia validation](../ML-V5-JOPIA-VALIDATION.md#reproduction-and-results)
and `tests/forecasting/v5-runtime-integration.sh`, with the externally pinned
model. The setup's temporary enabled binding is test-only and cannot approve a
concrete institution binding. The supplied backend probe currently uses bearer
API injection and disposes its database; it does not provision a browser cookie
account or retain a browser-accessible server. Jopia must provide the matching
isolated producer/DB server and approved synthetic session fixture for a full
cookie-browser success rerun. Do not seed the shared development database to
make Analytics appear populated.

### Independent inventory dependency and remaining acceptance

The V1 inventory/dashboard projections expose counts/status and projection
instants; V2 components expose individual inventory versions. They do not expose
a complete permission-scoped census snapshot index with snapshot identity,
projection digest, recorded/evaluation Manila date, explicit completeness and
freshness, and verified coverage including zero rows. No sufficient census HTTP
read is in `services/api/openapi.json`; backend census storage or coordination
readers are not browser APIs. Jopia owns exposing an authorized read of that
evidence, including unambiguous current/stale/unavailable and verified-zero
semantics. A policy-approved contract is needed before LAT implements that
assessment; no freshness threshold is invented here.

Until then Analytics states inventory validity unavailable for every forecast
status. Unknown never becomes zero; projections cannot establish stock validity,
shortage, surplus, reserves or redistributability. Browser BROA/surplus is absent;
`SIMULATION_ONLY` and `DISABLED_UNAPPROVED_POLICY` remain visible. No autonomous
clinical, transfer or release approval is enabled. FR-14 stock-dependent and full
live integration acceptance remain incomplete. RQ-07, UAT, concrete institution
binding and separate Jopia activation remain open.


## Jopia PR #21 follow-up validation — 2026-10-01

The user authorized Jopia to implement the census contract and frontend fixes
on `codex/pr-21-jopia-review` from reviewed head
`91500c9e250fdcbf545a1e0158f34f6b43067df7`. The tested implementation is
`f13c2b0c2a69662d85b91a0bbd59e748f5944b0f`; [Jopia’s complete validation](../ML-V5-PR21-JOPIA-VALIDATION.md)
records commands, source evidence, secret dispositions and limitations. Lat
retains frontend ownership and resulting-change review. This is Jopia
self-validation and does not replace Lat’s independent review or human UAT.

Web build/typecheck and 59 unit tests passed; browser tests passed 43 with seven
existing retired V1 cases skipped. The real isolated producer → PostgreSQL →
official HttpOnly cookie → rendered Chromium flow passed without route
interception. The [safe aggregate](v5-cookie-evidence-2026-10-01.json) proves
twenty V5 results, forty complete persisted census combinations, verified zeros,
tenant isolation, failure transitions and Manila-midnight staleness. The live
probe uses the requested date and checks rendered quantities; unavailable latest
evidence stays explicitly BLOCKED. The missing-model harness case is BLOCKED.

The authorized [OpenAPI V2](../../services/api/openapi-v2.json) read supplies
independent inventory evidence. This supersedes the prior missing-contract,
verified-census and authenticated isolated-flow blockers for this follow-up.
The original Lat checkpoint above remains historical. Runtime snapshots that
are absent still return unavailable; the GET cannot capture them. History,
redistribution, surplus calculations, reserve actions, BROA actions and
operational recommendations remain disabled or deferred.

Full history/index/candidate secret scanning now passes with exact demonstrated
false-positive exceptions; dependency audit reports zero vulnerabilities after
scoped updates. These supersede the earlier untriaged-secret statement for the
validated follow-up. Binding, activation, RQ-07, UAT, physical OCR and full
Fabric-to-browser NFR-06 remain open. Synthetic projection fixtures do not
establish live Fabric or operational inventory validity.


## Lat PR #22 incorporation review — 2026-10-07

**Decision: BLOCKED for complete live V5 acceptance.** The grouped follow-up
code is accepted and incorporated into PR #21; formal approval is withheld
while this host's real producer → database → official cookie → browser rerun
is blocked. This is a completed code review with an explicit incomplete
integration result, not a request to activate V5 or an assertion that Jopia's
prior passing evidence failed.

Perspective/owner: Lat. Executor: Codex assisting Yuri Benjamin Lat;
agent-assisted self-validation on Lat's host, not independent human validation
or UAT. Authenticated GitHub account verified through `/user`:
`Yuri-Benjamin-Lat`. Jopia retains the census/API/database dependency, Buno the
frozen model/calculation boundary. FR-12/FR-14, BR-ALG-07 and
NFR-01/09/10/11; classification `SIMULATION_ONLY`.

### Refreshed sources and delivered revisions

Git fetch and authenticated GitHub reads confirmed PR #21 OPEN at
`91500c9e250fdcbf545a1e0158f34f6b43067df7`, with Jopia CHANGES_REQUESTED,
and PR #22 OPEN at `6c2d1483e65dca1ae2c91e69f939b931396e0ecc`, targeting
`codex/ml-v5-frontend`. A second read before delivery found no intervening head
change. Buno's APPROVED review on PR #20 at
`dfffe8aba7d02b0d109b2dbd27e240ddcbeb11d9` was independently re-read through
GitHub; its ML evidence remains Buno's prior evidence.

The initial local fast-forward and security checkpoint are preserved on
`codex/lat-pr22-preserved`. Delivery instead uses source-linked `cherry-pick -x`
after `b90d0c1`, preserving Jopia's authorship, grouping and original commit
references without making PR #22's exact head an ancestor of its target.
Neither GitHub PR is merged. The original working tree was clean; unrelated
work and shared services were preserved.

| Jopia source | Incorporated commit | Group |
|---|---|---|
| `e5e52bf` | `bfa2e85` | Official roles and complete V5 envelope |
| `8e84bdc` | `0f390e5` | Scoped census API and persisted validation |
| `9883e0b` | `7ae75b8` | Independent census presentation |
| `9fda19c` | `b30dd6c` | Timestamp precision and Analytics deep link |
| `9bd06b3` | `dc2a779` | Real cookie/browser harness |
| `f13c2b0` | `4e21b66` | Exact synthetic secret exceptions and dependency pins |
| `6c2d148` | `41535d6` | Jopia evidence and cross-references |

Additional Lat commits: `dbea2ec` fixes the current dependency advisory;
`0b7833e88bd7f4b192cb25cb23ba14645fbc1257` adds the isolated database harness
and is the exact application/database rerun SHA tested below.
`a409188dd31843f709408074bbf0f2e14450d633` subsequently changes only the real
cookie harness prerequisite handling; its focused checks are recorded below.
A final record-only commit changes no application, dependency or test behavior.
Earlier local checks at `984abaec87e0e2a66be70d3a7ab49102a9e81dc6` have an
identical tracked tree to `dbea2ec`; final delivery checks were nevertheless
rerun at `0b7833e` to remove ambiguity about the delivered revision.

### Review findings and dispositions

The complete 36-file follow-up was reviewed against AGENTS, the Testing phase,
requirements/design, runtime contract and Jopia evidence. Roles 01–03 match the
cookie authorization; regulatory and administrative roles remain denied.
Successful V5 parsing requires all twenty unique supported series, unique IDs,
consistent run/model/origin/target/generation metadata, frozen cutoff and null
uncertainty. Institution mismatches fail closed. Inventory independently
validates forty persisted combinations, counts, policy/header metadata and
digest before verified-zero claims; latest invalid evidence cannot fall back.
Current, historical stale and unavailable presentations are distinct. Date and
version changes, refresh, failures, races and logout clear affected prior usable
evidence. Independent forecast failure does not invalidate an otherwise valid
census read. Keyboard and narrow-viewport scenarios follow DESIGN.

The timestamp change preserves PostgreSQL milliseconds for digest verification;
the Analytics deep link returns the application shell. Exact-path AND
exact-value scanner exceptions were inspected against the historical synthetic
run/idempotency identifiers and in-process test keys; no broad detector, path
or history suppression was introduced. V4 stays default. No surplus, reserve,
BROA action or operational recommendation is enabled.

**LAT-V5-01 — resolved, high, NFR-01/09:** the fresh audit of the inherited
lockfile found `source-map-js@1.2.1`, unlike Jopia's time-specific zero finding.
[GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)
identifies the patched version as 1.2.2. `npm update source-map-js
--package-lock-only` changed only that package's version, URL and integrity.
`dbea2ec` records the fix; a clean `npm ci`, audit and affected checks passed.
No unrelated package update or architecture change was made.

The new database harness initially encountered two test-setup failures, not
application defects: existing recovery probes intentionally leave pending
commands, and immutable snapshot guards reject deletion even by the owner.
The final harness uses a separate fresh census database, proves the delete
rejection, then injects one missing count at the database-read boundary.
It never disables guards or rewrites persisted evidence. Its final rerun passed.
The missing-row case is fault-injection evidence, not naturally corrupt storage.

**LAT-V5-02 — resolved, medium, FR-14/Testing-phase evidence:** the inherited
real cookie harness classified missing image/Docker/browser prerequisites as
generic integration failures, and a nonexistent model path escaped the initial
BLOCKED branch. `a409188` adds safe preflight decisions before creating test
resources. Absent/unreadable model, unavailable Docker, pinned images or
Chromium now exit 2/BLOCKED; a corrupt supplied model hash remains a failure.
Absent-model and nonexistent-model-path runs at that exact commit both exited
2/BLOCKED; syntax checks passed. Image/browser failure paths were source-reviewed
but not executed because the real pinned model is unavailable. The successful
producer path remains BLOCKED, not a passing regression of this change.

### Commands and observed results

Ubuntu 24.04.4 / WSL2 Linux `6.18.33.2-microsoft-standard-WSL2`, Node
24.17.0, npm 11.13.0, Vitest 4.1.11, Playwright 1.61.1 and Chromium
149.0.7827.55. PostgreSQL `postgres:17.10`; synthetic fixture
`tests/forecasting/v4-verification-fixture.sql`, fixed census date 2026-10-07,
scheduled/captured fractional instants in the committed harness. No external
model was used. Builds used the corrected committed lockfile.

| Command at delivery implementation `0b7833e` | Result / exit |
|---|---|
| `npm run check:foundation` | PASS / 0: format, workspace, versions, ignore, safe env |
| `npm run check:web` / `npm run test:web` | PASS / 0; type/build, 59 tests in 18 files |
| `npm run test:web:e2e` | PASS / 0 for executed mocked HTTP UI cases: 43 passed, 7 existing retired V1 cases skipped, 50 total |
| `npm run check:api` / `npm run test:api` | PASS / 0; type/static, 106 tests, no skips |
| `npm run check:coordination` / `npm run test:coordination` | PASS / 0; type/static, 19 tests, no skips |
| `npm run check:database` | PASS / 0; static migration/schema boundary |
| `npm run test:capture` | PASS / 0; 14 tests after shared test-runner updates |
| `npm run build --workspace @bloodledger/coordination` | PASS / 0; prerequisite build |
| `node tests/api/v5-census-integration.mjs` | PASS / 0; real isolated database results below |
| `node tests/frontend/v5-cookie-integration.mjs` | BLOCKED / 2: external pinned model path unavailable |
| `bash tests/forecasting/v5-runtime-integration.sh` | BLOCKED / 2: external selected model unavailable |
| `npm audit --json` | PASS / 0; zero current production/development findings after 1.2.2 fix |
| `npm run scan:secrets` | PASS / 0; Gitleaks 8.30.1, 231 history commits, index and candidate |
| `node --check` on the database and both browser harnesses / `git diff --check` | PASS / 0 |

Foundation/type/unit/build commands were rerun at `0b7833e`.
`a409188` changes only the blocked-prerequisite harness, not those tested
application files, lockfile, mocked suite or database harness.
The coordination build and dependency audit were also rerun at that SHA.
Secret scanning included the committed database test. A final scan at
`a409188`, including candidate validation records, passed history (232
commits), index and candidate; `/tmp/lat-v5-record-secrets.log` records it. Gitleaks digest:
`sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f`.
All results above are this session's reruns, separate from Jopia's reported
106/59/43 and real-cookie results. The final mocked suite completed with 43 passes and seven pre-existing
retired V1 skips; skips are not passing evidence. The first sandboxed browser
run could not start its server; the permitted rerun and final delivery run
both passed. Mocked cases cover keyboard, 390 × 844 viewport, date/version
races, refresh/error clearing, role denial, complete V5 and independent
census states. They cannot establish producer/cookie success.

The [safe database aggregate](v5-census-evidence-2026-10-07.json) records the exact
SHA. It proves 23 forward migrations, idempotent reapplication, runtime grants,
existing API/Sprint 6 persistence probes, coordination replay/conflict/purge and
disabled-policy evidence, forty persisted census counts, explicit zeros,
fractional timestamps/digest, tenant scope, future/unavailable and midnight
stale states, immutability and missing-latest-row fault injection without fallback.
This directly calls the census service/store; it is not a real cookie/browser
flow or a live Fabric commit. The harness creates one random container with an
ephemeral loopback port and two disposable databases; final cleanup removed only
that container and its own temporary directory. Shared development data was
neither seeded nor migrated. The historical bootstrap-only `test:database`
script expects four migrations and writes the shared database, so it was not
used; current isolated apply/reapply/status/grant checks replace that unsafe,
outdated setup for this task. Shared Compose-based API/coordination wrappers
were likewise replaced by their existing probes within the disposable harness.

### Remaining blockers and reproduction

The pinned external model with file hash
`1e0f0c240109e49e8f1a89a713021afae07c2f5fae5b0e2bc8e3904610fb9764`
is unavailable. Docker image inspection also found no matching forecasting
image `sha256:dcb2ccd36834bcec33e3d5cb8158f2b7a75b0881f695821cc705764667fba4c1`.
The host browser is available and passed mocked tests; Jopia's browser-library
workaround was not needed. Missing prerequisites remain BLOCKED, not PASS.
No enabled institution binding was supplied or approved.

Reproduce model-free database checks with:

```bash
npm ci
npm run test:api
npm run check:web
npm run build --workspace @bloodledger/coordination
node tests/api/v5-census-integration.mjs
npm run test:web:e2e
npm audit --json
npm run scan:secrets
git diff --check
```

With the documented external model and pinned Docker/browser prerequisites,
run `BLOODLEDGER_V5_MODEL_TEST_PATH=/absolute/path/to/selected_model.json node
tests/frontend/v5-cookie-integration.mjs` and the producer script. Their
test-only binding is disposable evidence, not institutional approval.
Local uncommitted logs are `/tmp/lat-v5-delivery-*.log`,
`/tmp/lat-v5-census-integration-final.log`, `/tmp/lat-v5-cookie-blocked-final.log`, `/tmp/lat-v5-cookie-missing-final.log`,
`/tmp/lat-v5-producer-blocked.log`, `/tmp/lat-v5-delivery-audit.json` and
`/tmp/lat-v5-final-secrets.log`. No credential, cookie, raw application payload,
model, enabled binding, image or browser storage artifact is committed.

## Lat Testing-phase frontend regression — 2026-10-07

**Result:** PASS for the selected mocked frontend regression and remediation
slice, not complete Testing-phase acceptance. **Owner:** Lat; Codex-assisted
self-validation. **Classification:** SIMULATION_ONLY. Starting revision:
`0f2f1f42d735f606aabf1a754bb6cca261b117e4` on
`codex/lat-testing-traceability`; results below apply to the local working-tree
implementation and the new scenario file. No GitHub handoff response was
processed in this slice.

The [traceability register](../TESTING-TRACEABILITY.md) owns scenario mappings;
the [defect register](../TESTING-DEFECTS.md) owns dispositions for TP-LAT-D01
through D05. Inventory clears prior contract evidence, rejects foreign rows,
and ignores superseded responses. Inventory/intake and shared feature data
clear after 401/403. Transient feature refresh failures label preserved data
and provide retry. Status polling keeps the accepted command/resource identity
and ignores responses after cleanup. Reporting describes already implemented
scoped census discovery while preserving capture/copy/export deferrals.

### Environment and fixture lineage

- WSL2 Linux kernel `6.18.33.2-microsoft-standard-WSL2`, Bash, Node `24.17.0`,
  npm `11.13.0`, Playwright `1.61.1`, configured Desktop Chrome/Chromium profile.
- Browser preview: `http://127.0.0.1:4174`; synthetic mocked HTTP only, no
  shared database seed, migration, ledger mutation, or human UAT.
- Synthetic fixture instant: `2026-10-07T04:00:00.000Z`; distinct synthetic
  owner/recipient/regulator and foreign inventory/resource IDs. Inventory uses
  `INTERVIEW_DERIVED_CORE_V2`; retry tests select V2.1 cryoprecipitate.
- `apps/web/e2e/testing-phase.spec.ts` SHA-256:
  `a71153eefd54ecbb8ac2a8a73ee97bbd8844513be850196308c8e40e286629ba`.
- Unchanged `package-lock.json` SHA-256:
  `7809183849bdc5c2cb5ccb9b3e4e584d60c777cc6ee64e18bf1a12d9d3f1233c`.

### Execution and evidence

| Command | Exit/result | Boundary |
|---|---|---|
| `npm run test:web:e2e -- testing-phase.spec.ts` | 0 / PASS: 14 cases | Seven scenario groups; late response, foreign rows, six 401/403 cases, two transient refresh cases, two retry/failure/conflict cases, command resource binding, reporting deferrals |
| `npm run test:web:e2e` | 0 / PASS: 57 passed, 7 skipped | Full mocked browser suite; skips remain retired V1 mutations, never passing evidence |
| `npm run check:web` | 0 / PASS | Typecheck and production build; full browser run also rebuilt final source |
| `npm run test:web` | 0 / PASS: 62 tests, 18 files | Includes three command-reader identity/valid-transition tests |
| `npm run check:foundation` | 0 / PASS | JSON format, workspace, versions, ignore paths, safe environment template |
| `npm audit --json` | 0 / PASS: zero vulnerabilities | Current registry audit; no dependency changes |
| `npm run scan:secrets` | 0 / PASS | Pinned Gitleaks history, index, tracked and untracked candidate content |
| `git diff --check` | 0 / PASS | Patch whitespace |

The initial diagnostic browser attempt could not start its preview inside the
sandbox. The approved outside-sandbox diagnostic run exposed stale inventory,
foreign rows, and access-denial/refresh problems, plus two draft fixture errors:
the component selector and omitted expected `urgency` field. Its preview build
was rebuilt during implementation, so its mixed 9-failure/5-pass total is not a
frozen-baseline regression result. The isolated final focused and full runs
above are the acceptance evidence for this slice. Fixture corrections changed
no request-submission behavior; retry tests prove identical keys/body/version,
recipient scope, and truthful FAILED/CONFLICT presentation without resubmission.

Initial audit and secret-scan attempts were blocked by sandbox registry/Docker
access; approved reruns passed. Local logs are `/tmp/lat-testing-focused.log`,
`/tmp/lat-testing-browser.log`, `/tmp/lat-testing-unit.log`,
`/tmp/lat-testing-check.log`, `/tmp/lat-testing-foundation.log`,
`/tmp/lat-testing-audit.json`, and `/tmp/lat-testing-secrets.log`.

Complete real V5 acceptance remains BLOCKED by the previously recorded pinned
model/image prerequisites; it was not rerun here. Physical Android OCR, full
Fabric-to-browser NFR-06, RQ-07/RQ-14, institution binding/activation, and human
UAT remain open. Passing mocked UI tests does not complete BL-TST-01 or the
Testing phase, approve production use, or establish clinical validation.

SIMULATION_ONLY, concrete institution binding, explicit activation, RQ-07,
RQ-14/onboarding, UAT participant/consent/instrument/custody, physical Android
OCR and full Fabric-to-browser NFR-06 gates remain unchanged. Human UAT is
NOT_RUN. No deployment, operational recommendation, clinical/regulatory claim
or Testing-phase completion is authorized by this review.

## Lat verified runtime transfer and real V5 rerun — 2026-10-07

**Result:** PASS for the isolated real V5 producer/database/cookie/browser
boundary. Owner: Lat, Codex-assisted self-validation. Classification:
SIMULATION_ONLY. Tested implementation: `b5601cc87011d7eab7b3cb1bae3a4256e60b255f`
on `codex/lat-testing-traceability`. The frontend checkpoint is `71c91af`;
PR #23 executable/evidence commits were incorporated as `d0ceeed`/`b5601cc`,
preserving Jopia authorship. Both overlapping phase records were preserved.

Transport `bloodledger-pr21-runtime-2026-10-07.tar.gz` SHA-256:
`dbeec3106057c00fee967052563fa2fd295e3cdc52d249928c2b899c0f8a8b1c`.
Local extraction: `/tmp/bloodledger-runtime-transfer/2026-10-07-pr21`, outside
Git. Its manifest matches the committed
[v5 runtime manifest](v5-runtime-artifact-manifest-2026-10-07-jopia.json).
The model, image archive and seven optional library files match all manifest
checksums. Docker load returned the exact approved image identity
`sha256:dcb2ccd36834bcec33e3d5cb8158f2b7a75b0881f695821cc705764667fba4c1`;
real prerequisite checks reverified it before resource creation. Jopia's source
folder is not Lat's extraction path. No raw runtime artifact is committed.

### Reproducible commands and results

Set `BLOODLEDGER_V5_MODEL_TEST_PATH` to the local extraction's
`selected_model.json`; for Chromium set `LD_LIBRARY_PATH` to its `browser-libs`.
Docker commands require access to the local daemon.

| Command | Result / exit |
|---|---|
| `node --test tests/forecasting/v5-runtime-prerequisites.test.mjs` | PASS / 0, 20 tests |
| `node tests/forecasting/v5-runtime-prerequisites.mjs --producer` | PASS / 0, prerequisites only |
| `npm run check:api` | PASS / 0 |
| `npm run check:web` | PASS / 0 |
| `npm run build --workspace @bloodledger/coordination` | PASS / 0 |
| `bash tests/forecasting/v5-runtime-integration.sh` | PASS / 0, real producer persistence/replay/conflict, freshness/scope and V4 preservation |
| `node tests/api/v5-census-integration.mjs` | PASS / 0, 23 migrations/reapply/grants and persisted forty-combination census |
| `node tests/frontend/v5-cookie-integration.mjs` | PASS / 0, official cookie and real Chromium without interception |
| `npm run test:web` | PASS / 0, 62 tests |
| `npm run check:foundation` | PASS / 0 |
| `npm run scan:secrets` | PASS / 0, pinned history/index/candidate scan |
| `npm audit --json` | PASS / 0, zero vulnerabilities |
| `git diff --check` | PASS / 0 |

[Lat cookie/browser aggregate](v5-cookie-evidence-2026-10-07-lat.json)
records twenty rendered forecast series, forty persisted census combinations,
verified zeros, tenant isolation, independently available inventory, latest
unavailable forecast, Manila midnight stale behavior and logout/401.
[Lat census aggregate](v5-census-evidence-2026-10-07-lat-runtime.json)
records persistence, scope, fractional timestamps/digest, immutability and
fault-injected missing latest rows without fallback. Node is 24.17.0,
PostgreSQL 17.10 and Chromium 149.0.7827.55. Business date is 2026-10-07.
Logs remain local at `/tmp/lat-runtime-{producer,cookie,census,unit,foundation}.log`.
The first sandboxed prerequisite test could not execute; the approved native
rerun passed all twenty tests. Initial Docker load lacked sandbox daemon access;
the approved load succeeded. These are host execution restrictions, not runtime
defects. All three integration harnesses exited 0 after their cleanup.

This supersedes Lat's missing-artifact BLOCKED disposition only for the tested
isolated real V5 boundary. V4 remains default, institution binding is disposable
test-only, and ledger state is a synthetic committed-projection fixture.
No Fabric-to-browser NFR-06, physical OCR, human UAT, operational accuracy,
binding approval, activation, RQ-07/RQ-14, deployment or phase acceptance gate
is closed. PRs remain unmerged; no publication or teammate message was sent.

## Lat final pre-handoff regression — 2026-10-07

Owner: Lat, Codex-assisted self-validation. Classification: SIMULATION_ONLY.
Tested baseline: `467b14601414b9ba43c61a2d5e3e9d9965d991a5`. This follow-up makes
documentation-only corrections; application source remains as tested in the
real runtime rerun at `b5601cc`.

| Command | Exit/result | Boundary |
|---|---|---|
| `npm run test:web:e2e` | 0 / PASS, 57 passed, 7 skipped | Full mocked HTTP web suite, six-role navigation, error/access clearing, retry, canonical V2 request/local release and V4/V5/census states |
| `npm run check:capture` | 0 / PASS | Capture typecheck/build and packaged local OCR assets |
| `npm run test:capture` | 0 / PASS, 14 tests | Synthetic parser/capture/privacy/command evidence |
| `npm run test:capture:e2e` | 0 / PASS, 3 tests | Desktop Chromium synthetic PNG OCR with mocked session/commands; no external OCR request, volatile exact label, offline blocking and accepted command polling |
| `npm run scan:secrets` | 0 / PASS | Final history/index/candidate-content scan including local review documents |
| `npm run check:format` and `git diff --check` | 0 / PASS | Repository JSON formatting and patch whitespace |

Logs: `/tmp/lat-prehandoff-browser.log`,
`/tmp/lat-prehandoff-capture-check.log`, `/tmp/lat-prehandoff-capture-unit.log`,
`/tmp/lat-prehandoff-capture-browser.log`, and `/tmp/lat-prehandoff-secrets.log`.
Local link targets were checked in all eight affected documents. Browser suites rebuilt their
respective apps before execution; no shared preview server was reused.
The capture test titled “on device” runs browser-local OCR in Desktop Chromium;
it is not a physical Android result. Command commitment is mocked in this
capture suite; no Fabric event or durable offline replay is proved.
Seven skipped web tests are retired V1 request/approval/rejection/cancellation/
dispatch/transit/receipt mutations; canonical V2 coverage does not reinstate
those legacy actions or imply complete real transfer lifecycle acceptance.

[Pre-handoff review](LAT-PRE-HANDOFF-REVIEW.md) lists the local decision and
remaining owner gates. No Testing-phase acceptance or replacement execution
window is approved by this preparation.
# Lat design restoration and populated preview — 2026-10-08

The user requested restoration of the prior design progress together with sample
data and top navigation. The design remains preserved on
`codex/ui-polish-first-batch` at `f61a60f`; it was absent from the subsequently
selected persistent-integration snapshot. Lat restored the shared shell,
navigation order, compact page heads and three-signal dashboard around the current
V2/historical/V5 consumers on `codex/lat-restore-design`, implementation commit
`2e9e175c7f1ab25b6918eb6e6a9f55e22b95c1e8`. Original worktrees and the retained
database were preserved. The restored chart also reserves space for its highest
value labels.

The permanent [sample review command](VISUAL-REVIEW.md), `npm run review:web`,
serves current editable components at loopback 5175. It includes all ten tabs,
role/populated/empty/unavailable selectors and a direct Page selector in the top
toolbar. Every API write is blocked; samples never connect to API 3000. Historical
samples use explicitly constructed visual references, not the missing workbook
or local Fabric receipts. Port 5174 continues to use the real API through its
existing proxy. Those backend records remain empty; populated backend validation
and the account-policy/workbook/binding dependencies remain open.

Lat self-validation passed:

- `npm run check:web`: type check and production build.
- `npm run test:web`: 62 tests.
- `npm run test:web:e2e`: 57 passed, seven existing retired V1 mutation skips.
  Inherited test-only dashboard/alert/audit fixtures were aligned with the
  delivered V2 read paths; label/control assertions were updated for the restored
  design. Authorization, stale-state, failure, retry and scope checks remain.
- `node tests/frontend/visual-review/check.mjs`: 42 page checks, all ten tabs,
  role navigation, blocked writes, empty/unavailable states, top Page selector,
  CRYO, historical sample pagination and unclipped chart values; no page errors.
  The synthetic screenshot is `/tmp/bloodledger-visual-review-dashboard.png`.
- Real ordinary-login 5174→3000 probe: 23 checks, including all six existing
  accounts and permission/logout boundaries. Private report:
  `build/development-local/browser-restored-design.json`. This is empty-state
  evidence, not a populated durability pass.
- Repository foundation and secret scanning passed; no dependencies were added.

This is FR-03/09/12/14 presentation and NFR-11 technical evidence, SIMULATION_ONLY.
It does not complete UAT, physical OCR, clinical/operational accuracy, full
Fabric-to-browser latency, V5 activation or Testing-phase acceptance.
