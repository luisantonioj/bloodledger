#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
forecast_root="${repository_root}/services/forecasting"

required=(
  "${forecast_root}/pyproject.toml"
  "${forecast_root}/requirements.lock"
  "${forecast_root}/.dockerignore"
  "${forecast_root}/src/bloodledger_forecasting/cli.py"
  "${forecast_root}/src/bloodledger_forecasting/modeling.py"
  "${forecast_root}/src/bloodledger_forecasting/persistence.py"
  "${repository_root}/database/migrations/20260812000000000_create-simulation-forecast-tables.js"
  "${repository_root}/docs/SPRINT-03.md"
)
for path in "${required[@]}"; do
  [[ -f "${path}" ]] || { echo "Missing Sprint 3 artifact: ${path}" >&2; exit 1; }
done

rg --fixed-strings 'SYNTHETIC_FORECAST_V1' "${forecast_root}/src" >/dev/null
rg --fixed-strings 'requested_units' "${forecast_root}/src/bloodledger_forecasting/modeling.py" >/dev/null
rg --fixed-strings 'DISABLED_UNAPPROVED_POLICY' "${forecast_root}/src" >/dev/null
rg --fixed-strings 'SIMULATION_ONLY' "${forecast_root}/src" >/dev/null

if rg -i 'fabric|chaincode|gateway|submittransaction|evaluatetransaction' \
  "${forecast_root}/src" --glob '*.py'; then
  echo "Forecasting runtime must not invoke Fabric or chaincode" >&2
  exit 1
fi

if rg -i 'patient|donor|diagnosis|treatment|employee_id' \
  "${forecast_root}/tests" --glob '*.csv' --glob '*.json'; then
  echo "Forecast fixtures contain prohibited fields" >&2
  exit 1
fi

git -C "${repository_root}" check-ignore \
  services/forecasting/artifacts/example.pkl \
  services/forecasting/data/generated/example.csv \
  services/forecasting/.venv/bin/python \
  services/forecasting/src/bloodledger_forecasting.egg-info/PKG-INFO >/dev/null

echo "Static forecasting boundaries passed"
