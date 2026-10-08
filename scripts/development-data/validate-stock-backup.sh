#!/usr/bin/env bash
# TP-STOCK-01 / NFR-02: restore a private archive only into disposable storage.
set -euo pipefail
backup="${1:-}"
[[ -f "$backup" && "$(stat -c %a "$backup")" == 600 ]] || { echo STOCK_PRIVATE_BACKUP_REQUIRED >&2; exit 2; }
container="bloodledger-stock-backup-test-$$"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$container" --network none --tmpfs /var/lib/postgresql/data \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=bloodledger_backup_test postgres:17.10 >/dev/null
for ((i=0;i<30;i++)); do
  if docker exec "$container" pg_isready -U postgres -d bloodledger_backup_test >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec -i "$container" pg_restore --list < "$backup" >/dev/null
docker exec -i "$container" pg_restore --exit-on-error --no-owner --no-acl --username postgres --dbname bloodledger_backup_test < "$backup" >/dev/null
result="$(docker exec "$container" psql -U postgres -d bloodledger_backup_test -Atc "SELECT (SELECT count(*) FROM app.application_users WHERE account_kind='PRIMARY' AND status='ACTIVE')=6 AND (SELECT count(*) FROM app.v2_components)=9 AND (SELECT count(*) FROM app.synthetic_inventory_completed_units)=522")"
[[ "$result" == t ]] || { echo STOCK_BACKUP_REVIEWED_BASELINE_MISMATCH >&2; exit 2; }
sha256sum "$backup" | cut -d ' ' -f1
docker exec "$container" psql -U postgres -d bloodledger_backup_test -Atc 'SELECT instance_id FROM app.development_target_identity WHERE singleton'
