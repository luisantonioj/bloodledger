# ML Exploration — Sanitized Evidence Report

**Evidence date:** 2026-08-18

**Classification:** `SIMULATION_ONLY`

**Recommendation eligibility:** `DISABLED_UNAPPROVED_POLICY`

**Review status:** Awaiting independent review; not accepted for merge

## Decision

Keep the accepted `SYNTHETIC_FORECAST_V1` implementation unchanged. The
per-series candidate is isolated in a research harness and has not earned
promotion. No code in this branch changes the accepted forecasting default,
database contract, transfer workflow, chaincode, or BROA recommendation
eligibility.

The exact pinned experiment execution is currently unverified because the
repository forecasting image could not be rebuilt: repeated dependency fetches
ended in PyPI TLS `UNEXPECTED_EOF_WHILE_READING` errors. Under the experiment
rule, missing evidence cannot be treated as a pass. This is an environment
blocker, not evidence that the candidate's accuracy gate failed.

## Lineage and source disposition

| Input | SHA-256 | Disposition |
|---|---|---|
| Temporary XLSX | `4a43043e9d6315befbb8af8b5ccfae29d4aca3332fc30040651f472a0b57b646` | Synthetic research input; outside Git |
| Exploratory notebook | `abeaedaea30b077df534416fbe3dbde4f38149a4385d0796b4d918fcc3712c4e` | Research method input; outside Git |
| Revised manuscript | `ca15ad9b69fa98556331c7a94bcf92f202e9e1ec7220fe4d44fc5d7c7816ec75` | Research source; outside Git |

The workbook describes itself as non-real hospital data. No source file is
copied into the repository. The harness permits detailed artifacts only outside
the repository and emits aggregate, sanitized evidence.

## Accepted control

The control is the accepted Sprint 3 tree at `d7c04fa`. Its recorded locked
evidence remains:

- 1,460 generated rows, four daily series, seed 42, and target
  `requested_units`;
- dataset SHA-256
  `bb533200e098f5caf8ded7cbff9d2969a3cdc8e129994e390c372bb4c8b242bc`;
- global-random-forest pooled MAE `1.321955`, seasonal-naive MAE `1.693243`,
  and weighted-average MAE `1.399469`;
- byte-identical accepted model artifact SHA-256
  `b3ba11f67d06a188207626b882f68b59558fab4abde8bc9c48103249c1867ef9`;
  and
- non-negative, lineage-linked forecasts classified `SIMULATION_ONLY` and
  disabled for operational recommendations.

These values reproduce accepted repository evidence; they do not estimate
Mediatrix performance.

## Workbook quality findings

| Check | Sanitized result |
|---|---:|
| Raw observations | 5,888 |
| Series | 32 |
| Coverage | 184 days, 2025-07-01 through 2025-12-31 |
| Duplicate raw keys | 0 |
| Missing raw values | 0 |
| Stock-balance identity failures | 1,850 |
| Overnight stock discontinuities | 1,839 |
| Training data records | 1,472 |
| Excluded trailing note rows | 1 |
| Terminal `Daily_Usage` blanks | 8 |
| Negative `Daily_Usage` values | 472 |

The structured sheets did not expose prohibited data fields or contact-pattern
values during the sanitized inspection. The implemented audit rechecks every
structured header/value for prohibited terms and every worksheet value for
email/phone patterns without printing rows.

`Daily_Usage` is rejected: its formulas use the stock-difference proxy and its
negative values demonstrate semantic and quality problems. `Units_Issued` may
be benchmarked only as censored issued demand. It is not equivalent to
`requested_units`, cannot be ranked against the accepted demand track, and is
ineligible for persistence or BROA.

## Notebook and thesis assessment

The notebook's use of `Units_Issued` is better aligned with usage than the
thesis stock-difference proxy, but stockouts can censor issued demand. Its
184-day history, single 70/15/15 split, blood-type-only aggregation, MAPE, and
SARIMA convergence warning do not satisfy the accepted evaluation contract.
LSTM and SARIMA remain deferred. The manuscript's 1.3 safety multiplier and
minimum reserves remain unapproved synthetic examples, not policy.

## Implemented safeguards

- Same target, features, seed, folds, granularity, and metrics for the accepted
  control and per-series candidate.
- Shift-before-roll feature construction and a leakage regression test.
- Promotion against both simple baselines and the accepted global forest, plus
  the per-series 10% guard.
- Deterministic two-run comparisons, non-negative predictions, residual
  interval evidence, source hashes, and external-only artifact output.
- Separate issued-unit benchmark with `runtime_integration_eligible=false` and
  `broa_input_eligible=false`.
- No SARIMA, LSTM, stock-difference target, MAPE selection, hard-coded safety
  multiplier, or hard-coded reserve.

## Validation evidence

Passed during branch construction:

- branch ancestry and exact accepted Sprint 3 control checkpoint;
- foundation JSON/workspace/version checks;
- safe environment-variable checks (21 variables);
- tracked/ignored-path audit (15 paths);
- PostgreSQL static migration/role checks;
- Fabric identity static checks; and
- Python syntax compilation for the research package.

Not completed in the current environment:

- exact pinned forecasting quality/tests and two experiment runs, because the
  image dependency installation could not reach PyPI reliably;
- downstream tests requiring that image; and
- a new PostgreSQL experiment integration, which is intentionally unnecessary
  unless the candidate passes and remains semantically compatible.

No failed assertion or product regression was observed in these uncompleted
checks. They must be rerun before review or acceptance.

## BROA conclusion and unresolved gates

Synthetic data is sufficient to test deterministic, explainable, disabled
FEFO/RPS/BROA simulation and safe failure for stale, missing, failed, or
incompatible forecasts. It is not sufficient for operational accuracy,
surplus safety, clinical correctness, production readiness, or autonomous
transfer decisions.

`BL-ML-01`, `BL-ML-02`, `BL-ML-03`, `RQ-07`, the safety allowance, and the
minimum reserve remain unresolved. The accepted default and
`DISABLED_UNAPPROVED_POLICY` must remain in force.
