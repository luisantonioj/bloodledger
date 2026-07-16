#!/usr/bin/env bash
set -euo pipefail
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "${repository_root}"
# shellcheck source=network/scripts/lib.sh
source network/scripts/lib.sh

require_local_ca_configuration

postgres_before="$("${compose[@]}" ps --quiet postgres)"
postgres_volume_before="$(docker volume ls --quiet --filter name='^bloodledger_postgres-data$')"
marker_before="$(stat -c '%Y:%s' network/generated/.identity-bootstrap-complete)"
ca_mediatrix_original="$("${compose[@]}" ps --quiet ca-mediatrix)"
ca_orderer_original="$("${compose[@]}" ps --quiet ca-orderer)"

"${compose[@]}" up --detach --wait ca-mediatrix ca-orderer peer0-mediatrix orderer0
[[ -z "${ca_mediatrix_original}" || "$("${compose[@]}" ps --quiet ca-mediatrix)" == "${ca_mediatrix_original}" ]]
[[ -z "${ca_orderer_original}" || "$("${compose[@]}" ps --quiet ca-orderer)" == "${ca_orderer_original}" ]]
"${repository_root}/network/scripts/validate-nodes.sh"

ca_mediatrix_before="$("${compose[@]}" ps --quiet ca-mediatrix)"
ca_orderer_before="$("${compose[@]}" ps --quiet ca-orderer)"
[[ "$("${compose[@]}" ps --quiet peer0-mediatrix | wc -l)" -eq 1 ]]
[[ "$("${compose[@]}" ps --quiet orderer0 | wc -l)" -eq 1 ]]

"${compose[@]}" restart peer0-mediatrix orderer0 >/dev/null
for service in peer0-mediatrix orderer0; do
  for _ in $(seq 1 40); do
    id="$("${compose[@]}" ps --quiet "${service}")"
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "${id}")"
    [[ "${status}" == healthy ]] && break
    sleep 1
  done
  [[ "${status}" == healthy ]] || { echo "${service} did not return to healthy after restart" >&2; exit 1; }
done
"${repository_root}/network/scripts/validate-nodes.sh"

[[ "$("${compose[@]}" ps --quiet ca-mediatrix)" == "${ca_mediatrix_before}" ]]
[[ "$("${compose[@]}" ps --quiet ca-orderer)" == "${ca_orderer_before}" ]]
[[ "$(stat -c '%Y:%s' network/generated/.identity-bootstrap-complete)" == "${marker_before}" ]]
[[ "$("${compose[@]}" ps --quiet postgres)" == "${postgres_before}" ]]
[[ "$(docker volume ls --quiet --filter name='^bloodledger_postgres-data$')" == "${postgres_volume_before}" ]]

echo "Fabric node startup, health, and non-destructive restart validation passed"
