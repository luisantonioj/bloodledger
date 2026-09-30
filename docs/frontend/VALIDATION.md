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
