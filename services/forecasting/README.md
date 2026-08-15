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
