#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=network/scripts/lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

require_local_ca_configuration

peer_node="${generated_root}/organizations/peerOrganizations/mediatrix.bloodledger.local/peers/peer0.mediatrix.bloodledger.local"
orderer_node="${generated_root}/organizations/ordererOrganizations/orderer.bloodledger.local/orderers/orderer0.orderer.bloodledger.local"
for path in "${peer_node}/msp" "${peer_node}/tls" "${orderer_node}/msp" "${orderer_node}/tls"; do
  [[ -d "${path}" ]] || {
    echo "Missing approved node identity path: ${path#"${repository_root}/"}" >&2
    exit 1
  }
done

"${compose[@]}" config --quiet
"${repository_root}/network/scripts/wait-for-cas.sh" >/dev/null

container_id() {
  local service="$1" id
  id="$("${compose[@]}" ps --quiet "${service}")"
  [[ -n "${id}" ]] || { echo "Node service is not running: ${service}" >&2; exit 1; }
  printf '%s' "${id}"
}

assert_healthy() {
  local service="$1" id status
  id="$(container_id "${service}")"
  status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "${id}")"
  [[ "${status}" == healthy ]] || {
    echo "Node health check failed: ${service} is ${status}" >&2
    "${compose[@]}" ps "${service}" >&2
    exit 1
  }
}

operations_get() {
  local service="$1" port="$2" resource="$3"
  "${compose[@]}" exec --no-TTY "${service}" bash -ec '
    exec 3<>"/dev/tcp/127.0.0.1/$1"
    printf "GET %s HTTP/1.0\r\nHost: localhost\r\nConnection: close\r\n\r\n" "$2" >&3
    response="$(cat <&3)"
    printf "%s\n" "$response" | grep -q "^HTTP/1.[01] 200"
    printf "%s\n" "$response" | sed "1,/^\r\{0,1\}$/d"
  ' -- "${port}" "${resource}"
}

assert_healthy peer0-mediatrix
assert_healthy orderer0

for service in peer0-mediatrix orderer0; do
  id="$(container_id "${service}")"
  while IFS= read -r volume_name; do
    [[ -z "${volume_name}" ]] && continue
    [[ "${volume_name}" == bloodledger_* ]] || {
      echo "Anonymous or non-project node volume detected for ${service}" >&2
      exit 1
    }
  done < <(docker inspect --format '{{range .Mounts}}{{if eq .Type "volume"}}{{.Name}}{{println}}{{end}}{{end}}' "${id}")
done

peer_health="$(operations_get peer0-mediatrix 9443 /healthz)"
orderer_health="$(operations_get orderer0 8443 /healthz)"
grep -q '"status":"OK"' <<<"${peer_health}"
grep -q '"status":"OK"' <<<"${orderer_health}"

peer_version="$(operations_get peer0-mediatrix 9443 /version)"
orderer_version="$(operations_get orderer0 8443 /version)"
grep -q '2.5.16' <<<"${peer_version}"
grep -q '2.5.16' <<<"${orderer_version}"

peer_values="$("${compose[@]}" exec --no-TTY peer0-mediatrix sh -ceu '
  printf "%s\n" "$CORE_PEER_ID" "$CORE_PEER_LOCALMSPID" "$CORE_LEDGER_STATE_STATEDATABASE" "$CORE_PEER_TLS_ENABLED" "$CORE_OPERATIONS_LISTENADDRESS"
')"
grep -qx 'peer0.mediatrix.bloodledger.local' <<<"${peer_values}"
grep -qx 'MediatrixMSP' <<<"${peer_values}"
grep -qx 'goleveldb' <<<"${peer_values}"
grep -qx 'true' <<<"${peer_values}"
grep -qx '0.0.0.0:9443' <<<"${peer_values}"

orderer_values="$("${compose[@]}" exec --no-TTY orderer0 sh -ceu '
  printf "%s\n" "$HOSTNAME" "$ORDERER_GENERAL_LOCALMSPID" "$ORDERER_GENERAL_BOOTSTRAPMETHOD" "$ORDERER_CHANNELPARTICIPATION_ENABLED" "$ORDERER_GENERAL_TLS_ENABLED" "$ORDERER_OPERATIONS_LISTENADDRESS"
')"
grep -qx 'orderer0.orderer.bloodledger.local' <<<"${orderer_values}"
grep -qx 'OrdererMSP' <<<"${orderer_values}"
grep -qx 'none' <<<"${orderer_values}"
grep -qx 'true' <<<"${orderer_values}"
grep -qx '0.0.0.0:8443' <<<"${orderer_values}"

[[ "$("${compose[@]}" port peer0-mediatrix 7051)" == 127.0.0.1:7051 ]]
[[ "$("${compose[@]}" port orderer0 7050)" == 127.0.0.1:7050 ]]
for target in 'peer0-mediatrix 7052' 'peer0-mediatrix 9443' 'orderer0 8443' 'orderer0 9443'; do
  read -r service port <<<"${target}"
  [[ -z "$("${compose[@]}" port "${service}" "${port}" 2>/dev/null)" ]]
done

printf 'peer0-mediatrix image: %s\n' "$(docker inspect --format '{{.Config.Image}}' "$(container_id peer0-mediatrix)")"
printf 'orderer0 image: %s\n' "$(docker inspect --format '{{.Config.Image}}' "$(container_id orderer0)")"
printf 'peer0-mediatrix /healthz: OK; /version: 2.5.16\n'
printf 'orderer0 /healthz: OK; /version: 2.5.16\n'
echo "Fabric peer/orderer node validation passed"
