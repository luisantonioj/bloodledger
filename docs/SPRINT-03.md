# Sprint 3 — Simulation-Only Demand Forecasting

**Status:** In progress; implementation authorized 2026-08-12  
**Accountable owner:** Jopia  
**Assigned owner/validator:** Jopia (self-validation disclosed)  
**Branch:** `codex/sprint-03-ml-experiment`  
**Baseline:** `sprint-02-accepted-2026-07-30`  
**Policy baseline:** `SYNTHETIC_FORECAST_V1` under PA-ML-01

## 1. Sprint goal

Implement one reproducible, off-chain ML vertical slice that generates and
validates synthetic requested-demand history, compares simple baselines with
one candidate model using time-ordered validation, forecasts one next-day value
for each approved blood-type/component pair, and stores exactly four
simulation-only forecasts in PostgreSQL.

This sprint is an experiment. It does not demonstrate Mediatrix accuracy,
clinical safety, regulatory acceptance, or production readiness.

## 2. Entry gates and unresolved decisions

- Sprint 2 was accepted by Jopia on 2026-07-30 and tagged before this work.
- PA-ML-01 authorizes `SYNTHETIC_FORECAST_V1`; the implementation must record
  its schema, generator version, seed, time range, lineage, and classification.
- `BL-ML-01` remains blocked because no approved institutional dataset exists.
- `RQ-07` remains open, so no model metric can justify operational use.
- `BL-ML-03` remains gated by approved safety and reserve policy.

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

## 4. Excluded work

- Approved or anonymized institutional data ingestion.
- Operational accuracy thresholds or claims under unresolved `RQ-07`.
- Automated BROA/RPS ranking, reserve policy, transfer approval, or custody
  mutation.
- Fabric inference, chaincode changes, scheduler/background worker, HTTP API,
  web UI, Kaggle execution, SARIMA, or LSTM.
- Editing or committing the external revised manuscript.

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
- A clean-database validation applies both migrations and atomically inserts
  exactly four forecast rows through `bloodledger_app`.
- All linked checks pass and the remaining real-data, policy, and operational
  limitations are explicit.

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

The following evidence was reproduced on 2026-08-13. It does not complete the
Sprint Review or resolve the pending live-database gate:

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
- Two independent training executions produced byte-identical model artifacts
  with SHA-256
  `01d79272bc43643effb11918fbf651773c003b6e701ae8e9ec708ec1bcb2230a`.
- The non-persisting CLI sequence generated four 2026-01-01 forecasts, all with
  `DISABLED_UNAPPROVED_POLICY`. Production npm audit reported zero
  vulnerabilities.
- The official Gitleaks `8.30.1` Linux archive matched its published checksum.
  Native history and candidate-content scans found no leaks across 23 commits
  and the current uncommitted implementation.

Live PostgreSQL evidence remains pending. The isolated worktree has no copied
`.env`, all three database secrets are unset, no PostgreSQL listener is active,
and Docker Desktop WSL integration is unavailable in this session. The
reproducible `npm run test:forecasting:database` command is implemented to
apply both migrations, exercise least-privileged insertion/replay/conflict
behavior, and prove one run plus exactly four safe forecast rows once Jopia
provides the untracked local secrets and restores Docker integration. Until
that passes and Jopia accepts the Sprint Review, this sprint remains **In
progress**.
