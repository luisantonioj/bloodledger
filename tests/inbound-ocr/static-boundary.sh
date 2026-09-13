#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"

[[ "$(git branch --show-current)" == "codex/inbound-ocr-registration-v2" ]]
if git diff --name-only main...HEAD | rg -n '^(apps/web|apps/capture-pwa|services/forecasting)/'; then
  echo "Inbound OCR branch must not modify LAT/BUNO workstreams" >&2
  exit 1
fi

jq -e '.properties.captureMethod.const == "OCR" and .properties.capturePolicyVersion.const == "INBOUND_OCR_V1" and .additionalProperties == false' contracts/inbound-ocr-v1.schema.json >/dev/null
rg -q 'V2_OCR_REQUIRED' services/api/src/v2-routes.ts services/api/openapi-v2.json
rg -q 'RegisterInboundComponent|RecordInboundReceipt' chaincode/src/interview-core-contract.ts services/api/src/fabric.ts
rg -q "INBOUND_CAPTURE" services/api/src/v2-command.ts database/migrations/20260912010000000_add-inbound-ocr-capture-v2.js
rg -q 'captureMethod.*OCR|INBOUND_OCR_V1' services/api/src/inbound-ocr-policy.ts
if rg -n 'donationNumber\s*:' services/api/src/v2-routes.ts chaincode/src services/coordination/src; then
  echo "Raw Donation No. field reached command, Fabric, or coordination code" >&2
  exit 1
fi

echo "Inbound OCR boundary checks passed"
