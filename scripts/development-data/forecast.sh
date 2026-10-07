#!/usr/bin/env bash
# FR-14 / BR-ALG-07: retained-target V5 preview, no activation or retraining.
set -euo pipefail
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "$repository_root"
action="${1:-preview}"; shift || true
config=""; model=""; job=""; output=""; request_id=""; approve_binding=""; approve_job=""
while (($#)); do
  (($# >= 2)) || { echo FORECAST_ARGUMENT_INVALID >&2; exit 2; }
  case "$1" in
    --config) config="$2";; --model) model="$2";; --job) job="$2";; --output) output="$2";;
    --request-id) request_id="$2";; --approve-binding) approve_binding="$2";; --approve-job) approve_job="$2";;
    *) echo FORECAST_ARGUMENT_INVALID >&2; exit 2;;
  esac
  shift 2
done
[[ "$action" == preview || "$action" == apply ]] || { echo FORECAST_ACTION_INVALID >&2; exit 2; }
umask 077
inspection="$(mktemp /tmp/bloodledger-persistent-target.XXXXXX)"
trap 'rm -f -- "$inspection"' EXIT
bash scripts/development-data/run.sh inspect --config "$config" > "$inspection"
if [[ "$action" == preview ]]; then
  python3 - "$config" "$inspection" "$model" "$job" "$request_id" <<'PY'
import datetime as dt, hashlib, json, pathlib, re, sys
config=json.loads(pathlib.Path(sys.argv[1]).read_text()); target=json.loads(pathlib.Path(sys.argv[2]).read_text());model=pathlib.Path(sys.argv[3]).resolve();dest=pathlib.Path(sys.argv[4]).resolve();request_id=sys.argv[5]
assert config.get('targetSha256')==target['targetSha256'], 'FORECAST_TARGET_MISMATCH'
assert hashlib.sha256(model.read_bytes()).hexdigest()=='1e0f0c240109e49e8f1a89a713021afae07c2f5fae5b0e2bc8e3904610fb9764', 'FORECAST_PINNED_MODEL_REQUIRED'
assert re.fullmatch(r'[A-Z][A-Z0-9_-]{0,63}',request_id), 'FORECAST_REQUEST_ID_INVALID'
assert 'build' in dest.parts or not dest.is_relative_to(pathlib.Path.cwd()), 'FORECAST_PRIVATE_OUTPUT_REQUIRED'
binding={'schemaVersion':'SYNTHETIC_V5_INSTITUTION_BINDING_V1','bindingId':'V5_BIND_PERSISTENT_DEVELOPMENT','researchInstitutionId':'SIM_INSTITUTION_01','institutionId':'INST_MEDIATRIX','modelSha256':'ceb0e74b2eb2f8af7fcafabb3619f2a23681c38eac65998816e7daf40b5afb86','enabled':True}
canonical=lambda value:json.dumps(value,sort_keys=True,separators=(',',':'))
now=dt.datetime.now(dt.UTC);manila=now+dt.timedelta(hours=8)
job={'classification':'SIMULATION_ONLY','scope':'PERSISTENT_LOCAL_DEVELOPMENT','targetSha256':target['targetSha256'],'model':str(model),'binding':binding,'bindingSha256':hashlib.sha256(canonical(binding).encode()).hexdigest(),'requestId':request_id,'originDate':str(manila.date()-dt.timedelta(days=1)),'generatedAt':now.isoformat(timespec='milliseconds').replace('+00:00','Z')}
job['jobSha256']=hashlib.sha256(canonical(job).encode()).hexdigest()
with dest.open('x') as stream:stream.write(canonical(job)+'\n')
dest.chmod(0o600)
print(json.dumps({'jobSha256':job['jobSha256'],'bindingSha256':job['bindingSha256'],'originDate':job['originDate'],'generatedAt':job['generatedAt'],'classification':'SIMULATION_ONLY'}))
PY
else
  # Validate all approvals before creating the runtime binding or touching forecasts.
  runtime_dir="$(mktemp -d "$repository_root/build/persistent-forecast.XXXXXX")"
  python3 - "$job" "$inspection" "$approve_job" "$approve_binding" "$runtime_dir" <<'PY'
import hashlib,json,pathlib,sys
job=json.loads(pathlib.Path(sys.argv[1]).read_text());target=json.loads(pathlib.Path(sys.argv[2]).read_text());expected=job.pop('jobSha256')
canonical=lambda v:json.dumps(v,sort_keys=True,separators=(',',':'))
assert expected==sys.argv[3]==hashlib.sha256(canonical(job).encode()).hexdigest(), 'FORECAST_JOB_APPROVAL_REQUIRED'
assert job['bindingSha256']==sys.argv[4]==hashlib.sha256(canonical(job['binding']).encode()).hexdigest(), 'FORECAST_BINDING_APPROVAL_REQUIRED'
assert job['classification']=='SIMULATION_ONLY' and job['scope']=='PERSISTENT_LOCAL_DEVELOPMENT' and job['targetSha256']==target['targetSha256'], 'FORECAST_TARGET_MISMATCH'
assert hashlib.sha256(pathlib.Path(job['model']).read_bytes()).hexdigest()=='1e0f0c240109e49e8f1a89a713021afae07c2f5fae5b0e2bc8e3904610fb9764', 'FORECAST_MODEL_CHANGED'
root=pathlib.Path(sys.argv[5]);(root/'binding.json').write_text(canonical(job['binding'])+'\n');(root/'arguments').write_text('\n'.join([job['model'],job['bindingSha256'],job['requestId'],job['originDate'],job['generatedAt']]))
PY
  mapfile -t producer_arguments < "$runtime_dir/arguments"
  output="$(realpath -m "$output")"
  [[ "$output" == "$repository_root/build/"* && ! -e "$output" ]] || { echo FORECAST_PRIVATE_NEW_OUTPUT_REQUIRED >&2; exit 2; }
  docker run --rm --network bloodledger_default --env-file "${BLOODLEDGER_DEV_ENV_FILE:-.env}" \
    -e POSTGRES_HOST=postgres -e POSTGRES_PORT=5432 \
    -e "BLOODLEDGER_V5_APPROVED_BINDING_SHA256=${producer_arguments[1]}" \
    -e PYTHONPATH=/forecasting/src -e PYTHONDONTWRITEBYTECODE=1 \
    -v "$repository_root/services/forecasting:/forecasting:ro" \
    -v "${producer_arguments[0]}:/model.json:ro" -v "$runtime_dir:/private:ro" \
    -v "$(dirname "$output"):/output" --entrypoint python \
    sha256:dcb2ccd36834bcec33e3d5cb8158f2b7a75b0881f695821cc705764667fba4c1 \
    -m bloodledger_forecasting.runtime_v5_cli --model /model.json --binding /private/binding.json \
    --institution-id INST_MEDIATRIX --request-id "${producer_arguments[2]}" \
    --origin-date "${producer_arguments[3]}" --generated-at "${producer_arguments[4]}" \
    --output "/output/$(basename "$output")" --persist
fi
