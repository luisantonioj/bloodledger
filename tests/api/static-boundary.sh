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

if rg -n 'request\.log\..*(body|headers)|console\.log\(|logger: true' services/api/src; then
  echo "API source may log a request payload, header, or unsafe console output" >&2
  exit 1
fi
if rg -n 'submitAsync|submitTransaction' services/api/src/app.ts services/api/src/server.ts; then
  echo "HTTP intake must not directly submit to Fabric" >&2
  exit 1
fi

echo "Sprint 4 API and privacy boundary checks passed"
