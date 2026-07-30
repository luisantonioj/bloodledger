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
  "${peer_org}/users/Admin@mediatrix.bloodledger.local/tls/client.crt"
  "${peer_org}/users/Admin@mediatrix.bloodledger.local/tls/client.key"
  "${peer_org}/users/ApiGateway@mediatrix.bloodledger.local/msp/signcerts/cert.pem"
  "${peer_org}/peers/peer0.mediatrix.bloodledger.local/msp/signcerts/cert.pem"
  "${peer_org}/peers/peer0.mediatrix.bloodledger.local/tls/server.crt"
  "${peer_org}/peers/peer0.mediatrix.bloodledger.local/tls/server.key"
  "${orderer_org}/msp/config.yaml"
  "${orderer_org}/users/Admin@orderer.bloodledger.local/msp/signcerts/cert.pem"
  "${orderer_org}/users/Admin@orderer.bloodledger.local/tls/client.crt"
  "${orderer_org}/users/Admin@orderer.bloodledger.local/tls/client.key"
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

if find "${generated_root}" -type d -perm /007 -print -quit | grep -q .; then
  echo "Generated identity directories have group/other permissions" >&2
  exit 1
fi
if find "${generated_root}" -type f \
  \( -name '*_sk' -o -name '*.key' -o -name '*-key.pem' \
     -o -name 'fabric-ca-server.db*' -o -name 'fabric-ca-server-config.yaml' \
     -o -name 'identity-secrets.env' -o -name 'IssuerSecretKey' \
     -o -name 'IssuerRevocationPrivateKey' \) \
  -perm /077 -print -quit | grep -q .; then
  echo "Generated identity secrets or private material have group/other permissions" >&2
  exit 1
fi
if git -C "${repository_root}" ls-files --error-unmatch network/generated >/dev/null 2>&1 || \
   ! git -C "${repository_root}" check-ignore --quiet --no-index network/generated/example; then
  echo "Generated Fabric identity boundary is not safely excluded from Git" >&2
  exit 1
fi

"${repository_root}/network/scripts/wait-for-cas.sh" >/dev/null
for service in ca-mediatrix ca-orderer; do
  ca_exec "${service}" fabric-ca-server version | sed -n '1,2p'
  ca_exec "${service}" fabric-ca-client version | sed -n '1,2p'
done

ca_exec ca-mediatrix sh -ceu '
  export FABRIC_CA_CLIENT_HOME=/work/fabric-ca/clients/mediatrix-registrar
  all="$(fabric-ca-client identity list --caname ca.mediatrix.bloodledger.local --tls.certfiles /work/fabric-ca/mediatrix/tls-cert.pem 2>&1)"
  [ "$(printf "%s\n" "$all" | grep -c "^Name:")" -eq 4 ]
  for expected in "mediatrix-ca-admin client" "mediatrix-admin admin" "peer0 peer" "api-gateway client"; do
    set -- $expected
    output="$(fabric-ca-client identity list --id "$1" --caname ca.mediatrix.bloodledger.local --tls.certfiles /work/fabric-ca/mediatrix/tls-cert.pem 2>&1)"
    printf "%s\n" "$output" | grep -Eiq "^Name: $1, Type: $2,"
    if [ "$1" = mediatrix-ca-admin ]; then
      printf "%s" "$output" | grep -q "hf.Registrar.Roles"
    elif printf "%s" "$output" | grep -q "hf.Registrar.Roles"; then
      exit 1
    fi
  done
'
ca_exec ca-orderer sh -ceu '
  export FABRIC_CA_CLIENT_HOME=/work/fabric-ca/clients/orderer-registrar
  all="$(fabric-ca-client identity list --caname ca.orderer.bloodledger.local --tls.certfiles /work/fabric-ca/orderer/tls-cert.pem 2>&1)"
  [ "$(printf "%s\n" "$all" | grep -c "^Name:")" -eq 3 ]
  for expected in "orderer-ca-admin client" "orderer-admin admin" "orderer0 orderer"; do
    set -- $expected
    output="$(fabric-ca-client identity list --id "$1" --caname ca.orderer.bloodledger.local --tls.certfiles /work/fabric-ca/orderer/tls-cert.pem 2>&1)"
    printf "%s\n" "$output" | grep -Eiq "^Name: $1, Type: $2,"
    if [ "$1" != orderer-ca-admin ]; then
      printf "%s\n" "$output" | grep -Eiq "Affiliation: bloodledger(,|$)"
    fi
    if [ "$1" = orderer-ca-admin ]; then
      printf "%s" "$output" | grep -q "hf.Registrar.Roles"
    elif printf "%s" "$output" | grep -q "hf.Registrar.Roles"; then
      exit 1
    fi
  done
'

api_cert="${peer_org}/users/ApiGateway@mediatrix.bloodledger.local/msp/signcerts/cert.pem"
api_attributes="$(openssl x509 -in "${api_cert}" -noout -text | \
  sed -n 's/^[[:space:]]*\({"attrs":.*}\)[[:space:]]*$/\1/p')"
if ! jq -e '
  .attrs["hf.Affiliation"] == "mediatrix" and
  .attrs["hf.EnrollmentID"] == "api-gateway" and
  .attrs["hf.Type"] == "client" and
  .attrs["bloodledger.role"] == "API_GATEWAY" and
  .attrs["bloodledger.institution_id"] == "INST_MEDIATRIX" and
  (.attrs | length) == 5
' <<<"${api_attributes}" >/dev/null; then
  echo "api-gateway certificate has missing or unapproved Fabric attributes" >&2
  exit 1
fi
orderer_admin_subject="$(openssl x509 -in "${orderer_org}/users/Admin@orderer.bloodledger.local/msp/signcerts/cert.pem" -noout -subject -nameopt RFC2253)"
orderer_node_subject="$(openssl x509 -in "${orderer_org}/orderers/orderer0.orderer.bloodledger.local/msp/signcerts/cert.pem" -noout -subject -nameopt RFC2253)"
[[ "$(grep -o 'OU=admin' <<<"${orderer_admin_subject}" | wc -l)" -eq 1 ]]
[[ "$(grep -o 'OU=orderer' <<<"${orderer_node_subject}" | wc -l)" -eq 1 ]]
grep -q 'OU=bloodledger' <<<"${orderer_admin_subject}"
grep -q 'OU=bloodledger' <<<"${orderer_node_subject}"
for certificate in \
  "${peer_org}/users/Admin@mediatrix.bloodledger.local/msp/signcerts/cert.pem" \
  "${peer_org}/users/ApiGateway@mediatrix.bloodledger.local/msp/signcerts/cert.pem" \
  "${peer_org}/peers/peer0.mediatrix.bloodledger.local/msp/signcerts/cert.pem" \
  "${orderer_org}/users/Admin@orderer.bloodledger.local/msp/signcerts/cert.pem" \
  "${orderer_org}/orderers/orderer0.orderer.bloodledger.local/msp/signcerts/cert.pem"; do
  openssl x509 -in "${certificate}" -noout -subject -issuer
done
echo "Fabric CA identity validation passed"
