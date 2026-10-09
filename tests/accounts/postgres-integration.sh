#!/usr/bin/env bash
set -euo pipefail
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "$repository_root"
container="bloodledger-accounts-test-$$"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
# Disposable container only; no retained volumes, published ports, or project network.
docker run --rm -v "$repository_root:/workspace" -w /workspace node:24.17.0 sh -ec 'npm run build --workspace @bloodledger/api && npm run build --workspace @bloodledger/inventory-contract'
docker run -d --name "$container" --network none --tmpfs /var/lib/postgresql/data -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=bloodledger_accounts_test postgres:17.10 >/dev/null
for ((i=0;i<30;i++)); do
  if docker exec "$container" pg_isready -U postgres -d bloodledger_accounts_test >/dev/null 2>&1; then break; fi
  sleep 1
done
docker run --rm --network "container:$container" -v "$repository_root:/workspace:ro" -w /workspace -e BLOODLEDGER_ACCOUNTS_BROWSER=1 mcr.microsoft.com/playwright:v1.61.1-noble node services/api/test/institution-accounts-database.mjs
