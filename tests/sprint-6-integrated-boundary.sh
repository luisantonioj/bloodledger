#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

[[ "$(git branch --show-current)" == "codex/mediatrix-interview-core-v2" || "$(git branch --show-current)" == "codex/inbound-ocr-registration-v2" ]]
if git diff --name-only main...HEAD | rg -n '^(apps/web|apps/capture-pwa|services/forecasting)/'; then
  echo "Sprint 6 branch must not modify the LAT/Buno workstreams" >&2
  exit 1
fi

jq -e '(.bloodTypes | length) == 8 and (.componentTypes | length) == 4 and .nearExpiryEnabled == false and .classification == "SIMULATION_ONLY"' chaincode/policy/interview-core-v2.json >/dev/null
jq -e '.broa.weights.urgency == 0.5 and .broa.weights.stockShortage == 0.3125 and .broa.weights.distancePenalty == 0.1875 and .automaticApprovalEnabled == false' services/coordination/policy/interview-derived-optimization-v2.json >/dev/null
rg -q 'API_VERSION_READ_ONLY' services/api/src/app.ts
rg -q 'DISABLED_UNAPPROVED_REPORT_FORMAT' services/api/src/v2-routes.ts services/api/src/census-worker.ts
rg -q 'sourceSurplusIsEligibilityGate' services/coordination/policy/interview-derived-optimization-v2.json
rg -q 'AES-256-GCM|aes-256-gcm' services/api/src/donation-crypto.ts
if rg -n 'donationNumber\s*:' chaincode/src services/coordination/src; then
  echo "Raw Donation No. field reached chaincode or coordination" >&2
  exit 1
fi

echo "Sprint 6 integrated boundary checks passed"
