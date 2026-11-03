#!/usr/bin/env bash
# Panel revision Franze #6: bounded workload and resilience experiment on this host's development Fabric network.
# It uses an isolated validation database (created here, dropped on exit), but it writes synthetic
# SUBMIT_TRANSFER transactions to the shared development channel and stops/starts the peer. Run only with the
# owner's explicit approval for the host: pass --confirm-shared-ledger.
set -euo pipefail
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${repository_root}"
[[ "${1:-}" == "--confirm-shared-ledger" ]] || { echo "Refusing to run without --confirm-shared-ledger (see header)." >&2; exit 2; }
shift
run_id="${WORKLOAD_RUN_ID:?set WORKLOAD_RUN_ID (A-Z0-9, up to 10 characters)}"
report="${WORKLOAD_REPORT:?set WORKLOAD_REPORT to a path outside Git, e.g. build/workload/run.json}"
if [[ -f .env ]]; then set -a; source .env; set +a; fi
for variable_name in POSTGRES_ADMIN_PASSWORD POSTGRES_MIGRATOR_PASSWORD POSTGRES_APP_PASSWORD; do
  [[ -n "${!variable_name:-}" ]] || { echo "Required untracked secret is missing: ${variable_name}" >&2; exit 1; }
done
postgres_container="bloodledger-postgres-1"
test_database="bloodledger_workload_${run_id,,}_test"
existing="$(docker exec "${postgres_container}" psql --username postgres --dbname bloodledger_dev --no-psqlrc --tuples-only --no-align --command "SELECT 1 FROM pg_database WHERE datname='${test_database}'")"
[[ -z "${existing}" ]] || { echo "Refusing to overwrite existing isolated validation database: ${test_database}" >&2; exit 1; }
docker exec "${postgres_container}" psql --username postgres --dbname bloodledger_dev --no-psqlrc --command "CREATE DATABASE \"${test_database}\" OWNER bloodledger_migrator" >/dev/null
trap 'docker exec "${postgres_container}" psql --username postgres --dbname bloodledger_dev --no-psqlrc --command "DROP DATABASE \"${test_database}\" WITH (FORCE)" >/dev/null' EXIT
export POSTGRES_DB="${test_database}" POSTGRES_HOST=127.0.0.1 POSTGRES_PORT="${POSTGRES_HOST_PORT:-5432}" POSTGRES_APP_USER="${POSTGRES_APP_USER:-bloodledger_app}"
export BLOODLEDGER_REPOSITORY_ROOT="${repository_root}"
node database/scripts/migrate.mjs >/dev/null
node_modules/.bin/tsc -p services/api/tsconfig.json
mkdir -p "$(dirname "${report}")"
node services/api/test/workload-resilience-probe.mjs --run "${run_id}" --report "${report}" "$@"
