#!/usr/bin/env bash
set -euo pipefail
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "$repository_root"
source network/scripts/inventory-contract-lib.sh
[[ "${1:-}" == --apply && "${2:-}" == bloodledger-local && "$#" -eq 2 ]] || {
  echo 'Usage: bash network/scripts/deploy-persistent-development.sh --apply bloodledger-local' >&2; exit 2;
}
# FR-12 / NFR-02: preserve trust, endorsement, namespaces and retained channel state.
assert_health_prerequisites readonly
version=persistent-development-v1
current="$(inventory_tools_run peer lifecycle chaincode querycommitted --channelID "$channel_name" --output json)"
definition="$(jq -c --arg name "$inventory_chaincode_name" '.chaincode_definitions[] | select(.name==$name)' <<< "$current")"
[[ -n "$definition" ]] || { echo 'Existing domain chaincode definition is required' >&2; exit 1; }
[[ "$(jq -r '.validation_parameter' <<< "$definition")" == "$inventory_validation_parameter" ]] || { echo 'Existing endorsement policy differs from the approved Mediatrix policy' >&2; exit 1; }
jq -e '.endorsement_plugin=="escc" and .validation_plugin=="vscc" and ((.init_required // false)==false) and ((.collections // {})=={})' <<< "$definition" >/dev/null || {
  echo 'Existing lifecycle plugins, initialization or collections differ from the reviewed baseline' >&2; exit 1;
}
sequence="$(jq -r '.sequence' <<< "$definition")"
[[ "$sequence" =~ ^[1-9][0-9]*$ ]] || { echo 'Invalid existing sequence' >&2; exit 1; }
docker run --rm -v "$repository_root:/workspace" -w /workspace node:24.17.0 \
  sh -ec 'npm run build --workspace @bloodledger/inventory-contract && node chaincode/scripts/prepare-package.mjs'
package_digest="$(find chaincode/build/package/dist -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum | sha256sum | cut -d ' ' -f1)"
label="bloodledger-persistent-development-v1_${package_digest:0:12}"
archive="${inventory_build_root}/${label}.tgz"
inventory_tools_run peer lifecycle chaincode package "/chaincode/build/$(basename "$archive")" \
  --path /chaincode/build/package --lang node --label "$label"
package_id="$(calculate_inventory_package_id "$archive")"
installed="$(inventory_tools_run peer lifecycle chaincode queryinstalled --output json)"
if ! jq -e --arg id "$package_id" '.installed_chaincodes | any(.package_id==$id)' <<< "$installed" >/dev/null; then
  inventory_tools_run peer lifecycle chaincode install "/chaincode/build/$(basename "$archive")"
fi
if [[ "$(jq -r '.version' <<< "$definition")" == "$version" ]]; then
  approved="$(inventory_tools_run peer lifecycle chaincode queryapproved --channelID "$channel_name" --name "$inventory_chaincode_name" --sequence "$sequence" --output json)"
  jq -e --arg id "$package_id" --arg version "$version" --arg policy "$inventory_validation_parameter" --argjson sequence "$sequence" \
    '.sequence==$sequence and .version==$version and .validation_parameter==$policy and .source.Type.LocalPackage.package_id==$id' <<< "$approved" >/dev/null || {
      echo 'Committed development version has a different package; review a new version before upgrading' >&2; exit 1;
    }
  printf 'Persistent development package already approved at sequence %s; package %s\n' "$sequence" "$package_id"
  exit 0
fi
sequence="$((sequence+1))"
inventory_tools_run peer lifecycle chaincode approveformyorg -o orderer0.orderer.bloodledger.local:7050 \
  --ordererTLSHostnameOverride orderer0.orderer.bloodledger.local --tls --cafile "$orderer_tls_root" \
  --channelID "$channel_name" --name "$inventory_chaincode_name" --version "$version" \
  --package-id "$package_id" --sequence "$sequence" --signature-policy "$inventory_policy"
readiness="$(inventory_tools_run peer lifecycle chaincode checkcommitreadiness --channelID "$channel_name" \
  --name "$inventory_chaincode_name" --version "$version" --sequence "$sequence" --signature-policy "$inventory_policy" --output json)"
jq -e '.approvals.MediatrixMSP==true' <<< "$readiness" >/dev/null
inventory_tools_run peer lifecycle chaincode commit -o orderer0.orderer.bloodledger.local:7050 \
  --ordererTLSHostnameOverride orderer0.orderer.bloodledger.local --tls --cafile "$orderer_tls_root" \
  --channelID "$channel_name" --name "$inventory_chaincode_name" --version "$version" --sequence "$sequence" \
  --signature-policy "$inventory_policy" --peerAddresses peer0.mediatrix.bloodledger.local:7051 --tlsRootCertFiles "$peer_tls_root"
committed="$(inventory_tools_run peer lifecycle chaincode querycommitted --channelID "$channel_name" --name "$inventory_chaincode_name" --output json)"
jq -e --arg version "$version" --argjson sequence "$sequence" --arg policy "$inventory_validation_parameter" \
  '.version==$version and .sequence==$sequence and .validation_parameter==$policy and .approvals.MediatrixMSP==true' <<< "$committed" >/dev/null
approved="$(inventory_tools_run peer lifecycle chaincode queryapproved --channelID "$channel_name" --name "$inventory_chaincode_name" --sequence "$sequence" --output json)"
jq -e --arg id "$package_id" --arg version "$version" --argjson sequence "$sequence" \
  '.sequence==$sequence and .version==$version and .source.Type.LocalPackage.package_id==$id' <<< "$approved" >/dev/null
printf 'Persistent development committed at sequence %s; verified package %s\n' "$sequence" "$package_id"
