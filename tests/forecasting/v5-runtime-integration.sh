#!/usr/bin/env bash
# FR-14 / BR-ALG-07: isolated V5 producer, migration, replay and scope evidence.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
repository_root="$PWD"
model_path="${BLOODLEDGER_V5_MODEL_TEST_PATH:-}"
if [[ -z "$model_path" || ! -f "$model_path" ]]; then
  echo 'Set BLOODLEDGER_V5_MODEL_TEST_PATH to the external selected_model.json' >&2
  exit 2
fi
probe_root="$(mktemp -d)"
probe_container="bloodledger-v5-forecast-check-$$"
created=false
cleanup() {
  if [[ "$created" == true ]]; then docker rm --force "$probe_container" >/dev/null; fi
  rm -rf -- "$probe_root"
}
trap cleanup EXIT
python3 - "$probe_root/env" "$probe_root/binding.json" "$probe_root/binding-hash" <<'PY'
import hashlib, json, os, secrets, sys
values = {
  'POSTGRES_USER': 'postgres', 'POSTGRES_DB': 'bloodledger_dev',
  'POSTGRES_MIGRATOR_USER': 'bloodledger_migrator', 'POSTGRES_APP_USER': 'bloodledger_app',
  'POSTGRES_HOST': '127.0.0.1', 'POSTGRES_PORT': '5432', 'POSTGRES_HOST_PORT': '5432',
}
for key in ('POSTGRES_PASSWORD', 'POSTGRES_MIGRATOR_PASSWORD', 'POSTGRES_APP_PASSWORD'):
    values[key] = secrets.token_hex(24)
with open(sys.argv[1], 'w') as stream:
    stream.write('\n'.join(f'{key}={value}' for key, value in values.items())+'\n')
os.chmod(sys.argv[1], 0o600)
binding = {
  'schemaVersion': 'SYNTHETIC_V5_INSTITUTION_BINDING_V1',
  'bindingId': 'V5_BIND_ISOLATED_TEST', 'researchInstitutionId': 'SIM_INSTITUTION_01',
  'institutionId': 'INST_MEDIATRIX',
  'modelSha256': 'ceb0e74b2eb2f8af7fcafabb3619f2a23681c38eac65998816e7daf40b5afb86',
  'enabled': True,
}
with open(sys.argv[2], 'w') as stream:
    json.dump(binding, stream)
with open(sys.argv[3], 'w') as stream:
    stream.write(hashlib.sha256(json.dumps(binding, sort_keys=True, separators=(',', ':')).encode()).hexdigest())
PY
docker run --detach --name "$probe_container" --env-file "$probe_root/env" \
  -v "$repository_root/database/bootstrap:/docker-entrypoint-initdb.d:ro" postgres:17.10 >/dev/null
created=true
for attempt in {1..40}; do
  if docker exec "$probe_container" psql -U postgres -d bloodledger_dev -Atc "SELECT 1 FROM pg_roles WHERE rolname='bloodledger_app'" 2>/dev/null | grep -qx 1; then break; fi
  sleep 1
done
node_run=(docker run --rm --network "container:$probe_container" --env-file "$probe_root/env" \
  --user "$(id -u):$(id -g)" -v "$repository_root:/workspace" -w /workspace \
  --entrypoint node node:24.17.0-bookworm-slim)
node_v4_run=(docker run --rm --network "container:$probe_container" --env-file "$probe_root/env" \
  --env BLOODLEDGER_MIGRATION_COUNT=21 --user "$(id -u):$(id -g)" \
  -v "$repository_root:/workspace" -w /workspace --entrypoint node node:24.17.0-bookworm-slim)
"${node_v4_run[@]}" database/scripts/migrate.mjs | tail -1
docker exec "$probe_container" psql -U postgres -d bloodledger_dev -c \
  "INSERT INTO app.forecast_runs (run_id,institution_id,run_key,payload_sha256,dataset_version,generator_version,dataset_sha256,code_sha256,config_sha256,model_artifact_sha256,model_version,model_name,target_name,input_start_date,input_end_date,horizon_date,generated_at,classification,run_status,safe_error_code,lineage,selection_evidence) VALUES ('RUN_$(printf 'A%.0s' {1..32})','INST_MEDIATRIX','V4_UPGRADE_FIXTURE','$(printf 'a%.0s' {1..64})','SYNTHETIC_FORECAST_V4_RUNTIME_V1','runtime_v4','$(printf 'b%.0s' {1..64})','$(printf 'c%.0s' {1..64})','$(printf 'd%.0s' {1..64})','$(printf 'e%.0s' {1..64})','synthetic-v4-upgrade','synthetic_v4','requested_units','2026-09-28','2026-09-28','2026-09-29','2026-09-28T12:00:00.000Z','SIMULATION_ONLY','UNAVAILABLE','TEST_UNAVAILABLE','{}','{}')" >/dev/null
"${node_run[@]}" database/scripts/migrate.mjs | tail -1
docker exec "$probe_container" psql -U postgres -d bloodledger_dev -Atc \
  "SELECT dataset_version || ':' || run_status FROM app.forecast_runs WHERE run_key='V4_UPGRADE_FIXTURE'" \
  | grep -Fx 'SYNTHETIC_FORECAST_V4_RUNTIME_V1:UNAVAILABLE'
docker exec --interactive "$probe_container" psql -U postgres -d bloodledger_dev < "$repository_root/tests/forecasting/v4-verification-fixture.sql" >/dev/null
docker exec "$probe_container" psql -U postgres -d bloodledger_dev -c \
  "UPDATE app.v2_components SET expires_at='2026-10-31T00:00:00.000Z' WHERE component_id LIKE 'COMP_VERIFY_%'" >/dev/null
forecast_run=(docker run --rm --network "container:$probe_container" --env-file "$probe_root/env" \
  --env "BLOODLEDGER_V5_APPROVED_BINDING_SHA256=$(cat "$probe_root/binding-hash")" \
  --user "$(id -u):$(id -g)" -v "$repository_root/services/forecasting:/workspace/repository:ro" \
  -v "$probe_root:/workspace/tmp" -v "$model_path:/workspace/model.json:ro" \
  -w /workspace/repository -e PYTHONPATH=src --entrypoint python bloodledger-forecasting:latest)
for hour in 12 13; do
  "${forecast_run[@]}" -m bloodledger_forecasting.runtime_v5_cli \
    --model /workspace/model.json --binding /workspace/tmp/binding.json \
    --institution-id INST_MEDIATRIX --request-id V5_REQ_ISOLATED \
    --origin-date 2026-09-28 --generated-at "2026-09-28T${hour}:00:00.000Z" \
    --output "/workspace/tmp/forecast-${hour}.json" --persist
 done
cmp "$probe_root/forecast-12.json" "$probe_root/forecast-13.json"
"${forecast_run[@]}" -m bloodledger_forecasting.runtime_v5_cli \
  --model /workspace/model.json --binding /workspace/tmp/binding.json \
  --institution-id INST_MEDIATRIX --request-id V5_REQ_CURRENT \
  --origin-date 2026-09-29 --generated-at 2026-09-29T12:00:00.000Z \
  --output /workspace/tmp/current.json --persist
"${forecast_run[@]}" -m bloodledger_forecasting.runtime_v5_cli \
  --model /workspace/tmp/missing.json --binding /workspace/tmp/binding.json \
  --institution-id INST_MEDIATRIX --request-id V5_REQ_UNAVAILABLE \
  --origin-date 2026-09-28 --generated-at 2026-09-28T14:00:00.000Z \
  --output /workspace/tmp/unavailable.json --persist
# The same idempotency key with a changed origin must not overwrite the saved run.
if "${forecast_run[@]}" -m bloodledger_forecasting.runtime_v5_cli \
  --model /workspace/model.json --binding /workspace/tmp/binding.json \
  --institution-id INST_MEDIATRIX --request-id V5_REQ_ISOLATED \
  --origin-date 2026-09-27 --generated-at 2026-09-28T15:00:00.000Z \
  --output /workspace/tmp/conflict.json --persist >"$probe_root/conflict.stdout" 2>"$probe_root/conflict.stderr"; then
  echo 'Expected V5 idempotency conflict' >&2
  exit 1
fi
grep -F 'FORECAST_RUN_CONFLICT' "$probe_root/conflict.stderr" >/dev/null
python3 - "$probe_root/forecast-12.json" "$probe_root/unavailable.json" <<'PY'
import json, sys
available, unavailable = [json.load(open(path)) for path in sys.argv[1:]]
assert len(available['forecasts']) == 20
assert available['run']['runStatus'] == 'COMPLETED'
assert unavailable['run']['runStatus'] == 'UNAVAILABLE'
assert unavailable['forecasts'] == []
PY
docker exec "$probe_container" psql -U postgres -d bloodledger_dev -Atc \
  "SELECT run_status || ':' || count(*) FROM app.forecast_runs WHERE dataset_version='SYNTHETIC_FORECAST_V5_RUNTIME_V1' GROUP BY run_status ORDER BY run_status" \
  | grep -Fx 'COMPLETED:2'
docker exec "$probe_container" psql -U postgres -d bloodledger_dev -Atc \
  "SELECT count(*) FROM app.demand_forecasts WHERE institution_id='INST_MEDIATRIX'" \
  | grep -Fx '40'
docker exec "$probe_container" psql -U postgres -d bloodledger_dev -Atc \
  "SELECT has_table_privilege('bloodledger_app','app.forecast_runs','UPDATE')::text || ':' || has_table_privilege('bloodledger_app','app.demand_forecasts','DELETE')::text" \
  | grep -Fx 'false:false'
"${node_run[@]}" node_modules/typescript/bin/tsc -p services/api/tsconfig.json
"${node_run[@]}" node_modules/typescript/bin/tsc -p services/coordination/tsconfig.json
"${node_run[@]}" tests/forecasting/v5-api-probe.mjs
"${node_run[@]}" tests/forecasting/v5-coordination-probe.mjs
echo 'V5 isolated database persistence passed'
