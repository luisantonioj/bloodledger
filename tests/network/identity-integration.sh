#!/usr/bin/env bash
set -euo pipefail
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${repository_root}"

network/scripts/bootstrap-identities.sh
network/scripts/bootstrap-identities.sh
network/scripts/validate-identities.sh

services="$(docker compose --project-name bloodledger ps --services --status running)"
grep -qx ca-mediatrix <<<"${services}"
grep -qx ca-orderer <<<"${services}"
echo "Fabric identity integration and safe repeat execution passed"
