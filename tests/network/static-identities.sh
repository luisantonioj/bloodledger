#!/usr/bin/env bash
set -euo pipefail
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${repository_root}"

docker compose \
  --project-name bloodledger \
  --env-file .env.example \
  config >/tmp/bloodledger-compose-config.yaml 2>/tmp/bloodledger-compose-config.err && {
    echo "Compose unexpectedly accepted empty required secrets" >&2
    exit 1
  }

export MEDIATRIX_CA_ADMIN_PASSWORD=static-validation-only
export ORDERER_CA_ADMIN_PASSWORD=static-validation-only
export POSTGRES_ADMIN_PASSWORD=static-validation-only
export POSTGRES_MIGRATOR_PASSWORD=static-validation-only
export POSTGRES_APP_PASSWORD=static-validation-only
effective="$(docker compose --project-name bloodledger config)"

grep -q 'hyperledger/fabric-ca:1.5.15' <<<"${effective}"
grep -q 'host_ip: 127.0.0.1' <<<"${effective}"
grep -q 'published: "7054"' <<<"${effective}"
grep -q 'published: "8054"' <<<"${effective}"
for service in ca-mediatrix ca-orderer; do grep -q "^  ${service}:" <<<"${effective}"; done
if grep -Eq '^  (peer0-mediatrix|orderer0):' <<<"${effective}"; then
  echo "Peer/orderer node provisioning is outside this batch" >&2
  exit 1
fi

for config in network/config/fabric-ca/mediatrix.yaml network/config/fabric-ca/orderer.yaml; do
  grep -q '^version: 1.5.15$' "${config}"
  grep -q '^  enabled: true$' "${config}"
done
for script in network/scripts/*.sh tests/network/*.sh; do bash -n "${script}"; done
git check-ignore --quiet --no-index network/generated/fabric-ca/mediatrix/ca-key.pem
if git ls-files | grep -Eq '(^|/)(fabric-ca-server\.db|[^/]*_sk|[^/]*\.pem|identity-secrets\.env)$'; then
  echo "Tracked generated Fabric material detected" >&2
  exit 1
fi
echo "Static Fabric CA and identity baseline checks passed"
