#!/usr/bin/env bash
set -euo pipefail
# Read-only trust and synchronization check for the preserved development channel.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/channel-lib.sh"

assert_approved_channel_environment
resolve_compose_network
for service in peer0-mediatrix orderer0; do
  container_id="$("${compose[@]}" ps --quiet "${service}")"
  [[ -n "${container_id}" && "$(docker inspect --format '{{.State.Health.Status}}' "${container_id}")" == healthy ]] || {
    echo "Fabric trust preflight: ${service} is not healthy" >&2
    exit 1
  }
done

scratch="$(mktemp -d)"
trap 'rm -rf "${scratch}"' EXIT
docker run --rm --user "$(id -u):$(id -g)" \
  --volume "${generated_root}:/generated:ro" --volume "${scratch}:/scratch" \
  --volume "${repository_root}/network/config:/config:ro" \
  "${tools_image}" configtxgen -configPath /config \
  -inspectBlock "/generated/channel-artifacts/${channel_name}.block" \
  >"${scratch}/block.json" 2>"${scratch}/inspect.log"

channel_orderer='.data.data[0].payload.data.config.channel_group.groups.Orderer'
jq -er "${channel_orderer}.values.ConsensusType.value.metadata.consenters[0].server_tls_cert" \
  "${scratch}/block.json" | base64 --decode >"${scratch}/channel-orderer.crt"
jq -er "${channel_orderer}.groups.OrdererMSP.values.MSP.value.config.tls_root_certs[0]" \
  "${scratch}/block.json" | base64 --decode >"${scratch}/channel-orderer-root.crt"
jq -er '.data.data[0].payload.data.config.channel_group.groups.Application.groups.MediatrixMSP.values.MSP.value.config.root_certs[0]' \
  "${scratch}/block.json" | base64 --decode >"${scratch}/channel-mediatrix-root.crt"

orderer_dir="${generated_root}/organizations/ordererOrganizations/orderer.bloodledger.local/orderers/orderer0.orderer.bloodledger.local/tls"
mediatrix_root="${generated_root}/organizations/peerOrganizations/mediatrix.bloodledger.local/msp/cacerts/ca-mediatrix-cert.pem"
cmp -s "${scratch}/channel-orderer.crt" "${orderer_dir}/server.crt" || { echo 'Generated channel orderer certificate differs from mounted identity' >&2; exit 1; }
cmp -s "${scratch}/channel-orderer-root.crt" "${orderer_dir}/ca.crt" || { echo 'Generated channel orderer root differs from mounted identity' >&2; exit 1; }
cmp -s "${scratch}/channel-mediatrix-root.crt" "${mediatrix_root}" || { echo 'Generated channel Mediatrix root differs from enrolled identity' >&2; exit 1; }
openssl verify -CAfile "${orderer_dir}/ca.crt" "${orderer_dir}/server.crt" >/dev/null
mounted_orderer_hash="$("${compose[@]}" exec --no-TTY orderer0 sha256sum /opt/bloodledger/orderer/tls/server.crt | cut -d' ' -f1)"
local_orderer_hash="$(sha256sum "${orderer_dir}/server.crt" | cut -d' ' -f1)"
[[ "${mounted_orderer_hash}" == "${local_orderer_hash}" ]] || { echo 'Running orderer certificate differs from generated identity' >&2; exit 1; }
peer_dir="${generated_root}/organizations/peerOrganizations/mediatrix.bloodledger.local/peers/peer0.mediatrix.bloodledger.local/tls"
mounted_peer_hash="$("${compose[@]}" exec --no-TTY peer0-mediatrix sha256sum /opt/bloodledger/fabric/tls/server.crt | cut -d' ' -f1)"
local_peer_hash="$(sha256sum "${peer_dir}/server.crt" | cut -d' ' -f1)"
[[ "${mounted_peer_hash}" == "${local_peer_hash}" ]] || { echo 'Running peer certificate differs from generated identity' >&2; exit 1; }

# The local files can agree while a preserved peer ledger holds older channel
# configuration. A signed peer channel query detects that case before submission.
orderer_info="$(osnadmin list --channelID "${channel_name}")"
orderer_height="$(sed -n 's/.*"height":[[:space:]]*\([0-9][0-9]*\).*/\1/p' <<<"${orderer_info}")"
[[ -n "${orderer_height}" ]] || { echo 'Orderer channel height unavailable' >&2; exit 1; }
if ! peer_info="$(tools_run peer channel getinfo -c "${channel_name}" 2>"${scratch}/peer-error.log")"; then
  if rg -q 'access denied|policy evaluation|TLS|certificate|unknown authority' "${scratch}/peer-error.log"; then
    echo 'Fabric trust preflight: persisted peer channel trust or identity rejects the current administrator; preserve ledger and investigate channel configuration' >&2
  else
    echo 'Fabric trust preflight: peer channel query failed' >&2
  fi
  exit 1
fi
peer_height="$(sed -n 's/.*"height":\([0-9][0-9]*\),.*/\1/p' <<<"${peer_info}")"
[[ -n "${peer_height}" && "${peer_height}" == "${orderer_height}" ]] || {
  echo "Fabric trust preflight: peer/orderer heights differ (peer ${peer_height:-unknown}, orderer ${orderer_height})" >&2
  exit 1
}
echo "Fabric trust preflight passed: channel=${channel_name}; height=${peer_height}; generated roots and live channel query verified"
