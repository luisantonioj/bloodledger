# BloodLedger Forecasting Experiment

This package implements the Sprint 3 `SYNTHETIC_FORECAST_V1` simulation slice.
It predicts requested demand for four blood-type/component series and cannot
approve redistribution or custody changes.

Use Python `3.13.11`, the newest portable 3.13 patch available during the
2026-08-13 validation. The planned 3.13.14 runtime was requested but was not
available from the managed runtime index and was not falsely claimed as tested.
Create a local virtual environment, install the hashed
lock, then install the package without dependency resolution:

```bash
cd services/forecasting
python3.13 -m venv .venv
.venv/bin/python -m pip install --require-hashes -r requirements.lock
.venv/bin/python -m pip install --no-deps -e .
```

The one-shot container uses the verified multi-architecture digest for
`python:3.13.11-slim`; dependency installation also requires every lockfile
hash.

From the repository root, `npm run check:forecasting` and
`npm run test:forecasting` use the local virtual environment when it is
executable and otherwise run the same pinned tools in the one-shot Compose
image.

The reproducible vertical slice is:

```bash
bloodledger-forecasting generate-synthetic \
  --output data/generated/synthetic-forecast-v1.csv
bloodledger-forecasting validate-data \
  --data data/generated/synthetic-forecast-v1.csv
bloodledger-forecasting train \
  --data data/generated/synthetic-forecast-v1.csv \
  --artifact artifacts/model-v1.pkl \
  --manifest artifacts/model-v1.manifest.json
bloodledger-forecasting forecast \
  --data data/generated/synthetic-forecast-v1.csv \
  --artifact artifacts/model-v1.pkl \
  --manifest artifacts/model-v1.manifest.json \
  --output artifacts/forecast-2026-01-01.json
```

Add `--persist` to the forecast command only after PostgreSQL migrations are
applied and the existing untracked `POSTGRES_*` variables are populated. The
command refuses a role other than `bloodledger_app`, inserts one run and four
forecasts atomically, and never prints credentials.

`evaluate-surplus-scenario` requires the explicit `--scenario-mode` flag.
Safety and reserve values are caller-supplied synthetic inputs; the result is
not stored as an approved recommendation. Add `--output artifacts/scenario.json`
to write a `BLOODLEDGER_SURPLUS_SCENARIO_V1` artifact for scenario-only BROA
input; it remains `SIMULATION_ONLY`, unpersisted, and
`DISABLED_UNAPPROVED_POLICY`.

The same CLI is available as an explicit one-shot Compose profile after the
untracked database secrets and writable data/artifact directories exist:

```bash
mkdir -p services/forecasting/data/generated services/forecasting/artifacts
LOCAL_UID="$(id -u)" LOCAL_GID="$(id -g)" \
  docker compose --profile forecasting run --rm forecasting \
  generate-synthetic --output data/generated/synthetic-forecast-v1.csv
```

Compose does not schedule or automatically start this worker; every run must be
explicit. Generated data and model artifacts are ignored by Git.

JupyterLab is optional analysis tooling. Any notebook must import this package
instead of reimplementing generation, validation, or modeling behavior. Kaggle
and scheduled execution are outside Sprint 3.

## Existing-data thesis exploration

The isolated offline experiment is specified in
[`docs/ML-THESIS-EXPLORATION.md`](../../docs/ML-THESIS-EXPLORATION.md).
It does not replace the accepted four-series runtime model or persistence schema.
From this directory, using the pinned environment:

```bash
PYTHONPATH=src python -m bloodledger_forecasting.exploration \
  --output /absolute/external/new-experiment-directory
```

The default runs all five fixed seeds and three scenarios with invented neutral
rates. For the provided institutional sample, append `--workbook /absolute/input.xlsx`
to produce a local descriptive audit. Append `--use-sample-scale` only to explicitly
use the partial sample as a scenario scale, or `--audit-only` to skip modeling.
Inputs mount read-only; outputs must be a new external or ignored artifacts
folder. These examples use the same module command executed in the pinned
container during the exploration; use `PYTHONPATH=src` from this directory.

Outputs include safe observed aggregates and row-reason audit (if a source is
supplied), coverage, SVG figures, generated data, validation/test predictions,
selection evidence, a model artifact, demo forecasts, report and SHA-256 manifest.
Do not commit these source-derived research files. Source free text is never
copied; cached formula values are not silently trusted. Observed missing days
stay unknown. Real forecasting accuracy remains unavailable while coverage is
unverified. The optional 14-day extension is not selected for runtime delivery.

### Frozen workbook v4 handoff

Use `python -m bloodledger_forecasting.thesis_release --workbook /source.xlsx
--release /final-v1 --output /outputs/new-handoff` (arguments on one command
line, with `PYTHONPATH=src`). This verifies the frozen release and exports all
metrics, descriptive summaries, figures, a model card and historical replay.
The mixed v4 workbook must not be supplied to the original request-file audit.
No training is repeated and no study model is promoted to the application.

From the repository root, `bash tests/forecasting/v4-runtime-integration.sh`
checks the accepted runtime with a new disposable PostgreSQL container, no
published ports, generated test credentials, all current migrations, and the
API database mapper. It requires Docker, the built `bloodledger-forecasting`
image and locked npm dependencies installed in `node_modules`. It tests insert,
replay, conflict, current/stale/unavailable results and exactly four persisted
rows. Its trap removes only the container and temporary directory it created.


### V4 producer corrections (Issue #9)

The v4 runtime integration specification is
[`ML-RUNTIME-INTEGRATION-V4.md`](../../docs/ML-RUNTIME-INTEGRATION-V4.md).
From this directory in the pinned Python environment:

```bash
PYTHONPATH=src python -m bloodledger_forecasting.cli forecast-v4-runtime \
  --data /external/synthetic-request-history.csv --output /external/forecast.json \
  --institution-id INST_MEDIATRIX --origin-date 2026-01-07 \
  --horizon-date 2026-01-08 --generated-at 2026-01-08T00:00:00Z --persist
```

The history CSV accepts only business_date, blood_type, component and
requested_units. Blank quantities are unknown, not zero. Null/missing history
produces a persisted UNAVAILABLE attempt with no forecast rows and the requested
dates; the latest attempt prevents older success from being shown as current.
Invalid numeric/schema/date inputs still fail. A supplied path must exist;
its actual bytes identify the dataset. Python calls without a path use a canonical
in-memory evidence hash. Execution time alone does not change replay identity.
Institution, all immutable lineage and the requested window do change identity.
All outputs remain simulation-only; historical V1 and frozen study results remain.
