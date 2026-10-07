#!/usr/bin/env bash
# Start only this integration's disposable API/web containers against RETAINED stores.
# Do not stop another API automatically, or start a general queue worker.
set -euo pipefail
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "$repository_root"
[[ "${1:-}" == --apply && "$#" -eq 1 ]] || { echo 'Usage: start-local.sh --apply (requires ports 3000 and 5174 free)' >&2; exit 2; }
environment="${BLOODLEDGER_DEV_ENV_FILE:-build/development-local/runtime.env}"
[[ -f "$environment" ]] || { echo PRIVATE_RUNTIME_ENV_REQUIRED >&2; exit 2; }
for container in bloodledger-persistent-api bloodledger-persistent-web; do
  if docker inspect "$container" >/dev/null 2>&1; then echo 'LOCAL_CONTAINER_ALREADY_EXISTS: use docker start or restart for retained setup' >&2; exit 2; fi
done
docker run --rm -v "$repository_root:/workspace" -w /workspace node:24.17.0 npm run build --workspace @bloodledger/api >/dev/null
docker run -d --name bloodledger-persistent-api --network bloodledger_default \
  -p 127.0.0.1:3000:3000 -p 127.0.0.1:5174:5174 --env-file "$environment" \
  -v "$repository_root:/workspace" -w /workspace node:24.17.0 node services/api/build/src/server.js >/dev/null
docker run -d --name bloodledger-persistent-web --network container:bloodledger-persistent-api \
  -v "$repository_root:/workspace" -w /workspace node:24.17.0 \
  npm run dev --workspace @bloodledger/web -- --host 0.0.0.0 >/dev/null
printf 'Editable UI: http://127.0.0.1:5174 ; API: http://127.0.0.1:3000\n'
