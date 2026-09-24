#!/usr/bin/env bash
set -euo pipefail
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "${repository_root}"

suffix="${BLOODLEDGER_COMPROMISE_RUN_SUFFIX:-}"
[[ "${suffix}" =~ ^[A-Z0-9]{4,20}$ ]] || { echo 'Set a unique BLOODLEDGER_COMPROMISE_RUN_SUFFIX (4–20 uppercase letters/digits)' >&2; exit 1; }
chaincode_name="bloodledger-inventory-s6-compromise-${suffix,,}"
export BLOODLEDGER_COMPROMISE_RUN_SUFFIX="${suffix}"
export FABRIC_CHAINCODE="${chaincode_name}"

# Refuse to package, install, submit, or change the test database until the
# preserved peer/orderer trust and channel heights are verified.
network/scripts/preflight-fabric-trust.sh
source network/scripts/inventory-contract-lib.sh
assert_health_prerequisites
if [[ -f .env ]]; then set -a; source .env; set +a; fi
for variable_name in POSTGRES_ADMIN_PASSWORD POSTGRES_MIGRATOR_PASSWORD POSTGRES_APP_PASSWORD; do
  [[ -n "${!variable_name:-}" ]] || { echo "Required untracked secret is missing: ${variable_name}" >&2; exit 1; }
done

existing_definitions="$(inventory_tools_run peer lifecycle chaincode querycommitted --channelID "${channel_name}" --output json)"
if jq -e --arg name "${chaincode_name}" '.chaincode_definitions | any(.name == $name)' <<<"${existing_definitions}" >/dev/null; then
  echo "Refusing to reuse existing live validation definition ${chaincode_name}" >&2
  exit 1
fi

export PATH="${HOME}/.nvm/versions/node/v24.17.0/bin:${PATH}"
network/scripts/package-inventory-contract.sh
package_id="$(<"${inventory_package_id_file}")"
installed="$(inventory_tools_run peer lifecycle chaincode queryinstalled --output json)"
if ! jq -e --arg package_id "${package_id}" '.installed_chaincodes | any(.package_id == $package_id)' <<<"${installed}" >/dev/null; then
  inventory_tools_run peer lifecycle chaincode install "/chaincode/build/$(basename "${inventory_package_archive}")"
fi
inventory_tools_run peer lifecycle chaincode approveformyorg \
  -o orderer0.orderer.bloodledger.local:7050 --ordererTLSHostnameOverride orderer0.orderer.bloodledger.local \
  --tls --cafile "${orderer_tls_root}" --channelID "${channel_name}" \
  --name "${chaincode_name}" --version "${inventory_version}" --package-id "${package_id}" \
  --sequence 1 --signature-policy "${inventory_policy}"
readiness="$(inventory_tools_run peer lifecycle chaincode checkcommitreadiness \
  --channelID "${channel_name}" --name "${chaincode_name}" --version "${inventory_version}" \
  --sequence 1 --signature-policy "${inventory_policy}" --output json)"
jq -e '.approvals.MediatrixMSP == true' <<<"${readiness}" >/dev/null
inventory_tools_run peer lifecycle chaincode commit \
  -o orderer0.orderer.bloodledger.local:7050 --ordererTLSHostnameOverride orderer0.orderer.bloodledger.local \
  --tls --cafile "${orderer_tls_root}" --channelID "${channel_name}" \
  --name "${chaincode_name}" --version "${inventory_version}" --sequence 1 \
  --signature-policy "${inventory_policy}" --peerAddresses peer0.mediatrix.bloodledger.local:7051 \
  --tlsRootCertFiles "${peer_tls_root}"
committed="$(inventory_tools_run peer lifecycle chaincode querycommitted \
  --channelID "${channel_name}" --name "${chaincode_name}" --output json)"
jq -e --arg version "${inventory_version}" --arg policy "${inventory_validation_parameter}" \
  '.version == $version and .sequence == 1 and .validation_parameter == $policy' <<<"${committed}" >/dev/null
printf 'Fabric validation definition: %s; package ID: %s; version=%s; sequence=1\n' "${chaincode_name}" "${package_id}" "${inventory_version}"

test_database="bloodledger_s6_compromise_${suffix,,}"
postgres_container="$("${compose[@]}" ps --quiet postgres)"
[[ -n "${postgres_container}" ]] || { echo 'Project PostgreSQL is unavailable' >&2; exit 1; }
existing_database="$(docker exec "${postgres_container}" psql --username postgres --dbname bloodledger_dev --no-psqlrc --tuples-only --no-align --command "SELECT 1 FROM pg_database WHERE datname='${test_database}'")"
[[ -z "${existing_database}" ]] || { echo "Refusing to overwrite ${test_database}" >&2; exit 1; }
docker exec "${postgres_container}" psql --username postgres --dbname bloodledger_dev --no-psqlrc \
  --command "CREATE DATABASE \"${test_database}\" OWNER bloodledger_migrator" >/dev/null
cleanup() {
  docker exec "${postgres_container}" psql --username postgres --dbname bloodledger_dev --no-psqlrc \
    --command "DROP DATABASE \"${test_database}\" WITH (FORCE)" >/dev/null
}
trap cleanup EXIT
export POSTGRES_DB="${test_database}"
export POSTGRES_HOST=127.0.0.1
export POSTGRES_PORT="${POSTGRES_HOST_PORT:-5432}"
export POSTGRES_APP_USER="${POSTGRES_APP_USER:-bloodledger_app}"
export BLOODLEDGER_REPOSITORY_ROOT="${repository_root}"
node database/scripts/migrate.mjs >/dev/null
npm run build --workspace @bloodledger/api >/dev/null
dependency_root="$(readlink -f node_modules)"

run_probe() {
  docker run --rm --network bloodledger_default \
    --volume "${repository_root}:/workspace:ro" --volume "${dependency_root}:${dependency_root}:ro" \
    --volume "${repository_root}:${repository_root}:ro" \
    --workdir /workspace \
    --env POSTGRES_HOST=postgres --env POSTGRES_PORT=5432 --env POSTGRES_DB \
    --env POSTGRES_APP_USER --env POSTGRES_APP_PASSWORD \
    --env POSTGRES_MIGRATOR_USER --env POSTGRES_MIGRATOR_PASSWORD \
    --env BLOODLEDGER_REPOSITORY_ROOT --env BLOODLEDGER_COMPROMISE_RUN_SUFFIX \
    --env FABRIC_CHAINCODE node:24.17.0 \
    node services/api/test/v2-fabric-compromise-probe.mjs "$1"
}
run_probe seed
run_probe commit
"${compose[@]}" restart peer0-mediatrix orderer0 >/dev/null
for service in peer0-mediatrix orderer0; do
  container_id="$("${compose[@]}" ps --quiet "${service}")"
  for _ in $(seq 1 40); do
    [[ "$(docker inspect --format '{{.State.Health.Status}}' "${container_id}")" == healthy ]] && break
    sleep 1
  done
  [[ "$(docker inspect --format '{{.State.Health.Status}}' "${container_id}")" == healthy ]] || { echo "${service} did not recover" >&2; exit 1; }
done
network/scripts/preflight-fabric-trust.sh
run_probe recover
echo 'Real-Fabric compromise, quarantine projection, and zero-submission recovery passed'
