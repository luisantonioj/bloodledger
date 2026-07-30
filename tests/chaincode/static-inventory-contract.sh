#!/usr/bin/env bash
set -euo pipefail
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "${repository_root}"

[[ -f chaincode/policy/synthetic-inventory-v1.json ]]
jq -e '
  .classification == "PROTOTYPE_ASSUMPTION_NON_CLINICAL" and
  .policyVersion == "SYNTHETIC_INVENTORY_V1" and
  .institutionId == "INST_MEDIATRIX" and
  .bloodTypes == ["A_POSITIVE", "O_POSITIVE"] and
  .components.RED_BLOOD_CELLS.maximumCollectionToExpirySeconds == 259200 and
  .components.RED_BLOOD_CELLS.nearExpiryLeadSeconds == 43200 and
  .components.PLATELETS.maximumCollectionToExpirySeconds == 129600 and
  .components.PLATELETS.nearExpiryLeadSeconds == 21600
' chaincode/policy/synthetic-inventory-v1.json >/dev/null
rg -q 'super\("InventoryContract"\)' chaincode/src/inventory-contract.ts
rg -q 'RegisterBloodUnit' chaincode/src/inventory-contract.ts
rg -q 'ReadBloodUnit' chaincode/src/inventory-contract.ts
rg -q 'EvaluateBloodUnitExpiry' chaincode/src/inventory-contract.ts
rg -q 'status: "EXPIRED"' chaincode/src/inventory-contract.ts
rg -q 'SYNTHETIC_INVENTORY_V1' docs/REQUIREMENTS.md docs/SPRINT-02.md
rg -q 'PA-S2-01' docs/REQUIREMENTS.md docs/SPRINT-02.md
rg -q 'ADR-031' docs/ARCHITECTURE.md
rg -q '"fabric-contract-api": "2.5.8"' chaincode/package.json
rg -q '"fabric-shim": "2.5.8"' chaincode/package.json
rg -q 'inventory_validation_parameter="Ch4SCBIGCAESAggAGhISEAoMTWVkaWF0cml4TVNQEAM="' \
  network/scripts/inventory-contract-lib.sh
git check-ignore --quiet --no-index chaincode/build/example.tgz
[[ -z "$(git ls-files chaincode/build)" ]]
for script in network/scripts/*.sh tests/chaincode/*.sh; do bash -n "${script}"; done
echo "Static Sprint 2 policy, contract, documentation, dependency, and exclusion checks passed"
