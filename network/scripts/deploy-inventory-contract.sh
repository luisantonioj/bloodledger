#!/usr/bin/env bash
set -euo pipefail
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "${repository_root}"
# shellcheck source=network/scripts/inventory-contract-lib.sh
source network/scripts/inventory-contract-lib.sh

network/scripts/package-inventory-contract.sh
assert_health_prerequisites
package_id="$(<"${inventory_package_id_file}")"

committed_json="$(inventory_tools_run peer lifecycle chaincode querycommitted \
  --channelID "${channel_name}" --output json)"
existing_definition="$(jq -c --arg name "${inventory_chaincode_name}" \
  '.chaincode_definitions[]? | select(.name == $name)' <<<"${committed_json}")"
if [[ -n "${existing_definition}" ]]; then
  if jq -e --arg version "${inventory_version}" --argjson sequence "${inventory_sequence}" \
    --arg policy "${inventory_validation_parameter}" \
    '.version == $version and .sequence == $sequence and
     .validation_parameter == $policy' \
    <<<"${existing_definition}" >/dev/null; then
    echo "Identical inventory-transfer contract definition is already committed"
    exit 0
  fi
  jq -e --arg policy "${inventory_validation_parameter}" \
    '.version == "0.1.0" and .sequence == 1 and .validation_parameter == $policy' \
    <<<"${existing_definition}" >/dev/null || {
      echo "Committed definition is not the accepted Sprint 2 upgrade baseline" >&2
      exit 1
    }
else
  echo "Sprint 2 chaincode 0.1.0 sequence 1 must be committed before the Sprint 3 upgrade" >&2
  exit 1
fi

installed_json="$(inventory_tools_run peer lifecycle chaincode queryinstalled --output json)"
if ! jq -e --arg package_id "${package_id}" \
  '.installed_chaincodes | any(.package_id == $package_id)' <<<"${installed_json}" >/dev/null; then
  inventory_tools_run peer lifecycle chaincode install \
    "/chaincode/build/$(basename "${inventory_package_archive}")"
fi

inventory_tools_run peer lifecycle chaincode approveformyorg \
  -o orderer0.orderer.bloodledger.local:7050 \
  --ordererTLSHostnameOverride orderer0.orderer.bloodledger.local \
  --tls --cafile "${orderer_tls_root}" --channelID "${channel_name}" \
  --name "${inventory_chaincode_name}" --version "${inventory_version}" \
  --package-id "${package_id}" --sequence "${inventory_sequence}" \
  --signature-policy "${inventory_policy}"

readiness_json="$(inventory_tools_run peer lifecycle chaincode checkcommitreadiness \
  --channelID "${channel_name}" --name "${inventory_chaincode_name}" \
  --version "${inventory_version}" --sequence "${inventory_sequence}" \
  --signature-policy "${inventory_policy}" --output json)"
jq -e '.approvals.MediatrixMSP == true' <<<"${readiness_json}" >/dev/null

inventory_tools_run peer lifecycle chaincode commit \
  -o orderer0.orderer.bloodledger.local:7050 \
  --ordererTLSHostnameOverride orderer0.orderer.bloodledger.local \
  --tls --cafile "${orderer_tls_root}" --channelID "${channel_name}" \
  --name "${inventory_chaincode_name}" --version "${inventory_version}" \
  --sequence "${inventory_sequence}" --signature-policy "${inventory_policy}" \
  --peerAddresses peer0.mediatrix.bloodledger.local:7051 \
  --tlsRootCertFiles "${peer_tls_root}"

inventory_tools_run peer lifecycle chaincode querycommitted \
  --channelID "${channel_name}" --name "${inventory_chaincode_name}" --output json |
  jq -e --arg version "${inventory_version}" --argjson sequence "${inventory_sequence}" \
    --arg policy "${inventory_validation_parameter}" \
    '.version == $version and .sequence == $sequence and
     .validation_parameter == $policy and .approvals.MediatrixMSP == true' \
    >/dev/null
echo "Inventory-transfer contract upgraded to 0.2.0 sequence 2 with the single-Mediatrix policy"
