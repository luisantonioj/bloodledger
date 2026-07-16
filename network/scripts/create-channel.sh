#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=network/scripts/channel-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/channel-lib.sh"

prepare_channel_context
"${repository_root}/network/scripts/ensure-channel-admin-tls.sh"

candidate="${channel_artifacts}/${channel_name}.candidate.block"
observed="${channel_artifacts}/${channel_name}.observed.block"
rm -f "${candidate}" "${observed}"
tools_run configtxgen -configPath /config -profile BloodLedgerDevChannel \
  -outputBlock "/generated/channel-artifacts/$(basename "${candidate}")" \
  -channelID "${channel_name}"
inspect_channel_block "${candidate}"

orderer_joined=false
peer_joined=false
orderer_has_channel && orderer_joined=true
peer_has_channel && peer_joined=true

if [[ "${orderer_joined}" == true ]]; then
  tools_run peer channel fetch 0 "/generated/channel-artifacts/$(basename "${observed}")" \
    -c "${channel_name}" -o orderer0.orderer.bloodledger.local:7050 \
    --tls --cafile "${orderer_tls_root}"
  inspect_channel_block "${observed}"
  [[ "$(channel_config_digest "${candidate}")" == "$(channel_config_digest "${observed}")" ]] || {
    echo "Existing ${channel_name} genesis block conflicts with the approved channel configuration; no state was changed" >&2
    exit 1
  }
  if [[ -f "${channel_block}" ]]; then
    [[ "$(channel_config_digest "${channel_block}")" == "$(channel_config_digest "${observed}")" ]] || {
      echo "Generated channel block conflicts with the effective ${channel_name} configuration; no artifact was overwritten" >&2
      exit 1
    }
  else
    mv "${observed}" "${channel_block}"
  fi
  rm -f "${candidate}" "${observed}"
  echo "orderer0 already participates in ${channel_name}; approved configuration verified"
elif [[ "${peer_joined}" == true ]]; then
  echo "peer0-mediatrix reports ${channel_name}, but orderer0 does not; refusing conflicting state" >&2
  exit 1
else
  if [[ -f "${channel_block}" ]]; then
    [[ "$(channel_config_digest "${candidate}")" == "$(channel_config_digest "${channel_block}")" ]] || {
      echo "Existing generated channel block conflicts with the approved configuration; no state was changed" >&2
      exit 1
    }
  fi
  mv "${candidate}" "${channel_block}"
  osnadmin join --channelID "${channel_name}" --config-block "/generated/channel-artifacts/$(basename "${channel_block}")"
  for _ in $(seq 1 20); do
    orderer_has_channel && break
    sleep 1
  done
  orderer_has_channel || { echo "orderer0 did not report ${channel_name} after join" >&2; exit 1; }
  echo "orderer0 joined ${channel_name} through channel participation"
fi

if [[ "${peer_joined}" == true ]]; then
  echo "peer0-mediatrix already belongs to ${channel_name}; membership verified"
else
  tools_run peer channel join --blockpath "/generated/channel-artifacts/$(basename "${channel_block}")"
  peer_has_channel || { echo "peer0-mediatrix did not report ${channel_name} after join" >&2; exit 1; }
  echo "peer0-mediatrix joined ${channel_name}"
fi

"${repository_root}/network/scripts/query-channel.sh"
