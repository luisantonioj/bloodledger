#!/usr/bin/env bash
set -euo pipefail
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "${repository_root}"

[[ -d network/health-contract/src ]]
[[ ! -e chaincode/health-contract ]]
rg -q 'super\("HealthContract"\)' network/health-contract/src/health-contract.ts
rg -q 'HealthProbeRecorded' network/health-contract/src/health-contract.ts
rg -q '\^\[A-Za-z0-9\._-\]\{1,64\}\$' network/health-contract/src/health-contract.ts
rg -q 'health:\$\{probeId\}' network/health-contract/src/health-contract.ts
rg -q '"fabric-contract-api": "2.5.8"' network/health-contract/package.json
rg -q '"fabric-shim": "2.5.8"' network/health-contract/package.json
rg -q '"@hyperledger/fabric-gateway": "1.11.0"' network/health-contract/package.json
rg -q '"emitDecoratorMetadata": true' network/health-contract/tsconfig.json
rg -q 'health_package_label="bloodledger-health_0.1.0"' network/scripts/health-contract-lib.sh
rg -q 'health_version="0.1.0"' network/scripts/health-contract-lib.sh
rg -q 'health_sequence="1"' network/scripts/health-contract-lib.sh
rg -q "health_policy=\"OR\('MediatrixMSP.peer'\)\"" network/scripts/health-contract-lib.sh
git check-ignore --quiet --no-index network/health-contract/build/example.tgz
[[ -z "$(git ls-files network/generated network/health-contract/build)" ]]
echo "Static S1-07 health-contract boundary, interface, lifecycle, dependency, and exclusion checks passed"
