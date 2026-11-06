#!/usr/bin/env bash
set -euo pipefail
source_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
temporary_root="$(mktemp -d)"
trap 'rm -rf -- "${temporary_root}"' EXIT
test_root="${temporary_root}/repo"
fake_bin="${temporary_root}/bin"
mkdir -p "${test_root}/scripts" "${test_root}/network/scripts" \
  "${test_root}/network/generated/channel-artifacts" \
  "${test_root}/network/health-contract/build" "${fake_bin}"
cp "${source_root}/scripts/bloodledger-dev.sh" "${test_root}/scripts/"

cat >"${test_root}/.env" <<'ENV'
COMPOSE_PROJECT_NAME=bloodledger
FABRIC_CHANNEL_NAME=bloodledger-dev
MEDIATRIX_MSP_ID=MediatrixMSP
ORDERER_MSP_ID=OrdererMSP
FABRIC_PEER_ENDPOINT=peer0-mediatrix:7051
FABRIC_ORDERER_ENDPOINT=orderer0:7050
FABRIC_HEALTH_CHAINCODE_NAME=bloodledger-health
MEDIATRIX_CA_ADMIN_PASSWORD=synthetic-test-only-ca
ORDERER_CA_ADMIN_PASSWORD=synthetic-test-only-orderer
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=bloodledger_dev
POSTGRES_ADMIN_USER=postgres
POSTGRES_ADMIN_PASSWORD=synthetic-test-only-admin
POSTGRES_MIGRATOR_USER=bloodledger_migrator
POSTGRES_MIGRATOR_PASSWORD=synthetic-test-only-migrator
POSTGRES_APP_USER=bloodledger_app
POSTGRES_APP_PASSWORD=synthetic-test-only-app
POSTGRES_HOST_PORT=5432
ENV

cat >"${fake_bin}/docker" <<'DOCKER'
#!/usr/bin/env bash
set -euo pipefail
[[ -n "${FAKE_DOCKER_LOG:-}" ]] && printf '%s\n' "$*" >>"${FAKE_DOCKER_LOG}"
if [[ "${FAKE_DOCKER_DOWN:-}" == 1 && "${1:-}" == info ]]; then exit 1; fi
if [[ "${1:-}" == info ]]; then exit 0; fi
if [[ "${1:-}" == version ]]; then echo '29.6.1'; exit 0; fi
if [[ "${1:-}" == ps ]]; then exit 0; fi
if [[ "${1:-}" == network && "${2:-}" == inspect ]]; then exit 1; fi
if [[ "${1:-}" == container && "${2:-}" == rm ]]; then exit 0; fi
if [[ "${1:-}" == start ]]; then
  # FAKE_PEER_START_FAILURES socket-mount failures precede a successful start.
  attempts_file="${FAKE_STATE_DIR}/peer-start-attempts"
  attempts=$(($(cat "${attempts_file}" 2>/dev/null || echo 0) + 1))
  echo "${attempts}" >"${attempts_file}"
  ((attempts > ${FAKE_PEER_START_FAILURES:-0})) || exit 1
  touch "${FAKE_STATE_DIR}/peer-started"
  exit 0
fi
if [[ "${1:-}" == volume ]]; then
  case "${2:-}" in
    ls)
      if [[ "${FAKE_VOLUMES:-}" == 1 && "$*" =~ com.docker.compose.volume=([^[:space:]]+) ]]; then
        echo "bloodledger_${BASH_REMATCH[1]}"
      fi
      exit 0
      ;;
    inspect)
      if [[ "$*" == *com.docker.compose.volume* ]]; then
        echo "${*: -1}" | sed 's/^bloodledger_//'
      else
        echo bloodledger
      fi
      exit 0
      ;;
    rm) exit 0 ;;
  esac
fi
if [[ "${1:-}" == inspect ]]; then
  if [[ "$*" == *com.docker.compose.project* ]]; then
    [[ "${FAKE_UNRELATED:-}" == 1 ]] && echo unrelated || echo bloodledger
  elif [[ "$*" == *com.docker.compose.service* ]]; then
    if [[ "${FAKE_UNRELATED:-}" == 1 ]]; then
      echo unrelated-service
    else
      echo "${*: -1}" | sed 's/^fake-//'
    fi
  elif [[ "$*" == *State.Running* ]]; then
    if [[ -n "${FAKE_PEER_STOPPED_ERROR+set}${FAKE_PEER_SOCKET_STALE:-}" && ! -e "${FAKE_STATE_DIR}/peer-started" ]]; then
      echo false
    else
      echo true
    fi
  elif [[ "$*" == *State.Error* ]]; then
    if [[ -n "${FAKE_PEER_STOPPED_ERROR+set}" ]]; then
      echo "${FAKE_PEER_STOPPED_ERROR}"
    elif [[ "${FAKE_PEER_SOCKET_STALE:-}" == 1 ]]; then
      echo 'error mounting "/run/desktop/docker.sock" to rootfs at "/var/run/docker.sock"'
    else
      echo ''
    fi
  elif [[ "$*" == *State.Status* ]]; then
    echo running
  elif [[ "$*" == *State.Health* ]]; then
    echo "${FAKE_UNHEALTHY:-healthy}"
  else
    echo healthy
  fi
  exit 0
fi
if [[ "${1:-}" == compose && "${2:-}" == version ]]; then echo '5.3.0'; exit 0; fi
if [[ "${1:-}" == compose ]]; then
  shift
  while (($#)); do
    case "$1" in
      --project-name|--env-file) shift 2 ;;
      *) break ;;
    esac
  done
  case "${1:-}" in
    config)
      if [[ "${FAKE_INVALID_COMPOSE:-}" == 1 ]]; then exit 1; fi
      if [[ "${2:-}" == --services ]]; then
        printf '%s\n' ca-mediatrix ca-orderer orderer0 peer0-mediatrix postgres
      elif [[ "${2:-}" == --images ]]; then
        printf '%s\n' hyperledger/fabric-ca:1.5.15 hyperledger/fabric-orderer:2.5.16 \
          hyperledger/fabric-peer:2.5.16 postgres:17.10
      fi
      ;;
    ps)
      service="${*: -1}"
      [[ "${FAKE_PEER_ABSENT:-}" == 1 && "${service}" == peer0-mediatrix ]] || echo "fake-${service}"
      ;;
    exec)
      [[ "$*" == *'SELECT current_database()'* ]] && echo bloodledger_dev
      ;;
    logs|down|rm|up) exit 0 ;;
  esac
  exit 0
fi
exit 0
DOCKER
chmod +x "${fake_bin}/docker"

cat >"${fake_bin}/npm" <<'NPM'
#!/usr/bin/env bash
exit "${FAKE_NPM_FAILURE:-0}"
NPM
cat >"${fake_bin}/node" <<'NODE'
#!/usr/bin/env bash
exit 0
NODE
cat >"${fake_bin}/ss" <<'SS'
#!/usr/bin/env bash
exit 0
SS
chmod +x "${fake_bin}/node" "${fake_bin}/npm" "${fake_bin}/ss"

for script in validate-nodes.sh query-channel.sh query-health-contract.sh; do
  cat >"${test_root}/network/scripts/${script}" <<'COMPONENT'
#!/usr/bin/env bash
case "$(basename "$0")" in
  query-channel.sh) exit "${FAKE_CHANNEL_FAILURE:-0}" ;;
  query-health-contract.sh) exit "${FAKE_HEALTH_FAILURE:-0}" ;;
  *) exit 0 ;;
esac
COMPONENT
  chmod +x "${test_root}/network/scripts/${script}"
done

fake_state_dir="${temporary_root}/state"
mkdir -p "${fake_state_dir}"
fake_socket="${temporary_root}/docker.sock"
python3 -c 'import socket, sys; socket.socket(socket.AF_UNIX).bind(sys.argv[1])' "${fake_socket}"

run_command() {
  PATH="${fake_bin}:${PATH}" FAKE_STATE_DIR="${fake_state_dir}" \
    BLOODLEDGER_DOCKER_SOCKET="${BLOODLEDGER_DOCKER_SOCKET:-${fake_socket}}" \
    BLOODLEDGER_PEER_RETRY_SECONDS=0 BLOODLEDGER_DOCKER_WAIT_SECONDS="${BLOODLEDGER_DOCKER_WAIT_SECONDS:-0}" \
    "${test_root}/scripts/bloodledger-dev.sh" "$@"
}

reset_fake_peer() {
  rm -f "${fake_state_dir}/peer-start-attempts" "${fake_state_dir}/peer-started" "${docker_log}"
}

expect_failure() {
  local expected="$1"
  shift
  local output
  if output="$(run_command "$@" 2>&1)"; then
    echo "Expected failure for: $*" >&2
    exit 1
  fi
  grep -Fq "${expected}" <<<"${output}" || {
    echo "Failure did not include expected text: ${expected}" >&2
    echo "${output}" >&2
    exit 1
  }
}

(cd /tmp && run_command help | grep -Fq 'Usage: scripts/bloodledger-dev.sh')
expect_failure 'Unknown command' unknown

mv "${test_root}/.env" "${test_root}/.env.saved"
expect_failure 'Untracked .env is missing' stop
mv "${test_root}/.env.saved" "${test_root}/.env"
sed -i 's/^POSTGRES_APP_PASSWORD=.*/POSTGRES_APP_PASSWORD=/' "${test_root}/.env"
secret_output="$(run_command stop 2>&1 || true)"
grep -Fq 'required local secret value is empty' <<<"${secret_output}"
! grep -Fq 'synthetic-test-only-admin' <<<"${secret_output}"
sed -i 's/^POSTGRES_APP_PASSWORD=.*/POSTGRES_APP_PASSWORD=synthetic-test-only-app/' "${test_root}/.env"

FAKE_DOCKER_DOWN=1 expect_failure 'Docker is unavailable' stop
FAKE_INVALID_COMPOSE=1 expect_failure 'Compose configuration is invalid' stop
expect_failure 'Unknown BloodLedger service' logs unrelated-service

expect_failure 'Level 1 reset requires' reset-fabric
docker_log="${temporary_root}/docker.log"
FAKE_DOCKER_LOG="${docker_log}" expect_failure 'Level 1 reset requires' reset-fabric --confirm WRONG
! grep -Fq 'container rm' "${docker_log}"
run_command reset-fabric --dry-run | grep -Fq 'Dry run complete'
grep -Fq 'synthetic-test-only-admin' "${test_root}/.env"
mkdir -p "${test_root}/network/generated/preserved-test" "${test_root}/network/health-contract/build/preserved-test"
run_command reset-fabric --confirm RESET_BLOODLEDGER_FABRIC >/dev/null
[[ -f "${test_root}/.env" && ! -e "${test_root}/network/generated/preserved-test" ]]

mkdir -p "${test_root}/network/generated" "${test_root}/network/health-contract/build"
expect_failure 'Level 2 reset requires' reset-all
expect_failure 'Level 2 reset requires' reset-all --confirm RESET_BLOODLEDGER
FAKE_VOLUMES=1 run_command reset-all --dry-run | grep -Fq 'PostgreSQL volume: bloodledger_postgres-data'

rm -rf "${test_root}/network/generated"
outside="${temporary_root}/outside"
mkdir -p "${outside}"
ln -s "${outside}" "${test_root}/network/generated"
expect_failure 'traversal or a symlink' reset-fabric --dry-run
rm "${test_root}/network/generated"
mkdir -p "${test_root}/network/generated/channel-artifacts"

touch "${test_root}/network/generated/.identity-bootstrap-complete" \
  "${test_root}/network/generated/channel-artifacts/bloodledger-dev.block" \
  "${test_root}/network/health-contract/build/package-id.txt"
run_command start | grep -Fq 'BloodLedger development infrastructure is healthy'
docker_log="${temporary_root}/docker.log"
FAKE_DOCKER_LOG="${docker_log}" run_command start >/dev/null
if grep -Fq -- '--force-recreate' "${docker_log}"; then
  echo "A healthy peer must not be recreated" >&2
  exit 1
fi
# Boot race: the socket mount fails until WSL integration is ready, then a
# plain start succeeds and the peer is not recreated.
reset_fake_peer
race_start="$(FAKE_PEER_SOCKET_STALE=1 FAKE_PEER_START_FAILURES=2 FAKE_DOCKER_LOG="${docker_log}" run_command start)"
grep -Fq 'started on attempt 3' <<<"${race_start}"
grep -Fq 'BloodLedger development infrastructure is healthy' <<<"${race_start}"
[[ "$(grep -c '^start fake-peer0-mediatrix$' "${docker_log}")" == 3 ]]
! grep -Fq -- '--force-recreate' "${docker_log}"
# Moved bind path: every plain start fails, so only the peer is recreated.
reset_fake_peer
stale_start="$(FAKE_PEER_SOCKET_STALE=1 FAKE_PEER_START_FAILURES=99 FAKE_DOCKER_LOG="${docker_log}" \
  BLOODLEDGER_PEER_START_ATTEMPTS=3 run_command start)"
grep -Fq 'stale Docker socket mount' <<<"${stale_start}"
grep -Fq 'BloodLedger development infrastructure is healthy' <<<"${stale_start}"
[[ "$(grep -c '^start fake-peer0-mediatrix$' "${docker_log}")" == 3 ]]
grep -Eq -- ' up --detach --wait --no-deps --force-recreate peer0-mediatrix$' "${docker_log}"
[[ "$(grep -c -- '--force-recreate' "${docker_log}")" == 1 ]]

# recover-peer: no-op when running, never touches a deliberately stopped peer,
# never deletes volumes, and waits for the socket and engine.
reset_fake_peer
noop="$(FAKE_DOCKER_LOG="${docker_log}" run_command recover-peer)"
grep -Fq 'already running; nothing changed' <<<"${noop}"
reset_fake_peer
stopped="$(FAKE_PEER_STOPPED_ERROR='' FAKE_DOCKER_LOG="${docker_log}" run_command recover-peer)"
grep -Fq 'without a Docker socket mount failure; left unchanged' <<<"${stopped}"
! grep -Eq '^start |--force-recreate' "${docker_log}"
reset_fake_peer
recovered="$(FAKE_PEER_SOCKET_STALE=1 FAKE_PEER_START_FAILURES=1 FAKE_DOCKER_LOG="${docker_log}" run_command recover-peer)"
grep -Fq 'started on attempt 2' <<<"${recovered}"
grep -Fq 'peer0-mediatrix: healthy' <<<"${recovered}"
! grep -Eq 'volume rm|container rm| down|--force-recreate' "${docker_log}"
[[ "$(grep -c '^start ' "${docker_log}")" == 2 ]]
reset_fake_peer
other="$(FAKE_PEER_STOPPED_ERROR='exec: "peer": executable file not found' run_command recover-peer)"
grep -Fq 'left unchanged' <<<"${other}"
BLOODLEDGER_DOCKER_SOCKET="${temporary_root}/absent.sock" expect_failure 'was not ready after 0s' recover-peer
FAKE_DOCKER_DOWN=1 expect_failure 'was not ready after 0s' recover-peer
FAKE_UNHEALTHY=starting BLOODLEDGER_PEER_HEALTH_WAIT_SECONDS=0 expect_failure 'peer0-mediatrix: starting after 0s' recover-peer
expect_failure 'recover-peer accepts no arguments' recover-peer extra
absent="$(FAKE_PEER_ABSENT=1 run_command recover-peer)"
grep -Fq 'container is absent' <<<"${absent}"
FAKE_UNHEALTHY=unhealthy expect_failure 'ca-mediatrix: unhealthy' status
FAKE_CHANNEL_FAILURE=1 expect_failure 'Channel membership' status
FAKE_HEALTH_FAILURE=1 expect_failure 'Health contract lifecycle' status

touch "${test_root}/network/generated/stop-preserved" "${test_root}/network/health-contract/build/stop-preserved"
run_command stop | grep -Fq 'preserved'
[[ -f "${test_root}/.env" && -f "${test_root}/network/generated/stop-preserved" ]]

FAKE_UNRELATED=1 \
  expect_failure 'not owned by project bloodledger' reset-fabric --dry-run

echo "Operational help, failure, health, peer socket recovery, stop, reset-intent, preview, preservation, and path-safety behavior passed"
