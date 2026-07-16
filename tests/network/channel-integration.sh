#!/usr/bin/env bash
set -euo pipefail
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "${repository_root}"
# shellcheck source=network/scripts/lib.sh
source network/scripts/lib.sh

export POSTGRES_ADMIN_PASSWORD="${POSTGRES_ADMIN_PASSWORD:-unused-by-channel-test}"
export POSTGRES_MIGRATOR_PASSWORD="${POSTGRES_MIGRATOR_PASSWORD:-unused-by-channel-test}"
export POSTGRES_APP_PASSWORD="${POSTGRES_APP_PASSWORD:-unused-by-channel-test}"

for service in ca-mediatrix ca-orderer peer0-mediatrix orderer0; do
  id="$("${compose[@]}" ps --quiet "${service}")"
  [[ -n "${id}" ]] || { echo "Required S1-06 service is not running: ${service}" >&2; exit 1; }
  [[ "$(docker inspect --format '{{.State.Health.Status}}' "${id}")" == healthy ]] || {
    echo "Required S1-06 service is not healthy: ${service}" >&2
    exit 1
  }
done

ca_mediatrix_before="$("${compose[@]}" ps --quiet ca-mediatrix)"
ca_orderer_before="$("${compose[@]}" ps --quiet ca-orderer)"
postgres_before="$("${compose[@]}" ps --quiet postgres)"
postgres_volume_before="$(docker volume ls --quiet --filter name='^bloodledger_postgres-data$')"
identity_marker_before="$(stat -c '%Y:%s' network/generated/.identity-bootstrap-complete)"

network/scripts/create-channel.sh
block_hash_before="$(sha256sum network/generated/channel-artifacts/bloodledger-dev.block | cut -d' ' -f1)"
admin_tls_hash_before="$(find \
  network/generated/organizations/peerOrganizations/mediatrix.bloodledger.local/users/Admin@mediatrix.bloodledger.local/tls \
  network/generated/organizations/ordererOrganizations/orderer.bloodledger.local/users/Admin@orderer.bloodledger.local/tls \
  -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -d' ' -f1)"

network/scripts/create-channel.sh
network/scripts/query-channel.sh
[[ "$(sha256sum network/generated/channel-artifacts/bloodledger-dev.block | cut -d' ' -f1)" == "${block_hash_before}" ]]
[[ "$(find \
  network/generated/organizations/peerOrganizations/mediatrix.bloodledger.local/users/Admin@mediatrix.bloodledger.local/tls \
  network/generated/organizations/ordererOrganizations/orderer.bloodledger.local/users/Admin@orderer.bloodledger.local/tls \
  -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -d' ' -f1)" == "${admin_tls_hash_before}" ]]
[[ "$("${compose[@]}" ps --quiet ca-mediatrix)" == "${ca_mediatrix_before}" ]]
[[ "$("${compose[@]}" ps --quiet ca-orderer)" == "${ca_orderer_before}" ]]
[[ "$(stat -c '%Y:%s' network/generated/.identity-bootstrap-complete)" == "${identity_marker_before}" ]]
[[ "$("${compose[@]}" ps --quiet postgres)" == "${postgres_before}" ]]
[[ "$(docker volume ls --quiet --filter name='^bloodledger_postgres-data$')" == "${postgres_volume_before}" ]]
git check-ignore --quiet --no-index network/generated/channel-artifacts/bloodledger-dev.block
[[ -z "$(git ls-files network/generated)" ]]

echo "S1-07 channel creation, participation, peer join, query, and idempotency checks passed"
