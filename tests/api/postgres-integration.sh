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
test_database="bloodledger_s4_scan_test"
existing_test_database="$("${compose[@]}" exec --no-TTY postgres \
  psql --username postgres --dbname bloodledger_dev --no-psqlrc \
  --tuples-only --no-align --command "SELECT 1 FROM pg_database WHERE datname = '${test_database}'")"
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
export POSTGRES_HOST="127.0.0.1"
export POSTGRES_PORT="${POSTGRES_HOST_PORT:-5432}"
export POSTGRES_APP_USER="${POSTGRES_APP_USER:-bloodledger_app}"
npm run migrate:up
npm run build --workspace @bloodledger/api
node services/api/test/postgres-probe.mjs

PGPASSWORD="${POSTGRES_APP_PASSWORD}" "${compose[@]}" exec --no-TTY \
  --env PGPASSWORD postgres psql --host 127.0.0.1 --username bloodledger_app \
  --dbname "${test_database}" --no-psqlrc --tuples-only --no-align <<'SQL' |
SELECT
  has_table_privilege(current_user, 'app.scan_events', 'SELECT,INSERT'),
  has_column_privilege(current_user, 'app.scan_events', 'status', 'UPDATE'),
  NOT has_table_privilege(current_user, 'app.scan_events', 'DELETE,TRUNCATE'),
  NOT has_table_privilege(current_user, 'app.scan_event_attempts', 'UPDATE,DELETE'),
  NOT has_table_privilege(current_user, 'app.inventory_projection', 'DELETE,TRUNCATE');
SQL
  grep --fixed-strings 't|t|t|t|t' >/dev/null

echo "Clean isolated Sprint 4 PostgreSQL validation passed"
