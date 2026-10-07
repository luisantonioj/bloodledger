#!/usr/bin/env bash
set -euo pipefail
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "${repository_root}"
source network/scripts/inventory-contract-lib.sh
[[ "${1:-}" == --apply && "${2:-}" == bloodledger-local && "$#" -eq 2 ]] || {
  echo 'Usage: bash network/scripts/deploy-historical-inventory.sh --apply bloodledger-local' >&2; exit 2;
}
# Trust and synchronized channel checks precede every lifecycle mutation.
assert_health_prerequisites readonly
current="$(inventory_tools_run peer lifecycle chaincode querycommitted --channelID "$channel_name" --output json)"
definition="$(jq -c --arg name "$inventory_chaincode_name" '.chaincode_definitions[] | select(.name==$name)' <<< "$current")"
[[ -n "$definition" ]] || { echo 'Existing domain chaincode definition is required' >&2; exit 1; }
[[ "$(jq -r '.validation_parameter' <<< "$definition")" == "$inventory_validation_parameter" ]] || { echo 'Existing endorsement policy differs from the approved Mediatrix policy' >&2; exit 1; }
sequence="$(jq -r '.sequence' <<< "$definition")"
if [[ "$(jq -r '.version' <<< "$definition")" == historical-v1 ]]; then
  echo 'historical-v1 already committed; verify the installed package and contract before importing';exit 0;
fi
sequence="$((sequence+1))"
# Stage the full additive package, retaining operational contracts and their namespaces.
docker run --rm -v "$repository_root:/workspace" -w /workspace node:24.17.0 \
  sh -ec 'npm run build --workspace @bloodledger/inventory-contract && node chaincode/scripts/prepare-package.mjs'
package_digest="$(find chaincode/build/package/dist -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum | sha256sum | cut -d ' ' -f1)"
label="bloodledger-historical-v1_${package_digest:0:12}"
archive="${inventory_build_root}/${label}.tgz"
# Use Fabric's packager: the Node builder requires code.tar.gz contents under src/.
inventory_tools_run peer lifecycle chaincode package "/chaincode/build/$(basename "$archive")" \
  --path /chaincode/build/package --lang node --label "$label"
package_id="$(calculate_inventory_package_id "$archive")"
installed="$(inventory_tools_run peer lifecycle chaincode queryinstalled --output json)"
if ! jq -e --arg id "$package_id" '.installed_chaincodes | any(.package_id==$id)' <<< "$installed" >/dev/null; then
  inventory_tools_run peer lifecycle chaincode install "/chaincode/build/$(basename "$archive")"
fi
inventory_tools_run peer lifecycle chaincode approveformyorg -o orderer0.orderer.bloodledger.local:7050 \
  --ordererTLSHostnameOverride orderer0.orderer.bloodledger.local --tls --cafile "$orderer_tls_root" \
  --channelID "$channel_name" --name "$inventory_chaincode_name" --version historical-v1 \
  --package-id "$package_id" --sequence "$sequence" --signature-policy "$inventory_policy"
readiness="$(inventory_tools_run peer lifecycle chaincode checkcommitreadiness --channelID "$channel_name" \
  --name "$inventory_chaincode_name" --version historical-v1 --sequence "$sequence" --signature-policy "$inventory_policy" --output json)"
jq -e '.approvals.MediatrixMSP==true' <<< "$readiness" >/dev/null
inventory_tools_run peer lifecycle chaincode commit -o orderer0.orderer.bloodledger.local:7050 \
  --ordererTLSHostnameOverride orderer0.orderer.bloodledger.local --tls --cafile "$orderer_tls_root" \
  --channelID "$channel_name" --name "$inventory_chaincode_name" --version historical-v1 --sequence "$sequence" \
  --signature-policy "$inventory_policy" --peerAddresses peer0.mediatrix.bloodledger.local:7051 --tlsRootCertFiles "$peer_tls_root"
committed="$(inventory_tools_run peer lifecycle chaincode querycommitted --channelID "$channel_name" --name "$inventory_chaincode_name" --output json)"
jq -e --argjson sequence "$sequence" --arg policy "$inventory_validation_parameter" '.version=="historical-v1" and .sequence==$sequence and .validation_parameter==$policy and .approvals.MediatrixMSP==true' <<< "$committed" >/dev/null
printf 'Historical additive chaincode committed at sequence %s; package %s\n' "$sequence" "$package_id"
