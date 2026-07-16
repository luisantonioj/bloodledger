#!/usr/bin/env bash
set -euo pipefail

readonly repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
readonly project_name="bloodledger"
readonly fabric_reset_token="RESET_BLOODLEDGER_FABRIC"
readonly full_reset_token="RESET_BLOODLEDGER_DEVELOPMENT"
readonly health_probe_id="s1-08-bootstrap"
readonly generated_root="${repository_root}/network/generated"
readonly health_build_root="${repository_root}/network/health-contract/build"
readonly -a project_services=(ca-mediatrix ca-orderer peer0-mediatrix orderer0 postgres)
readonly -a fabric_services=(ca-mediatrix ca-orderer peer0-mediatrix orderer0)
readonly -a fabric_volume_keys=(peer0-mediatrix-config peer0-mediatrix-data orderer0-config orderer0-data)
readonly -a required_secrets=(MEDIATRIX_CA_ADMIN_PASSWORD ORDERER_CA_ADMIN_PASSWORD POSTGRES_ADMIN_PASSWORD POSTGRES_MIGRATOR_PASSWORD POSTGRES_APP_PASSWORD)

cd "${repository_root}"

usage() {
  cat <<'USAGE'
Usage: scripts/bloodledger-dev.sh COMMAND [OPTIONS]

Commands:
  doctor                       Inspect prerequisites, versions, configuration, and ports
  bootstrap                    Create or validate the Sprint 1 infrastructure baseline
  start                        Start an existing bootstrapped environment and prove health
  status                       Inspect all required layers without changing infrastructure
  logs [SERVICE]               Follow logs for all or one approved project service
  stop                         Stop project services without deleting state
  reset-fabric [OPTIONS]       Preview or perform Level 1 Fabric reset
  reset-all [OPTIONS]          Preview or perform Level 2 full development reset
  help                         Show this help

Reset options:
  --dry-run                    Preview validated targets without deleting them
  --confirm TOKEN              Required literal confirmation for execution

Level 1 token: RESET_BLOODLEDGER_FABRIC
Level 2 token: RESET_BLOODLEDGER_DEVELOPMENT
USAGE
}

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

require_commands() {
  local command_name
  for command_name in "$@"; do
    command_exists "${command_name}" || fail "Required command is unavailable: ${command_name}"
  done
}

load_environment() {
  [[ -f "${repository_root}/.env" ]] || fail "Untracked .env is missing; copy .env.example and fill the required local secrets"
  set -a
  # shellcheck disable=SC1091
  source "${repository_root}/.env"
  set +a

  local missing=0 variable_name
  for variable_name in "${required_secrets[@]}"; do
    if [[ -z "${!variable_name:-}" ]]; then
      printf 'ERROR: A required local secret value is empty (%s)\n' "${variable_name}" >&2
      missing=1
    fi
  done
  ((missing == 0)) || fail "Complete the empty secret values in the untracked .env; no values were printed"

  local expected_name expected_value actual_value
  while IFS='|' read -r expected_name expected_value; do
    actual_value="${!expected_name:-${expected_value}}"
    [[ "${actual_value}" == "${expected_value}" ]] ||
      fail "${expected_name} conflicts with the approved Sprint 1 value ${expected_value}"
  done <<'VALUES'
COMPOSE_PROJECT_NAME|bloodledger
FABRIC_CHANNEL_NAME|bloodledger-dev
MEDIATRIX_MSP_ID|MediatrixMSP
ORDERER_MSP_ID|OrdererMSP
FABRIC_PEER_ENDPOINT|peer0-mediatrix:7051
FABRIC_ORDERER_ENDPOINT|orderer0:7050
FABRIC_HEALTH_CHAINCODE_NAME|bloodledger-health
POSTGRES_HOST|postgres
POSTGRES_PORT|5432
POSTGRES_DB|bloodledger_dev
POSTGRES_ADMIN_USER|postgres
POSTGRES_MIGRATOR_USER|bloodledger_migrator
POSTGRES_APP_USER|bloodledger_app
VALUES
}

compose_command() {
  docker compose --project-name "${project_name}" --env-file "${repository_root}/.env" "$@"
}

require_docker() {
  docker info >/dev/null 2>&1 || fail "Docker is unavailable; start Docker Desktop with WSL2 integration and retry"
  docker compose version >/dev/null 2>&1 || fail "The Docker Compose plugin is unavailable"
}

validate_compose() {
  compose_command config --quiet || fail "Compose configuration is invalid; inspect .env and compose.yaml"
  local actual_services
  actual_services="$(compose_command config --services | sort)"
  [[ "${actual_services}" == $'ca-mediatrix\nca-orderer\norderer0\npeer0-mediatrix\npostgres' ]] ||
    fail "Compose contains missing or unapproved Sprint 1 services"
  local actual_images
  actual_images="$(compose_command config --images | sort -u)"
  [[ "${actual_images}" == $'hyperledger/fabric-ca:1.5.15\nhyperledger/fabric-orderer:2.5.16\nhyperledger/fabric-peer:2.5.16\npostgres:17.10' ]] ||
    fail "Compose contains a missing, floating, or unapproved image reference"
}

version_ge() {
  [[ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -n1)" == "$2" ]]
}

report_exact_version() {
  local label="$1" actual="$2" approved="$3"
  [[ "${actual}" == "${approved}" ]] || fail "${label} ${actual:-unknown} is an unapproved mismatch; expected ${approved}"
  printf '%s: %s (approved)\n' "${label}" "${actual}"
}

project_owns_port() {
  local port="$1"
  docker ps --filter "label=com.docker.compose.project=${project_name}" --format '{{.Ports}}' |
    grep -Eq "127\\.0\\.0\\.1:${port}->"
}

check_port() {
  local label="$1" port="$2"
  [[ "${port}" =~ ^[0-9]+$ ]] && ((port >= 1 && port <= 65535)) || fail "${label} host port is invalid"
  if ss -H -ltn "sport = :${port}" 2>/dev/null | grep -q .; then
    if project_owns_port "${port}"; then
      printf '%s host port: 127.0.0.1:%s (occupied by project)\n' "${label}" "${port}"
    else
      fail "Host port ${port} for ${label} is occupied by a non-project listener"
    fi
  else
    printf '%s host port: 127.0.0.1:%s (available)\n' "${label}" "${port}"
  fi
}

check_ports() {
  check_port "Mediatrix CA" 7054
  check_port "Orderer CA" 8054
  check_port "Mediatrix peer" 7051
  check_port "Orderer" 7050
  check_port "PostgreSQL" "${POSTGRES_HOST_PORT:-5432}"
}

doctor() {
  require_commands bash docker git node npm jq ss openssl
  require_docker

  [[ "$(uname -s)" == Linux ]] || fail "Canonical execution requires Linux under WSL2"
  if ! grep -qi microsoft /proc/sys/kernel/osrelease /proc/version 2>/dev/null; then
    fail "Canonical execution requires WSL2 Ubuntu 24.04 LTS"
  fi
  [[ "${repository_root}" != /mnt/* ]] || fail "The working copy is on a Windows-mounted path; use the WSL Linux filesystem"
  # shellcheck disable=SC1091
  source /etc/os-release
  [[ "${ID:-}" == ubuntu && "${VERSION_ID:-}" == 24.04 ]] || fail "Ubuntu 24.04 LTS is required"
  printf 'Host: WSL2 %s; working copy is in the WSL Linux filesystem\n' "${PRETTY_NAME}"
  printf 'Linux kernel: %s\n' "$(uname -r)"
  if command_exists wsl.exe; then
    local wsl_version_line
    wsl_version_line="$(wsl.exe --version 2>/dev/null | tr -d '\r' | sed -n '1p')"
    if [[ -n "${wsl_version_line}" ]]; then
      printf 'WSL host tooling: %s\n' "${wsl_version_line}"
    else
      printf 'WSL host tooling: version output unavailable; WSL2 kernel confirmed\n'
    fi
  fi

  report_exact_version "Node.js" "$(node --version | sed 's/^v//')" "24.17.0"
  report_exact_version "npm" "$(npm --version)" "11.13.0"
  local git_version
  git_version="$(git --version | awk '{print $3}')"
  version_ge "${git_version}" "2.30.0" || fail "Git ${git_version} is below the approved minimum 2.30"
  if [[ "${git_version}" == 2.55.0 ]]; then
    printf 'Git: %s (approved target)\n' "${git_version}"
  elif [[ "${git_version}" == 2.43.0 ]]; then
    printf 'Git: %s (compatible recorded Jopia-host deviation)\n' "${git_version}"
  else
    printf 'Git: %s (compatible minimum met; record this host deviation for S1-09)\n' "${git_version}"
  fi
  [[ "$(docker context show)" == default ]] || fail "Docker context must be default for the approved Docker Desktop workflow"
  local docker_platform
  docker_platform="$(docker version --format '{{.Server.Platform.Name}}')"
  [[ "${docker_platform}" == 'Docker Desktop 4.82.0 (233772)' ]] ||
    fail "Docker Desktop bundle is an unapproved mismatch: ${docker_platform:-unknown}"
  printf 'Docker Desktop: 4.82.0 (build 233772; approved)\n'
  report_exact_version "Docker Engine" "$(docker version --format '{{.Server.Version}}')" "29.6.1"
  report_exact_version "Docker Compose" "$(docker compose version --short)" "5.3.0"

  [[ "$(node -p "require('./database/package.json').devDependencies['node-pg-migrate']")" == 8.0.4 ]] || fail "node-pg-migrate is not pinned to 8.0.4"
  [[ "$(node -p "require('./database/package.json').devDependencies.pg")" == 8.22.0 ]] || fail "pg is not pinned to 8.22.0"
  printf 'Repository dependencies: node-pg-migrate 8.0.4; pg 8.22.0; Gitleaks 8.30.1\n'
  printf 'Pinned images: Fabric 2.5.16; Fabric CA 1.5.15; PostgreSQL 17.10; no latest tags\n'

  load_environment
  validate_compose
  printf 'Compose project: %s; approved non-secret overrides validated\n' "${project_name}"
  if [[ "${POSTGRES_HOST_PORT:-5432}" == 5432 ]]; then
    printf 'Local overrides: none affecting approved host ports\n'
  else
    printf 'Local overrides: POSTGRES_HOST_PORT is set to %s (record for S1-09)\n' "${POSTGRES_HOST_PORT}"
  fi
  check_ports
  printf 'Prerequisite and effective-version inspection passed\n'
}

require_operational_context() {
  require_commands bash docker git node npm jq ss openssl
  require_docker
  load_environment
  validate_compose
  check_ports
}

service_health() {
  local service="$1" id state health
  id="$(compose_command ps --quiet "${service}")"
  [[ -n "${id}" ]] || fail "${service}: absent"
  state="$(docker inspect --format '{{.State.Status}}' "${id}")"
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}unavailable{{end}}' "${id}")"
  [[ "${state}" == running ]] || fail "${service}: ${state}"
  [[ "${health}" == healthy ]] || fail "${service}: ${health}"
  printf '%s: healthy\n' "${service}"
}

status() {
  require_operational_context
  printf 'Compose project: %s\n' "${project_name}"
  printf 'Resolved host ports: CA=7054/8054 peer=7051 orderer=7050 postgres=%s\n' "${POSTGRES_HOST_PORT:-5432}"

  local service
  for service in "${project_services[@]}"; do
    service_health "${service}"
  done

  PGPASSWORD="${POSTGRES_APP_PASSWORD}" compose_command exec --no-TTY --env PGPASSWORD postgres \
    psql --host 127.0.0.1 --username bloodledger_app --dbname bloodledger_dev \
    --no-psqlrc --tuples-only --no-align --command 'SELECT current_database()' | grep -Fxq bloodledger_dev ||
    fail "PostgreSQL authenticated connectivity failed"
  printf 'PostgreSQL authenticated connectivity: healthy\n'
  npm run migrate:status >/dev/null || fail "Bootstrap migration is missing or pending"
  printf 'Bootstrap migration: current\n'

  compose_command exec --no-TTY ca-mediatrix fabric-ca-client getcainfo --url https://localhost:7054 \
    --tls.certfiles /work/fabric-ca/mediatrix/tls-cert.pem >/dev/null || fail "Mediatrix CA readiness check failed"
  compose_command exec --no-TTY ca-orderer fabric-ca-client getcainfo --url https://localhost:7054 \
    --tls.certfiles /work/fabric-ca/orderer/tls-cert.pem >/dev/null || fail "Orderer CA readiness check failed"
  printf 'Fabric CA readiness: healthy\n'
  network/scripts/validate-nodes.sh >/dev/null || fail "Peer/orderer internal health validation failed"
  printf 'Peer/orderer operations health: healthy\n'
  network/scripts/query-channel.sh >/dev/null || fail "Channel membership or channel information query failed"
  printf 'Channel bloodledger-dev: orderer active; peer joined; information query passed\n'
  network/scripts/query-health-contract.sh "${health_probe_id}" >/dev/null ||
    fail "Health contract lifecycle or read-only probe query failed"
  printf 'Health contract bloodledger-health: committed definition and ReadProbe passed\n'
  printf 'BloodLedger development infrastructure is healthy\n'
}

bootstrap() {
  require_operational_context
  compose_command up --detach --wait postgres
  if ! npm run migrate:status >/dev/null 2>&1; then
    npm run migrate:up
  fi
  npm run migrate:status
  network/scripts/bootstrap-identities.sh
  compose_command up --detach --wait "${fabric_services[@]}"
  network/scripts/validate-identities.sh
  network/scripts/validate-nodes.sh
  network/scripts/create-channel.sh
  network/scripts/query-channel.sh
  network/scripts/package-health-contract.sh
  network/scripts/deploy-health-contract.sh
  npm run probe:fabric-health-contract -- "${health_probe_id}"
  status
}

start() {
  require_operational_context
  [[ -f "${generated_root}/.identity-bootstrap-complete" ]] || fail "Bootstrap is required: Fabric identities are absent"
  [[ -f "${generated_root}/channel-artifacts/bloodledger-dev.block" ]] || fail "Bootstrap is required: channel artifact is absent"
  [[ -f "${health_build_root}/package-id.txt" ]] || fail "Bootstrap is required: health contract package is absent"
  compose_command up --detach --wait "${project_services[@]}"
  status
}

logs() {
  require_docker
  load_environment
  validate_compose
  [[ "$#" -le 1 ]] || fail "logs accepts at most one service; run help for usage"
  if [[ "$#" -eq 1 ]]; then
    local requested="$1" allowed=false service
    for service in "${project_services[@]}"; do
      [[ "${requested}" == "${service}" ]] && allowed=true
    done
    [[ "${allowed}" == true ]] || fail "Unknown BloodLedger service: ${requested}"
    compose_command logs --follow "${requested}"
  else
    compose_command logs --follow "${project_services[@]}"
  fi
}

stop_services() {
  require_docker
  load_environment
  validate_compose
  compose_command down
  printf 'BloodLedger services stopped; volumes, generated material, and .env were preserved\n'
}

assert_safe_delete_path() {
  local target="$1" parent resolved
  [[ -n "${target}" && "${target}" == /* ]] || fail "Reset target is empty or unresolved"
  [[ "${target}" != / && "${target}" != "${HOME}" && "${target}" != "${repository_root}" && "${target}" != "$(dirname "${repository_root}")" ]] ||
    fail "Refusing unsafe reset target: ${target}"
  parent="$(dirname "${target}")"
  [[ -d "${parent}" ]] || fail "Reset target parent does not exist: ${parent}"
  resolved="$(realpath -m -- "${target}")"
  [[ "${resolved}" == "${target}" ]] || fail "Reset target contains traversal or a symlink: ${target}"
  [[ "${resolved}" == "${repository_root}/"* ]] || fail "Reset target escapes the repository: ${target}"
  [[ "${resolved}" == "${generated_root}" || "${resolved}" == "${health_build_root}" ]] ||
    fail "Reset target is outside the approved generated/build paths: ${target}"
  if [[ -L "${target}" ]]; then
    fail "Reset target must not be a symbolic link: ${target}"
  fi
}

project_volume_for_key() {
  local key="$1"
  docker volume ls --quiet \
    --filter "label=com.docker.compose.project=${project_name}" \
    --filter "label=com.docker.compose.volume=${key}"
}

validate_volume() {
  local key="$1" expected_name="${project_name}_${key}" actual_name
  actual_name="$(project_volume_for_key "${key}")"
  [[ -z "${actual_name}" || "${actual_name}" == "${expected_name}" ]] ||
    fail "Could not prove exclusive ownership of Compose volume key ${key}"
  if [[ -n "${actual_name}" ]]; then
    [[ "$(docker volume inspect --format '{{index .Labels "com.docker.compose.project"}}' "${actual_name}")" == "${project_name}" ]] ||
      fail "Volume ${actual_name} is not owned by project ${project_name}"
    [[ "$(docker volume inspect --format '{{index .Labels "com.docker.compose.volume"}}' "${actual_name}")" == "${key}" ]] ||
      fail "Volume ${actual_name} has an unexpected Compose volume label"
  fi
  printf '%s' "${actual_name}"
}

validate_service_ownership() {
  local service="$1" id
  id="$(compose_command ps --all --quiet "${service}")"
  [[ -z "${id}" ]] && return 0
  [[ "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' "${id}")" == "${project_name}" ]] ||
    fail "Container for ${service} is not owned by project ${project_name}"
  [[ "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "${id}")" == "${service}" ]] ||
    fail "Container service ownership cannot be proven for ${service}"
}

resolve_project_network() {
  local network_name="${project_name}_default"
  if ! docker network inspect "${network_name}" >/dev/null 2>&1; then
    printf '%s' ""
    return 0
  fi
  [[ "$(docker network inspect --format '{{index .Labels "com.docker.compose.project"}}' "${network_name}")" == "${project_name}" ]] ||
    fail "Network ${network_name} is not owned by Compose project ${project_name}"
  [[ "$(docker network inspect --format '{{index .Labels "com.docker.compose.network"}}' "${network_name}")" == default ]] ||
    fail "Network ${network_name} has an unexpected Compose network label"
  printf '%s' "${network_name}"
}

resolve_health_runtime_container() {
  local network_name="$1"
  [[ -n "${network_name}" ]] || { printf '%s' ""; return 0; }
  local package_id_file="${health_build_root}/package-id.txt"
  local -a candidates=()
  mapfile -t candidates < <(docker ps --all --filter "network=${network_name}" \
    --filter 'name=dev-peer0.mediatrix.bloodledger.local-bloodledger-health_0.1.0-' \
    --format '{{.ID}}')
  ((${#candidates[@]} > 0)) || { printf '%s' ""; return 0; }
  [[ -f "${package_id_file}" ]] || fail "A health-contract runtime exists but its approved package ID file is missing"
  local package_id package_hash expected_name id actual_name actual_networks
  package_id="$(<"${package_id_file}")"
  [[ "${package_id}" =~ ^bloodledger-health_0\.1\.0:([a-f0-9]{64})$ ]] || fail "The recorded health-contract package ID is invalid"
  package_hash="${BASH_REMATCH[1]}"
  expected_name="dev-peer0.mediatrix.bloodledger.local-bloodledger-health_0.1.0-${package_hash}"
  [[ "${#candidates[@]}" -eq 1 ]] || fail "Health-contract runtime ownership is ambiguous; expected at most one approved container"
  id="${candidates[0]}"
  actual_name="$(docker inspect --format '{{.Name}}' "${id}")"
  actual_name="${actual_name#/}"
  [[ "${actual_name}" == "${expected_name}" ]] || fail "Health-contract runtime name does not match the approved package ID"
  [[ "$(docker inspect --format '{{index .Config.Labels "org.hyperledger.fabric.chaincode.type"}}' "${id}")" == NODE ]] ||
    fail "Health-contract runtime has an unexpected chaincode type"
  [[ "$(docker inspect --format '{{index .Config.Labels "org.hyperledger.fabric.version"}}' "${id}")" == v2.5.16 ]] ||
    fail "Health-contract runtime has an unexpected Fabric version"
  actual_networks="$(docker inspect --format '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}}{{println}}{{end}}' "${id}" | sed '/^$/d')"
  [[ "${actual_networks}" == "${network_name}" ]] || fail "Health-contract runtime is attached outside the approved project network"
  printf '%s' "${id}"
}

remove_directory_contents() {
  local target="$1"
  [[ -e "${target}" ]] || return 0
  assert_safe_delete_path "${target}"
  find "${target}" -mindepth 1 -depth -delete
}

reset_changes=()
run_reset_step() {
  local description="$1"
  shift
  if "$@"; then
    reset_changes+=("${description}")
    printf 'Reset changed: %s\n' "${description}"
  else
    printf 'ERROR: Reset stopped on partial failure: %s\n' "${description}" >&2
    if ((${#reset_changes[@]} > 0)); then
      printf 'Already changed: %s\n' "${reset_changes[*]}" >&2
    else
      printf 'Already changed: none\n' >&2
    fi
    printf 'Remaining validated targets were not changed\n' >&2
    exit 1
  fi
}

reset_environment() {
  local level="$1"
  shift
  local dry_run=false confirmation="" option
  while (($#)); do
    option="$1"
    case "${option}" in
      --dry-run) dry_run=true; shift ;;
      --confirm)
        (($# >= 2)) || fail "--confirm requires the complete documented token"
        confirmation="$2"
        shift 2
        ;;
      *) fail "Unknown reset option: ${option}" ;;
    esac
  done

  require_docker
  load_environment
  validate_compose
  assert_safe_delete_path "${generated_root}"
  assert_safe_delete_path "${health_build_root}"

  local service key name
  for service in "${fabric_services[@]}"; do validate_service_ownership "${service}"; done
  local project_network health_runtime health_runtime_name=""
  project_network="$(resolve_project_network)"
  health_runtime="$(resolve_health_runtime_container "${project_network}")"
  if [[ -n "${health_runtime}" ]]; then
    health_runtime_name="$(docker inspect --format '{{.Name}}' "${health_runtime}")"
    health_runtime_name="${health_runtime_name#/}"
  fi
  local -a fabric_volumes=()
  for key in "${fabric_volume_keys[@]}"; do
    name="$(validate_volume "${key}")"
    [[ -n "${name}" ]] && fabric_volumes+=("${name}")
  done
  local postgres_volume=""
  if [[ "${level}" == all ]]; then
    validate_service_ownership postgres
    postgres_volume="$(validate_volume postgres-data)"
  fi

  printf 'Reset preview: Compose project %s\n' "${project_name}"
  printf '  Compose containers: %s\n' "${fabric_services[*]}"
  printf '  Health-contract runtime container: %s\n' "${health_runtime_name:-none present}"
  printf '  Shared network: %s\n' "${project_network:-none present} (preserved for Level 1; removed by Level 2 shutdown)"
  printf '  Fabric volumes: %s\n' "${fabric_volumes[*]:-none present}"
  printf '  Generated path: %s\n' "${generated_root}"
  printf '  Health build path: %s\n' "${health_build_root}"
  if [[ "${level}" == all ]]; then
    printf '  PostgreSQL container: postgres\n'
    printf '  PostgreSQL volume: %s\n' "${postgres_volume:-none present}"
  else
    printf '  Preserved: .env, postgres container, postgres-data, migration history, source, docs, tests\n'
  fi

  [[ "${dry_run}" == true ]] && { printf 'Dry run complete; no resources or files were changed\n'; return 0; }
  if [[ "${level}" == fabric ]]; then
    [[ "${confirmation}" == "${fabric_reset_token}" ]] || fail "Level 1 reset requires --confirm ${fabric_reset_token}"
  else
    [[ "${confirmation}" == "${full_reset_token}" ]] || fail "Level 2 reset requires --confirm ${full_reset_token}"
  fi

  reset_changes=()
  if [[ -n "${health_runtime}" ]]; then
    run_reset_step "health-contract runtime ${health_runtime_name}" \
      docker container rm --force "${health_runtime}"
  fi
  if [[ "${level}" == fabric ]]; then
    run_reset_step "Fabric Compose containers" compose_command rm --stop --force "${fabric_services[@]}"
  else
    run_reset_step "all BloodLedger Compose containers and project network" compose_command down
  fi
  for name in "${fabric_volumes[@]}"; do
    run_reset_step "Fabric volume ${name}" docker volume rm "${name}"
  done
  if [[ "${level}" == all && -n "${postgres_volume}" ]]; then
    run_reset_step "PostgreSQL volume ${postgres_volume}" docker volume rm "${postgres_volume}"
  fi
  run_reset_step "contents below ${generated_root}" remove_directory_contents "${generated_root}"
  run_reset_step "contents below ${health_build_root}" remove_directory_contents "${health_build_root}"
  printf 'Reset complete. Run scripts/bloodledger-dev.sh bootstrap to recreate the approved empty baseline\n'
}

command_name="${1:-help}"
[[ "$#" -gt 0 ]] && shift
case "${command_name}" in
  doctor) [[ "$#" -eq 0 ]] || fail "doctor accepts no arguments"; doctor ;;
  bootstrap) [[ "$#" -eq 0 ]] || fail "bootstrap accepts no arguments"; bootstrap ;;
  start) [[ "$#" -eq 0 ]] || fail "start accepts no arguments"; start ;;
  status) [[ "$#" -eq 0 ]] || fail "status accepts no arguments"; status ;;
  logs) logs "$@" ;;
  stop) [[ "$#" -eq 0 ]] || fail "stop accepts no arguments"; stop_services ;;
  reset-fabric) reset_environment fabric "$@" ;;
  reset-all) reset_environment all "$@" ;;
  help|-h|--help) [[ "$#" -eq 0 ]] || fail "help accepts no arguments"; usage ;;
  *) usage >&2; fail "Unknown command: ${command_name}" ;;
esac
