#!/usr/bin/env bash
set -euo pipefail

for variable_name in POSTGRES_MIGRATOR_PASSWORD POSTGRES_APP_PASSWORD; do
  if [[ -z "${!variable_name:-}" ]]; then
    echo "Required database bootstrap secret is missing: ${variable_name}" >&2
    exit 1
  fi
done

if [[ "${POSTGRES_DB}" != "bloodledger_dev" ||
      "${POSTGRES_USER}" != "postgres" ||
      "${POSTGRES_MIGRATOR_USER}" != "bloodledger_migrator" ||
      "${POSTGRES_APP_USER}" != "bloodledger_app" ]]; then
  echo "Database bootstrap identifiers do not match the approved Sprint 1 baseline" >&2
  exit 1
fi

psql --set=ON_ERROR_STOP=1 \
  --username "${POSTGRES_USER}" \
  --dbname "${POSTGRES_DB}" \
  --set=migrator_password="${POSTGRES_MIGRATOR_PASSWORD}" \
  --set=app_password="${POSTGRES_APP_PASSWORD}" <<'SQL'
CREATE ROLE bloodledger_migrator LOGIN PASSWORD :'migrator_password';
CREATE ROLE bloodledger_app LOGIN PASSWORD :'app_password';

REVOKE ALL ON DATABASE bloodledger_dev FROM PUBLIC;
GRANT CONNECT, CREATE, TEMPORARY ON DATABASE bloodledger_dev TO bloodledger_migrator;
GRANT CONNECT ON DATABASE bloodledger_dev TO bloodledger_app;

REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO bloodledger_migrator;
SQL

