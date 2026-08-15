#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source_dir="$root/services/coordination/src"

if rg -n "fabric-(contract-api|shim|gateway)|submitTransaction|evaluateTransaction" "$source_dir"; then
  echo "Coordination worker must not call Fabric or chaincode" >&2
  exit 1
fi

if rg -n "(patient|donor|diagnosis|treatment|employee)(_id|Id|Name)?" "$root/services/coordination"; then
  echo "Coordination package contains a prohibited PHI/PII field" >&2
  exit 1
fi

rg -q 'DISABLED_UNAPPROVED_POLICY' "$root/services/coordination/policy/synthetic-optimization-v1.json"
rg -q 'automaticApprovalEnabled.*false' "$root/services/coordination/policy/synthetic-optimization-v1.json"
rg -q 'retentionDays.*30' "$root/services/coordination/policy/synthetic-location-v1.json"

echo "Static coordination boundary checks passed"
