#!/usr/bin/env bash
set -euo pipefail
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "${repository_root}"
# shellcheck source=network/scripts/health-contract-lib.sh
source network/scripts/health-contract-lib.sh

probe_id="${1:-}"
[[ "${probe_id}" =~ ^[A-Za-z0-9._-]{1,64}$ ]] || {
  echo "Provide one approved synthetic probe ID for the read-only health query" >&2
  exit 1
}

assert_health_prerequisites readonly
committed="$(health_tools_run peer lifecycle chaincode querycommitted \
  --channelID "${channel_name}" --name "${health_chaincode_name}" --output json)"
jq -e --arg version "${health_version}" --argjson sequence "${health_sequence}" \
  --arg policy "${health_validation_parameter}" \
  '.version == $version and .sequence == $sequence and
   .endorsement_plugin == "escc" and .validation_plugin == "vscc" and
   .validation_parameter == $policy and .approvals.MediatrixMSP == true and
   (.collections == {})' \
  <<<"${committed}" >/dev/null || {
    echo "Committed health contract definition conflicts with the approved version, sequence, or policy" >&2
    exit 1
  }

set +e
result="$(health_tools_run peer chaincode query --channelID "${channel_name}" \
  --name "${health_chaincode_name}" --ctor "{\"Args\":[\"ReadProbe\",\"${probe_id}\"]}" 2>&1)"
query_code=$?
set -e
if ((query_code != 0)); then
  if grep -Fq HEALTH_PROBE_NOT_FOUND <<<"${result}"; then
    echo "Approved health probe is absent" >&2
    exit 3
  fi
  echo "ReadProbe query failed without exposing Fabric connection details" >&2
  exit 1
fi
[[ "${result}" == "{\"probeId\":\"${probe_id}\",\"status\":\"OK\"}" ]] || {
  echo "ReadProbe returned an unexpected result" >&2
  exit 1
}
echo "Committed health contract definition and read-only probe query passed"
