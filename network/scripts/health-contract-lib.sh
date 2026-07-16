#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=network/scripts/channel-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/channel-lib.sh"

health_contract_root="${repository_root}/network/health-contract"
health_build_root="${health_contract_root}/build"
health_package_root="${health_build_root}/package"
health_package_archive="${health_build_root}/bloodledger-health_0.1.0.tgz"
health_package_id_file="${health_build_root}/package-id.txt"
health_chaincode_name="bloodledger-health"
health_package_label="bloodledger-health_0.1.0"
health_version="0.1.0"
health_sequence="1"
health_policy="OR('MediatrixMSP.peer')"
# Canonical common.ApplicationPolicy encoding for the approved one-of-one
# MediatrixMSP PEER signature policy.
health_validation_parameter="Ch4SCBIGCAESAggAGhISEAoMTWVkaWF0cml4TVNQEAM="

assert_health_contract_environment() {
  assert_approved_channel_environment
  [[ "${FABRIC_HEALTH_CHAINCODE_NAME:-${health_chaincode_name}}" == "${health_chaincode_name}" ]] || {
    echo "FABRIC_HEALTH_CHAINCODE_NAME conflicts with the approved name ${health_chaincode_name}" >&2
    exit 1
  }
}

assert_health_prerequisites() {
  local context_mode="${1:-mutable}"
  assert_health_contract_environment
  for service in ca-mediatrix ca-orderer peer0-mediatrix orderer0; do
    local container_id
    container_id="$("${compose[@]}" ps --quiet "${service}")"
    [[ -n "${container_id}" ]] || { echo "Required Fabric service is not running: ${service}" >&2; exit 1; }
    [[ "$(docker inspect --format '{{.State.Health.Status}}' "${container_id}")" == healthy ]] || {
      echo "Required Fabric service is not healthy: ${service}" >&2
      exit 1
    }
  done
  [[ -f "${generated_root}/organizations/peerOrganizations/mediatrix.bloodledger.local/users/Admin@mediatrix.bloodledger.local/msp/signcerts/cert.pem" ]] || {
    echo "mediatrix-admin MSP material is missing" >&2
    exit 1
  }
  [[ -f "${generated_root}/organizations/peerOrganizations/mediatrix.bloodledger.local/users/Admin@mediatrix.bloodledger.local/tls/client.crt" && -f "${generated_root}/organizations/peerOrganizations/mediatrix.bloodledger.local/users/Admin@mediatrix.bloodledger.local/tls/client.key" ]] || {
    echo "mediatrix-admin TLS material is missing" >&2
    exit 1
  }
  if [[ "${context_mode}" == readonly ]]; then
    prepare_channel_query_context
  else
    prepare_channel_context
  fi
  peer_has_channel || { echo "peer0-mediatrix is not joined to bloodledger-dev" >&2; exit 1; }
  local orderer_channel_output peer_channel_output orderer_height peer_height
  orderer_channel_output="$(osnadmin list --channelID "${channel_name}")"
  peer_channel_output="$(health_tools_run peer channel getinfo -c "${channel_name}" 2>&1)"
  orderer_height="$(sed -n 's/.*"height":[[:space:]]*\([0-9][0-9]*\).*/\1/p' <<<"${orderer_channel_output}")"
  peer_height="$(sed -n 's/.*"height":[[:space:]]*\([0-9][0-9]*\).*/\1/p' <<<"${peer_channel_output}")"
  [[ -n "${orderer_height}" && -n "${peer_height}" ]] || {
    echo "Could not verify orderer and peer channel heights" >&2
    exit 1
  }
  [[ "${orderer_height}" == "${peer_height}" ]] || {
    echo "bloodledger-dev is not synchronized: orderer height ${orderer_height}, peer height ${peer_height}" >&2
    exit 1
  }
}

health_tools_run() {
  docker run --rm --network "${compose_network}" --user "$(id -u):$(id -g)" \
    --volume "${repository_root}/network/config:/config:ro" \
    --volume "${generated_root}:/generated" \
    --volume "${health_contract_root}:/health-contract" \
    --env FABRIC_CFG_PATH=/etc/hyperledger/fabric \
    --env CORE_PEER_LOCALMSPID=MediatrixMSP \
    --env CORE_PEER_MSPCONFIGPATH="${peer_admin}/msp" \
    --env CORE_PEER_ADDRESS=peer0.mediatrix.bloodledger.local:7051 \
    --env CORE_PEER_TLS_ENABLED=true \
    --env CORE_PEER_TLS_ROOTCERT_FILE="${peer_tls_root}" \
    "${tools_image}" "$@"
}

calculate_health_package_id() {
  local archive="${1:-${health_package_archive}}"
  health_tools_run peer lifecycle chaincode calculatepackageid "/health-contract/build/$(basename "${archive}")"
}

verify_committed_health_policy() {
  local committed_json="$1" policy_base64 role_base64
  # Canonical msp.MSPRole encoding for MediatrixMSP with role PEER.
  local expected_peer_role_base64="CgxNZWRpYXRyaXhNU1AQAw=="
  policy_base64="$(jq -r '.validation_parameter // empty' <<<"${committed_json}")"
  [[ -n "${policy_base64}" ]] || { echo "Committed definition has no endorsement policy" >&2; exit 1; }
  printf '%s' "${policy_base64}" | base64 --decode >"${health_build_root}/committed-policy.pb"
  health_tools_run configtxlator proto_decode --input /health-contract/build/committed-policy.pb \
    --type common.ApplicationPolicy --output /health-contract/build/committed-policy.json
  jq -e '(.signature_policy.identities | length) == 1 and .signature_policy.identities[0].principal_classification == "ROLE"' \
    "${health_build_root}/committed-policy.json" >/dev/null
  jq -e '.signature_policy.rule.n_out_of.n == 1 and (.signature_policy.rule.n_out_of.rules | length == 1) and .signature_policy.rule.n_out_of.rules[0].signed_by == 0' \
    "${health_build_root}/committed-policy.json" >/dev/null
  role_base64="$(jq -r '.signature_policy.identities[0].principal' "${health_build_root}/committed-policy.json")"
  [[ "${role_base64}" == "${expected_peer_role_base64}" ]] || {
    echo "Committed endorsement policy is not MediatrixMSP peer-only" >&2
    exit 1
  }
}
