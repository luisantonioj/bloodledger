#!/usr/bin/env bash
set -euo pipefail
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "${repository_root}"

operations=scripts/bloodledger-dev.sh
health_query=network/scripts/query-health-contract.sh
bash -n "${operations}" "${health_query}"

for command_name in doctor bootstrap start status logs stop reset-fabric reset-all; do
  grep -Fq "${command_name}" "${operations}"
done
for required in \
  'docker compose --project-name "${project_name}"' \
  'RESET_BLOODLEDGER_FABRIC' \
  'RESET_BLOODLEDGER_DEVELOPMENT' \
  'network/generated' \
  'network/health-contract/build' \
  'postgres-data' \
  'realpath -m' \
  'find "${target}" -mindepth 1 -depth -delete'; do
  grep -Fq "${required}" "${operations}"
done
grep -Fq 'Reset stopped on partial failure' "${operations}"
grep -Fq 'org.hyperledger.fabric.chaincode.type' "${operations}"
grep -Fq 'bloodledger-health_0\.1\.0:([a-f0-9]{64})' "${operations}"

if rg -n 'docker (system|volume|network|builder) prune|compose[^\n]*down[^\n]*--volumes|rm -rf|eval ' \
  "${operations}" "${health_query}"; then
  echo "Forbidden global cleanup or unsafe shell operation found" >&2
  exit 1
fi
if rg -n 'MEDIATRIX_CA_ADMIN_PASSWORD.*echo|ORDERER_CA_ADMIN_PASSWORD.*echo|POSTGRES_.*PASSWORD.*echo' \
  "${operations}"; then
  echo "Potential secret-value output found" >&2
  exit 1
fi
grep -Fq 'peer chaincode query' "${health_query}"
grep -Fq 'assert_health_prerequisites readonly' "${health_query}"
! grep -Eq 'peer chaincode invoke|submit|RecordProbe' "${health_query}"
git check-ignore --quiet --no-index network/health-contract/build/operational-test.tgz
[[ -z "$(git ls-files network/generated network/health-contract/build)" ]]
echo "Static operational interface, reset boundary, and read-only status checks passed"
