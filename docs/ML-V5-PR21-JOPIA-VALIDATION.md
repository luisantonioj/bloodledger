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

## Jopia incorporation re-review and runtime prerequisites — 2026-10-07

**Perspective:** Jopia. **Executor:** Codex-assisted Jopia self-validation on the native WSL host. **Phase:** Testing-phase
BL-ML-05 follow-up. **Requirements:** FR-12/FR-14, BR-ALG-07,
NFR-01/09/10/11. **Classification:** SIMULATION_ONLY.
**Decision:** Jopia technical validation PASS; Lat’s own real browser rerun and
frontend decision remain pending. Full live V5 acceptance remains BLOCKED until
that owner gate is recorded.

### Reviewed baseline and dispositions

GitHub was refreshed at PR #21 head
`0f2f1f42d735f606aabf1a754bb6cca261b117e4` and PR #22 source
`6c2d1483e65dca1ae2c91e69f939b931396e0ecc`. Both remain open and unmerged.
All seven source/recipient patch pairs are identical; original author names and
`cherry-pick -x` source references are preserved:

| Source | Recipient | Source review disposition |
|---|---|---|
| e5e52bf | bfa2e85 | Role alignment and complete V5 envelope incorporated |
| 8e84bdc | 0f390e5 | Scoped census API and persisted coverage incorporated |
| 9883e0b | 7ae75b8 | Independent census UI and safe clearing incorporated |
| 9fda19c | b30dd6c | Timestamp precision and Analytics deep link incorporated |
| 9bd06b3 | dc2a779 | Real cookie/browser harness incorporated |
| f13c2b0 | 4e21b66 | Exact synthetic scanner exceptions and dependency updates incorporated |
| 6c2d148 | 41535d6 | Prior Jopia evidence incorporated without reattribution |

The complete repository trees differ only in nine paths: Lat's five
documentation updates, census aggregate, lockfile, new database harness, and
cookie prerequisite handling. Application code, contracts, existing regression
tests, migrations and scanner configuration match PR #22 exactly. This is
source-equivalence evidence; it does not replace current runtime checks.

The reviewed endpoint restores the official session, permits roles 01–03,
derives institution scope from the principal, rejects query overrides, and
performs no capture. Census reads select and validate the latest snapshot,
require forty persisted combinations with count invariants, preserve fractional
timestamps and recompute the digest before exposing zeros. Invalid evidence
does not revive older snapshots. The web parser requires twenty unique V5
series/IDs and consistent run/date/model evidence; the view rejects foreign
institutions and clears old forecasts on refresh, selection changes and races.
The independent panel and Analytics deep link match the incorporated source.

Lat's `dbea2ec` patch changes only source-map-js version, URL and integrity;
the delivered lockfile contains 1.2.2. The current native audit reports zero vulnerabilities.
The database harness uses a fresh census database separately from recovery
probes, proves immutable deletion rejection, and injects a missing row only at
the read boundary. Its finally block names only its own container/temp directory.
Lat’s prior results retain their attribution; Jopia also reran this harness on
the current implementation SHA and recorded separate evidence below.

Buno's APPROVED review on PR #20 at
`dfffe8aba7d02b0d109b2dbd27e240ddcbeb11d9` was re-read through GitHub.
No model, mapping, saved means or inference code is changed in this follow-up.
No new calculation approval is required for the prerequisite-only change.

### Implemented prerequisite follow-up

The producer still used `bloodledger-forecasting:latest`. The follow-up replaces
that mutable selection with the same immutable image ID as the cookie harness.
[Shared prerequisites](../tests/forecasting/v5-runtime-prerequisites.mjs) own
both harnesses' image and model-file pins. The Python adapter remains
authoritative for canonical parameters and inference.

The producer now checks model bytes/hash, Python availability, Docker and all
required images before making a temporary directory or database container.
It normalizes the external model path for the read-only bind mount. The cookie
harness uses the same check plus a Chromium launch/close check; the integration
body following preflight is unchanged. No API, schema, migration, policy or
inference behavior is modified.

Missing/unreadable model, missing Python/Docker/images/browser are BLOCKED/2.
Wrong model hash, wrong image identity or unexpected model I/O failure are
FAIL/1. A PASS/0 preflight explicitly means prerequisites only, not successful
integration. Child-process errors are replaced with fixed safe reasons. No
automatic image pull, model substitution or shared service mutation is added.

### Native validation and resolved blockers

The implementation is committed at
`60fd148740c9ce45b379bec1633923fceef39d11` on
`codex/pr21-jopia-runtime-prerequisites`, based on the reviewed PR #21 head.
All final executable checks below ran against this implementation commit;
the subsequent evidence-only commit changes documentation and safe aggregates.
The native executor recovered through its approved host execution route without
reinstallation or shared-service changes. Authenticated native Git/CLI replaced
the connector route that previously returned 403. Neither prior limitation is
used as current validation evidence.

| Native command/check | Result / exit |
|---|---|
| `npm ci` | PASS / 0; one committed lockfile |
| `node --test tests/forecasting/v5-runtime-prerequisites.test.mjs` | PASS / 0; 20 tests, zero skipped |
| `node --check` on shared module, focused tests and both frontend probes; `bash -n tests/forecasting/v5-runtime-integration.sh` | PASS / 0 |
| `npm run check:foundation` | PASS / 0 |
| `npm run check:api`; `npm run test:api` | PASS / 0; 106 tests |
| `npm run check:web`; `npm run test:web` | PASS / 0; 59 tests |
| `npm run check:coordination`; `npm run test:coordination`; coordination build | PASS / 0; 19 tests |
| `npm run test:capture` | PASS / 0; 14 tests |
| `npm run check:database` | PASS / 0 |
| `npm run test:web:e2e` | PASS / 0; 43 passed, seven existing retired V1 cases skipped |
| Pinned image: Ruff format/lint, mypy and pytest | PASS / 0; 31 formatted files, 18 typed source files, 117 tests, no skips; real external model enabled |
| `node tests/api/v5-census-integration.mjs` | PASS / 0; 23 migrations, idempotent reapply/grants, API and coordination persistence, forty-row census |
| `bash tests/forecasting/v5-runtime-integration.sh` | PASS / 0; frozen inference, replay/conflict, latest-attempt precedence, future/expiry, scope, V4 preservation |
| `node tests/frontend/v5-cookie-integration.mjs` | PASS / 0; official cookie and real Chromium, no HTTP interception |
| Native negative cookie-harness processes | PASS; missing/nonexistent/directory/unreadable model and unavailable Chromium exit 2; corrupt hash exits 1 |
| `npm audit --json` | PASS / 0; zero vulnerabilities across all severities |
| `npm run scan:secrets`; `git diff --check` | PASS / 0; history/index/candidate content and whitespace |

The twenty native prerequisite tests cover all eighteen previously simulated
cases plus actual file/CLI adapters and unsupported arguments. Missing Docker,
Python and each image, unexpected image identity, and unavailable Chromium use
injected failures and read-only command traces. No shared image was deleted or
shared service stopped. Native subprocesses verify real file access and exits.
Corrupt bytes and unexpected I/O fail; unavailable dependencies stay BLOCKED/2.
The initial invocation without the documented model variable exited 2 as
expected; it was corrected before the final successful producer run.

The current [decision/regression aggregate](frontend/v5-prerequisite-decision-evidence-2026-10-07.json),
[Jopia census evidence](frontend/v5-census-evidence-2026-10-07-jopia.json) and
[Jopia cookie evidence](frontend/v5-cookie-evidence-2026-10-07-jopia.json) are
separate from prior owner evidence. Current browser assertions prove twenty
rendered series and saved-mean mapping, forty census combinations and verified
zeros, tenant isolation, override rejection, independent census availability,
latest unavailable precedence, Manila-midnight staleness and logout/401.
The current Manila business date was 2026-10-07; midnight uses the isolated
server’s injected clock. PostgreSQL numeric(12,6) precision remains unchanged.
The standalone live probe passed rendered success and kept the deliberately
unavailable latest attempt BLOCKED.

The three harnesses cleaned up their own containers and temporary resources;
a post-run inventory found no census/cookie/producer harness container remaining.
Only synthetic committed projection fixtures and disposable synthetic accounts
were used. The external model hash remained unchanged. Shared development data,
Fabric and services were not reset or seeded. Safe logs remain outside Git in
`/tmp/jopia-pr21-native`; credentials, cookies and raw artifacts are not committed.

### Recovered artifacts and runtime reconciliation

The original frozen model was recovered from Jopia’s existing external handoff
ZIP; only `selected_model.json` was extracted. The unchanged pinned loader
verified the file hash, canonical parameter hash, all twenty saved means and
existing research-to-runtime series mapping. The original forecasting image was
already available, so no replacement build, retraining or reconstruction was
needed. Buno’s prior approval remains recorded; neither artifact recovery nor
these prerequisite changes require a new calculation review.

The [artifact manifest](frontend/v5-runtime-artifact-manifest-2026-10-07-jopia.json)
records the actual external directory:
`/home/luisantonioj/bloodledger-handoffs/2026-10-07-pr21`.

| Artifact | Verified identity |
|---|---|
| `selected_model.json` | File SHA-256 `1e0f0c240109e49e8f1a89a713021afae07c2f5fae5b0e2bc8e3904610fb9764` |
| Canonical frozen parameters | SHA-256 `ceb0e74b2eb2f8af7fcafabb3619f2a23681c38eac65998816e7daf40b5afb86` |
| Original forecasting image | `sha256:dcb2ccd36834bcec33e3d5cb8158f2b7a75b0881f695821cc705764667fba4c1`, linux/amd64 |
| `forecasting-image.tar` | Archive SHA-256 `aa1ab6e460911f91cba6164116302015d76fb5c6e591c5208a0835bb40cd0b26`; checksum and load/identity check PASS |
| Forecasting dependency lock | SHA-256 `67899a9f908fef2fd2177ca05032c8c6fad8456a97d3c051dc30154b52972a88` |

The architecture table’s planned Python 3.13.14 differs from the original
image’s effective Python 3.13.11. This is the explicitly recorded Sprint 3
runtime-availability deviation in [Sprint 3](SPRINT-03.md#6-effective-environment-deviation)
and [forecasting setup](../services/forecasting/README.md).
The recovered, previously validated image and effective baseline are preserved;
this follow-up does not claim 3.13.14 validation. Its Dockerfile pins
`python:3.13.11-slim@sha256:2b9c9803c6a287cafa0a8c917211dddd23dcd2016f049690ee5219f5d3f1636e`
and requires hashed dependencies. Historical build commit provenance is not
embedded in image labels; the original image identity and currently validated
mounted-source SHA are recorded separately. The user’s 3.13.14 replacement
fallback was unnecessary because the exact original image was recovered.

Native versions: Node 24.17.0, npm 11.13.0, PostgreSQL 17.10, Playwright 1.61.1,
Chromium 149.0.7827.55. Chromium initially lacked NSPR/NSS/ALSA shared libraries.
Seven files were copied from the existing pinned Playwright image
`sha256:5b8f294aff9041b7191c34a4bab3ac270157a28774d4b0660e9743297b697e48`
into an isolated directory; no host packages were installed. Verified copies,
`browser-libraries.sha256`, the archive checksum, artifact manifest and README
are included beside the model/archive outside Git. The manifest records every
library checksum.

### Lat reproduction and Jopia review handoff

Transfer the external directory through the existing artifact channel and
preserve its restricted permissions. The paths below identify Jopia’s source
package; Lat sets `runtime_dir` to the transferred directory on his own host.
First check out the published follow-up commit; the tested implementation SHA is
`60fd148740c9ce45b379bec1633923fceef39d11`. The evidence-only descendant has
identical executable sources. Verify Node/npm versions and installed Docker;
the existing `postgres:17.10` and `node:24.17.0-bookworm-slim` images are required.
The locked Playwright 1.61.1 Chromium runtime must already be installed.

```bash
runtime_dir=/home/luisantonioj/bloodledger-handoffs/2026-10-07-pr21
(cd "$runtime_dir" && sha256sum --check forecasting-image.tar.sha256)
(cd "$runtime_dir" && sha256sum --check browser-libraries.sha256)
printf '%s  %s\n' \
  1e0f0c240109e49e8f1a89a713021afae07c2f5fae5b0e2bc8e3904610fb9764 \
  "$runtime_dir/selected_model.json" | sha256sum --check

docker image load --input "$runtime_dir/forecasting-image.tar"
forecasting_image=sha256:dcb2ccd36834bcec33e3d5cb8158f2b7a75b0881f695821cc705764667fba4c1
test "$(docker image inspect --format '{{.Id}}' "$forecasting_image")" = "$forecasting_image"
node --version
npm --version
npm ci
export BLOODLEDGER_V5_MODEL_TEST_PATH="$runtime_dir/selected_model.json"
export LD_LIBRARY_PATH="$runtime_dir/browser-libs${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
node --test tests/forecasting/v5-runtime-prerequisites.test.mjs
node tests/forecasting/v5-runtime-prerequisites.mjs --producer
npm run test:api
npm run check:web
npm run build --workspace @bloodledger/coordination
node tests/api/v5-census-integration.mjs
bash tests/forecasting/v5-runtime-integration.sh
node tests/frontend/v5-cookie-integration.mjs
```

Every successful command above exits 0. Prerequisite-only PASS does not count as
integration. Lat’s producer/database/browser run must record its own source SHA,
versions and safe aggregates, including twenty rendered forecasts, forty census
combinations, verified zeros, scope, midnight and logout assertions.

**Prepared Jopia review:** the seven original findings are resolved against the
reviewed PR #21 head and native-validated follow-up implementation. Lat’s added
lockfile, census harness and prerequisite behavior are reviewed and independently
rerun. Jopia’s runtime/model/API/database/harness tasks are complete on this host,
with self-validation disclosed. Publication is recorded by the follow-up draft
PR and its grouped commit history. Lat retains the frontend rerun and decision;
this evidence does not impersonate that owner’s validation. PR #22 remains the
source of incorporated work; neither existing PR is merged or closed.

V4 remains default; all outputs remain SIMULATION_ONLY and recommendations
remain disabled. Binding approval, V5 activation, RQ-07/RQ-14, human UAT,
physical OCR, full Fabric-to-browser latency acceptance and deployment remain
separate gates. Jopia’s earlier 2026-10-01 results and Lat’s prior source/mocked
results retain their original attribution.
