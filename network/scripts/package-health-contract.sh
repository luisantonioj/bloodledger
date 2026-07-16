#!/usr/bin/env bash
set -euo pipefail
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "${repository_root}"
# shellcheck source=network/scripts/health-contract-lib.sh
source network/scripts/health-contract-lib.sh

assert_health_prerequisites
export PATH="${HOME}/.nvm/versions/node/v24.17.0/bin:${PATH}"
npm run build --workspace @bloodledger/health-contract
node network/health-contract/scripts/prepare-package.mjs
npm install --package-lock-only --ignore-scripts --workspaces=false --prefix "${health_package_root}"
find "${health_package_root}" -exec touch -d '@946684800' {} +

candidate_archive="${health_build_root}/.bloodledger-health_0.1.0.candidate.tgz"
rm -f "${candidate_archive}"
tar --sort=name --mtime='@946684800' --owner=0 --group=0 --numeric-owner --format=gnu \
  --transform='s,^\./,src/,' -czf "${health_build_root}/code.tar.gz" -C "${health_package_root}" .
touch -d '@946684800' "${health_build_root}/code.tar.gz" "${health_build_root}/metadata.json"
tar --sort=name --mtime='@946684800' --owner=0 --group=0 --numeric-owner --format=gnu \
  -czf "${candidate_archive}" -C "${health_build_root}" code.tar.gz metadata.json
candidate_package_id="$(calculate_health_package_id "${candidate_archive}")"
if [[ -f "${health_package_archive}" ]]; then
  package_id="$(calculate_health_package_id "${health_package_archive}")"
  [[ "${candidate_package_id}" == "${package_id}" ]] || {
    rm -f "${candidate_archive}"
    echo "Existing health package conflicts with the reproducible candidate" >&2
    exit 1
  }
  rm -f "${candidate_archive}"
else
  mv "${candidate_archive}" "${health_package_archive}"
  package_id="${candidate_package_id}"
fi
printf '%s\n' "${package_id}" >"${health_package_id_file}"
[[ "${package_id}" == "${health_package_label}:"* ]] || {
  echo "Calculated package ID does not match approved label" >&2
  exit 1
}
echo "Health contract packaged with approved label; package ID recorded below ignored build output"
