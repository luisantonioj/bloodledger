#!/usr/bin/env bash
set -euo pipefail
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "$repository_root"
entrypoint=scripts/development-data/cli.mjs
if [[ "${1:-}" == stock ]]; then entrypoint=scripts/development-data/stock-cli.mjs; shift; fi
private_mount=()
if [[ -n "${BLOODLEDGER_DEV_PRIVATE_DIR:-}" ]]; then
  private_dir="$(realpath "$BLOODLEDGER_DEV_PRIVATE_DIR")"
  [[ -d "$private_dir" && "$(stat -c %a "$private_dir")" == 700 ]] || { echo STOCK_PRIVATE_DIRECTORY_REQUIRED >&2; exit 2; }
  private_mount=(-v "$private_dir:$private_dir")
fi
# Private artifacts must be inside ignored build/ or explicitly mounted by the caller.
# Read-only Docker inspection binds the manifest to this retained PostgreSQL volume.
container="${BLOODLEDGER_DEV_POSTGRES_CONTAINER:-bloodledger-postgres-1}"
volume="$(docker inspect "$container" --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}')"
[[ -n "$volume" && "$volume" == bloodledger* ]] || { echo 'SEED_PROJECT_RETAINED_VOLUME_REQUIRED' >&2; exit 2; }
running_workers="$(docker ps --filter label=com.docker.compose.project=bloodledger --filter label=com.docker.compose.service=sync-worker --format '{{.Names}}')"
[[ -z "$running_workers" ]] || { echo 'SEED_STOP_GENERAL_SYNC_WORKER_BEFORE_SCOPED_IMPORT' >&2; exit 2; }
created="$(docker volume inspect "$volume" --format '{{.CreatedAt}}')"
backup_sha=""
backup_instance=""
if [[ "$entrypoint" == scripts/development-data/stock-cli.mjs && ( "${1:-}" == confirm || "${1:-}" == apply || "${1:-}" == resume ) ]]; then
  arguments=("$@")
  backup=""
  for ((i=1;i<${#arguments[@]};i+=2)); do
    if [[ "${arguments[i]}" == --backup ]]; then backup="${arguments[i+1]:-}"; fi
  done
  [[ -f "$backup" && "$(stat -c %a "$backup")" == 600 ]] || { echo STOCK_PRIVATE_BACKUP_REQUIRED >&2; exit 2; }
  backup_result="$(bash scripts/development-data/validate-stock-backup.sh "$backup")"
  mapfile -t backup_evidence <<< "$backup_result"
  backup_sha="${backup_evidence[0]}"; backup_instance="${backup_evidence[1]:-}"
fi
docker run --rm -v "$repository_root:/workspace" -w /workspace node:24.17.0 npm run build --workspace @bloodledger/api >/dev/null
docker run --rm -v "$repository_root:/workspace" -w /workspace node:24.17.0 npm run build --workspace @bloodledger/inventory-contract >/dev/null
docker run --rm -v "$repository_root:/workspace" -w /workspace node:24.17.0 npm run prepare:ocr --workspace @bloodledger/capture-pwa >/dev/null
docker build -q -t bloodledger-development-tools:local -f scripts/development-data/Dockerfile scripts/development-data >/dev/null
# The private configuration contains existing synthetic account credentials.
# No accounts, schema, services or volumes are reset/created by this command.
docker run --rm --init --user "$(id -u):$(id -g)" --network bloodledger_default --env-file "${BLOODLEDGER_DEV_ENV_FILE:-.env}" -v "$repository_root:$repository_root" "${private_mount[@]}" -w "$repository_root" \
  -e "BLOODLEDGER_REPOSITORY_ROOT=$repository_root" \
  -e DEVELOPMENT_PG_HOST=postgres -e DEVELOPMENT_PG_PORT=5432 \
  -e "DEVELOPMENT_TARGET_VOLUME=$volume" -e "DEVELOPMENT_TARGET_VOLUME_CREATED=$created" \
  -e "DEVELOPMENT_VALIDATED_BACKUP_SHA256=$backup_sha" \
  -e "DEVELOPMENT_VALIDATED_BACKUP_INSTANCE_ID=$backup_instance" \
  -e "DEVELOPMENT_API_URL=${BLOODLEDGER_DEV_API_URL:-http://host.docker.internal:3000}" \
  -e FABRIC_PEER_ENDPOINT=peer0-mediatrix:7051 \
  bloodledger-development-tools:local node "$entrypoint" "$@"
