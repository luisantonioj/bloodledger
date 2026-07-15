#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=network/scripts/lib.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

require_local_ca_configuration
if [[ "${BLOODLEDGER_IDENTITY_RECREATE:-}" != "REMOVE_BLOODLEDGER_CA_IDENTITIES" ]]; then
  echo "Identity-only recreation requires BLOODLEDGER_IDENTITY_RECREATE=REMOVE_BLOODLEDGER_CA_IDENTITIES" >&2
  exit 1
fi

repository_real="$(realpath "${repository_root}")"
generated_real="$(realpath -m "${generated_root}")"
case "${generated_real}" in
  "${repository_real}"/network/generated) ;;
  *) echo "Refusing recreation outside the repository generated boundary: ${generated_real}" >&2; exit 1 ;;
esac

mapfile -t ca_containers < <("${compose[@]}" ps --all --quiet ca-mediatrix ca-orderer)
mapfile -t ca_volumes < <(docker volume ls --quiet \
  --filter label=com.docker.compose.project=bloodledger \
  --filter label=com.docker.compose.service=ca-mediatrix \
  --filter label=com.docker.compose.service=ca-orderer)

echo "Identity recreation targets:"
printf '  CA container: %s\n' "${ca_containers[@]:-none}"
printf '  CA volume: %s\n' "${ca_volumes[@]:-none}"
printf '  Generated path: %s\n' \
  "${generated_real}/fabric-ca" "${generated_real}/organizations" \
  "${generated_real}/secrets" "${generated_real}/.identity-bootstrap-complete"
echo "Preserved: .env, postgres service, bloodledger_postgres-data, and unrelated Docker resources"

if ((${#ca_volumes[@]})); then
  echo "Refusing unexpected CA volumes; this batch uses generated bind paths only" >&2
  exit 1
fi
"${compose[@]}" rm --stop --force ca-mediatrix ca-orderer >/dev/null
for target in fabric-ca organizations secrets; do
  resolved="$(realpath -m "${generated_real}/${target}")"
  case "${resolved}" in "${generated_real}"/*) ;; *) exit 1 ;; esac
  if [[ -d "${resolved}" ]]; then
    # Enrollment runs as the container's root user and deliberately applies
    # restrictive permissions. Use the same pinned image as a scoped cleanup
    # helper so recreation remains repeatable for an unprivileged host user.
    docker run --rm --user 0 --volume "${generated_real}:/work" \
      hyperledger/fabric-ca:1.5.15 sh -ceu \
      "find '/work/${target}' -mindepth 1 -delete"
  fi
done
marker="${generated_real}/.identity-bootstrap-complete"
[[ ! -e "${marker}" || -f "${marker}" ]] || { echo "Unexpected recreation marker type" >&2; exit 1; }
if [[ -e "${marker}" ]]; then
  docker run --rm --user 0 --volume "${generated_real}:/work" \
    hyperledger/fabric-ca:1.5.15 rm -f /work/.identity-bootstrap-complete
fi
echo "Identity-only CA state removed safely; run network/scripts/bootstrap-identities.sh to recreate it"
