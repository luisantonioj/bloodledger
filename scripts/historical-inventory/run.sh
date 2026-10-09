#!/usr/bin/env bash
set -euo pipefail
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "${repository_root}"
# All source extraction is read-only. Temporary allowlisted counts never become repository fixtures.
workbook=""; digest=""; business_date=""
extra_mounts=()
arguments=("$@")
for ((i=0;i<${#arguments[@]};i++)); do
  case "${arguments[i]}" in
    --workbook) workbook="${arguments[i+1]:-}" ;;
    --sha256) digest="${arguments[i+1]:-}" ;;
    --business-date) business_date="${arguments[i+1]:-}" ;;
  esac
done
[[ -f "${workbook}" && "${digest}" =~ ^[0-9a-f]{64}$ && "${business_date}" =~ ^202[3-6]-[0-9]{2}-[0-9]{2}$ ]] || {
  echo 'Require --workbook <external.xlsx> --sha256 <expected hash> --business-date <explicit day>' >&2; exit 2;
}
workbook="$(realpath "${workbook}")"
for ((i=0;i<${#arguments[@]};i++)); do
  if [[ "${arguments[i]}" == --workbook ]]; then arguments[i+1]="${workbook}"; fi
done
# Resolve artifact paths and mount only the selected files or output parents.
for ((i=0;i<${#arguments[@]};i++)); do
  case "${arguments[i]}" in
    --manifest|--output|--report)
      artifact="$(realpath -m "${arguments[i+1]}")"
      arguments[i+1]="$artifact"
      if [[ "${arguments[i]}" == --manifest ]]; then
        [[ -f "$artifact" ]] || { echo 'Manifest file does not exist' >&2; exit 2; }
        extra_mounts+=(-v "$artifact:$artifact:ro")
      else
        mkdir -p "$(dirname "$artifact")"
        extra_mounts+=(-v "$(dirname "$artifact"):$(dirname "$artifact")")
      fi ;;
  esac
done
docker run --rm -v "${repository_root}:/workspace" -w /workspace node:24.17.0 \
  npm run build --workspace @bloodledger/inventory-contract >/dev/null
umask 077
source_file="$(mktemp /tmp/bloodledger-historical-source.XXXXXX)"
trap 'rm -f -- "${source_file}"' EXIT
docker run --rm --user "$(id -u):$(id -g)" --network none --read-only --tmpfs /tmp \
  -v "${repository_root}/services/forecasting:/forecasting:ro" -v "${workbook}:/source/workbook.xlsx:ro" \
  -e PYTHONPATH=/forecasting/src -e PYTHONDONTWRITEBYTECODE=1 --entrypoint python \
  sha256:dcb2ccd36834bcec33e3d5cb8158f2b7a75b0881f695821cc705764667fba4c1 -m bloodledger_forecasting.historical_snapshot \
  --workbook /source/workbook.xlsx --sha256 "${digest}" --business-date "${business_date}" > "${source_file}"
# The pinned Node runtime accesses only this project's network and volumes.
docker run --rm -i --user "$(id -u):$(id -g)" --network bloodledger_default -v "${repository_root}:${repository_root}" \
  -v "${workbook}:${workbook}:ro" "${extra_mounts[@]}" -w "${repository_root}" \
  -e HISTORICAL_PG_HOST=postgres -e HISTORICAL_PG_PORT=5432 -e FABRIC_PEER_ENDPOINT=peer0-mediatrix:7051 \
  node:24.17.0 node scripts/historical-inventory/cli.mjs "${arguments[@]}" < "${source_file}"
