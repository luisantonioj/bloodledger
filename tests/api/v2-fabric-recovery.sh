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

test_database="bloodledger_s6_fabric_recovery_test"
postgres_container="bloodledger-postgres-1"
peer_container="bloodledger-peer0-mediatrix-1"
orderer_container="bloodledger-orderer0-1"
existing="$(docker exec "${postgres_container}" psql --username postgres --dbname bloodledger_dev --no-psqlrc --tuples-only --no-align --command "SELECT 1 FROM pg_database WHERE datname='${test_database}'")"
if [[ -n "${existing}" ]]; then
  echo "Refusing to overwrite existing isolated validation database: ${test_database}" >&2
  exit 1
fi
docker exec "${postgres_container}" psql --username postgres --dbname bloodledger_dev --no-psqlrc --command "CREATE DATABASE \"${test_database}\" OWNER bloodledger_migrator" >/dev/null
cleanup() {
  docker exec "${postgres_container}" psql --username postgres --dbname bloodledger_dev --no-psqlrc --command "DROP DATABASE \"${test_database}\" WITH (FORCE)" >/dev/null
}
trap cleanup EXIT

export POSTGRES_DB="${test_database}"
export POSTGRES_HOST="127.0.0.1"
export POSTGRES_PORT="${POSTGRES_HOST_PORT:-5432}"
export POSTGRES_APP_USER="${POSTGRES_APP_USER:-bloodledger_app}"
export BLOODLEDGER_REPOSITORY_ROOT="${BLOODLEDGER_LIVE_REPOSITORY_ROOT:-${repository_root}}"
node database/scripts/migrate.mjs >/dev/null
node_modules/.bin/tsc -p services/api/tsconfig.json
dependency_root="$(readlink -f node_modules)"
run_probe() {
  local phase="$1"
  docker run --rm --network bloodledger_default \
    --volume "${repository_root}:/workspace" \
    --volume "${dependency_root}:${dependency_root}:ro" \
    --volume "${BLOODLEDGER_REPOSITORY_ROOT}:${BLOODLEDGER_REPOSITORY_ROOT}:ro" \
    --workdir /workspace \
    --env POSTGRES_HOST=postgres \
    --env POSTGRES_PORT=5432 \
    --env POSTGRES_DB \
    --env POSTGRES_APP_USER \
    --env POSTGRES_APP_PASSWORD \
    --env POSTGRES_MIGRATOR_USER \
    --env POSTGRES_MIGRATOR_PASSWORD \
    --env BLOODLEDGER_REPOSITORY_ROOT \
    --env FABRIC_CHAINCODE="${BLOODLEDGER_FABRIC_CHAINCODE:-bloodledger-inventory-s6-20260919}" \
    --env BLOODLEDGER_FABRIC_RECOVERY_RUN_SUFFIX \
    --env FABRIC_PEER_ENDPOINT=peer0-mediatrix:7051 \
    node:24.17.0 node services/api/test/v2-fabric-recovery-probe.mjs "${phase}"
}
run_probe commit

docker restart "${peer_container}" "${orderer_container}" >/dev/null
for container in "${peer_container}" "${orderer_container}"; do
  status=""
  for _ in $(seq 1 40); do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "${container}")"
    [[ "${status}" == "healthy" ]] && break
    sleep 1
  done
  [[ "${status}" == "healthy" ]] || { echo "${container} did not return to healthy after restart" >&2; exit 1; }
done

run_probe recover
echo "Real-Fabric committed-command projection recovery passed without resubmission"
