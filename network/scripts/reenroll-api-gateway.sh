#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=network/scripts/lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

require_local_ca_configuration
if [[ "${BLOODLEDGER_API_GATEWAY_REENROLL:-}" != "REPLACE_API_GATEWAY_ENROLLMENT" ]]; then
  echo "API gateway reenrollment requires BLOODLEDGER_API_GATEWAY_REENROLL=REPLACE_API_GATEWAY_ENROLLMENT" >&2
  exit 1
fi

api_gateway_relative="organizations/peerOrganizations/mediatrix.bloodledger.local/users/ApiGateway@mediatrix.bloodledger.local"
api_gateway_root="${generated_root}/${api_gateway_relative}"
generated_real="$(realpath -m "${generated_root}")"
api_gateway_real="$(realpath -m "${api_gateway_root}")"
case "${api_gateway_real}" in
  "${generated_real}"/organizations/peerOrganizations/mediatrix.bloodledger.local/users/ApiGateway@mediatrix.bloodledger.local) ;;
  *) echo "Refusing API gateway reenrollment outside its generated identity boundary" >&2; exit 1 ;;
esac
[[ -f "${generated_root}/secrets/identity-secrets.env" ]] || {
  echo "Generated API gateway enrollment secret is missing" >&2
  exit 1
}

echo "API gateway reenrollment target: ${api_gateway_real}"
echo "Preserved: CA roots/database, peer/orderer identities, channel, ledgers, and all unrelated resources"

ca_exec ca-mediatrix sh -ceu '
  export FABRIC_CA_CLIENT_HOME=/work/fabric-ca/clients/mediatrix-registrar
  fabric-ca-client identity modify api-gateway --caname ca.mediatrix.bloodledger.local \
    --attrs "bloodledger.role=API_GATEWAY:ecert,bloodledger.institution_id=INST_MEDIATRIX:ecert" \
    --tls.certfiles /work/fabric-ca/mediatrix/tls-cert.pem >/dev/null
'
if [[ -d "${api_gateway_real}" ]]; then
  docker run --rm --user 0 --volume "${generated_real}:/work" \
    hyperledger/fabric-ca:1.5.15 sh -ceu \
    "find '/work/${api_gateway_relative}' -mindepth 1 -delete"
fi
ca_exec ca-mediatrix sh -ceu "
  . /work/secrets/identity-secrets.env
  fabric-ca-client enroll \
    --url \"https://api-gateway:\${API_GATEWAY_SECRET}@ca-mediatrix:7054\" \
    --caname ca.mediatrix.bloodledger.local \
    --mspdir '/work/${api_gateway_relative}/msp' \
    --tls.certfiles /work/fabric-ca/mediatrix/tls-cert.pem >/dev/null
  chown -R '$(id -u):$(id -g)' '/work/${api_gateway_relative}'
  find '/work/${api_gateway_relative}' -type d -exec chmod 700 {} +
  find '/work/${api_gateway_relative}' -type f -exec chmod 600 {} +
"
"${repository_root}/network/scripts/validate-identities.sh"
echo "API gateway reenrolled with the approved Sprint 2 certificate attributes"
