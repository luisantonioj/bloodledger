#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=network/scripts/health-contract-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/health-contract-lib.sh"

inventory_contract_root="${repository_root}/chaincode"
inventory_build_root="${inventory_contract_root}/build"
inventory_package_root="${inventory_build_root}/package"
inventory_package_archive="${inventory_build_root}/bloodledger-inventory_0.1.0.tgz"
inventory_package_id_file="${inventory_build_root}/package-id.txt"
inventory_chaincode_name="bloodledger-inventory"
inventory_package_label="bloodledger-inventory_0.1.0"
inventory_version="0.1.0"
inventory_sequence="1"
inventory_policy="OR('MediatrixMSP.peer')"
inventory_validation_parameter="Ch4SCBIGCAESAggAGhISEAoMTWVkaWF0cml4TVNQEAM="

inventory_tools_run() {
  docker run --rm --network "${compose_network}" --user "$(id -u):$(id -g)" \
    --volume "${repository_root}/network/config:/config:ro" \
    --volume "${generated_root}:/generated" \
    --volume "${inventory_contract_root}:/chaincode" \
    --env FABRIC_CFG_PATH=/etc/hyperledger/fabric \
    --env CORE_PEER_LOCALMSPID=MediatrixMSP \
    --env CORE_PEER_MSPCONFIGPATH="${peer_admin}/msp" \
    --env CORE_PEER_ADDRESS=peer0.mediatrix.bloodledger.local:7051 \
    --env CORE_PEER_TLS_ENABLED=true \
    --env CORE_PEER_TLS_ROOTCERT_FILE="${peer_tls_root}" \
    "${tools_image}" "$@"
}

calculate_inventory_package_id() {
  local archive="${1:-${inventory_package_archive}}"
  inventory_tools_run peer lifecycle chaincode calculatepackageid \
    "/chaincode/build/$(basename "${archive}")"
}
