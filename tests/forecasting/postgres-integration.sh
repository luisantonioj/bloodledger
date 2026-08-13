#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${repository_root}"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

for variable_name in POSTGRES_ADMIN_PASSWORD POSTGRES_MIGRATOR_PASSWORD POSTGRES_APP_PASSWORD; do
  if [[ -z "${!variable_name:-}" ]]; then
    echo "Required untracked secret is missing: ${variable_name}" >&2
    exit 1
  fi
done

compose=(docker compose --project-name bloodledger)
if [[ -f .env ]]; then
  compose+=(--env-file .env)
fi

"${compose[@]}" config --quiet
"${compose[@]}" up --detach --wait postgres
npm run migrate:up

forecasting="services/forecasting/.venv/bin/bloodledger-forecasting"
data="services/forecasting/data/generated/synthetic-forecast-v1.csv"
model="services/forecasting/artifacts/model-v1.pkl"
manifest="services/forecasting/artifacts/model-v1.manifest.json"
bundle="services/forecasting/artifacts/forecast-2026-01-01.json"

"${forecasting}" generate-synthetic --output "${data}"
"${forecasting}" validate-data --data "${data}"
"${forecasting}" train \
  --data "${data}" \
  --artifact "${model}" \
  --manifest "${manifest}" \
  --generated-at 2026-01-01T00:00:00Z
first_result="$("${forecasting}" forecast \
  --data "${data}" \
  --artifact "${model}" \
  --manifest "${manifest}" \
  --output "${bundle}" \
  --generated-at 2026-01-01T00:00:00Z \
  --persist)"
grep -Eq '"persistence": "(INSERTED|EXISTING)"' <<<"${first_result}"

run_id="$(services/forecasting/.venv/bin/python -c \
  'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["run"]["run_id"])' \
  "${bundle}")"

PGPASSWORD="${POSTGRES_APP_PASSWORD}" "${compose[@]}" exec --no-TTY \
  --env PGPASSWORD postgres psql --host 127.0.0.1 --username bloodledger_app \
  --dbname bloodledger_dev --no-psqlrc --tuples-only --no-align \
  --set=run_id="${run_id}" <<'SQL' | grep --fixed-strings '1|4|0' >/dev/null
SELECT
  count(DISTINCT runs.run_id),
  count(forecasts.forecast_id),
  count(*) FILTER (
    WHERE forecasts.classification <> 'SIMULATION_ONLY'
       OR forecasts.recommendation_eligibility <> 'DISABLED_UNAPPROVED_POLICY'
  )
FROM app.forecast_runs AS runs
LEFT JOIN app.demand_forecasts AS forecasts ON forecasts.run_id = runs.run_id
WHERE runs.run_id = :'run_id';
SQL

second_result="$("${forecasting}" forecast \
  --data "${data}" \
  --artifact "${model}" \
  --manifest "${manifest}" \
  --output "${bundle}" \
  --generated-at 2026-01-01T01:00:00Z \
  --persist)"
grep --fixed-strings '"persistence": "EXISTING"' <<<"${second_result}" >/dev/null

services/forecasting/.venv/bin/python \
  services/forecasting/tests/postgres_conflict_probe.py "${bundle}"

echo "Live PostgreSQL forecasting integration inserted one run and exactly four safe rows"
