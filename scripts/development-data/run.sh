#!/usr/bin/env bash
set -euo pipefail
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "$repository_root"
# Private artifacts must be inside ignored build/ or explicitly mounted by the caller.
# Read-only Docker inspection binds the manifest to this retained PostgreSQL volume.
container="${BLOODLEDGER_DEV_POSTGRES_CONTAINER:-bloodledger-postgres-1}"
volume="$(docker inspect "$container" --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}')"
[[ -n "$volume" && "$volume" == bloodledger* ]] || { echo 'SEED_PROJECT_RETAINED_VOLUME_REQUIRED' >&2; exit 2; }
running_workers="$(docker ps --filter label=com.docker.compose.project=bloodledger --filter label=com.docker.compose.service=sync-worker --format '{{.Names}}')"
[[ -z "$running_workers" ]] || { echo 'SEED_STOP_GENERAL_SYNC_WORKER_BEFORE_SCOPED_IMPORT' >&2; exit 2; }
created="$(docker volume inspect "$volume" --format '{{.CreatedAt}}')"
docker run --rm -v "$repository_root:/workspace" -w /workspace node:24.17.0 npm run build --workspace @bloodledger/api >/dev/null
docker run --rm -v "$repository_root:/workspace" -w /workspace node:24.17.0 npm run build --workspace @bloodledger/inventory-contract >/dev/null
docker run --rm -v "$repository_root:/workspace" -w /workspace node:24.17.0 npm run prepare:ocr --workspace @bloodledger/capture-pwa >/dev/null
docker build -q -t bloodledger-development-tools:local -f scripts/development-data/Dockerfile scripts/development-data >/dev/null
# The private configuration contains existing synthetic account credentials.
# No accounts, schema, services or volumes are reset/created by this command.
docker run --rm --init --user "$(id -u):$(id -g)" --network bloodledger_default --env-file "${BLOODLEDGER_DEV_ENV_FILE:-.env}" -v "$repository_root:$repository_root" -w "$repository_root" \
  -e "BLOODLEDGER_REPOSITORY_ROOT=$repository_root" \
  -e DEVELOPMENT_PG_HOST=postgres -e DEVELOPMENT_PG_PORT=5432 \
  -e "DEVELOPMENT_TARGET_VOLUME=$volume" -e "DEVELOPMENT_TARGET_VOLUME_CREATED=$created" \
  -e "DEVELOPMENT_API_URL=${BLOODLEDGER_DEV_API_URL:-http://host.docker.internal:3000}" \
  -e FABRIC_PEER_ENDPOINT=peer0-mediatrix:7051 \
  bloodledger-development-tools:local node scripts/development-data/cli.mjs "$@"
