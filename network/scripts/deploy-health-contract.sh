#!/usr/bin/env bash
set -euo pipefail
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "${repository_root}"
# shellcheck source=network/scripts/health-contract-lib.sh
source network/scripts/health-contract-lib.sh

network/scripts/package-health-contract.sh
assert_health_prerequisites
package_id="$(<"${health_package_id_file}")"

installed_json="$(health_tools_run peer lifecycle chaincode queryinstalled --output json)"
matching_installed="$(jq -r --arg label "${health_package_label}" '.installed_chaincodes[]? | select(.label == $label) | .package_id' <<<"${installed_json}")"
if [[ -n "${matching_installed}" && "${matching_installed}" != "${package_id}" ]]; then
  echo "Installed package label conflicts with the calculated package ID" >&2
  exit 1
fi
if [[ -z "${matching_installed}" ]]; then
  health_tools_run peer lifecycle chaincode install "/health-contract/build/$(basename "${health_package_archive}")"
fi
health_tools_run peer lifecycle chaincode queryinstalled --output json | jq -e \
  --arg label "${health_package_label}" --arg package_id "${package_id}" \
  '.installed_chaincodes | any(.label == $label and .package_id == $package_id)' >/dev/null

committed_json="$(health_tools_run peer lifecycle chaincode querycommitted --channelID "${channel_name}" --output json)"
existing_definition="$(jq -c --arg name "${health_chaincode_name}" '.chaincode_definitions[]? | select(.name == $name)' <<<"${committed_json}")"
if [[ -n "${existing_definition}" ]]; then
  jq -e --arg version "${health_version}" --argjson sequence "${health_sequence}" \
    '.version == $version and .sequence == $sequence' <<<"${existing_definition}" >/dev/null || {
      echo "Committed health contract definition conflicts with approved version or sequence" >&2
      exit 1
    }
  verify_committed_health_policy "${existing_definition}"
  echo "Identical health contract definition is already committed; lifecycle reuse validated"
  exit 0
fi

health_tools_run peer lifecycle chaincode approveformyorg \
  -o orderer0.orderer.bloodledger.local:7050 --ordererTLSHostnameOverride orderer0.orderer.bloodledger.local \
  --tls --cafile "${orderer_tls_root}" --channelID "${channel_name}" \
  --name "${health_chaincode_name}" --version "${health_version}" --package-id "${package_id}" \
  --sequence "${health_sequence}" --signature-policy "${health_policy}"

readiness_json="$(health_tools_run peer lifecycle chaincode checkcommitreadiness \
  --channelID "${channel_name}" --name "${health_chaincode_name}" --version "${health_version}" \
  --sequence "${health_sequence}" --signature-policy "${health_policy}" --output json)"
jq -e '.approvals.MediatrixMSP == true' <<<"${readiness_json}" >/dev/null || {
  echo "MediatrixMSP commit readiness was not proven" >&2
  exit 1
}

health_tools_run peer lifecycle chaincode commit \
  -o orderer0.orderer.bloodledger.local:7050 --ordererTLSHostnameOverride orderer0.orderer.bloodledger.local \
  --tls --cafile "${orderer_tls_root}" --channelID "${channel_name}" \
  --name "${health_chaincode_name}" --version "${health_version}" --sequence "${health_sequence}" \
  --signature-policy "${health_policy}" --peerAddresses peer0.mediatrix.bloodledger.local:7051 \
  --tlsRootCertFiles "${peer_tls_root}"

committed_definition="$(health_tools_run peer lifecycle chaincode querycommitted --channelID "${channel_name}" \
  --name "${health_chaincode_name}" --output json)"
jq -e \
  --arg version "${health_version}" --argjson sequence "${health_sequence}" \
  '.version == $version and .sequence == $sequence' <<<"${committed_definition}" >/dev/null
verify_committed_health_policy "${committed_definition}"
echo "Health contract definition committed with approved name, version, sequence, and Mediatrix-only policy"
