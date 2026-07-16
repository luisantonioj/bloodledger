#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=network/scripts/lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

channel_name="bloodledger-dev"
tools_image="hyperledger/fabric-tools:2.5.16"
channel_artifacts="${generated_root}/channel-artifacts"
channel_block="${channel_artifacts}/${channel_name}.block"
peer_admin="/generated/organizations/peerOrganizations/mediatrix.bloodledger.local/users/Admin@mediatrix.bloodledger.local"
orderer_admin="/generated/organizations/ordererOrganizations/orderer.bloodledger.local/users/Admin@orderer.bloodledger.local"
peer_tls_root="/generated/organizations/peerOrganizations/mediatrix.bloodledger.local/peers/peer0.mediatrix.bloodledger.local/tls/ca.crt"
orderer_tls_root="/generated/organizations/ordererOrganizations/orderer.bloodledger.local/orderers/orderer0.orderer.bloodledger.local/tls/ca.crt"

# Channel-only Compose inspection must not require or modify PostgreSQL secrets.
export POSTGRES_ADMIN_PASSWORD="${POSTGRES_ADMIN_PASSWORD:-unused-by-channel-command}"
export POSTGRES_MIGRATOR_PASSWORD="${POSTGRES_MIGRATOR_PASSWORD:-unused-by-channel-command}"
export POSTGRES_APP_PASSWORD="${POSTGRES_APP_PASSWORD:-unused-by-channel-command}"

assert_approved_channel_environment() {
  [[ "${FABRIC_CHANNEL_NAME:-${channel_name}}" == "${channel_name}" ]] || {
    echo "FABRIC_CHANNEL_NAME conflicts with the approved channel ${channel_name}" >&2
    exit 1
  }
  [[ "${MEDIATRIX_MSP_ID:-MediatrixMSP}" == MediatrixMSP ]] || {
    echo "MEDIATRIX_MSP_ID conflicts with the approved MSP ID MediatrixMSP" >&2
    exit 1
  }
  [[ "${ORDERER_MSP_ID:-OrdererMSP}" == OrdererMSP ]] || {
    echo "ORDERER_MSP_ID conflicts with the approved MSP ID OrdererMSP" >&2
    exit 1
  }
}

resolve_compose_network() {
  local peer_id
  peer_id="$("${compose[@]}" ps --quiet peer0-mediatrix)"
  [[ -n "${peer_id}" ]] || { echo "peer0-mediatrix is not running" >&2; exit 1; }
  mapfile -t compose_networks < <(
    docker inspect --format '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}}{{println}}{{end}}' "${peer_id}" |
      sed '/^$/d'
  )
  [[ "${#compose_networks[@]}" -eq 1 && -n "${compose_networks[0]}" ]] || {
    echo "Expected peer0-mediatrix on exactly one project-scoped Compose network" >&2
    exit 1
  }
  compose_network="${compose_networks[0]}"
  [[ "$(docker network inspect --format '{{index .Labels "com.docker.compose.project"}}' "${compose_network}")" == bloodledger ]] || {
    echo "Peer network is not scoped to Compose project bloodledger" >&2
    exit 1
  }
}

tools_run() {
  docker run --rm --network "${compose_network}" --user "$(id -u):$(id -g)" \
    --volume "${repository_root}/network/config:/config:ro" \
    --volume "${generated_root}:/generated" \
    --env FABRIC_CFG_PATH=/etc/hyperledger/fabric \
    --env CORE_PEER_LOCALMSPID=MediatrixMSP \
    --env CORE_PEER_MSPCONFIGPATH="${peer_admin}/msp" \
    --env CORE_PEER_ADDRESS=peer0.mediatrix.bloodledger.local:7051 \
    --env CORE_PEER_TLS_ENABLED=true \
    --env CORE_PEER_TLS_ROOTCERT_FILE="${peer_tls_root}" \
    "${tools_image}" "$@"
}

osnadmin() {
  tools_run osnadmin channel "$@" -o orderer0:9443 \
    --ca-file "${orderer_tls_root}" \
    --client-cert "${orderer_admin}/tls/client.crt" \
    --client-key "${orderer_admin}/tls/client.key"
}

peer_channels() {
  tools_run peer channel list
}

peer_has_channel() {
  peer_channels 2>/dev/null | grep -Fxq "${channel_name}"
}

orderer_has_channel() {
  osnadmin list 2>/dev/null | grep -Eq '"name"[[:space:]]*:[[:space:]]*"bloodledger-dev"'
}

inspect_channel_block() {
  local block_path="$1" inspect_path="${channel_artifacts}/.inspect.json"
  tools_run configtxgen -configPath /config -inspectBlock "/generated/channel-artifacts/$(basename "${block_path}")" >"${inspect_path}"
  tools_run jq -e '
    .data.data[0].payload as $payload |
    $payload.header.channel_header.channel_id == "bloodledger-dev" and
    ($payload.data.config.channel_group.groups | keys == ["Application", "Orderer"]) and
    ($payload.data.config.channel_group.groups.Application.groups | keys == ["MediatrixMSP"]) and
    ($payload.data.config.channel_group.groups.Orderer.groups | keys == ["OrdererMSP"]) and
    ($payload.data.config.channel_group.values.Capabilities.value.capabilities | keys == ["V2_0"]) and
    ($payload.data.config.channel_group.groups.Application.values.Capabilities.value.capabilities | keys == ["V2_5"]) and
    ($payload.data.config.channel_group.groups.Orderer.values.Capabilities.value.capabilities | keys == ["V2_0"]) and
    ($payload.data.config.channel_group.groups.Orderer.values.ConsensusType.value.type == "etcdraft") and
    ($payload.data.config.channel_group.groups.Orderer.values.ConsensusType.value.metadata.consenters | length == 1) and
    ($payload.data.config.channel_group.groups.Orderer.values.ConsensusType.value.metadata.consenters[0].host == "orderer0.orderer.bloodledger.local") and
    ($payload.data.config.channel_group.groups.Orderer.values.ConsensusType.value.metadata.consenters[0].port == 7050) and
    ($payload.data.config.channel_group.groups.Orderer.groups.OrdererMSP.policies.Writers.policy.value.identities | length == 1) and
    ($payload.data.config.channel_group.groups.Orderer.groups.OrdererMSP.policies.Writers.policy.value.identities[0].principal.msp_identifier == "OrdererMSP") and
    ($payload.data.config.channel_group.groups.Orderer.groups.OrdererMSP.policies.Writers.policy.value.identities[0].principal.role == "ORDERER") and
    ((tostring | test("Org1MSP|Org2MSP|example\\.com|mychannel|PRCMSP|DOHMSP")) | not)
  ' "/generated/channel-artifacts/$(basename "${inspect_path}")" >/dev/null
  rm -f "${inspect_path}"
  echo "Effective bloodledger-dev channel block validation passed"
}

channel_config_digest() {
  local block_path="$1" inspect_path="${channel_artifacts}/.digest-inspect.json"
  tools_run configtxgen -configPath /config -inspectBlock "/generated/channel-artifacts/$(basename "${block_path}")" >"${inspect_path}"
  tools_run jq -S '.data.data[0].payload.data.config.channel_group' \
    "/generated/channel-artifacts/$(basename "${inspect_path}")" | sha256sum | cut -d' ' -f1
  rm -f "${inspect_path}"
}

prepare_channel_context() {
  assert_approved_channel_environment
  mkdir -p "${channel_artifacts}"
  chmod 700 "${channel_artifacts}"
  resolve_compose_network
}
