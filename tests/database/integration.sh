#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${repository_root}"

compose=(docker compose --project-name bloodledger)
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  compose+=(--env-file .env)
fi

for variable_name in POSTGRES_ADMIN_PASSWORD POSTGRES_MIGRATOR_PASSWORD POSTGRES_APP_PASSWORD; do
  if [[ -z "${!variable_name:-}" ]]; then
    echo "Required untracked secret is missing: ${variable_name}" >&2
    exit 1
  fi
done

"${compose[@]}" config --quiet
"${compose[@]}" up --detach --wait postgres

container_id="$("${compose[@]}" ps --quiet postgres)"
if [[ -z "${container_id}" || "$(docker inspect --format '{{.State.Health.Status}}' "${container_id}")" != "healthy" ]]; then
  echo "PostgreSQL did not reach healthy state; inspect: docker compose --project-name bloodledger logs postgres" >&2
  exit 1
fi

server_version="$("${compose[@]}" exec --no-TTY postgres psql --username postgres --dbname bloodledger_dev --tuples-only --no-align --command 'SHOW server_version')"
client_version="$("${compose[@]}" exec --no-TTY postgres psql --version)"
echo "PostgreSQL server ${server_version}; ${client_version}"

PGPASSWORD="${POSTGRES_APP_PASSWORD}" "${compose[@]}" exec --no-TTY \
  --env PGPASSWORD postgres psql --host 127.0.0.1 --username bloodledger_app \
  --dbname bloodledger_dev --no-psqlrc --command 'SELECT current_database(), current_user' >/dev/null

if npm run migrate:status; then
  echo "Migration status unexpectedly reported an empty database as current" >&2
  exit 1
else
  echo "Migration status correctly reported the bootstrap migration as pending"
fi
npm run migrate:up
npm run migrate:status
before_reapply="$("${compose[@]}" exec --no-TTY postgres psql --username postgres --dbname bloodledger_dev --tuples-only --no-align --command 'SELECT count(*) FROM public.pgmigrations')"
npm run migrate:up
after_reapply="$("${compose[@]}" exec --no-TTY postgres psql --username postgres --dbname bloodledger_dev --tuples-only --no-align --command 'SELECT count(*) FROM public.pgmigrations')"
[[ "${before_reapply}" == "${after_reapply}" && "${after_reapply}" == "2" ]]

"${compose[@]}" exec --no-TTY postgres psql --username postgres --dbname bloodledger_dev \
  --set=ON_ERROR_STOP=1 --tuples-only --no-align <<'SQL' | grep --fixed-strings 'roles-and-schema-ok' >/dev/null
SELECT 'roles-and-schema-ok'
WHERE EXISTS (SELECT FROM pg_roles WHERE rolname = 'bloodledger_migrator' AND rolcanlogin)
  AND EXISTS (SELECT FROM pg_roles WHERE rolname = 'bloodledger_app' AND rolcanlogin)
  AND (SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname = 'app') = 'bloodledger_migrator'
  AND has_schema_privilege('bloodledger_app', 'app', 'USAGE')
  AND NOT has_schema_privilege('bloodledger_app', 'app', 'CREATE')
  AND NOT has_database_privilege('bloodledger_app', 'bloodledger_dev', 'CREATE');
SQL

"${compose[@]}" exec --no-TTY postgres psql --username postgres --dbname bloodledger_dev \
  --set=ON_ERROR_STOP=1 --tuples-only --no-align <<'SQL' | grep --fixed-strings 'forecast-privileges-ok' >/dev/null
SELECT 'forecast-privileges-ok'
WHERE has_table_privilege('bloodledger_app', 'app.forecast_runs', 'SELECT,INSERT')
  AND has_table_privilege('bloodledger_app', 'app.demand_forecasts', 'SELECT,INSERT')
  AND NOT has_table_privilege('bloodledger_app', 'app.forecast_runs', 'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
  AND NOT has_table_privilege('bloodledger_app', 'app.demand_forecasts', 'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER');
SQL

if PGPASSWORD="${POSTGRES_APP_PASSWORD}" "${compose[@]}" exec --no-TTY \
  --env PGPASSWORD postgres psql --host 127.0.0.1 --username bloodledger_app \
  --dbname bloodledger_dev --no-psqlrc --command 'CREATE TABLE app.runtime_role_must_not_create_tables (id integer)' \
  >/dev/null 2>&1; then
  echo "Runtime role unexpectedly performed DDL" >&2
  exit 1
fi

domain_table_count="$("${compose[@]}" exec --no-TTY postgres psql --username postgres --dbname bloodledger_dev --tuples-only --no-align --command "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'app'")"
[[ "${domain_table_count}" == "2" ]]

"${compose[@]}" down
"${compose[@]}" up --detach --wait postgres
persisted_count="$("${compose[@]}" exec --no-TTY postgres psql --username postgres --dbname bloodledger_dev --tuples-only --no-align --command 'SELECT count(*) FROM public.pgmigrations')"
[[ "${persisted_count}" == "2" ]]
echo "Normal stop/restart preserved app schema and two migration-history rows"

if [[ "${1:-}" == "--recreate" ]]; then
  if [[ "${BLOODLEDGER_VALIDATION_RESET:-}" != "REMOVE_BLOODLEDGER_POSTGRES_DATA" ]]; then
    echo "Recreate validation requires BLOODLEDGER_VALIDATION_RESET=REMOVE_BLOODLEDGER_POSTGRES_DATA" >&2
    exit 1
  fi
  volume_name="$(docker volume ls --quiet --filter label=com.docker.compose.project=bloodledger --filter label=com.docker.compose.volume=postgres-data)"
  if [[ "${volume_name}" != "bloodledger_postgres-data" ]]; then
    echo "Refusing validation reset: expected only bloodledger-postgres-data, received ${volume_name:-none}" >&2
    exit 1
  fi
  echo "Validation reset target: Compose project bloodledger, volume ${volume_name}"
  "${compose[@]}" down
  docker volume rm "${volume_name}" >/dev/null
  "${compose[@]}" up --detach --wait postgres
  npm run migrate:up
  npm run migrate:status
  recreated_count="$("${compose[@]}" exec --no-TTY postgres psql --username postgres --dbname bloodledger_dev --tuples-only --no-align --command 'SELECT count(*) FROM public.pgmigrations')"
  recreated_tables="$("${compose[@]}" exec --no-TTY postgres psql --username postgres --dbname bloodledger_dev --tuples-only --no-align --command "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'app'")"
  [[ "${recreated_count}" == "2" && "${recreated_tables}" == "2" ]]
  echo "Empty-state recreation restored two migrations and two forecast tables"
fi

echo "PostgreSQL integration checks passed"
