#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=network/scripts/lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

require_local_ca_configuration
for service in ca-mediatrix ca-orderer; do
  container_id="$("${compose[@]}" ps --quiet "${service}")"
  if [[ -z "${container_id}" ]]; then
    echo "CA service is not running: ${service}" >&2
    exit 1
  fi
  for _ in {1..30}; do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "${container_id}")"
    [[ "${status}" == healthy ]] && break
    sleep 1
  done
  if [[ "${status}" != healthy ]]; then
    echo "CA service did not become healthy: ${service}" >&2
    exit 1
  fi
done
echo "Both Fabric CA services are healthy"

