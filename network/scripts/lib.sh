#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
generated_root="${repository_root}/network/generated"

compose=(docker compose --project-name bloodledger)
if [[ -f "${repository_root}/.env" ]]; then
  compose+=(--env-file "${repository_root}/.env")
fi

require_local_ca_configuration() {
  if [[ -f "${repository_root}/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "${repository_root}/.env"
    set +a
  fi
  for variable_name in MEDIATRIX_CA_ADMIN_PASSWORD ORDERER_CA_ADMIN_PASSWORD; do
    if [[ -z "${!variable_name:-}" ]]; then
      echo "Required CA secret is empty; set ${variable_name} in the process environment or untracked .env" >&2
      exit 1
    fi
  done
  export POSTGRES_ADMIN_PASSWORD="${POSTGRES_ADMIN_PASSWORD:-unused-by-ca-only-command}"
  export POSTGRES_MIGRATOR_PASSWORD="${POSTGRES_MIGRATOR_PASSWORD:-unused-by-ca-only-command}"
  export POSTGRES_APP_PASSWORD="${POSTGRES_APP_PASSWORD:-unused-by-ca-only-command}"
}

prepare_generated_root() {
  umask 077
  mkdir -p "${generated_root}/fabric-ca/mediatrix" \
    "${generated_root}/fabric-ca/orderer" "${generated_root}/organizations" \
    "${generated_root}/secrets"
  chmod 700 "${generated_root}" "${generated_root}/fabric-ca" \
    "${generated_root}/fabric-ca/mediatrix" "${generated_root}/fabric-ca/orderer" \
    "${generated_root}/organizations" "${generated_root}/secrets"
}

yaml_single_quote() {
  local escaped="${1//\'/\'\'}"
  printf "'%s'" "${escaped}"
}

url_encode() {
  local input="$1" output="" character encoded index
  LC_ALL=C
  for ((index = 0; index < ${#input}; index++)); do
    character="${input:index:1}"
    case "${character}" in
      [a-zA-Z0-9.~_-]) output+="${character}" ;;
      *)
        printf -v encoded '%%%02X' "'${character}"
        output+="${encoded}"
        ;;
    esac
  done
  printf '%s' "${output}"
}

ca_exec() {
  local service="$1"
  shift
  # The CA bootstrap passwords are intentionally not part of the committed
  # Compose environment. Pass them only to the short-lived client process
  # used by this script; never write them to generated files or normal output.
  local -a exec_environment=()
  exec_environment+=( -e "MEDIATRIX_CA_ADMIN_USER=${MEDIATRIX_CA_ADMIN_USER:-mediatrix-ca-admin}" )
  exec_environment+=( -e "ORDERER_CA_ADMIN_USER=${ORDERER_CA_ADMIN_USER:-orderer-ca-admin}" )
  if [[ -n "${MEDIATRIX_CA_ADMIN_PASSWORD:-}" ]]; then
    exec_environment+=( -e "MEDIATRIX_CA_ADMIN_PASSWORD_ENCODED=$(url_encode "${MEDIATRIX_CA_ADMIN_PASSWORD}")" )
  fi
  if [[ -n "${ORDERER_CA_ADMIN_PASSWORD:-}" ]]; then
    exec_environment+=( -e "ORDERER_CA_ADMIN_PASSWORD_ENCODED=$(url_encode "${ORDERER_CA_ADMIN_PASSWORD}")" )
  fi
  "${compose[@]}" exec --no-TTY "${exec_environment[@]}" "${service}" "$@"
}
