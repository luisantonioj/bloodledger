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
test_database="bloodledger_s3_forecast_test"
existing_test_database="$("${compose[@]}" exec --no-TTY postgres \
  psql --username postgres --dbname bloodledger_dev --no-psqlrc \
  --tuples-only --no-align \
  --command "SELECT 1 FROM pg_database WHERE datname = '${test_database}'")"
if [[ -n "${existing_test_database}" ]]; then
  echo "Refusing to overwrite existing isolated validation database: ${test_database}" >&2
  exit 1
fi
"${compose[@]}" exec --no-TTY postgres psql --username postgres \
  --dbname bloodledger_dev --no-psqlrc \
  --command "CREATE DATABASE \"${test_database}\" OWNER bloodledger_migrator" >/dev/null
cleanup_test_database() {
  "${compose[@]}" exec --no-TTY postgres psql --username postgres \
    --dbname bloodledger_dev --no-psqlrc \
    --command "DROP DATABASE \"${test_database}\" WITH (FORCE)" >/dev/null
}
trap cleanup_test_database EXIT
export POSTGRES_DB="${test_database}"
npm run migrate:up
"${compose[@]}" exec --no-TTY postgres psql --username postgres \
  --dbname "${test_database}" --no-psqlrc --tuples-only --no-align <<'SQL' |
SELECT
  (SELECT count(*) FROM public.pgmigrations),
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'app');
SQL
  grep --fixed-strings '8|19' >/dev/null

mkdir -p services/forecasting/data/generated services/forecasting/artifacts
export LOCAL_UID="${LOCAL_UID:-$(id -u)}"
export LOCAL_GID="${LOCAL_GID:-$(id -g)}"

"${compose[@]}" --profile forecasting build forecasting
forecasting=(
  "${compose[@]}" --profile forecasting run --rm --no-deps \
  --env POSTGRES_DB="${test_database}" forecasting
)
data="data/generated/synthetic-forecast-v1.csv"
model="artifacts/model-v1.pkl"
manifest="artifacts/model-v1.manifest.json"
bundle="artifacts/forecast-2026-01-01.json"
host_bundle="services/forecasting/${bundle}"

"${forecasting[@]}" generate-synthetic --output "${data}"
"${forecasting[@]}" validate-data --data "${data}"
"${forecasting[@]}" train \
  --data "${data}" \
  --artifact "${model}" \
  --manifest "${manifest}" \
  --generated-at 2026-01-01T00:00:00Z
first_result="$("${forecasting[@]}" forecast \
  --data "${data}" \
  --artifact "${model}" \
  --manifest "${manifest}" \
  --output "${bundle}" \
  --generated-at 2026-01-01T00:00:00Z \
  --persist)"
grep --fixed-strings '"persistence": "INSERTED"' <<<"${first_result}" >/dev/null

run_id="$(sed -n 's/^[[:space:]]*"run_id": "\([^"]*\)",*$/\1/p' "${host_bundle}")"
if [[ -z "${run_id}" ]]; then
  echo "Forecast bundle did not contain a run_id" >&2
  exit 1
fi

PGPASSWORD="${POSTGRES_APP_PASSWORD}" "${compose[@]}" exec --no-TTY \
  --env PGPASSWORD postgres psql --host 127.0.0.1 --username bloodledger_app \
  --dbname "${test_database}" --no-psqlrc --tuples-only --no-align \
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

second_result="$("${forecasting[@]}" forecast \
  --data "${data}" \
  --artifact "${model}" \
  --manifest "${manifest}" \
  --output "${bundle}" \
  --generated-at 2026-01-01T01:00:00Z \
  --persist)"
grep --fixed-strings '"persistence": "EXISTING"' <<<"${second_result}" >/dev/null

"${compose[@]}" --profile forecasting run --rm --no-deps \
  --env POSTGRES_DB="${test_database}" \
  --entrypoint python \
  --volume "${repository_root}/services/forecasting/tests:/workspace/tests:ro" \
  forecasting tests/postgres_conflict_probe.py "${bundle}"

echo "Clean isolated PostgreSQL forecasting integration applied all migrations and inserted one run with exactly four safe rows"
