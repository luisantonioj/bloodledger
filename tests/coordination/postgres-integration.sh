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
if [[ -f .env ]]; then compose+=(--env-file .env); fi
"${compose[@]}" config --quiet
"${compose[@]}" up --detach --wait postgres
test_database="bloodledger_s3_coordination_test"
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
npm run build --workspace @bloodledger/coordination

export POSTGRES_HOST="127.0.0.1"
export POSTGRES_PORT="${POSTGRES_HOST_PORT:-5432}"
export POSTGRES_APP_USER="${POSTGRES_APP_USER:-bloodledger_app}"
cli=(node services/coordination/build/src/cli.js)
fixtures="services/coordination/test/fixtures"

first_location="$("${cli[@]}" capture-location-evidence --input "${fixtures}/location.json" --persist)"
grep -Eq '"persistence":"(INSERTED|EXISTING)"' <<<"${first_location}"
second_location="$("${cli[@]}" capture-location-evidence --input "${fixtures}/location.json" --persist)"
grep -q '"persistence":"EXISTING"' <<<"${second_location}"
if "${cli[@]}" capture-location-evidence --input "${fixtures}/location-conflict.json" --persist \
  2> /tmp/bloodledger-coordination-conflict.log; then
  echo "Conflicting location replay unexpectedly succeeded" >&2
  exit 1
fi
grep -q 'COORD_LOCATION_EVIDENCE_CONFLICT' /tmp/bloodledger-coordination-conflict.log

rps_first="$("${cli[@]}" rank-rps --input "${fixtures}/rps.json" --persist)"
grep -Eq '"persistence":"(INSERTED|EXISTING)"' <<<"${rps_first}"
rps_run_id="$(sed -n 's/.*"runId":"\([^"]*\)".*/\1/p' <<<"${rps_first}")"
rps_second="$("${cli[@]}" rank-rps --input "${fixtures}/rps.json" --persist)"
grep -q '"persistence":"EXISTING"' <<<"${rps_second}"
broa_result="$("${cli[@]}" recommend-broa --input "${fixtures}/broa.json" --persist)"
grep -Eq '"persistence":"(INSERTED|EXISTING)"' <<<"${broa_result}"
broa_run_id="$(sed -n 's/.*"runId":"\([^"]*\)".*/\1/p' <<<"${broa_result}")"
[[ -n "${rps_run_id}" && -n "${broa_run_id}" && "${rps_run_id}" != "${broa_run_id}" ]]

PGPASSWORD="${POSTGRES_APP_PASSWORD}" "${compose[@]}" exec --no-TTY \
  --env PGPASSWORD postgres psql --host 127.0.0.1 --username bloodledger_app \
  --dbname "${POSTGRES_DB}" --no-psqlrc --tuples-only --no-align \
  --set=rps_run_id="${rps_run_id}" --set=broa_run_id="${broa_run_id}" <<'SQL' |
SELECT
  (SELECT count(*) FROM app.location_evidence WHERE evidence_id = 'LOC_INTEGRATION_001'),
  (SELECT count(*) FROM app.algorithm_runs
   WHERE run_id IN (:'rps_run_id', :'broa_run_id') AND classification = 'SIMULATION_ONLY'),
  (SELECT count(*) FROM app.algorithm_runs
   WHERE run_id IN (:'rps_run_id', :'broa_run_id')
     AND (recommendation_eligibility <> 'DISABLED_UNAPPROVED_POLICY'
       OR recommendation_digest IS NULL));
SQL
  grep --fixed-strings '1|2|0' >/dev/null

"${cli[@]}" purge-expired-location-evidence --as-of "2026-08-01T00:00:00.000Z" |
  grep -q '"deletedCount":1'

PGPASSWORD="${POSTGRES_APP_PASSWORD}" "${compose[@]}" exec --no-TTY \
  --env PGPASSWORD postgres psql --host 127.0.0.1 --username bloodledger_app \
  --dbname "${POSTGRES_DB}" --no-psqlrc --tuples-only --no-align \
  --command "SELECT count(*) FROM app.location_evidence WHERE evidence_id = 'LOC_INTEGRATION_001'" |
  grep --fixed-strings '0' >/dev/null

echo "Clean isolated PostgreSQL coordination checks passed with idempotency, conflict, and 30-day purge evidence"
