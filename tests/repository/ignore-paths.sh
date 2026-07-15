#!/usr/bin/env bash
set -euo pipefail

readonly ignored_paths=(
  ".env"
  ".env.local"
  "network/generated/organizations/example/msp/keystore/private_sk"
  "network/runtime/wallet/admin/identity.json"
  "network/runtime/wallets/api/identity.json"
  "network/runtime/keystore/private.key"
  "network/runtime/signcerts/cert.pem"
  "network/runtime/channel-artifacts/bloodledger-dev.block"
  "local-private.key"
  "application.log"
  "database/data/PG_VERSION"
  "database/postgres-data/PG_VERSION"
  "node_modules/example/index.js"
  "dist/index.js"
  "coverage/lcov.info"
)

for path in "${ignored_paths[@]}"; do
  if ! git check-ignore --quiet --no-index "$path"; then
    echo "Expected ignored path is not excluded: $path" >&2
    exit 1
  fi
done

if git check-ignore --quiet --no-index .env.example; then
  echo ".env.example must remain eligible for tracking" >&2
  exit 1
fi

echo "Ignore-path behavior proven for ${#ignored_paths[@]} sensitive/generated paths"
