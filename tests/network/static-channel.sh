#!/usr/bin/env bash
set -euo pipefail
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "${repository_root}"

files=(
  network/config/configtx.yaml
  network/scripts/channel-lib.sh
  network/scripts/create-channel.sh
  network/scripts/query-channel.sh
)
for required in \
  BloodLedgerDevChannel MediatrixMSP OrdererMSP \
  orderer0.orderer.bloodledger.local 'V2_5: true' 'V2_0: true' \
  'OrdererType: etcdraft' 'hyperledger/fabric-tools:2.5.16' \
  bloodledger-dev 'osnadmin join' 'peer channel join' 'peer channel getinfo'; do
  grep -Fq "${required}" "${files[@]}" || {
    echo "Missing approved channel value or operation: ${required}" >&2
    exit 1
  }
done
for forbidden in Org1MSP Org2MSP example.com mychannel cryptogen HealthContract bloodledger-health; do
  if grep -Fq "${forbidden}" network/config/configtx.yaml \
    network/scripts/create-channel.sh network/scripts/query-channel.sh; then
    echo "Unapproved channel value or excluded health-contract work found: ${forbidden}" >&2
    exit 1
  fi
done
[[ "$(grep -c -- '^[[:space:]]*- &Mediatrix' network/config/configtx.yaml)" -eq 1 ]]
[[ "$(grep -c -- '^[[:space:]]*- &Orderer' network/config/configtx.yaml)" -eq 1 ]]
[[ "$(grep -c -- '^[[:space:]]*- Host: orderer0.orderer.bloodledger.local' network/config/configtx.yaml)" -eq 1 ]]
! grep -Fq 'docker system prune' "${files[@]}"
! grep -Fq 'docker compose down' "${files[@]}"
git check-ignore --quiet --no-index network/generated/channel-artifacts/bloodledger-dev.block
[[ -z "$(git ls-files network/generated)" ]]
echo "Static S1-07 channel configuration checks passed"
