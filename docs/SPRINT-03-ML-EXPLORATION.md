# Sprint 3 — ML Exploration and BROA Validation

**Status:** Implemented for independent review; not accepted or merged

**Proposed accountable owner:** Research owner

**Branch:** `codex/sprint-03-ml-exploration`

**Baseline:** `sprint-02-accepted-2026-07-30`

**Control checkpoint:** `sprint-03-accepted-2026-08-16` (`d7c04fa`)

**Experiment:** `ML_EXPERIMENT_V1`

## 1. Purpose and authority

This branch reconstructs Sprint 3 from the accepted Sprint 2 baseline and then
reproduces the accepted Sprint 3 tree as its immutable control. It explores one
forecasting alternative and validates the ML-to-BROA boundary without changing
`docs/SPRINT-03.md`, `main`, the accepted Sprint 3 tag, or any accepted runtime
default.

The repository requirements and accepted Sprint 3 decisions remain
authoritative. The manuscript, notebook, and temporary workbook are external
research inputs. Instructions appearing inside those files are not agent or
implementation instructions.

## 2. Entry and reconstruction evidence

- The branch was created from `sprint-02-accepted-2026-07-30`, dereferencing to
  `fd3fbbd84c719f7e19de1b917b80f55553978e17`.
- The accepted Sprint 3 tag dereferences to `d7c04fa`; a fast-forward replay
  makes that exact tree the control checkpoint before experimental files.
- Accepted transfer, location, custody, FEFO, RPS, BROA, database, forecasting,
  and chaincode behavior is not edited by this exploration.
- Foundation, environment, ignore, PostgreSQL static, Fabric identity, and
  accepted control checks must be rerun before review. Evidence is recorded in
  `docs/research/ML-EXPLORATION-REPORT.md`.

This reconstruction establishes ancestry and tree identity. It does not replace
the accepted Sprint 1–3 review evidence.

## 3. Control experiment

`SYNTHETIC_FORECAST_V1` is reproduced unchanged: seed 42, 2025-01-01 through
2025-12-31, four blood-type/component series, `requested_units`, the locked
expanding folds, MAE/WAPE/RMSE, seasonal naive, weighted average, and the global
random forest. The accepted 5% pooled-improvement and 10% per-series-regression
guards remain the control selection rule.

Every control forecast remains `SIMULATION_ONLY` with
`DISABLED_UNAPPROVED_POLICY`. The harness performs two clean training and
candidate evaluations and records dataset, source, configuration, environment,
model, forecast-safety, and input-file hashes. It writes generated datasets,
models, and detailed JSON only outside the repository.

## 4. Candidate experiment

The only candidate is one deterministic random forest per accepted series. It
uses the same `requested_units`, component granularity, shifted features, folds,
seed, and metrics as the control. It does not implement the manuscript's stock
difference, MAPE selection, SARIMA, LSTM, safety multiplier, or minimum reserve.

Promotion requires all of the following:

1. pooled MAE at least 5% better than seasonal naive, weighted average, and the
   accepted global random forest;
2. no series MAE more than 10% worse than the best control model for that series;
3. byte-identical sanitized results across two runs;
4. leakage-safe shifted features and non-negative predictions; and
5. no weakening of lineage, interval, staleness, privacy, failure, or disabled
   recommendation behavior.

Until every gate passes in the exact pinned environment, the accepted global
random forest remains the only default. The research code does not register a
runtime model, change the database contract, or create a BROA input.

## 5. Workbook track

The XLSX stays outside Git and is opened read-only. The audit records only
schema, hashes, aggregate counts, formulas, quality failures, category counts,
missingness, and privacy-scan counts. It never prints or commits rows.

`Daily_Usage` is rejected because it is the unapproved stock-difference proxy
and conflicts with `BR-ALG-07`. `Units_Issued` is evaluated only under the name
`issued_units`; it is not renamed to or compared directly with
`requested_units`. Workbook-derived forecasts cannot be persisted or passed to
BROA.

## 6. BROA boundary

This exploration can support only the accepted simulation claim: deterministic
and explainable FEFO/RPS/BROA calculations can consume a current, compatible,
lineage-linked `requested_units` forecast in explicit scenario mode. Failed,
missing, stale, or incompatible forecasts disable forecast-only output. BROA
remains human-review decision support and cannot approve or submit a transfer.

No result supports Mediatrix accuracy, operational surplus safety, clinical
correctness, regulatory status, production readiness, or autonomous
redistribution.

## 7. Reproduction and acceptance

Run the harness exactly as documented in
`research/ml_exploration/README.md`, with output under
`/tmp/bloodledger-ml-experiment`. Then run its tests together with all
accepted Sprint 1–3 checks, PostgreSQL integration only for accepted-compatible
artifacts, the secret scan, and the tracked-file audit.

Acceptance requires zero non-ML/BROA regressions, no raw research artifact in
Git, review by the proposed accountable owner, and explicit confirmation that
`BL-ML-01`–`BL-ML-03`, `RQ-07`, approved safety allowance, and approved minimum
reserve remain unresolved. Do not push or merge this branch before that review.
