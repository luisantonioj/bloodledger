#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=network/scripts/lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

require_local_ca_configuration
peer_org="${generated_root}/organizations/peerOrganizations/mediatrix.bloodledger.local"
orderer_org="${generated_root}/organizations/ordererOrganizations/orderer.bloodledger.local"

required=(
  "${peer_org}/msp/config.yaml"
  "${peer_org}/users/Admin@mediatrix.bloodledger.local/msp/signcerts/cert.pem"
  "${peer_org}/users/ApiGateway@mediatrix.bloodledger.local/msp/signcerts/cert.pem"
  "${peer_org}/peers/peer0.mediatrix.bloodledger.local/msp/signcerts/cert.pem"
  "${peer_org}/peers/peer0.mediatrix.bloodledger.local/tls/server.crt"
  "${peer_org}/peers/peer0.mediatrix.bloodledger.local/tls/server.key"
  "${orderer_org}/msp/config.yaml"
  "${orderer_org}/users/Admin@orderer.bloodledger.local/msp/signcerts/cert.pem"
  "${orderer_org}/orderers/orderer0.orderer.bloodledger.local/msp/signcerts/cert.pem"
  "${orderer_org}/orderers/orderer0.orderer.bloodledger.local/tls/server.crt"
  "${orderer_org}/orderers/orderer0.orderer.bloodledger.local/tls/server.key"
  "${generated_root}/secrets/identity-secrets.env"
)
for path in "${required[@]}"; do
  [[ -f "${path}" ]] || { echo "Missing generated identity path: ${path#"${repository_root}/"}" >&2; exit 1; }
done

for config in "${peer_org}/msp/config.yaml" "${orderer_org}/msp/config.yaml"; do
  grep -q '^  Enable: true$' "${config}"
  for role in Client Peer Admin Orderer; do grep -q "^  ${role}OUIdentifier:$" "${config}"; done
done

if find "${generated_root}" \( -type d -perm /007 -o -type f -perm /077 \) -print -quit | grep -q .; then
  echo "Generated identity material has group/other permissions" >&2
  exit 1
fi
if git -C "${repository_root}" ls-files --error-unmatch network/generated >/dev/null 2>&1 || \
   ! git -C "${repository_root}" check-ignore --quiet --no-index network/generated/example; then
  echo "Generated Fabric identity boundary is not safely excluded from Git" >&2
  exit 1
fi

"${repository_root}/network/scripts/wait-for-cas.sh" >/dev/null
for service in ca-mediatrix ca-orderer; do
  ca_exec "${service}" fabric-ca-client version | sed -n '1p'
done

ca_exec ca-mediatrix sh -ceu '
  export FABRIC_CA_CLIENT_HOME=/work/fabric-ca/clients/mediatrix-registrar
  for expected in "mediatrix-admin admin" "peer0 peer" "api-gateway client"; do
    set -- $expected
    output="$(fabric-ca-client identity list --id "$1" --caname ca.mediatrix.bloodledger.local --tls.certfiles /work/fabric-ca/mediatrix/tls-cert.pem 2>&1)"
    printf "%s" "$output" | grep -Eiq "(name|id):[[:space:]]*$1.*type:[[:space:]]*$2|name:[[:space:]]*$1|type:[[:space:]]*$2"
    if printf "%s" "$output" | grep -q "hf.Registrar.Roles"; then exit 1; fi
  done
'
ca_exec ca-orderer sh -ceu '
  export FABRIC_CA_CLIENT_HOME=/work/fabric-ca/clients/orderer-registrar
  for expected in "orderer-admin admin" "orderer0 orderer"; do
    set -- $expected
    output="$(fabric-ca-client identity list --id "$1" --caname ca.orderer.bloodledger.local --tls.certfiles /work/fabric-ca/orderer/tls-cert.pem 2>&1)"
    printf "%s" "$output" | grep -Eiq "(name|id):[[:space:]]*$1.*type:[[:space:]]*$2|name:[[:space:]]*$1|type:[[:space:]]*$2"
    if printf "%s" "$output" | grep -q "hf.Registrar.Roles"; then exit 1; fi
  done
'

api_cert="${peer_org}/users/ApiGateway@mediatrix.bloodledger.local/msp/signcerts/cert.pem"
if openssl x509 -in "${api_cert}" -noout -text | grep -q 'hf\.Registrar\|api-gateway'; then
  echo "api-gateway certificate contains an unapproved registrar or application attribute" >&2
  exit 1
fi
for certificate in \
  "${peer_org}/users/Admin@mediatrix.bloodledger.local/msp/signcerts/cert.pem" \
  "${peer_org}/users/ApiGateway@mediatrix.bloodledger.local/msp/signcerts/cert.pem" \
  "${peer_org}/peers/peer0.mediatrix.bloodledger.local/msp/signcerts/cert.pem" \
  "${orderer_org}/users/Admin@orderer.bloodledger.local/msp/signcerts/cert.pem" \
  "${orderer_org}/orderers/orderer0.orderer.bloodledger.local/msp/signcerts/cert.pem"; do
  openssl x509 -in "${certificate}" -noout -subject -issuer
done
echo "Fabric CA identity validation passed"

