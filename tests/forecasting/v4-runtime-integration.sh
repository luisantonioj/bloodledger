#!/usr/bin/env bash
# BL-ML-05: accepted runtime compatibility, separate from frozen v4 scores.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
root="$PWD"
probe_root="$(mktemp -d)"
probe_container="bloodledger-v4-forecast-check-$$"
created=false
cleanup() {
  if [[ "$created" == true ]]; then docker rm --force "$probe_container" >/dev/null; fi
  rm -rf -- "$probe_root"
}
trap cleanup EXIT
python3 - "$probe_root/env" <<'PY'
import os, secrets, sys
values = {'POSTGRES_USER':'postgres', 'POSTGRES_DB':'bloodledger_dev',
          'POSTGRES_MIGRATOR_USER':'bloodledger_migrator', 'POSTGRES_APP_USER':'bloodledger_app',
          'POSTGRES_HOST':'127.0.0.1', 'POSTGRES_PORT':'5432'}
for key in ('POSTGRES_PASSWORD','POSTGRES_MIGRATOR_PASSWORD','POSTGRES_APP_PASSWORD'):
    values[key] = secrets.token_hex(24)
with open(sys.argv[1], 'w') as f:
    f.write('\n'.join(f'{k}={v}' for k,v in values.items())+'\n')
os.chmod(sys.argv[1], 0o600)
PY
docker run --detach --name "$probe_container" --env-file "$probe_root/env" \
  -v "$root/database/bootstrap:/docker-entrypoint-initdb.d:ro" postgres:17.10 >/dev/null
created=true
for attempt in {1..40}; do
  if docker exec "$probe_container" pg_isready -U postgres -d bloodledger_dev >/dev/null 2>&1; then break; fi
  sleep 1
done
# Readiness can briefly be true during initialization; require the app role too.
for attempt in {1..40}; do
  if docker exec "$probe_container" psql -U postgres -d bloodledger_dev -Atc "SELECT 1 FROM pg_roles WHERE rolname='bloodledger_app'" 2>/dev/null | grep -qx 1; then break; fi
  sleep 1
done
node_run=(docker run --rm --network "container:$probe_container" --env-file "$probe_root/env" \
  --user "$(id -u):$(id -g)" -v "$root:/workspace" -w /workspace node:24.17.0-bookworm-slim)
"${node_run[@]}" npm run migrate:up
upgrade_database="bloodledger_v4_upgrade"
docker exec "$probe_container" psql -U postgres -d postgres -c "CREATE DATABASE $upgrade_database OWNER bloodledger_migrator" >/dev/null
upgrade_node_run=(docker run --rm --network "container:$probe_container" --env-file "$probe_root/env" \
  --env "POSTGRES_DB=$upgrade_database" --env BLOODLEDGER_MIGRATION_COUNT=10 \
  --user "$(id -u):$(id -g)" -v "$root:/workspace" -w /workspace node:24.17.0-bookworm-slim)
"${upgrade_node_run[@]}" npm run migrate:up
upgrade_full_run=(docker run --rm --network "container:$probe_container" --env-file "$probe_root/env" \
  --env "POSTGRES_DB=$upgrade_database" --user "$(id -u):$(id -g)" \
  -v "$root:/workspace" -w /workspace node:24.17.0-bookworm-slim)
"${upgrade_full_run[@]}" npm run migrate:up
docker exec "$probe_container" psql -U postgres -d "$upgrade_database" -Atc \
  "SELECT count(*) FROM public.pgmigrations" | grep --fixed-strings '20' >/dev/null
"${node_run[@]}" npm run build --workspace @bloodledger/api
"${node_run[@]}" npm run build --workspace @bloodledger/coordination
docker exec --interactive "$probe_container" psql -U postgres -d bloodledger_dev < "$root/tests/forecasting/v4-verification-fixture.sql"
forecast_image="$probe_container-forecasting"
docker build --tag "$forecast_image" "$root/services/forecasting" >/dev/null
forecast_run=(docker run --rm --network "container:$probe_container" --env-file "$probe_root/env" \
  --user "$(id -u):$(id -g)" -v "$root/services/forecasting:/research:ro" \
  -v "$probe_root:/outputs" -w /research -e PYTHONPATH=src --entrypoint python "$forecast_image")
"${forecast_run[@]}" -m bloodledger_forecasting.cli generate-synthetic --output /outputs/data.csv >/dev/null
"${forecast_run[@]}" -m bloodledger_forecasting.cli train --data /outputs/data.csv \
  --artifact /outputs/model.pkl --manifest /outputs/model.json --generated-at 2026-01-01T00:00:00Z
for hour in 00 01; do
  "${forecast_run[@]}" -m bloodledger_forecasting.cli forecast --data /outputs/data.csv \
    --artifact /outputs/model.pkl --manifest /outputs/model.json --output /outputs/bundle.json \
    --generated-at "2026-01-01T${hour}:00:00Z" --persist > "$probe_root/persist-$hour.json"
done
python3 - "$probe_root/v4.csv" <<'PY'
import csv, sys
from datetime import date, timedelta
blood_types = ('A_POSITIVE', 'B_POSITIVE', 'AB_POSITIVE', 'O_POSITIVE')
components = ('PACKED_RED_BLOOD_CELLS', 'PLATELETS', 'FRESH_FROZEN_PLASMA', 'CRYOPRECIPITATE', 'WHOLE_BLOOD')
with open(sys.argv[1], 'w', newline='') as stream:
    writer = csv.DictWriter(stream, fieldnames=('business_date','blood_type','component','requested_units'))
    writer.writeheader()
    for offset in range(7):
        for blood_index, blood_type in enumerate(blood_types):
            for component_index, component in enumerate(components):
                writer.writerow({'business_date': date(2026, 1, 1) + timedelta(days=offset), 'blood_type': blood_type, 'component': component, 'requested_units': offset + blood_index + component_index})
PY
"${forecast_run[@]}" -m bloodledger_forecasting.cli forecast-v4-runtime --data /outputs/v4.csv \
  --output /outputs/v4-bundle.json --generated-at 2026-01-08T00:00:00Z --persist > "$probe_root/v4-persist.json"
python3 - "$probe_root" <<'PY'
import json, pathlib, sys
p=pathlib.Path(sys.argv[1])
assert json.loads((p/'persist-00.json').read_text())['persistence']=='INSERTED'
assert json.loads((p/'persist-01.json').read_text())['persistence']=='EXISTING'
assert json.loads((p/'v4-persist.json').read_text())['persistence']=='INSERTED'
print('Runtime persistence: INSERTED then EXISTING')
PY
"${forecast_run[@]}" tests/postgres_conflict_probe.py /outputs/bundle.json
"${node_run[@]}" npm run build --workspace @bloodledger/coordination
"${node_run[@]}" node tests/forecasting/v4-independent-verification.mjs
"${node_run[@]}" node tests/forecasting/v2-projection-integration.mjs
