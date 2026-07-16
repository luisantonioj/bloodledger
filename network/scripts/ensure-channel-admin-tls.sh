#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=network/scripts/lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

completion_marker="${generated_root}/.identity-bootstrap-complete"
secrets_file="${generated_root}/secrets/identity-secrets.env"
[[ -f "${completion_marker}" && -f "${secrets_file}" ]] || {
  echo "Complete S1-06 identity material is required before channel administration" >&2
  exit 1
}

mediatrix_user="${generated_root}/organizations/peerOrganizations/mediatrix.bloodledger.local/users/Admin@mediatrix.bloodledger.local"
orderer_user="${generated_root}/organizations/ordererOrganizations/orderer.bloodledger.local/users/Admin@orderer.bloodledger.local"
if [[ -f "${mediatrix_user}/tls/client.crt" && -f "${mediatrix_user}/tls/client.key" && \
      -f "${orderer_user}/tls/client.crt" && -f "${orderer_user}/tls/client.key" ]]; then
  echo "Channel administrator TLS material already exists; no changes made"
  exit 0
fi
export POSTGRES_ADMIN_PASSWORD="${POSTGRES_ADMIN_PASSWORD:-unused-by-channel-admin-enrollment}"
export POSTGRES_MIGRATOR_PASSWORD="${POSTGRES_MIGRATOR_PASSWORD:-unused-by-channel-admin-enrollment}"
export POSTGRES_APP_PASSWORD="${POSTGRES_APP_PASSWORD:-unused-by-channel-admin-enrollment}"
for path in "${mediatrix_user}/tls-enrollment" "${mediatrix_user}/tls" \
  "${orderer_user}/tls-enrollment" "${orderer_user}/tls"; do
  [[ ! -e "${path}" ]] || {
    echo "Partial channel administrator TLS state found at ${path#"${repository_root}/"}; no files were overwritten" >&2
    exit 1
  }
done

for service in ca-mediatrix ca-orderer; do
  container_id="$("${compose[@]}" ps --quiet "${service}")"
  [[ -n "${container_id}" && "$(docker inspect --format '{{.State.Health.Status}}' "${container_id}")" == healthy ]] || {
    echo "Required CA service is not healthy: ${service}" >&2
    exit 1
  }
done
peer_org="/work/organizations/peerOrganizations/mediatrix.bloodledger.local"
orderer_org="/work/organizations/ordererOrganizations/orderer.bloodledger.local"
ca_exec ca-mediatrix sh -ceu "
  . /work/secrets/identity-secrets.env
  fabric-ca-client enroll --url \"https://mediatrix-admin:\${MEDIATRIX_ADMIN_SECRET}@ca-mediatrix:7054\" --caname ca.mediatrix.bloodledger.local --enrollment.profile tls --mspdir '${peer_org}/users/Admin@mediatrix.bloodledger.local/tls-enrollment' --tls.certfiles /work/fabric-ca/mediatrix/tls-cert.pem >/dev/null
"
ca_exec ca-orderer sh -ceu "
  . /work/secrets/identity-secrets.env
  fabric-ca-client enroll --url \"https://orderer-admin:\${ORDERER_ADMIN_SECRET}@ca-orderer:7054\" --caname ca.orderer.bloodledger.local --enrollment.profile tls --mspdir '${orderer_org}/users/Admin@orderer.bloodledger.local/tls-enrollment' --tls.certfiles /work/fabric-ca/orderer/tls-cert.pem >/dev/null
"
ca_exec ca-mediatrix chown -R "$(id -u):$(id -g)" /work/organizations
"${repository_root}/network/scripts/assemble-msps.sh"
echo "Generated approved channel administrator TLS material below network/generated"
