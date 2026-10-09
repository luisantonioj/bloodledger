#!/usr/bin/env bash
set -euo pipefail
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "${repository_root}"
container="bloodledger-historical-test-$$"
trap 'docker rm -f "${container}" >/dev/null 2>&1 || true' EXIT
# Ephemeral test data, no published ports and no connection to the application network.
docker run -d --name "${container}" --network none --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=historical_test postgres:17.10 >/dev/null
for ((i=0;i<30;i++)); do
  if docker exec "${container}" pg_isready -U postgres -d historical_test >/dev/null 2>&1; then break; fi
  sleep 1
done
docker run --rm --network "container:${container}" -v "${repository_root}:/workspace:ro" -w /workspace \
  node:24.17.0 node tests/historical-inventory/database.mjs
