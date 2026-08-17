#!/usr/bin/env bash
set -euo pipefail
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "${repository_root}"
# shellcheck source=network/scripts/inventory-contract-lib.sh
source network/scripts/inventory-contract-lib.sh

assert_health_prerequisites
export PATH="${HOME}/.nvm/versions/node/v24.17.0/bin:${PATH}"
npm run build --workspace @bloodledger/inventory-contract
node chaincode/scripts/prepare-package.mjs
npm install --package-lock-only --ignore-scripts --workspaces=false \
  --prefix "${inventory_package_root}"
find "${inventory_package_root}" -exec touch -d '@946684800' {} +

candidate_archive="${inventory_build_root}/.bloodledger-inventory-transfer_0.2.0.candidate.tgz"
rm -f "${candidate_archive}"
tar --sort=name --mtime='@946684800' --owner=0 --group=0 --numeric-owner \
  --format=gnu --transform='s,^\./,src/,' \
  -czf "${inventory_build_root}/code.tar.gz" -C "${inventory_package_root}" .
touch -d '@946684800' \
  "${inventory_build_root}/code.tar.gz" "${inventory_build_root}/metadata.json"
tar --sort=name --mtime='@946684800' --owner=0 --group=0 --numeric-owner \
  --format=gnu -czf "${candidate_archive}" -C "${inventory_build_root}" \
  code.tar.gz metadata.json
candidate_package_id="$(calculate_inventory_package_id "${candidate_archive}")"
if [[ -f "${inventory_package_archive}" ]]; then
  package_id="$(calculate_inventory_package_id "${inventory_package_archive}")"
  [[ "${candidate_package_id}" == "${package_id}" ]] || {
    rm -f "${candidate_archive}"
    echo "Existing inventory package conflicts with the reproducible candidate" >&2
    exit 1
  }
  rm -f "${candidate_archive}"
else
  mv "${candidate_archive}" "${inventory_package_archive}"
  package_id="${candidate_package_id}"
fi
printf '%s\n' "${package_id}" >"${inventory_package_id_file}"
[[ "${package_id}" == "${inventory_package_label}:"* ]]
echo "Inventory contract packaged reproducibly; package ID recorded below ignored build output"
