#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=network/scripts/channel-lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/channel-lib.sh"

prepare_channel_query_context
for path in \
  "${generated_root}${peer_admin#/generated}/msp" \
  "${generated_root}${orderer_admin#/generated}/tls"; do
  [[ -d "${path}" ]] || { echo "Missing approved channel administrator material: ${path#"${repository_root}/"}" >&2; exit 1; }
done
orderer_has_channel || { echo "orderer0 does not participate in ${channel_name}" >&2; exit 1; }
peer_has_channel || { echo "peer0-mediatrix is not joined to ${channel_name}" >&2; exit 1; }

orderer_info="$(osnadmin list --channelID "${channel_name}")"
grep -Eq '"name"[[:space:]]*:[[:space:]]*"bloodledger-dev"' <<<"${orderer_info}"
grep -Eq '"status"[[:space:]]*:[[:space:]]*"active"' <<<"${orderer_info}"
peer_info="$(tools_run peer channel getinfo -c "${channel_name}" 2>&1)"
grep -Fq "Blockchain info: {\"height\":" <<<"${peer_info}"
grep -Fq '"currentBlockHash":"' <<<"${peer_info}"
peer_height="$(sed -n 's/.*Blockchain info: {"height":\([0-9][0-9]*\),.*/\1/p' <<<"${peer_info}")"
[[ -n "${peer_height}" && "${peer_height}" -ge 1 ]]

echo "Orderer participation: channel=${channel_name}; status=active"
echo "Peer channel membership: ${channel_name}"
printf 'Peer channel information: channel=%s; height=%s; currentBlockHash=<redacted-present>\n' "${channel_name}" "${peer_height}"
