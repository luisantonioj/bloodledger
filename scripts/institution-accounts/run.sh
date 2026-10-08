#!/usr/bin/env bash
set -euo pipefail
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "$repository_root"
container="${BLOODLEDGER_DEV_POSTGRES_CONTAINER:-bloodledger-postgres-1}"
[[ "$(docker inspect "$container" --format '{{index .Config.Labels "com.docker.compose.project"}}')" == bloodledger ]] || { echo ACCOUNT_PROJECT_TARGET_REQUIRED >&2; exit 2; }
volume="$(docker inspect "$container" --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}')"
[[ "$volume" == bloodledger* ]] || { echo ACCOUNT_RETAINED_VOLUME_REQUIRED >&2; exit 2; }
created="$(docker volume inspect "$volume" --format '{{.CreatedAt}}')"
workers="$(docker ps --filter label=com.docker.compose.project=bloodledger --filter label=com.docker.compose.service=sync-worker --format '{{.Names}}')"
[[ -z "$workers" ]] || { echo ACCOUNT_QUIESCE_GENERAL_WORKER_REQUIRED >&2; exit 2; }
docker run --rm -v "$repository_root:/workspace" -w /workspace node:24.17.0 sh -ec 'npm run build --workspace @bloodledger/api && npm run build --workspace @bloodledger/inventory-contract' >/dev/null
docker run --rm --user "$(id -u):$(id -g)" --network bloodledger_default --env-file "${BLOODLEDGER_DEV_ENV_FILE:-.env}" -v "$repository_root:$repository_root" -w "$repository_root" \
  -e "BLOODLEDGER_REPOSITORY_ROOT=$repository_root" -e DEVELOPMENT_PG_HOST=postgres -e DEVELOPMENT_PG_PORT=5432 \
  -e "DEVELOPMENT_TARGET_VOLUME=$volume" -e "DEVELOPMENT_TARGET_VOLUME_CREATED=$created" -e FABRIC_PEER_ENDPOINT=peer0-mediatrix:7051 \
  node:24.17.0 node scripts/institution-accounts/cli.mjs "$@"
