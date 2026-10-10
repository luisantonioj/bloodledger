#!/usr/bin/env bash
# Start, stop or inspect the V2 command worker inside the retained API container.
# Retained hosts run no worker by default, so UI commands stay QUEUED until one runs.
# A docker restart of the API container stops the worker; start it again afterwards.
set -euo pipefail
readonly api_container="${BLOODLEDGER_API_CONTAINER:-bloodledger-persistent-api}"
readonly postgres_container="${BLOODLEDGER_POSTGRES_CONTAINER:-bloodledger-postgres-1}"
readonly database="${POSTGRES_DB:-bloodledger_dev}"
readonly worker_log=/tmp/bloodledger-v2-worker.log

usage() { echo 'Usage: uat-worker.sh status | start [--confirm-pending] | stop' >&2; exit 2; }
fail() { echo "$1" >&2; exit 1; }
sql() { docker exec "$postgres_container" psql -U postgres -d "$database" -At -c "$1"; }
worker_pids() { docker exec "$api_container" sh -c "ps -o pid=,args= | awk '/worker-main\\.js/ && !/awk/ {print \$1}'"; }

require_api() {
  [[ "$(docker inspect --format '{{.State.Running}}' "$api_container" 2>/dev/null)" == true ]] ||
    fail "API_CONTAINER_NOT_RUNNING: start ${api_container} first"
}
pending_v2() { sql "SELECT COUNT(*) FROM app.v2_commands WHERE status NOT IN ('COMMITTED','FAILED','CONFLICT')"; }
pending_v1() { sql "SELECT COUNT(*) FROM app.scan_events WHERE status <> 'COMMITTED'"; }
writer_lock() { sql "SELECT COUNT(*) FROM app.operational_stock_runs WHERE writer_lock"; }

status() {
  require_api
  local pids
  pids="$(worker_pids)"
  if [[ -n "$pids" ]]; then printf 'worker: RUNNING (pid %s)\n' "${pids//$'\n'/ }"; else echo 'worker: STOPPED'; fi
  printf 'pending V2 commands: %s; pending V1 scans: %s; population writer lock: %s\n' "$(pending_v2)" "$(pending_v1)" "$(writer_lock)"
  sql "SELECT status, COUNT(*) FROM app.v2_commands GROUP BY status ORDER BY status" | sed 's/^/  v2 /'
}

start() {
  local confirm_pending=false
  [[ "${1:-}" == --confirm-pending ]] && confirm_pending=true
  require_api
  [[ -z "$(worker_pids)" ]] || fail 'WORKER_ALREADY_RUNNING'
  # The approved population runner owns every write while its lock is held.
  [[ "$(writer_lock)" == 0 ]] || fail 'POPULATION_WRITER_LOCK_ACTIVE: wait for the population run to release it'
  local v2 v1
  v2="$(pending_v2)"; v1="$(pending_v1)"
  if [[ "$v2" != 0 || "$v1" != 0 ]] && [[ "$confirm_pending" != true ]]; then
    fail "PENDING_COMMANDS_PRESENT: ${v2} V2 and ${v1} V1 would be submitted; review them, then rerun with --confirm-pending"
  fi
  docker exec -d "$api_container" sh -c "FABRIC_SYNC_ENABLED=true FABRIC_V2_SYNC_ENABLED=true exec node services/api/build/src/worker-main.js >>${worker_log} 2>&1"
  for _ in 1 2 3 4 5; do
    [[ -n "$(worker_pids)" ]] && { printf 'worker started; log %s:%s\n' "$api_container" "$worker_log"; return 0; }
    sleep 1
  done
  fail "WORKER_DID_NOT_START: inspect ${api_container}:${worker_log}"
}

stop() {
  require_api
  local pids
  pids="$(worker_pids)"
  [[ -n "$pids" ]] || { echo 'worker already stopped'; return 0; }
  # SIGTERM lets the loop finish its current command before exiting.
  docker exec "$api_container" kill -TERM $pids
  for _ in $(seq 1 30); do
    [[ -z "$(worker_pids)" ]] && { echo 'worker stopped'; return 0; }
    sleep 1
  done
  fail 'WORKER_DID_NOT_STOP: it is still finishing a command; check status again'
}

case "${1:-}" in
  status) [[ "$#" -eq 1 ]] || usage; status ;;
  start) [[ "$#" -le 2 ]] || usage; shift; start "$@" ;;
  stop) [[ "$#" -eq 1 ]] || usage; stop ;;
  *) usage ;;
esac
