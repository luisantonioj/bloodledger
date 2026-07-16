#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=network/scripts/lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

peer_org="${generated_root}/organizations/peerOrganizations/mediatrix.bloodledger.local"
orderer_org="${generated_root}/organizations/ordererOrganizations/orderer.bloodledger.local"

write_node_ous() {
  local target="$1" ca_file="$2"
  mkdir -p "${target}"
  cat > "${target}/config.yaml" <<EOF
NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/${ca_file}
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/${ca_file}
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/${ca_file}
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/${ca_file}
    OrganizationalUnitIdentifier: orderer
EOF
}

install_msp_config() {
  local target="$1" source_ca="$2" ca_file="$3"
  mkdir -p "${target}/cacerts"
  cp "${source_ca}" "${target}/cacerts/${ca_file}"
  write_node_ous "${target}" "${ca_file}"
}

mediatrix_ca="${generated_root}/fabric-ca/mediatrix/ca-cert.pem"
orderer_ca="${generated_root}/fabric-ca/orderer/ca-cert.pem"
install_msp_config "${peer_org}/msp" "${mediatrix_ca}" ca-mediatrix-cert.pem
mkdir -p "${peer_org}/msp/tlscacerts"
cp "${mediatrix_ca}" "${peer_org}/msp/tlscacerts/tlsca-mediatrix-cert.pem"
for msp in \
  "${peer_org}/users/Admin@mediatrix.bloodledger.local/msp" \
  "${peer_org}/users/ApiGateway@mediatrix.bloodledger.local/msp" \
  "${peer_org}/peers/peer0.mediatrix.bloodledger.local/msp"; do
  install_msp_config "${msp}" "${mediatrix_ca}" ca-mediatrix-cert.pem
done

install_msp_config "${orderer_org}/msp" "${orderer_ca}" ca-orderer-cert.pem
mkdir -p "${orderer_org}/msp/tlscacerts"
cp "${orderer_ca}" "${orderer_org}/msp/tlscacerts/tlsca-orderer-cert.pem"
for msp in \
  "${orderer_org}/users/Admin@orderer.bloodledger.local/msp" \
  "${orderer_org}/orderers/orderer0.orderer.bloodledger.local/msp"; do
  install_msp_config "${msp}" "${orderer_ca}" ca-orderer-cert.pem
done

normalize_tls() {
  local node="$1" ca_cert="$2"
  local enrollment="${node}/tls-enrollment" target="${node}/tls"
  local key cert
  key="$(find "${enrollment}/keystore" -type f -print -quit)"
  cert="$(find "${enrollment}/signcerts" -type f -print -quit)"
  [[ -n "${key}" && -n "${cert}" ]]
  mkdir -p "${target}"
  cp "${ca_cert}" "${target}/ca.crt"
  cp "${cert}" "${target}/server.crt"
  cp "${key}" "${target}/server.key"
  chmod 600 "${target}/server.key"
}
normalize_tls "${peer_org}/peers/peer0.mediatrix.bloodledger.local" "${mediatrix_ca}"
normalize_tls "${orderer_org}/orderers/orderer0.orderer.bloodledger.local" "${orderer_ca}"

normalize_client_tls() {
  local user="$1" ca_cert="$2"
  local enrollment="${user}/tls-enrollment" target="${user}/tls"
  local key cert
  key="$(find "${enrollment}/keystore" -type f -print -quit)"
  cert="$(find "${enrollment}/signcerts" -type f -print -quit)"
  [[ -n "${key}" && -n "${cert}" ]]
  mkdir -p "${target}"
  cp "${ca_cert}" "${target}/ca.crt"
  cp "${cert}" "${target}/client.crt"
  cp "${key}" "${target}/client.key"
  chmod 600 "${target}/client.key"
}
normalize_client_tls "${peer_org}/users/Admin@mediatrix.bloodledger.local" "${mediatrix_ca}"
normalize_client_tls "${orderer_org}/users/Admin@orderer.bloodledger.local" "${orderer_ca}"
find "${generated_root}" -type d -exec chmod go-rwx {} +
find "${generated_root}" -type f -exec chmod go-rwx {} +
