# Sprint 3 — Transfer, Location, Optimization, and Forecasting

**Status:** In progress; forecasting slice validated 2026-08-13, expanded continuation authorized 2026-08-14

**Accountable owner:** Jopia  
**Assigned owner/validator:** Jopia (self-validation disclosed)  
**Branch:** `codex/sprint-03-ml-experiment`  
**Baseline:** `sprint-02-accepted-2026-07-30`  
**Policy baseline:** `SYNTHETIC_FORECAST_V1`, `SYNTHETIC_TRANSFER_V1`,
`SYNTHETIC_LOCATION_V1`, and `SYNTHETIC_OPTIMIZATION_V1`

## 1. Sprint goal

Complete the Gantt Sprint 3 boundary: preserve the reproducible ML slice, add a
deterministic transfer/custody contract with FEFO reservation, persist minimal
dispatch/receipt location evidence, and provide explainable off-chain RPS/BROA
simulation commands before local Fabric validation and consolidated review.

This sprint is an experiment. It does not demonstrate Mediatrix accuracy,
clinical safety, regulatory acceptance, or production readiness.

## 2. Entry gates and unresolved decisions

- Sprint 2 was accepted by Jopia on 2026-07-30 and tagged before this work.
- PA-ML-01 authorizes `SYNTHETIC_FORECAST_V1`; the implementation must record
  its schema, generator version, seed, time range, lineage, and classification.
- `BL-ML-01` remains blocked because no approved institutional dataset exists.
- `RQ-07` remains open, so no model metric can justify operational use.
- `BL-ML-03` remains gated by approved safety and reserve policy.
- `PA-S3-01` authorizes conservative synthetic transfer mechanics while
  `RQ-04`, `RQ-09`, `RQ-10`, `RQ-12`, and `RQ-15` remain replacement gates.
- `PA-S3-02` authorizes invented location fixtures and a 30-day exact-point
  retention test; `RQ-08` remains unresolved for real use.
- `PA-S3-03` authorizes simulation-only RPS/BROA configurations while
  `RQ-05`–`RQ-07` remain operational gates.

The temporary workbook, exploratory notebook, and revised manuscript are
research inputs only. They are not copied into the runtime, used as canonical
training data, or treated as implementation authority.

## 3. Included work

### S3-01 — Activate the forecasting package

Create the pinned Python package, one-shot Compose profile, safe CLI, generated
artifact ignore rules, and commands for data generation, validation, training,
forecasting, and scenario-only surplus evaluation.

### S3-02 — Generate and validate synthetic requested demand

Generate daily data from 2025-01-01 through 2025-12-31 for `INST_MEDIATRIX`
and the Cartesian product of `A_POSITIVE`/`O_POSITIVE` with
`RED_BLOOD_CELLS`/`PLATELETS`, using seed 42. Validate the machine-readable
contract, daily continuity, enumerations, quantities, inventory identities,
stockout semantics, duplicates, and prohibited-field absence.

### S3-03 — Evaluate and select the forecast model

Target `requested_units`. Compare seven-day seasonal naive, seven-day weighted
moving average, and one global random forest. Use an initial 180-day training
window, five 30-day validation folds, and one final 35-day fold. Report MAE,
WAPE, and RMSE; do not use MAPE for model promotion.

The random forest is selected only when pooled MAE is at least 5% better than
both baselines and no series MAE is more than 10% worse than its best baseline.
Otherwise select the lowest pooled-MAE baseline, using the weighted baseline for
an exact tie.

### S3-04 — Persist versioned next-day forecasts

Add the approved column-level PostgreSQL schema for forecast runs and demand
forecasts. The runtime role receives only `SELECT` and `INSERT`. A stable run
key makes an identical replay a no-op and rejects a different payload as
`FORECAST_RUN_CONFLICT`. One transaction writes one completed run and four
forecasts for 2026-01-01.

### S3-05 — Guard the surplus scenario

Expose only an explicit `scenario_mode=true` calculation using caller-supplied
synthetic stock, safety, and reserve values. Clamp negative output to zero. Do
not persist it as an approved recommendation or invoke Fabric.

### S3-06 — Validate and review

Run deterministic, data-quality, leakage, model-selection, forecast,
persistence, permissions, idempotency, failure, privacy, scenario, regression,
and secret checks. Record reproducible evidence without committing datasets,
models, credentials, or secret-bearing logs. Jopia separately records Sprint
Review acceptance after inspecting this evidence.

### S3-07 — Implement transfer request and approval

Add `TransferContract` to the existing package. Submit idempotent synthetic
requests, approve or reject them, reserve the full quantity atomically, enforce
FEFO, and reject partial, stale, unauthorized, or conflicting operations.

### S3-08 — Complete custody and location evidence

Implement dispatch, transit, delay/resume, receipt, cancellation, and
compromise transitions. Exact invented coordinates remain off-chain for 30
days; chaincode records only a stable evidence ID and digest summary.

### S3-09 — Implement off-chain RPS and BROA

Add a TypeScript coordination worker that validates location evidence, ranks
requests with normalized 70/30 RPS, and produces explainable 40/25/20/15 BROA
simulation results. Forecast integration requires `scenario_mode=true`; no
command approves or submits a transfer.

### S3-10 — Upgrade and validate on local Fabric

Package the combined chaincode as version `0.2.0`, sequence `2`, reproduce its
package ID, and validate success, exception, retry, conflict, and deterministic
replay scenarios on the single-Mediatrix development network.

### S3-11 — Consolidated review and retrospective

Map evidence to Gantt tasks 65–71, disclose Jopia's owner/self-validator role,
and record accountable-owner acceptance before the PR becomes ready or Sprint
4 begins.

## 4. Excluded work

- Approved or anonymized institutional data ingestion.
- Operational accuracy thresholds or claims under unresolved `RQ-07`.
- Operational BROA/RPS ranking, autonomous transfer approval, or any use of
  synthetic recommendations as institutional policy.
- Fabric inference, chaincode changes, scheduler/background worker, HTTP API,
  web UI, Kaggle execution, SARIMA, or LSTM.
- Editing or committing the external revised manuscript.
- Browser geolocation permission/UI, continuous tracking, real coordinates,
  email/SMS, and Sprint 4 API/offline/scan behavior.

## 5. Exit obligations

- The synthetic dataset and model artifact are reproducible for the locked
  environment and seed, with SHA-256 lineage recorded.
- Every model feature is derived only from observations before its forecast
  date.
- Forecasts contain generation time, one-day horizon, non-negative empirical
  interval, model version, simulation classification, and disabled operational
  eligibility.
- Missing, failed, stale, duplicate, conflicting, and unauthorized behavior is
  safe and tested.
- A clean-database validation applies all three migrations and atomically inserts
  exactly four forecast rows through `bloodledger_app`.
- All linked checks pass and the remaining real-data, policy, and operational
  limitations are explicit.
- Transfer reservation is atomic and FEFO-constrained; every lifecycle change
  is authorized, version-checked, idempotent, and deterministic.
- Exact synthetic dispatch/receipt points are kept off-chain, digest-linked to
  Fabric evidence, and purged at the 30-day boundary.
- RPS/BROA results retain normalization, contributions, hashes, and disabled
  recommendation eligibility.
- Chaincode version `0.2.0`, sequence `2`, passes local Fabric validation.

Passing these obligations is technical evidence only. Sprint completion and
acceptance require a separately recorded accountable-owner review.

## 6. Effective environment deviation

The implementation plan named Python `3.13.14`. On 2026-08-13 the managed
portable-runtime index exposed Python 3.13 builds only through `3.13.11`; an
explicit `3.13.14` lookup returned no download. The package therefore remains
locked to the Python 3.13 family and uses effective patch `3.13.11` for its
reproducible environment and validation. This is a tooling-availability
deviation, not evidence that 3.13.14 was tested.

## 7. Implementation-time evidence

The following forecasting-slice evidence was reproduced on 2026-08-13. It does
not prove the expanded transfer/location/optimization scope and does not replace
accountable-owner Sprint Review acceptance:

- Python `3.13.11`, pandas `3.0.5`, scikit-learn `1.9.0`, psycopg `3.3.4`,
  pytest `9.1.1`, Ruff `0.15.22`, and mypy `2.3.0` were installed from the
  generated SHA-256 lock. The verified `python:3.13.11-slim` container manifest
  digest is
  `sha256:2b9c9803c6a287cafa0a8c917211dddd23dcd2016f049690ee5219f5d3f1636e`.
- Formatting, lint, strict type, static off-chain boundary, foundation, and
  static PostgreSQL migration checks passed. All 31 forecasting tests and all
  12 Sprint 2 inventory-contract regression tests passed.
- Seed 42 generated 1,460 rows across the four daily series. Canonical dataset
  SHA-256 is
  `bb533200e098f5caf8ded7cbff9d2969a3cdc8e129994e390c372bb4c8b242bc`.
- The locked backtest selected `random_forest_global`. Its pooled synthetic MAE
  was `1.321955`, compared with `1.693243` for seasonal naive and `1.399469`
  for weighted average. Every per-series promotion guard passed. These are
  `SIMULATION_ONLY` metrics and do not estimate Mediatrix performance.
- Two independent final-revision training executions in the pinned container
  produced byte-identical model artifacts with SHA-256
  `b3ba11f67d06a188207626b882f68b59558fab4abde8bc9c48103249c1867ef9`.
  Their recorded environment-lock SHA-256 was
  `67899a9f908fef2fd2177ca05032c8c6fad8456a97d3c051dc30154b52972a88`.
- The non-persisting CLI sequence generated four 2026-01-01 forecasts, all with
  `DISABLED_UNAPPROVED_POLICY`. Production npm audit reported zero
  vulnerabilities.
- The pinned Gitleaks `8.30.1` image resolved to digest
  `sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f`.
  Mirrored all-ref history, index, and candidate-content scans found no leaks.

- On Jopia's Windows 11/WSL2 host, `npm run test:forecasting:database` used the
  pinned forecasting container, confirmed the PostgreSQL migration state,
  regenerated and validated the 1,460-row dataset, selected the global random
  forest, and atomically persisted one run with exactly four forecasts through
  `bloodledger_app`. An identical replay returned the existing run, a changed
  payload with the same run key returned `FORECAST_RUN_CONFLICT`, and all rows
  remained `SIMULATION_ONLY` with
  `DISABLED_UNAPPROVED_POLICY` recommendation eligibility.

The reproducible end-to-end acceptance command is:

```bash
npm run test:forecasting:database
```

On the final revision it finished twice with `Clean isolated PostgreSQL
forecasting integration applied all migrations and inserted one run with
exactly four safe rows`. It does not resolve `BL-ML-01`, `BL-ML-03`, or `RQ-07`
and does not demonstrate real-world, clinical, or operational accuracy.

## 8. Expanded continuation evidence and remaining gates

As of 2026-08-14, the repository contains the expanded implementation, but the
sprint is not yet complete or accepted:

| Gantt task | Repository result | Current gate |
|---|---|---|
| 65 — Sprint Planning | Scope, policies, requirements, architecture, backlog, exclusions, ownership, and exit obligations are versioned here. | Consolidated review remains pending. |
| 66 — Transfer Chaincode Development | `TransferContract` and inventory-expiry interaction pass 22 direct tests and the guarded Fabric upgrade from accepted `0.1.0`/sequence `1` to `0.2.0`/sequence `2`. | Technical gate passed; consolidated review remains pending. |
| 67 — Geo-Tagging Implementation | Backend dispatch/receipt evidence validation, off-chain exact synthetic points, digest-only chaincode summary, fallback flags, 30-day purge, and isolated PostgreSQL insert/replay/conflict evidence pass. Browser GPS permission/UI and continuous tracking remain excluded. | Technical gate passed; consolidated review remains pending. |
| 68 — ML Demand Forecasting Microservice | The pinned Python/Compose slice, 32 tests, deterministic dataset/artifact hashes, clean database workflow, four-row insert, replay, conflict, and disabled surplus artifact pass. | Technical gate passed; real-data and operational-policy gates remain unresolved. |
| 69 — BROA Algorithm Implementation | Deterministic FEFO, normalized RPS, scenario-only BROA, 9 tests, isolated persistence, result digests, and disabled recommendation eligibility pass. | Technical gate passed; operational policy remains unresolved. |
| 70 — Smart Contract Tests | Static/type checks, all 22 direct tests, reproducible package/deploy, and repeated local Gateway success/replay/conflict/stale-state validation pass. | Technical gate passed; consolidated review remains pending. |
| 71 — Sprint Review & Retrospective | Evidence structure and self-validation disclosure are present. | Jopia must inspect the final green evidence and explicitly accept; this file does not self-accept. |

The final 2026-08-14 coordination run used a refuse-to-overwrite isolated
database, applied all three migrations, and proved location
insert/replay/conflict, two disabled algorithm results with digests, and the
30-day purge. The final repository regression also passed foundation, database
role/migration/restart, 32 forecasting, 9 coordination, 22 inventory/transfer,
8 health-contract, operations-safety, and redacted Gitleaks checks.

Fabric diagnosis proved that the preserved orderer volume trusted an older CA
key than the generated node certificate while the peer retained a stale Docker
Desktop socket bind. After an explicit Level 1 preview and authorization, the
project-scoped Fabric runtimes, containers, volumes, identities, and disposable
build output were rebuilt; `.env`, PostgreSQL data, migrations, source, docs,
and tests were preserved. The fresh channel and health probe passed, the
immutable Sprint 2 tag was committed as inventory `0.1.0`/sequence `1`, and the
guarded Sprint 3 upgrade committed `0.2.0`/sequence `2` with package ID
`bloodledger-inventory-transfer_0.2.0:94ff70146d3ec98cf27d4186e493be3a93fa387eb4362a0a945bced03ec15746`.
Gateway suffix `S3FINAL02` then passed expiry, FEFO transfer receipt, exact
replay, conflicting replay, stale-state rejection, and a complete repeated run.

Required final evidence commands are:

```bash
npm run check:foundation
npm run check:database
npm run check:forecasting
npm run test:forecasting
npm run check:coordination
npm run test:coordination
npm run check:inventory-contract
npm run test:inventory-contract
npm run test:forecasting:database
npm run test:coordination:database
npm run package:inventory-contract
npm run deploy:inventory-contract
npm run validate:network --workspace @bloodledger/inventory-contract -- S3FINAL02
npm run scan:secrets
```

All commands above pass on the final revision. Sprint Review acceptance remains
a separate accountable-owner action and has not been inferred from technical
evidence.

Sprint 4 must not start until the pending live gates pass, the evidence is
updated with actual results/package ID, and Jopia records explicit Sprint Review
acceptance. This is a process/readiness gate, not a clinical validation claim.
