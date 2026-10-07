# Lat retained development validation — 2026-10-07

**Result: BLOCKED for populated integration; local setup and empty-state browser checks PASS.**
Validator: Lat, disclosed local self-validation. Classification: SIMULATION_ONLY.
This record does not complete Testing-phase acceptance, UAT, physical OCR, full
Fabric-to-browser latency, reporting policy, clinical readiness or V5 activation.
Jopia's retained-host evidence remains separately attributed in the
[delivered runbook](../PERSISTENT-DEVELOPMENT-RUNBOOK.md).

## Verified source and environment

- Branch: `codex/lat-persistent-development-validation`, created from delivered
  `e9a91d087819fab454bd3a033c7b22cdeaca1c71`.
- Exact tested source commit: `e9a91d087819fab454bd3a033c7b22cdeaca1c71`.
  Its immediate parent is Jopia's tested implementation revision
  `fee83dc43f0527f3ed57ff7e5095e9f731cdf6e2`.
- Previous clean branch `codex/lat-testing-traceability` at `00b95cd` is preserved.
  Delivered integration was fetched explicitly; main was not substituted.
- Ubuntu 24.04.4 LTS / WSL2 (`6.18.33.2-microsoft-standard-WSL2`) checkout
  `/home/yuri/projects/bloodledger-current`; Playwright 1.61.1; Node 24.17.0,
  npm 11.13.0, Python 3.12.3; PostgreSQL container
  `bloodledger-postgres-1`, database `bloodledger_dev`, internal/loopback port
  5432, retained volume `bloodledger_postgres-data`, created
  `2026-07-28T01:47:20Z`.
- API is the delivered source on loopback 3000; editable Vite frontend is on
  loopback 5174 with its existing `/api` proxy. Port 5175 fixtures were not used.
  Ordinary processes run directly under Node/npm rather than the optional
  `bloodledger-persistent-api`/`bloodledger-persistent-web` container recipe.
- General sync worker remains stopped. V2 writes are configured; V4 remains
  the default forecast dataset. No V5 binding or job was approved or persisted.

## Retained setup and preservation

The original peer was stopped after Docker Desktop reported an invalid stale
Docker socket bind mount. Recreating only that container through Compose
restored its healthy state, preserving both peer volumes and existing identities.
The retained `bloodledger-dev` channel was queried with the existing administrator.
Initial definitions were health 0.1.0/sequence 1 and inventory 0.2.0/sequence 2.
The documented additive historical contract deployment committed `historical-v1`
at sequence 3 with the same Mediatrix endorsement policy. This is local lifecycle
evidence, not historical stock import evidence. The existing API gateway MSP was
present; the delivered inspect CLI successfully queried channel genesis before
checking account mappings.

Before migrations, a private custom-format PostgreSQL backup was captured at
`build/development-local/before.dump`, SHA-256
`1717c0e21e8af2513acf5f499e78f6f5fd47bfab2322aa4459b05a359ed7d867`.
All 16 outstanding additive migrations applied: 10 applied migrations became 26.
Runtime forecast SELECT/INSERT grants existed initially. Applied migrations
were not changed. Read-only reconciliation SQL subsequently executed successfully.

All six synthetic accounts logged in through the ordinary frontend. Their
account, institution and role data dumps were identical before migrations and
after the service restart, excluding pg_dump's randomized `restrict` markers.
Passwords, usernames, roles and institutions were not changed. Initial and final
V1 inventory, V2 components/commands/donations/reservations, transfers and forecasts
were empty; no pending commands were drained. Historical units and ML census
snapshots remain empty after setup.

`prepare-local.mjs --initialize-missing-simulation-keys` created an ignored private
runtime file after verifying zero existing donations. Existing values and the
original `.env` were retained; only missing simulation keys were initialized.
No existing encrypted donation needed key recovery. Private account configuration
was derived from the existing six-account file, without provisioning accounts.

## Reconciliation and blocked dependencies

| Boundary | Local result | Required continuation |
| --- | --- | --- |
| Operational seed | BLOCKED; zero components/commands; no manifest approved | Jopia supplies an explicit Fabric actor-policy mapping for the existing accounts |
| Nine components / five types / 18 operations | NOT_RUN | Run inspect → target review → dated OCR preview → exact-hash apply after mapping is resolved |
| Requests and reservations | Zero; seeded lifecycle assertions NOT_RUN | Seed must add three PENDING requests and ACTIVE/IN_TRANSIT reservations |
| Historical import | BLOCKED; no local snapshot or units | Original workbook with supplied SHA-256 must be made available locally |
| Operational census | BLOCKED; no persisted snapshot | Delivered wrapper's inspect gate must pass before capture of 40 combinations |
| Persisted V5 | BLOCKED; zero runs/forecasts | Successful retained-target inspection and separate reviewed binding/job hashes |
| Seed/historical/forecast replay | NOT_RUN | No original manifest, import or forecast job exists to replay |
| Service restart | PASS for account preservation and real empty/unavailable responses | Populated record durability remains NOT_RUN |

The existing coordinator is `USR_SYNTH_REVIEW_ROLE02` / ROLE-02 /
`INST_MEDIATRIX`; the existing recipient is `USR_SYNTH_REVIEW_ROLE03` / ROLE-03 /
`INST_SYNTH_SECONDARY_REVIEW`. Neither user ID appears in the delivered
`chaincode/policy/interview-core-v2.json`. The runbook examples use
`USR_MEDIATRIX_TECH` and `USR_DIVINE_LOVE` / `INST_DIVINE_LOVE`.
The delivered native inspect CLI exits 2 with
`SEED_FABRIC_ACTOR_MAPPING_REQUIRED`. No account mutation, policy bypass or target
approval was used. Jopia must resolve this boundary explicitly. The forecast and
census wrappers also call inspect, so they share this blocker.

The original `BloodLedger_ML_Research_Dataset_v5.xlsx` was not found in the checked
Linux workspace/home or usual Windows Downloads/Documents/Desktop locations.
The available V5 handoff ZIP contains a model but no XLSX. Actual historical
preview/import was therefore stopped, as instructed. Required original workbook
SHA-256 is `5c5997bd4df26f6f0d52d7ea13dde0172706faaa15308ebc87f241f44c241ddb`;
expected historical manifest SHA-256 is
`7b8c831d37667b1459c2b16707c5bf37cf72fe6cc12b2f24bf17a6ab2449af04`.
The 486 available / 36 reserved / 522 units remain expected source counts,
not observed local counts. No Jopia receipts were copied to PostgreSQL.

The frozen runtime was recovered from the existing local Downloads transport
archive, without resend, reconstruction, rebuilding or training. Its verified
transport SHA-256 is
`dbeec3106057c00fee967052563fa2fd295e3cdc52d249928c2b899c0f8a8b1c`.
Original model bytes match
`1e0f0c240109e49e8f1a89a713021afae07c2f5fae5b0e2bc8e3904610fb9764`;
original image archive matches
`aa1ab6e460911f91cba6164116302015d76fb5c6e591c5208a0835bb40cd0b26`.
Importing it restored the pinned image
`sha256:dcb2ccd36834bcec33e3d5cb8158f2b7a75b0881f695821cc705764667fba4c1`.
Producer prerequisite preflight PASS is not forecast persistence evidence.
Buno model/image availability is resolved; an approved retained-target binding
and job remain unexecuted. Disposable binding approval was not reused.

The actual validation date was 2026-10-07 Manila, matching the explicit seed date.
The unchanged scenario has its expired example at `2026-10-06T23:00:00Z` and its
imminent-expiry example at `2026-10-07T23:00:00Z`. No manifest date/timestamp was
silently refreshed. After gates clear, V5 must use the actual Manila day minus
one as origin and actual generation time; after midnight a new reviewed job and
census capture may be needed. Near-expiry policy remains disabled.

## Real frontend evidence

The private probe `build/development-local/lat-browser.mjs` used Playwright
Chromium and ordinary form login at 5174, official HttpOnly cookies, the actual
API/database, and no HTTP interception. Both before and after an ordinary
API/frontend stop/start, **23 checks passed**:

- Anonymous history returns 401; coordinator V2 dashboard, transfers, alerts,
  audit and historical-list endpoints return 200 with SIMULATION_ONLY.
- V2.1 inventory truthfully displays no committed components; historical view
  truthfully displays no local import. CRYO row rendering and historical count,
  pagination and ledger-reference assertions remain NOT_RUN without stock.
- Transfers retain the local-release form and separate request/reservation
  sections; recipient retains the transfer-request form. No form was submitted.
- Alerts show the genuine empty state; audit renders authenticated off-chain
  activity. Expiry evidence, acknowledgement persistence and populated Fabric
  versus off-chain audit reconciliation remain NOT_RUN.
- V4 remains default; explicit V5 returns UNAVAILABLE with zero forecasts.
  Missing census returns UNAVAILABLE, without invented verified zeros.
- All six existing accounts sign in. Historical API is allowed only for ROLE-01
  and ROLE-02; V2 audit is allowed only for ROLE-02. Recipient component reads
  return its empty authorized scope. Wrong-origin mutation returns 403.
- Logout causes 401 and protected Analytics controls disappear after reload.
  There were no protected stock/forecast rows to test for residual display.

No populated cross-institution leakage test, actual freshness/20-series preview,
or full Fabric-to-browser timing pass is claimed. No frontend defect requiring
implementation was reproduced in this executable slice; no frontend code fixes
or unrelated changes were made.

## Commands and private evidence

Executed commands below are credential-free; connection secrets were read only
from existing/private configuration. Logs, backups, account dumps, model/archive,
probe and browser reports are ignored under `build/development-local/`.

| Command / procedure | Result / artifact |
| --- | --- |
| `git fetch origin codex/persistent-synthetic-development`; verify delivered commit and parent; create dedicated branch | PASS |
| Inspect retained Docker containers, mounts, migrations, grants, accounts and domain counts | PASS; initial 10 migrations, six accounts, empty domain rows |
| `docker exec bloodledger-postgres-1 pg_dump -U postgres -d bloodledger_dev -Fc` to private backup | PASS; `before.dump` |
| `npm run migrate:up` | PASS; `migrations.log`, 16 additive migrations |
| `docker compose --project-name bloodledger --env-file .env up -d --no-deps --force-recreate peer0-mediatrix` | PASS; retained peer healthy |
| `bash network/scripts/deploy-historical-inventory.sh --apply bloodledger-local` | PASS; `contract-upgrade.log`, sequence 3 |
| `node scripts/development-data/prepare-local.mjs --initialize-missing-simulation-keys` | PASS; protected runtime configuration |
| `node --env-file=build/development-local/runtime.env services/api/build/src/server.js` with loopback host/peer/repository overrides | PASS; `api.log` |
| `npm run dev --workspace @bloodledger/web -- --host 127.0.0.1` | PASS; `web.log`, 5174→3000 |
| Verify original transport/model/image checksums; `docker load --input` verified original image archive | PASS; unchanged pinned artifacts |
| `node tests/forecasting/v5-runtime-prerequisites.mjs --producer` with recovered model path | PASS; `v5-prerequisites.log` |
| Delivered `cli.mjs inspect` with actual host/volume metadata and private runtime/config | BLOCKED/2; `inspect-native.log`, actor mapping error |
| `bash scripts/development-data/run.sh inspect --config build/development-local/config.json` with private runtime env | Stopped during development-tools image preparation after the native CLI confirmed the blocker; `inspect.log`; wrapper inspection not completed |
| `node build/development-local/lat-browser.mjs`; ordinary API/web restart; rerun with fresh report path | PASS twice; `browser-before-restart.json`, `browser-after-restart.json` |
| `docker exec -i ... psql -v ON_ERROR_STOP=1` reading `scripts/development-data/inspect.sql` | PASS; `database-final.log` |
| Compare before/final account, role and institution dumps; read final domain counts | PASS; `accounts-final.sql`, `row-counts-final.log` |
| `npm run check:web`; `npm run test:web` | PASS; 62 web tests |
| `npm run check:api`; `npm run test:api` | PASS; 111 API tests |
| `npm run test:inventory-contract` | PASS; 36 tests |
| `npm run test:development-data`; `npm run test:historical-inventory` | PASS; recovery/historical test files |
| `npm run check:foundation`; `npm run check:database`; Bash syntax checks | PASS |
| `npm run scan:secrets`; `npm audit --json` | PASS; no leaks, zero reported vulnerabilities |

To continue, retain these services/configuration and supply the approved existing
account-to-policy mapping and exact original workbook. Then rerun the runbook's
inspect and explicit approvals; do not reset volumes, reprovision accounts,
refresh a saved manifest, use direct projection fixtures or backdate forecasts.
The existing pinned runtime requires no retraining or input history.
