# PR #21 — Jopia review and implementation validation

**Date:** 2026-10-01 Asia/Manila. **Perspective and validator:** Jopia,
self-validation. **Phase:** Testing-phase follow-up to BL-ML-05.
**Requirements:** FR-12, FR-14, BR-ALG-07, NFR-01/09/10/11.
**Classification:** SIMULATION_ONLY. Lat retains frontend ownership and
resulting-change review; Buno retains ML/research ownership. Human UAT is NOT_RUN.

## Decisions and exact revisions

Reviewed PR [#21](https://github.com/luisantonioj/bloodledger/pull/21) head:
`91500c9e250fdcbf545a1e0158f34f6b43067df7`. Initial decision: request changes,
accepting the explicit simulation-only preview. The [initial reply](https://github.com/luisantonioj/bloodledger/pull/21#issuecomment-5919449154)
identified role authorization, successful-envelope completeness, the live
probe’s fixed date and missing rendered-result assertion, absent browser census
contract and eleven untriaged historical scan findings.

Authorized implementation branch: `codex/pr-21-jopia-review`, based on that
refreshed PR head and targeting `codex/ml-v5-frontend`. The prior
`codex/ml-v5-jopia-runtime` branch and its work were preserved. Implemented
revision: `f13c2b0c2a69662d85b91a0bbd59e748f5944b0f`. The real cookie harness
records this exact clean revision. Earlier focused checks ran the same source
changes before they were grouped into commits; documentation follows separately.

The confirmed defects are corrected in this follow-up. Request changes remains
the decision on the original reviewed head until these fixes are incorporated.
The resulting inactive preview can be considered for approval after Lat reviews
that resulting diff and any newly discovered defects are dispositioned. This
is not activation, institutional binding, clinical acceptance or deployment.

## Implemented contract and regressions

The [integration contract](ML-RUNTIME-INTEGRATION-V5.md#pr-21-follow-up--independent-browser-inventory-evidence)
and [OpenAPI V2](../services/api/openapi-v2.json) own the read contract. The GET
uses official cookie roles 01–03, only the session’s institution and a validated
business date. It rejects institution overrides, does no capture and uses the
existing internal ML snapshot store. Full raw persisted coverage, count
invariants, policy/schema/header metadata and recomputed digest precede zero
verification. The latest selected snapshot never falls back to older evidence.
No applied migration was edited and DOH capture/export remains gated.

The frontend independently presents snapshot identity, capture/evaluation
instants, Manila dates, coverage, digest/watermark and forty persisted count
combinations. CURRENT, historical STALE and unavailable states are distinct.
Selection races, refresh errors and logout cannot retain prior usable counts.
V5 successful results require all twenty supported unique series, unique
forecast IDs, consistent run/model/date metadata and unavailable uncertainty.
V4 remains the default. No stock-dependent recommendation is enabled.

Two defects found through real integration were additionally fixed: the static
server omitted the `/analytics` deep link; PostgreSQL Date reconstruction through
String discarded milliseconds and invalidated snapshot digests. Regressions now
cover the route and fractional timestamps. Corrupt header timestamps return
unavailable evidence instead of a reconstructed snapshot.

## Executed checks and reproduction

Node 24.17.0, npm 11.13.0, PostgreSQL 17.10, Playwright 1.61.1 and Chromium
149.0.7827.55 were used on the WSL host. The locked dependencies were installed.
The forecasting image used was
`sha256:dcb2ccd36834bcec33e3d5cb8158f2b7a75b0881f695821cc705764667fba4c1`.
The external selected-model file matched SHA-256
`1e0f0c240109e49e8f1a89a713021afae07c2f5fae5b0e2bc8e3904610fb9764`.
It and all temporary credentials/bindings remained outside Git.

| Executed command | Result |
|---|---|
| `npm run check:foundation` | PASS: format, workspace, pinned versions, ignore and safe environment |
| `npm run check:api` / `npm run test:api` | PASS; 106/106 tests, none skipped |
| `npm run check:web` / `npm run test:web` | PASS; build/typecheck and 59/59 tests |
| `npm run test:web:e2e` | PASS; 43 passed, 7 existing retired V1 cases skipped |
| `npm run check:coordination` / `npm run test:coordination` | PASS; 19/19 tests |
| `npm run check:database` | PASS; static schema/migration boundary |
| `npm run test:capture` | PASS; 14/14 tests after shared Vitest security update |
| `bash tests/forecasting/v5-runtime-integration.sh` with external model | PASS; producer, persistence, future/expired evidence, no fallback, scope, immutable coordination and V4 compatibility |
| `node tests/frontend/v5-cookie-integration.mjs` with external model | PASS; real browser/HTTP, no interception; aggregate below |
| `node --check` on both frontend probes / `git diff --check` | PASS |
| `npm audit --json` | PASS; zero production and development vulnerabilities at execution |
| `npm run scan:secrets` | PASS; history, staged index and candidate tree after exact exceptions |

Builds are supplied by `npm run test:api` and `npm run check:web`. Set
`BLOODLEDGER_V5_MODEL_TEST_PATH` to an external copy of the pinned release model,
then run the two integration commands above. The cookie harness requires the
recorded forecasting image, Docker, PostgreSQL image and browser runtime. It
creates its own ephemeral-port database, migrates it, provisions random
synthetic accounts through the supported account function and serves the real
API/web build. It never populates the shared development database. It cleans up
only its created container and temporary directory.

The default business date is the current Manila date across producer, HTTP
assertions and browser controls. `BLOODLEDGER_BROWSER_BUSINESS_DATE` overrides it
for a synthetic boundary case; only the test server receives an injected clock.
The recorded run used 2026-10-01 and advanced that test clock to Manila midnight.
A separately executed missing-model scenario exited 2 with explicit BLOCKED.
Missing runtime/model prerequisites cannot establish successful integration.

This host lacked several Chromium shared libraries. Temporary copies from the
already available pinned `mcr.microsoft.com/playwright:v1.61.1-noble` image were
placed in `/tmp/pr21-browser-deps`; browser commands used
`LD_LIBRARY_PATH=/tmp/pr21-browser-deps`. No host package or repository dependency
was added for this workaround. No other host or physical-device coverage is
claimed. Previous failed development runs are superseded by final passing runs:
first live failures were the deep link, fractional timestamp reconstruction and
an assertion overlooking authoritative PostgreSQL numeric(12,6) rounding.

The committed [safe aggregate](frontend/v5-cookie-evidence-2026-10-01.json)
records the exact revision and runtime. It proves HttpOnly cookie authentication,
V4 default, explicit V5 HTTP/rendered twenty-series results, forty persisted
census rows with verified zeros, independent inventory availability, other-tenant
isolation, override rejection, unavailable latest attempt, Manila-midnight
staleness, UI logout clearing and subsequent 401s. It also runs the standalone
live probe against the same server: rendered success is PASS; latest unavailable
is BLOCKED. No credential, cookie, trace, screenshot or raw application payload
is retained. The committed projection is a synthetic fixture, not a live Fabric
commit. Full Fabric-to-browser NFR-06 and physical OCR evidence remain deferred.

Focused API/web cases additionally cover all six roles, revoked sessions,
invalid dates, missing zero rows, duplicate coverage, digest mismatch, negative
and inconsistent counts, stale/future timestamps, malformed V5 envelopes, races,
refresh failures, keyboard controls and a 390 × 844 viewport.

## Historical secret-scan dispositions

All eleven findings used the generic-api-key rule. Only redacted path/commit/line
metadata is recorded here. The historical source and how each value was used
were inspected. Synthetic workflow/run IDs have no authentication capability;
fixed test signing keys and probe credentials are passed solely to disposable
in-process test applications. No credential-owner remediation is required for
these demonstrated false positives.

| Path | Historical commits and lines | Count | Disposition |
|---|---|---:|---|
| `services/api/test/v5-forecast.test.ts` | `3027494:39` | 1 | Synthetic run ID |
| `tests/forecasting/v5-api-probe.mjs` | `3a6fd66:10` | 1 | In-process synthetic probe credential |
| `services/api/test/sprint-6-integration-probe.mjs` | `717c50a:116,124`; `4f712c9:88` | 3 | Synthetic idempotency IDs |
| `services/api/test/v2-contract-boundary.test.ts` | `15db63f:150`; `12a2a96:162`; `635295d:139,142`; `e270b44:120,130` | 6 | In-process test signing keys and synthetic idempotency IDs |

[Scanner exceptions](../.gitleaks.toml) require BOTH the exact test path and exact
matched synthetic value. No generic detection rule, entire test directory or
history range was excluded; history was not rewritten. A real exposed
credential remains a blocker requiring its owner’s remediation.

The audit additionally found vulnerable production dependencies and a development
Vitest/mocker finding. Scoped pins now use Fastify 5.12.5, grpc-js 1.14.5 and
Vitest 4.1.11; the lockfile updates brace-expansion and fast-uri within supported
major ranges. Subsequent unit, browser, API and integration checks passed.
Zero audit findings is time-specific scanner evidence, not a security guarantee.

## Verified owner evidence and remaining gates

GitHub shows Buno’s [APPROVED review](https://github.com/luisantonioj/bloodledger/pull/20#pullrequestreview-5367073735)
on exact head `dfffe8aba7d02b0d109b2dbd27e240ddcbeb11d9`, followed by PR #20 merge
`b028515b0d48c4d4819f00c87ce8866163cdc0f7`. This supersedes formal-backend-approval
pending statements. Buno’s prior ML results and Lat’s original mocked browser
results remain their evidence; the checks above are Jopia’s own self-validation.
The forecasting Python suite was not newly rerun in this follow-up.

Lat resulting-change review, a separately approved concrete synthetic binding,
explicit V5 activation, RQ-07 operational accuracy, RQ-14/onboarding, human UAT
participant/consent/instrument/custody approvals, physical Android OCR and full
Fabric-to-browser NFR-06 evidence remain open. Operational interpretation,
autonomous recommendations, deployment, clinical/regulatory acceptance and
production-readiness claims are excluded.
