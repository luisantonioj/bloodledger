#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${repository_root}"

test -f services/api/openapi.json
node -e 'JSON.parse(require("node:fs").readFileSync("services/api/openapi.json", "utf8"))'
rg -q 'SIMULATION_ONLY' services/api/openapi.json services/api/src apps/capture-pwa/src
rg -q 'DISABLED_UNAPPROVED_POLICY' services/api/openapi.json services/api/src
rg -q 'LEDGER_COMMITTED_PROJECTION_PENDING' services/api/src database/migrations/20260817000000000_create-synthetic-scan-sync-tables.js
rg -q 'pg_advisory_xact_lock' services/api/src/database.ts
rg -q 'FOR UPDATE SKIP LOCKED' services/api/src/database.ts
rg -q 'SYNTHETIC_CAPTURE_V1' services/api/src apps/capture-pwa/src
rg -q 'SYNTHETIC_WEB_ACCESS_V1' services/api/openapi.json services/api/src database/migrations/20260820000000000_create-synthetic-web-access-tables.js
rg -q 'HttpOnly; SameSite=Strict' services/api/src/app.ts
rg -q 'password_verifier' services/api/src/database-session.ts
rg -q '/api/v1/dashboard' services/api/openapi.json services/api/src/app.ts
rg -q '/api/v1/inventory' services/api/openapi.json services/api/src/app.ts
rg -Fq 'listInventoryUnits(principal.institutionId)' services/api/src/app.ts
rg -q '/api/v1/alerts' services/api/openapi.json services/api/src/app.ts
rg -q '/api/v1/transfers' services/api/openapi.json services/api/src/app.ts
rg -Fq '/api/v1/transfers/{transferId}' services/api/openapi.json
rg -Fq 'TransferRequestCreate' services/api/openapi.json
rg -Fq '/api/v1/transfers/{transferId}/approval' services/api/openapi.json
rg -Fq 'TransferApprovalRequest' services/api/openapi.json
rg -Fq 'submitAsync("ApproveTransfer"' services/api/src/fabric.ts
rg -Fq "'TRANSFER_APPROVED'" services/api/src/database-application-write.ts
rg -Fq "inventory_status='RESERVED'" services/api/src/database-application-write.ts
rg -Fq '/api/v1/transfers/{transferId}/rejection' services/api/openapi.json
rg -Fq 'TransferRejectionRequest' services/api/openapi.json
rg -Fq 'principal.roleId !== "ROLE-02"' services/api/src/app.ts
rg -Fq 'submitAsync("RejectTransfer"' services/api/src/fabric.ts
rg -Fq "'TRANSFER_REJECTED'" services/api/src/database-application-write.ts
rg -Fq '/api/v1/transfers/{transferId}/cancellation' services/api/openapi.json
rg -Fq 'TransferCancellationRequest' services/api/openapi.json
rg -Fq 'submitAsync("CancelTransfer"' services/api/src/fabric.ts
rg -Fq "'TRANSFER_CANCELLED'" services/api/src/database-application-write.ts
rg -Fq "inventory_status='AVAILABLE'" services/api/src/database-application-write.ts
rg -Fq 'principal.roleId !== "ROLE-03"' services/api/src/app.ts
rg -Fq 'evaluateTransaction("ReadTransfer"' services/api/src/fabric.ts
rg -Fq 'submitAsync("SubmitTransferRequest"' services/api/src/fabric.ts
rg -Fq "'TRANSFER_REQUESTED'" services/api/src/database-application-write.ts
rg -Fq './network/generated:/workspace/network/generated:ro' compose.yaml
rg -Fq 'findTransfer(request.params.transferId' services/api/src/app.ts
rg -Fq 'AND destination_institution_id=$2' services/api/src/database-application-read.ts
rg -q 'DISABLED_UNAPPROVED_POLICY' services/api/src/algorithm-explanation.ts
rg -Fq 'listTransfers(principal.institutionId,"DESTINATION")' services/api/src/app.ts
rg -Fq '/api/v1/alerts/{alertId}/acknowledgements' services/api/openapi.json
rg -q 'pg_advisory_xact_lock' services/api/src/database-application-write.ts
rg -Fq "institution_id=\$2 AND status='OPEN' FOR UPDATE" services/api/src/database-application-write.ts
rg -q 'ALERT_IDEMPOTENCY_CONFLICT' services/api/src/database-application-write.ts
rg -q "'ALERT_ACKNOWLEDGED'" services/api/src/database-application-write.ts
rg -Fq '/api/v1/consortium' services/api/openapi.json services/api/src/app.ts
rg -Fq '/api/v1/audit' services/api/openapi.json services/api/src/app.ts
rg -Fq '/api/v1/reports/inventory.csv' services/api/openapi.json services/api/src/app.ts
rg -Fq 'WHERE e.institution_id=$1' services/api/src/database-application-read.ts
rg -q 'not an official regulatory filing' services/api/src/app.ts

if rg -n 'request\.log\..*(body|headers)|console\.log\(|logger: true' services/api/src; then
  echo "API source may log a request payload, header, or unsafe console output" >&2
  exit 1
fi
if rg -n 'submitAsync|submitTransaction' services/api/src/app.ts services/api/src/server.ts; then
  echo "HTTP intake must not directly submit to Fabric" >&2
  exit 1
fi

echo "Sprint 4 capture and Sprint 5 web-access API boundaries passed"
