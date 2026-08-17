#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd -P)"
forecasting_root="${repository_root}/services/forecasting"
venv="${forecasting_root}/.venv"
mode="${1:-}"

case "${mode}" in
  check|test) ;;
  *) echo "Usage: $0 check|test" >&2; exit 2 ;;
esac

cd "${forecasting_root}"
if [[ -x "${venv}/bin/python" ]] && "${venv}/bin/python" --version >/dev/null 2>&1; then
  if [[ "${mode}" == check ]]; then
    "${venv}/bin/ruff" format --check --no-cache .
    "${venv}/bin/ruff" check --no-cache .
    MYPY_CACHE_DIR=/tmp/bloodledger-forecasting-mypy \
      "${venv}/bin/mypy" --config-file pyproject.toml src
  else
    PYTHONPYCACHEPREFIX=/tmp/bloodledger-forecasting-pycache \
      "${venv}/bin/pytest" -p no:cacheprovider tests
  fi
  exit 0
fi

export POSTGRES_ADMIN_PASSWORD="${POSTGRES_ADMIN_PASSWORD:-unused-by-forecasting-quality}"
export POSTGRES_MIGRATOR_PASSWORD="${POSTGRES_MIGRATOR_PASSWORD:-unused-by-forecasting-quality}"
export POSTGRES_APP_PASSWORD="${POSTGRES_APP_PASSWORD:-unused-by-forecasting-quality}"
export LOCAL_UID="${LOCAL_UID:-$(id -u)}"
export LOCAL_GID="${LOCAL_GID:-$(id -g)}"

compose=(docker compose --project-name bloodledger)
if [[ -f "${repository_root}/.env" ]]; then
  compose+=(--env-file "${repository_root}/.env")
fi
"${compose[@]}" --profile forecasting build forecasting

container=(
  "${compose[@]}" --profile forecasting run --rm --no-deps
  --entrypoint sh
  --volume "${forecasting_root}:/workspace/repository:ro"
  --workdir /workspace/repository
  forecasting
)
if [[ "${mode}" == check ]]; then
  "${container[@]}" -ec \
    'ruff format --check --no-cache . && ruff check --no-cache . && MYPY_CACHE_DIR=/tmp/bloodledger-forecasting-mypy mypy --config-file pyproject.toml src'
else
  "${container[@]}" -ec \
    'PYTHONPYCACHEPREFIX=/tmp/bloodledger-forecasting-pycache pytest -p no:cacheprovider tests'
fi
