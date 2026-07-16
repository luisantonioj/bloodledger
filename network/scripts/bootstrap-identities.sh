#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=network/scripts/lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

require_local_ca_configuration
prepare_generated_root

completion_marker="${generated_root}/.identity-bootstrap-complete"
if [[ -f "${completion_marker}" ]]; then
  "${repository_root}/network/scripts/validate-identities.sh"
  echo "Fabric identity material already exists and passed validation; no changes made"
  exit 0
fi
if find "${generated_root}/organizations" -mindepth 1 -print -quit | grep -q . || \
   [[ -f "${generated_root}/secrets/identity-secrets.env" ]]; then
  echo "Partial identity state found. Use the documented identity-only scoped recreation procedure; no files were changed." >&2
  exit 1
fi

write_runtime_ca_config() {
  local template="$1" target="$2" admin_user="$3" admin_password="$4"
  local quoted_user quoted_password temporary
  quoted_user="$(yaml_single_quote "${admin_user}")"
  quoted_password="$(yaml_single_quote "${admin_password}")"
  temporary="${target}.tmp"
  awk -v user="${quoted_user}" -v password="${quoted_password}" '
    $0 == "  identities: []" {
      print "  identities:"
      print "    - name: " user
      print "      pass: " password
      print "      type: client"
      print "      affiliation: \"\""
      print "      attrs:"
      print "        hf.Registrar.Roles: \"*\""
      print "        hf.Registrar.DelegateRoles: \"*\""
      print "        hf.Revoker: true"
      print "        hf.IntermediateCA: true"
      print "        hf.GenCRL: true"
      print "        hf.Registrar.Attributes: \"*\""
      print "        hf.AffiliationMgr: true"
      replaced = 1
      next
    }
    { print }
    END { if (!replaced) exit 1 }
  ' "${template}" > "${temporary}"
  mv "${temporary}" "${target}"
  chmod 600 "${target}"
}

write_runtime_ca_config \
  "${repository_root}/network/config/fabric-ca/mediatrix.yaml" \
  "${generated_root}/fabric-ca/mediatrix/fabric-ca-server-config.yaml" \
  "${MEDIATRIX_CA_ADMIN_USER:-mediatrix-ca-admin}" \
  "${MEDIATRIX_CA_ADMIN_PASSWORD}"
write_runtime_ca_config \
  "${repository_root}/network/config/fabric-ca/orderer.yaml" \
  "${generated_root}/fabric-ca/orderer/fabric-ca-server-config.yaml" \
  "${ORDERER_CA_ADMIN_USER:-orderer-ca-admin}" \
  "${ORDERER_CA_ADMIN_PASSWORD}"

generate_ca_tls_material() {
  local ca_home="$1" common_name="$2" dns_name="$3"
  if [[ ! -f "${ca_home}/tls-cert.pem" || ! -f "${ca_home}/tls-key.pem" ]]; then
    openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes \
      -keyout "${ca_home}/tls-key.pem" -out "${ca_home}/tls-cert.pem" \
      -days 3650 -subj "/C=PH/O=BloodLedger Development/CN=${common_name}" \
      -addext "subjectAltName=DNS:${dns_name},DNS:ca-mediatrix,DNS:ca-orderer,DNS:localhost,IP:127.0.0.1" \
      >/dev/null 2>&1
    chmod 600 "${ca_home}/tls-key.pem"
    chmod 600 "${ca_home}/tls-cert.pem"
  fi
}

generate_ca_tls_material "${generated_root}/fabric-ca/mediatrix" \
  ca.mediatrix.bloodledger.local ca.mediatrix.bloodledger.local
generate_ca_tls_material "${generated_root}/fabric-ca/orderer" \
  ca.orderer.bloodledger.local ca.orderer.bloodledger.local

"${compose[@]}" config --quiet
"${compose[@]}" up --detach --wait ca-mediatrix ca-orderer
"${repository_root}/network/scripts/wait-for-cas.sh"

secrets_file="${generated_root}/secrets/identity-secrets.env"
umask 077
{
  for identity in MEDIATRIX_ADMIN PEER0 API_GATEWAY ORDERER_ADMIN ORDERER0; do
    printf '%s_SECRET=%s\n' "${identity}" "$(openssl rand -hex 24)"
  done
} > "${secrets_file}"
chmod 600 "${secrets_file}"

peer_org="/work/organizations/peerOrganizations/mediatrix.bloodledger.local"
orderer_org="/work/organizations/ordererOrganizations/orderer.bloodledger.local"

ca_exec ca-mediatrix sh -ceu '
  export FABRIC_CA_CLIENT_HOME=/work/fabric-ca/clients/mediatrix-registrar
  fabric-ca-client enroll --url "https://${MEDIATRIX_CA_ADMIN_USER}:${MEDIATRIX_CA_ADMIN_PASSWORD_ENCODED}@ca-mediatrix:7054" --caname ca.mediatrix.bloodledger.local --tls.certfiles /work/fabric-ca/mediatrix/tls-cert.pem >/dev/null
  . /work/secrets/identity-secrets.env
  fabric-ca-client register --caname ca.mediatrix.bloodledger.local --id.name mediatrix-admin --id.secret "$MEDIATRIX_ADMIN_SECRET" --id.type admin --id.affiliation mediatrix --tls.certfiles /work/fabric-ca/mediatrix/tls-cert.pem >/dev/null 2>&1
  fabric-ca-client register --caname ca.mediatrix.bloodledger.local --id.name peer0 --id.secret "$PEER0_SECRET" --id.type peer --id.affiliation mediatrix --tls.certfiles /work/fabric-ca/mediatrix/tls-cert.pem >/dev/null 2>&1
  fabric-ca-client register --caname ca.mediatrix.bloodledger.local --id.name api-gateway --id.secret "$API_GATEWAY_SECRET" --id.type client --id.affiliation mediatrix --tls.certfiles /work/fabric-ca/mediatrix/tls-cert.pem >/dev/null 2>&1
'

ca_exec ca-orderer sh -ceu '
  export FABRIC_CA_CLIENT_HOME=/work/fabric-ca/clients/orderer-registrar
  fabric-ca-client enroll --url "https://${ORDERER_CA_ADMIN_USER}:${ORDERER_CA_ADMIN_PASSWORD_ENCODED}@ca-orderer:7054" --caname ca.orderer.bloodledger.local --tls.certfiles /work/fabric-ca/orderer/tls-cert.pem >/dev/null
  . /work/secrets/identity-secrets.env
  fabric-ca-client register --caname ca.orderer.bloodledger.local --id.name orderer-admin --id.secret "$ORDERER_ADMIN_SECRET" --id.type admin --id.affiliation orderer --tls.certfiles /work/fabric-ca/orderer/tls-cert.pem >/dev/null 2>&1
  fabric-ca-client register --caname ca.orderer.bloodledger.local --id.name orderer0 --id.secret "$ORDERER0_SECRET" --id.type orderer --id.affiliation orderer --tls.certfiles /work/fabric-ca/orderer/tls-cert.pem >/dev/null 2>&1
'

ca_exec ca-mediatrix sh -ceu "
  . /work/secrets/identity-secrets.env
  fabric-ca-client enroll --url \"https://mediatrix-admin:\${MEDIATRIX_ADMIN_SECRET}@ca-mediatrix:7054\" --caname ca.mediatrix.bloodledger.local --mspdir '${peer_org}/users/Admin@mediatrix.bloodledger.local/msp' --tls.certfiles /work/fabric-ca/mediatrix/tls-cert.pem >/dev/null
  fabric-ca-client enroll --url \"https://mediatrix-admin:\${MEDIATRIX_ADMIN_SECRET}@ca-mediatrix:7054\" --caname ca.mediatrix.bloodledger.local --enrollment.profile tls --mspdir '${peer_org}/users/Admin@mediatrix.bloodledger.local/tls-enrollment' --tls.certfiles /work/fabric-ca/mediatrix/tls-cert.pem >/dev/null
  fabric-ca-client enroll --url \"https://api-gateway:\${API_GATEWAY_SECRET}@ca-mediatrix:7054\" --caname ca.mediatrix.bloodledger.local --mspdir '${peer_org}/users/ApiGateway@mediatrix.bloodledger.local/msp' --tls.certfiles /work/fabric-ca/mediatrix/tls-cert.pem >/dev/null
  fabric-ca-client enroll --url \"https://peer0:\${PEER0_SECRET}@ca-mediatrix:7054\" --caname ca.mediatrix.bloodledger.local --mspdir '${peer_org}/peers/peer0.mediatrix.bloodledger.local/msp' --tls.certfiles /work/fabric-ca/mediatrix/tls-cert.pem >/dev/null
  fabric-ca-client enroll --url \"https://peer0:\${PEER0_SECRET}@ca-mediatrix:7054\" --caname ca.mediatrix.bloodledger.local --enrollment.profile tls --csr.hosts peer0.mediatrix.bloodledger.local --csr.hosts peer0-mediatrix --csr.hosts localhost --mspdir '${peer_org}/peers/peer0.mediatrix.bloodledger.local/tls-enrollment' --tls.certfiles /work/fabric-ca/mediatrix/tls-cert.pem >/dev/null
"

ca_exec ca-orderer sh -ceu "
  . /work/secrets/identity-secrets.env
  fabric-ca-client enroll --url \"https://orderer-admin:\${ORDERER_ADMIN_SECRET}@ca-orderer:7054\" --caname ca.orderer.bloodledger.local --mspdir '${orderer_org}/users/Admin@orderer.bloodledger.local/msp' --tls.certfiles /work/fabric-ca/orderer/tls-cert.pem >/dev/null
  fabric-ca-client enroll --url \"https://orderer-admin:\${ORDERER_ADMIN_SECRET}@ca-orderer:7054\" --caname ca.orderer.bloodledger.local --enrollment.profile tls --mspdir '${orderer_org}/users/Admin@orderer.bloodledger.local/tls-enrollment' --tls.certfiles /work/fabric-ca/orderer/tls-cert.pem >/dev/null
  fabric-ca-client enroll --url \"https://orderer0:\${ORDERER0_SECRET}@ca-orderer:7054\" --caname ca.orderer.bloodledger.local --mspdir '${orderer_org}/orderers/orderer0.orderer.bloodledger.local/msp' --tls.certfiles /work/fabric-ca/orderer/tls-cert.pem >/dev/null
  fabric-ca-client enroll --url \"https://orderer0:\${ORDERER0_SECRET}@ca-orderer:7054\" --caname ca.orderer.bloodledger.local --enrollment.profile tls --csr.hosts orderer0.orderer.bloodledger.local --csr.hosts orderer0 --csr.hosts localhost --mspdir '${orderer_org}/orderers/orderer0.orderer.bloodledger.local/tls-enrollment' --tls.certfiles /work/fabric-ca/orderer/tls-cert.pem >/dev/null
"

# Fabric CA runs as root in its pinned image. Transfer only the generated
# project-owned paths to the invoking WSL user so host-side MSP assembly and
# validation can operate without weakening their restrictive modes.
ca_exec ca-mediatrix chown -R "$(id -u):$(id -g)" \
  /work/organizations /work/fabric-ca /work/secrets

"${repository_root}/network/scripts/assemble-msps.sh"
touch "${completion_marker}"
chmod 600 "${completion_marker}"
"${repository_root}/network/scripts/validate-identities.sh"
echo "Approved Fabric identities were registered and enrolled; secrets remain under network/generated"
