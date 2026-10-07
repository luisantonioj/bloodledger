# Lat's persistent synthetic development setup

Jopia owns backend/Fabric integration; Lat owns local frontend validation; Buno owns V5 lineage. Scope: [accepted persistent development integration](PERSISTENT-SYNTHETIC-DEVELOPMENT.md), Testing-phase technical preparation, SIMULATION_ONLY. No resets, clinical/UAT acceptance or model activation.

## Delivered branch and prerequisites

Use `codex/persistent-synthetic-development`. Integration base: PR21 `0ebe88b`, merged historical `be043b3`. Executable seed: `scripts/development-data/run.sh`; scoped forecast producer: `scripts/development-data/forecast.sh`; DBeaver queries: `scripts/development-data/inspect.sql`; historical importer: `scripts/historical-inventory/run.sh`. The validation section records the tested revision; `git rev-parse HEAD` identifies your exact checkout.

Required: canonical WSL2 Linux checkout, Docker Desktop/Compose with WSL integration, Python 3, Bash, Git, npm lockfile dependencies, Node image `24.17.0`, Playwright image `v1.61.1-noble`, existing project network `bloodledger_default`, retained PostgreSQL 17.10 `bloodledger_dev`, current additive migrations, channel `bloodledger-dev`, organizational API gateway identity and the chaincode package containing `InterviewCoreContract` and `HistoricalInventoryContract`. Existing local private `.env`, donation encryption/lookup keys and synthetic passwords stay private. Preserve the key versions used for existing encrypted donations.

Start from a clean checkout; preserve unrelated changes rather than discarding them:

```bash
git fetch origin
git switch codex/persistent-synthetic-development
git status --short
git rev-parse HEAD
docker run --rm -v "$PWD:/workspace" -w /workspace node:24.17.0 npm ci --ignore-scripts
bash scripts/bloodledger-dev.sh status
```

Inspect your actual container name, database, volume and grants. These commands do not change the database:

```bash
docker ps -a --filter label=com.docker.compose.project=bloodledger
docker inspect bloodledger-postgres-1 --format '{{range .Mounts}}{{.Name}} {{.Destination}}{{println}}{{end}}'
docker exec bloodledger-postgres-1 psql -U postgres -d bloodledger_dev -c "SELECT user_id,username,institution_id,status FROM app.application_users; SELECT user_id,role_id FROM app.user_role_assignments;"
docker exec bloodledger-postgres-1 psql -U postgres -d bloodledger_dev -c "SELECT count(*) FROM app.v2_components; SELECT count(*) FROM app.v2_commands WHERE status <> 'COMMITTED';"
```

Set `BLOODLEDGER_DEV_POSTGRES_CONTAINER` if your project-owned PostgreSQL container differs. The wrapper verifies the retained data-volume name/creation time; the runtime fingerprint additionally includes a persisted database instance ID and Fabric genesis hash. Matching a database name alone is insufficient. Back up your retained database before migrations:

```bash
umask 077
mkdir -p build/development-local
docker exec bloodledger-postgres-1 pg_dump -U postgres -d bloodledger_dev -Fc > build/development-local/before.dump
docker run --rm --network host -v "$PWD:/workspace" -w /workspace node:24.17.0 npm run migrate:up
```

Migration owner applies schema; runtime `bloodledger_app` receives specific grants. No seed writes operational projections directly. Keep the backup outside Git. Preserve existing Fabric data and generated identities; use the existing historical deployment script only if the local package lacks that contract:

```bash
bash network/scripts/deploy-historical-inventory.sh --apply bloodledger-local
```

This preserves the channel and existing policy and adds a lifecycle sequence if required. A previously committed `historical-v1` package is reused; verify its namespace rather than resetting or reenrolling identities.

## Private configuration and editable frontend

If the existing 5174 frontend and API already run the delivered source, keep them. API must use the same retained database, V2 writes, existing donation keys, `WEB_ORIGIN=http://127.0.0.1:5174`, secure-cookie false on loopback, API 3000 and V4 default. Stop the general sync-worker while preparing this scoped seed; do not drain unrelated work. Existing pending operations remain pending and can block a truthful census.

Alternatively, when ports 3000/5174 are free, use the delivered API/web container recipe. This serves editable repository source through Vite with its existing `/api` proxy; it does not start a general worker:

```bash
# Reads your .env; preserves existing values. Refuses to overwrite output.
docker run --rm --user "$(id -u):$(id -g)" --network host \
  -v "$PWD:/workspace" -w /workspace node:24.17.0 \
  node scripts/development-data/prepare-local.mjs
export BLOODLEDGER_DEV_ENV_FILE=build/development-local/runtime.env
bash scripts/development-data/start-local.sh --apply
export BLOODLEDGER_DEV_API_URL=http://bloodledger-persistent-api:3000
```

If missing keys are confirmed on an empty simulation donation registry, `prepare-local.mjs --initialize-missing-simulation-keys` explicitly initializes them; it refuses initialization when encrypted donations already exist. Otherwise restore existing private keys. Never copy Jopia's keys or overwrite existing account passwords. The private runtime environment includes migration secrets because the original setup requires them: restrict permissions and never publish it.

Create `build/development-local/config.json` privately with this shape. Replace placeholders with **existing synthetic accounts**; do not paste credentials into Git or chat:

```json
{
  "classification": "SIMULATION_ONLY",
  "scope": "PERSISTENT_LOCAL_DEVELOPMENT",
  "accounts": {
    "coordinator": {"username": "YOUR_EXISTING_SYNTHETIC_TECHNICIAN", "password": "PRIVATE_EXISTING_PASSWORD"},
    "recipient": {"username": "YOUR_EXISTING_SYNTHETIC_RECIPIENT", "password": "PRIVATE_EXISTING_PASSWORD"}
  }
}
```

Set file mode 0600. The coordinator must be ROLE-02/INST_MEDIATRIX and its user ID must match the existing chaincode policy `USR_MEDIATRIX_TECH`. The recipient must be ROLE-03 and match an allowed recipient actor/institution, for example `USR_DIVINE_LOVE`/`INST_DIVINE_LOVE`. Different existing user IDs fail with `SEED_FABRIC_ACTOR_MAPPING_REQUIRED`; do not silently rename users/change roles. Jopia must resolve any mapping mismatch through an explicit policy change separately. This release supplies no account reseed.

Inspect, review your actual target and add its exact returned `targetSha256` to the private JSON:

```bash
bash scripts/development-data/run.sh inspect --config build/development-local/config.json > build/development-local/inspect.json
cat build/development-local/inspect.json
# Add targetSha256 after reviewing database, volume, genesis hash and role mappings.
```

## Freeze, apply and replay the operational seed

Use an explicit simulation date; this tested example is 2026-10-07, not a silently refreshed current-day dataset. It constructs label dates expressly for simulation, without a clinical shelf-life claim. Real Tesseract 7.0.0 recognizes generated label field regions. The accepted parser validates exact recognized values and measured confidence ≥90; failures stop preview. No raw label images or OCR text are persisted.

```bash
bash scripts/development-data/run.sh preview \
  --config build/development-local/config.json --date 2026-10-07 \
  --output build/development-local/manifest.json
```

Review all nine recognized label fields, measured confidences and generated timestamps in the private manifest. Passing its exact hash to apply confirms those **synthetic** fields as the local operator; it does not establish real-label or clinical validation. Use the exact preview output hash below:

```bash
seed_hash=$(python3 -c 'import json; print(json.load(open("build/development-local/manifest.json"))["manifestSha256"])')
bash scripts/development-data/run.sh apply \
  --config build/development-local/config.json --manifest build/development-local/manifest.json \
  --approve-manifest "$seed_hash" --report build/development-local/reconciliation.json
```

Expected additions: nine components across all five types; six AVAILABLE, one RESERVED, one IN_TRANSIT, one EXPIRED; three PENDING requests with two separate reservations (ACTIVE and IN_TRANSIT). A request's status does not pretend its reservation lifecycle is an approval transition. Eighteen real Fabric operations include OCR registrations, request submissions, FEFO reservations, preparation/dispatch/transit and expiry. The imminently expiring example remains ordinary AVAILABLE stock; near-expiry policy stays disabled. No autonomous RPS/BROA, receipt, local-release or compromise scenario is supplied by this small seed.

Apply/resume processes only recorded seed commands. `SUBMITTING` without a saved commitment requires queryable Fabric evidence; only explicit not-found permits resubmitting the identical saved envelope. A saved valid commitment retries projection. Do not discard manifests, refresh timestamps or manually update command state. Repeat with a **new report filename**:

```bash
bash scripts/development-data/run.sh resume \
  --config build/development-local/config.json --manifest build/development-local/manifest.json \
  --approve-manifest "$seed_hash" --report build/development-local/resume.json
bash scripts/development-data/run.sh verify \
  --config build/development-local/config.json --manifest build/development-local/manifest.json \
  --approve-manifest "$seed_hash" --report build/development-local/verified.json
```

A regenerated manifest for the same date/target conflicts rather than replacing the original. Unrelated earlier FEFO stock may cause reservation rejection: inspect and resolve the intended scenario, never exclude competing stock to bypass FEFO. `--stop-after N` is a safe partial-batch pause. Validation-only `pause-after-submit`/`pause-after-commit` require explicit private `validationFaultInjection:true`; use them only for controlled recovery evidence.

## Re-import reviewed historical stock on Lat's local ledger

Use the original external XLSX, not a newly exported version with different bytes. Expected original workbook SHA-256: `5c5997bd4df26f6f0d52d7ea13dde0172706faaa15308ebc87f241f44c241ddb`. The shared date selection review is `CONVERSATION_2026-10-07_STOCK_REVIEW_486_AVAILABLE_36_RESERVED`; this records supplied review evidence, not independent Buno account attestation.

```bash
workbook=/absolute/private/path/BloodLedger_ML_Research_Dataset_v5.xlsx
workbook_hash=5c5997bd4df26f6f0d52d7ea13dde0172706faaa15308ebc87f241f44c241ddb
bash scripts/historical-inventory/run.sh preview --workbook "$workbook" --sha256 "$workbook_hash" \
  --business-date 2026-10-07 --output build/development-local/historical-manifest.json
```

Expected manifest hash: `7b8c831d37667b1459c2b16707c5bf37cf72fe6cc12b2f24bf17a6ab2449af04`; snapshot `HSNAP_913241C895D1447FEC7E6022E33412D8C45474B0`. Confirm 20 counts and 522 deterministic components. On a matching existing local import run verify first; on an incomplete import resume; otherwise apply:

```bash
bash scripts/historical-inventory/run.sh apply --workbook "$workbook" --sha256 "$workbook_hash" \
  --business-date 2026-10-07 --manifest build/development-local/historical-manifest.json \
  --target bloodledger-local --operator USR_SYNTH_HISTORICAL_IMPORT \
  --approve-manifest 7b8c831d37667b1459c2b16707c5bf37cf72fe6cc12b2f24bf17a6ab2449af04 \
  --review-reference CONVERSATION_2026-10-07_STOCK_REVIEW_486_AVAILABLE_36_RESERVED \
  --report build/development-local/historical-reconciliation.json
```

Replace `apply` with `verify`/`resume` and use a fresh report filename as needed. References and commitment times are **Lat's actual local Fabric evidence**; never import Jopia's receipt rows. Available/reserved are snapshot representation, allocation groups are constructed, original bag/donation/expiry/purpose are unknown. Historical records are excluded from the operational tables/census. The workbook and generated manifests remain outside Git.

## Persist census and explicit V5 preview

Capture the 40-combination committed operational census independently. Choose a new exact UTC `scheduled-for` instant no later than now; reuse that instant only to replay the same unchanged snapshot:

```bash
scheduled_for=$(python3 -c 'from datetime import datetime,timezone; print(datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00","Z"))')
bash scripts/development-data/run.sh census --config build/development-local/config.json --scheduled-for "$scheduled_for"
```

The zero combinations are verified counts, not unavailable evidence. Pending relevant commands block capture. Historical source counts never fill operational stock. DOH reporting/copy needs its separately approved format/policy; the internal ML census does not close that gate.

Use Buno's external unchanged `selected_model.json` (file hash `1e0f0c240109e49e8f1a89a713021afae07c2f5fae5b0e2bc8e3904610fb9764`, parameter hash `ceb0e74b2eb2f8af7fcafabb3619f2a23681c38eac65998816e7daf40b5afb86`). Load Buno's verified forecasting image handoff if the pinned image is unavailable. No workbook/history/refitting is needed for this producer.

```bash
bash scripts/development-data/forecast.sh preview --config build/development-local/config.json \
  --model /absolute/private/path/selected_model.json \
  --request-id V5_REQ_LAT_PERSISTENT_20261007_001 --job build/development-local/forecast-job.json
```

Review target, institution, binding and job hashes. The scoped binding is development-only, distinct from the disposable binding. The producer uses yesterday in Manila as origin, actual current generation time and 20 next-day forecasts. Approve both exact hashes printed by preview:

```bash
bash scripts/development-data/forecast.sh apply --config build/development-local/config.json \
  --job build/development-local/forecast-job.json --approve-job YOUR_JOB_HASH \
  --approve-binding YOUR_BINDING_HASH --output build/development-local/forecasts.json
```

Replay the exact job with a fresh output filename: persistence reports `EXISTING`, retains run/time and adds no forecasts. New deliberate attempts require new request ID and new job. Midnight makes old forecasts/census stale; do not edit old timestamps to make them current. V4 remains default and may legitimately be UNAVAILABLE if Lat has no V4 run. V5 preview keeps recommendations disabled and null uncertainty explicit.

## Browser, DBeaver and ordinary restart

Open `http://127.0.0.1:5174`, sign in through the ordinary login. Inventory → Contract view V2.1 shows all five component types; Historical synthetic stock shows the 20 source combinations and generated units in pages of 50. Dashboard/Transfers/Alerts/Audit read V2 evidence; select explicit V5 and today's business date in Analytics. Existing V1 records remain accessible through unchanged V1 endpoints/DBeaver and are not double-counted in V2 totals.

DBeaver: open your PostgreSQL connection → `bloodledger_dev` → SQL Editor → New SQL Script. Paste `scripts/development-data/inspect.sql`; run the selected query with Ctrl+Enter. Refresh `Schemas → app → Tables` if the new names are absent. Operational blood components live in `v2_components`; historical stock lives in `synthetic_inventory_*`; `inventory_projection` retains the earlier prototype unit. Never edit rows in the data grid to invent commitment.

The retained browser probe uses official HttpOnly cookies, real HTTP and no interception. The strict fixture count assumes the clean Jopia operational baseline; on a populated Lat database verify the seed's IDs from its report, plus preservation of other rows, rather than claiming every table has exactly nine rows.

```bash
docker restart bloodledger-persistent-api bloodledger-persistent-web
# When infrastructure was stopped, start existing containers, preserving volumes.
# Sign in again; verify seed IDs and counts, historical snapshot and forecasts.
```

Stopping/disabling seed execution is rollback; committed Fabric history is retained. Do not run reset, prune, drop tables or remove project volumes.

## Verification evidence

Tested implementation revision: `fee83dc43f0527f3ed57ff7e5095e9f731cdf6e2` on 2026-10-07. The documentation commit containing this record is a descendant of that revision. Validator: Jopia, disclosed self-validation. Lat's six-account environment has not been executed remotely.

The retained Jopia database initially had zero web accounts and zero V2 components, alongside the existing prototype unit and historical snapshot. Two private synthetic validation accounts were provisioned through the existing account tool before the seed; the seed itself creates or changes no accounts. This does not establish that Lat's six existing accounts have matching Fabric actor IDs.

| Verified boundary | Jopia-host result |
| --- | --- |
| Confirmed synthetic OCR | Nine generated labels, actual Tesseract recognition/confidence at the accepted threshold; no persisted images/raw OCR text |
| Operational reconciliation | Nine components: six AVAILABLE, one RESERVED, one IN_TRANSIT, one EXPIRED; 18 directly verified VALID transactions, blocks 575–592 |
| Current component state | Nine direct `ReadComponent` results match projection state, version and last transaction |
| Transfer evidence | Three PENDING requests; two distinct reservations, ACTIVE and IN_TRANSIT |
| Ambiguous submission | Paused after the third submission committed but before saving its receipt; resume found the same valid transaction without resubmitting |
| Projection recovery | Paused after the fourth saved commitment but before projection; resume projected the existing commitment |
| Replay | Same component/command IDs and 18 transaction references; no duplicate domain rows |
| Historical preservation | All 20 original counts, 486 available and 36 reserved; 522 units and 524 directly verified VALID transactions, original IDs/receipts unchanged |
| Legacy preservation | `UNIT_SYNTH_S4_LIVE_001` remains AVAILABLE/version 1 with its original transaction; four earlier V1 forecast rows preserved |
| Operational census | 40 combinations at `2026-10-07T12:17:27.629Z`, including verified zeros; historical stock excluded |
| Persistent V5 preview | 20 forecasts, origin 2026-10-06, actual generation `2026-10-07T12:16:39.938Z`; public-wrapper replay reports EXISTING with the same run and time |
| Real browser | Official HttpOnly cookie, no interception; Inventory, historical stock, transfer forms/evidence, Alerts, Audit and explicit CURRENT V5 Analytics on 5174→3000 |
| Access boundary | Anonymous historical access 401, recipient history 403, source inventory absent for recipient, wrong origin 403, logout clears access; audit restricted to ROLE-02 |
| Persistence | Browser and ledger verification passed after ordinary API/web restart and after recovery from a stopped host, retaining the original volumes |

Automated checks passed: API type/build and 111 tests; final audit-role tests (four); web type/build and 62 tests; 36 chaincode tests; seven operational seed/recovery tests; nine historical ledger/recovery tests; repository foundation and database checks; API and forecasting static boundaries; shell syntax; DBeaver SQL execution; full npm audit (zero vulnerabilities); Gitleaks 8.30.1 history/index/candidate scan (no leaks). The OCR branch-specific static guard requires a different named branch and is inapplicable here; its guard was not weakened. Accepted OCR parser/contract and actual retained intake were verified through the applicable tests and live flow.

Private, ignored evidence remains under `build/persistent-development/`: `public-wrapper-verified.json`, `historical-preservation.json`, `browser-after-service-restart.json`, `browser-after-host-restart.json`, `browser-handoff-final.json`, `census.json`, `forecasts-public-replay.json`, and test/security logs. Never publish the private configuration, original workbook, manifests containing generated identities, cookies or keys.

To reproduce the strict retained browser probe after preparing the same scenario baseline:

```bash
docker run --rm --init --user "$(id -u):$(id -g)" --network host \
  -v "$PWD:$PWD" -w "$PWD" \
  -e BLOODLEDGER_BROWSER_CONFIG_PATH=build/development-local/config.json \
  -e BLOODLEDGER_BROWSER_REPORT_PATH=build/development-local/browser-report.json \
  bloodledger-development-tools:local node tests/development-data/retained-browser.mjs
```

The probe defaults to loopback 5174. Its assertions require this historical snapshot and an explicitly CURRENT V5 run for today's Manila date. Different existing local inventory requires checking seed IDs through `verify` and the UI rather than reusing the strict count assertions. Calendar rollover deliberately makes old forecasting/census evidence stale; create a new approved forecast job/census capture instead of editing timestamps. Existing forecasting regression evidence covers that clock boundary; this validation did not wait for a physical midnight.

Lat must still run this recipe against his retained database and Fabric, including the reviewed historical re-import. Local operational IDs are target-bound; historical IDs are source-bound and remain identical across hosts. Local transaction IDs, blocks and commitment times always come from the local ledger. Physical OCR, full latency, human UAT, reporting policy and operational activation remain deferred or gated.
