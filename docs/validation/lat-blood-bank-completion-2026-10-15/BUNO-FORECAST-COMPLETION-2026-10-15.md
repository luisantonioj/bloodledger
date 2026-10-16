# Buno forecasting completion review — 2026-10-15

Classification: SIMULATION_ONLY. Technical self-validation, not host validation,
UAT acceptance, activation, clinical accuracy or deployment approval.

## Scope and baseline

Reviewed main `b3bd63c90e0c936420b9e4d2eb6c3064162ef6bc` in a separate checkout
on `codex/buno-forecast-completion`. The original checkout and its pending
Testing-phase edits were preserved. Reviewed Lat's saved Analytics source at
`fd9154a4f477b7f53abc4cd69cf87d2d6868e791` read-only; this is not evidence
that those screens are deployed. No retained database, census, credentials,
worker, inventory, model or binding was changed.

Sources: AGENTS, current Testing phase, FR-04/14, architecture ADR-031/034/035,
ML-RUNTIME-INTEGRATION-V5, ML-V5-EXPLORATION, ML-V5-BUNO-REVIEW,
ML-V5-JOPIA-VALIDATION and Lat's private completion handoff.

## Results

| Check | Result | Evidence / limit |
|---|---|---|
| Original external model file and canonical parameters | PASS | Hashes below; 20 exact values reproduced |
| Frozen inference and mapping | PASS | Original artifact used by runtime tests; no fit, workbook or recent history required by runtime |
| Forecasting suite | PASS | 119 tests, no skipped external-model test |
| API suite | PASS | 183 tests, including future generation and Manila midnight boundaries |
| Coordination suite | PASS | 21 tests, including two added regression tests |
| Full pinned-image PostgreSQL/producer/authenticated API probe | BLOCKED | Required image absent locally; not rebuilt or substituted |
| Lat's currently persisted rows, binding and screens | NOT_RUN | No access to Lat's live host; earlier teammate reports are not this review's independent evidence |
| Operational accuracy, new groups/facilities | BLOCKED | RQ-07 and separate data/model/binding/owner decisions |

No supported production calculation defect was reproduced. Changes add regression
coverage and a model-audit helper, plus this report and a separate expansion plan.
The selected model, research protocol, runtime calculations and V4 default remain
unchanged. This review does not certify every integration boundary or close the
remaining gates.

## Forecast contract and coverage

Model `bloodledger-v5-series-mean-1.0.0`, dataset
`SYNTHETIC_FORECAST_V5_RUNTIME_V1`, one-day target, training cutoff 2025-06-30.

- File SHA-256: `1e0f0c240109e49e8f1a89a713021afae07c2f5fae5b0e2bc8e3904610fb9764`.
- Canonical parameter SHA-256: `ceb0e74b2eb2f8af7fcafabb3619f2a23681c38eac65998816e7daf40b5afb86`.
- Required integration image: `sha256:dcb2ccd36834bcec33e3d5cb8158f2b7a75b0881f695821cc705764667fba4c1`.
- Actual unit-test image: `sha256:d539c784667d763b48947971260fe88fb7c436d48eeea7c4eccf2c7369bf0c19`, with current source mounted. This is explicitly not the pinned integration-image check.

The audit helper produces a 20-row CSV with exact saved means, API enum mapping,
origin/target, cutoff and binding limitations. Its binding is only
`SIM_INSTITUTION_01` → `INST_SYNTHETIC_REVIEW`; it grants no institution approval.
The worked run uses origin Oct 14, target Oct 15, generated Oct 15 00:00 UTC.

| Facility / scope | Product coverage | Availability interpretation |
|---|---|---|
| Research SIM_INSTITUTION_01 | A+, B+, O+, AB+ × WB, PRBC, FFP, PC, CRYO: 20 | Exact frozen outputs verified |
| Isolated INST_SYNTHETIC_REVIEW | Same 20 | Test binding only; no persistence |
| Mediatrix runtime | Same 20 only with reviewed explicit binding | Current host binding/rows not verified here |
| Other named facilities / PRC | No additional evaluated facility-specific model | Never copy Mediatrix values or infer approval from an alias |
| A−, B−, O−, AB−, at every facility | Inventory can record them; no current model coverage | Demand remains unavailable, not zero |

For every runtime facility, Jopia/Lat must supply sanitized binding ID/hash, run ID,
payload hash, institution, origin, target, generation time and 20 unique rows to
verify its actual state. There is no automatic daily refit. Frozen means are
fractional expected requested units, not bags to dispense. UI two-decimal display
must never become a rounded calculation input. Null uncertainty means unavailable,
not a zero-width interval. CURRENT refers to the Manila target window and does not
mean newly trained. A latest unavailable attempt cannot revive an earlier success.
V4 remains default; explicit V5 preview is separate.

## Surplus and evidence checks

Current synthetic formula is `max(0, floor(E − F − 2 − 10))`, where E is the
snapshot's unexpired AVAILABLE count and F is fractional expected demand.
Reserved units and expired available units do not contribute to E. This is
snapshot evidence, not a guarantee of live stock at the time of a later action.

The regression test uses F=4.5, two expired AVAILABLE units and nine RESERVED
units. E=0,16,17,18,28 gives surplus=0,0,0,1,11 respectively. It verifies exact
forecast/run/snapshot/digest references and that changed stock changes evidence
identity even when surplus remains zero. Missing product evidence fails instead
of becoming zero. Future generation, wrong forecast ID, failed/stale run, wrong
target, missing/stale stock and institution mismatches fail closed in the tested
paths. BROA rejects mismatched candidate products; equal candidate scores select
by destination ID deterministically. Recommendations cannot approve transfers.
Existing RPS/FEFO tests remain in the passing coordination suite.

The trusted ML snapshot adapter validates all 40 persisted inventory cells before
reconstructing counts. The surplus function trusts that adapter; its focused unit
fixtures intentionally contain only the selected product. A snapshot can remain
same-day while inventory changes afterwards: show its timestamp and use current
version/FEFO checks at execution. Do not describe its result as live disposable
stock. A changed snapshot digest yields different surplus evidence.

The synthetic allowances 2 and 10 are not stock-status thresholds. The newer
accepted `SYNTHETIC_STOCK_CLASSIFICATION_V1` is a separate project-only frontend
band policy under FR-04. RQ-16 remains open; neither those bands nor surplus
constitute institutional safety levels or redistribution approval.

## Observed history and frontend boundary

Lat's saved source filters bank history by source institution and requesting-facility
history by destination. Requested quantities remain distinct from dispatched,
received and transfused quantities. Missing request dates are excluded from dated
charts, not filled with zero; departments and network-wide history remain
unavailable. Displayed peaks apply only to returned dated records. Two-decimal
forecast formatting preserves fractional presentation and unavailable uncertainty.
The new redistribution table remains an unavailable placeholder; existing backend
surplus support does not prove that this new table is connected.

Jopia owns a complete authorized aggregate/history read if full-period comparisons
are required: return covered dates, omitted/undated counts, institution/product
scope, completeness or pagination metadata and distinct requested/received event
measures. Lat must not label a capped returned list as complete annual demand or
train a model from that list. No new department or clinical fields are inferred.

## Reproduction

Use an isolated checkout at the baseline plus this patch. Keep the external model
outside Git. Logs and audit CSV/bundle belong under ignored `build/buno-review/`.
Commands used (Docker mounts the isolated checkout as `/workspace`):

```bash
npm ci --ignore-scripts
npm run test:api
npm run test:coordination
# Forecasting container: mount services/forecasting as working directory,
# external selected_model.json as /workspace/model.json, PYTHONPATH=src.
BLOODLEDGER_V5_MODEL_TEST_PATH=/workspace/model.json python -m pytest -q -p no:cacheprovider
# Mount repository and external model; PYTHONPATH=services/forecasting/src:
python tests/forecasting/v5-model-audit.py /workspace/model.json build/buno-review
```

Node container: `node:24.17.0-bookworm-slim`; forecasting unit-test image and hashes
are stated above. The initial audit write failed due to container UID permissions;
rerunning with the checkout owner's UID passed. No artifact data was changed.
The full integration command is **not a passed command in this review**:

```bash
BLOODLEDGER_V5_MODEL_TEST_PATH=/absolute/private/selected_model.json bash tests/forecasting/v5-runtime-integration.sh
```

It requires the original pinned image and supported Node runtime. Jopia owns its
isolated rerun and actual binding review; Lat owns real browser evidence and
wiring the preserved designs. Buno's expansion proposal is
[BUNO-FORECAST-EXPANSION-PLAN.md](BUNO-FORECAST-EXPANSION-PLAN.md).

## Local evidence hashes

These identify this review's ignored local outputs, not Lat's host evidence:

| File under build/buno-review | SHA-256 |
|---|---|
| forecasting.log | `3967a3470f7eac359388222b353644d0c76efe416477cf10067638da7e665570` |
| api.log | `398f25ad884aa2fdcff0e48706a5eb301c517c9073c1083ce32400f0f69d958d` |
| coordination-expanded.log | `49ed4d7901795b5370ab1b5799a4862a73dbbd11fdd24d565dce7a1afcc036b9` |
| coverage.csv | `30be0985e1d90a5903a0167ba6edf76f5215951589e603e94f9a7650621b3be4` |

The audit helper also passed Ruff after correcting its import order and replacing
assertions with explicit validation (so Python optimization cannot disable checks).
`git diff --check` passed. No push, deployment or activation was performed.
