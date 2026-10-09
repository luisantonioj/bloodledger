# Jopia → Lat: retained operational population package — 2026-10-09

Classification: **SIMULATION_ONLY**. Selected TP-STOCK-01 / BL-TST-01;
FR-01–05/08–09/12–14, BR-INV-01–07, NFR-01–02/05/08–09/12.
Status: technical package prepared; **Lat local execution BLOCKED** by a newly
reviewed Buno scenario/verifier and fresh Lat target/preview/execution review.
Jopia owns backend/ledger review; Buno owns dates/source lineage; Lat executes
locally and independently validates API/browser/restart evidence.

## Review disposition and integration

Reviewed PR27's complete discussion and PR30's exact target handoff. The frontend
correctly shows Lat's nine local operational units. Git integration transfers
code, not Jopia's database, identities, volumes or Fabric transaction receipts.
The existing historical 522 units remain separate and are never usable stock.

Implementation branch: `codex/jopia-lat-population-handoff`, based on exact PR29
`eb12ee2c28aa5f1810e325fdb1b074c4801eea27`; PR28
`c4f99c9c420a380ae64b1a444fc353fff666bd2e` and retained integration
`954f170b840fce1a346bb3bd393748a731be1913` are verified ancestors. Main is not
the runtime baseline. No frontend, account-policy, chaincode-policy, migration,
source workbook, model, Buno V1 generator or date is changed by this package.

The existing [population contract](../OPERATIONAL-STOCK-POPULATION.md#lat-retained-target-successor-review--2026-10-09)
owns the new review-file arguments, pinned source/verifier requirements,
legacy recovery and original-census preservation. ADR-035 genuine OCR,
explicit field confirmation and primary-account/action-bound individual
operator grants remain mandatory. No bulk-loader exception is proposed.

Buno renewal request: [PR26 coordination comment](https://github.com/luisantonioj/bloodledger/pull/26#issuecomment-6076159369).
No renewed scenario/window or hashes have been received or approved here.
The V1 population end `2026-10-09T00:00:00Z` (October 9, 08:00 Manila) has
passed. Waiting for a future verification instant does not authorize a new
submission. Do not backdate, edit V1 dates, reuse Jopia's execution file or
weaken operator rate limits. Allow several hours of intake plus local review.

## Exact outstanding inputs and approvals

| Input or decision | Required evidence / present disposition |
| --- | --- |
| Buno successor | New version, actual generatedAt, T0/start/exclusive-end, all unit collection/expiry dates, donation/workflow keys and reviewed mapping; file/canonical/archive hashes and exact generator/verifier revision/file hashes. **BLOCKED: requested, not received.** |
| Immutable source | Original workbook `5c5997bd4df26f6f0d52d7ea13dde0172706faaa15308ebc87f241f44c241ddb`; source counts digest `fcf62756d3e0b449e7a294b51e8108106f20e5735746c193b4dce0529e7a9daf`; unchanged 20-series distribution. |
| Lat target | Fresh QSCC genesis/database instance/volume creation evidence and fingerprint. Reference `3ddfcfd9398fc720822ac25acd6524dff8098335513301728ca84520eda5f074`, instance `68aa41aa9ca6b92980a1cb126ac9f5a2`, are prior Lat evidence, **not refreshed approval**. |
| Policy/operator | Installed `SYNTHETIC_INSTITUTION_CORE_V1`; parsed-JSON digest `ad7012c67346f65b0b7a74d61f30faa69d651a64a611277c6bdaae987823520d`, subject to installed match. Existing Mediatrix/Medix ROLE-02 operators and all six accounts/12 operators preserved. |
| Lifecycle | Read committed definition and approved package first. Lat's recorded sequence 5 requires review of PR28's CRYO read correction at `institution-accounts-v2`, normally sequence 6. Same policy/MSP/channel/plugins/collections; no lower sequence or broad deploy command. **NOT_RUN on Lat here.** |
| Backup/preservation | New Lat-host dump restored/tested only in disposable isolated storage; actual backup SHA and same instance identity; before-domain and identity/mount checkpoints. No copied Jopia backup or live restore. |
| Source/target review | Owner accepts actual successor source/mapping/dates, verifier code and actual target/policy. Sealed scenario-review file plus separately reviewed digest; no invented ACCEPTED fields. |
| Preview/confirmation | Actual global FEFO/collision and all OCR fields reviewed. Confirm exact preview with validated backup; confirmation freezes actual time. Review the resulting execution digest before apply. **NOT_RUN; no execution digest exists here.** |
| V5 | Binding/job/persistence and activation are separate decisions. Stock approval supplies none of them. V4 stays default. |

The only accessible store in this session is Jopia's existing population:
531 operational / 522 historical / one stock run / six primary accounts /
12 operators / 31 migrations, database instance `ad4170793088b7eac71fa3675178ac1f`.
Read-only SQL confirmed this. It is not Lat's instance. Peer/API/web are not
running here; no local population, target inspection, lifecycle, new census,
credential/account change or restart was performed for this package.

## Private prerequisites

Lat uses the retained WSL Linux checkout (previously
`/home/yuri/projects/bloodledger-current`), Node 24.17.0/npm 11.13.0,
lockfile-installed packages, Python 3, Docker, jq and retained healthy
PostgreSQL/peer/orderer/both CAs. API 3000 and editable web 5174 must run the
reviewed integrated source, with existing loopback same-origin configuration.
Port 5175 fixtures do not count. Docker image/tool and genuine OCR prerequisites
are unchanged from the [population runbook](../OPERATIONAL-STOCK-POPULATION.md).

Privately supply three existing paths as shell variables: `LAT_POPULATION_PRIVATE`
(new mode-0700 external artifact directory), `LAT_RUNTIME_ENV` (retained API/
queue/crypto environment) and `LAT_IDENTITY_ROOT` (original generated identities).
Supply mode-0600 `config.json` using the existing primary/operator fields;
`hostValidation=LAT_LOCAL_VALIDATION`, `writersQuiesced=true` only after actual
quiescence. Preserve all usernames/passwords/PINs/operator IDs and existing
crypto keys; do not create replacement accounts. Private source operator is
`USR_SYNTH_REVIEW_ROLE02`; recipient operator is the existing Medix administrator
listed in the population runbook. Read/write operator verification occurs per
command; primary login alone grants no mutation.

The new private ZIP, scenario and original `source.xlsx` are delivered by Buno
through the team's access-controlled transfer and extracted outside Git. Compare
archive and manifest bytes with independently published Buno hashes; do not
trust only a checksum delivered in the same archive. No frozen model/image
resend, refit or new workbook is required. Keep all credentials, raw manifests,
labels/OCR, backups, signed envelopes and detailed reports outside Git/PRs.

## 1. Preserve checkout and freeze competing writers

These are **Lat handoff commands, NOT_RUN on Lat by Jopia**. Commands must stop
on errors; use unique output filenames. Review changes before integration and
preserve Lat's nine unrelated design/evidence edits. No reset, forced checkout,
stash removal or frontend repointing is part of the procedure.

```bash
set -euo pipefail
set -o noclobber
umask 077
git status --short
git fetch origin codex/jopia-lat-population-handoff
# Set PACKAGE_COMMIT to the exact published implementation/evidence head.
git merge-base --is-ancestor eb12ee2c28aa5f1810e325fdb1b074c4801eea27 "$PACKAGE_COMMIT"
git merge-base --is-ancestor c4f99c9c420a380ae64b1a444fc353fff666bd2e "$PACKAGE_COMMIT"
git merge --ff-only "$PACKAGE_COMMIT"
# If a later Lat commit diverges, stop for a scoped reviewed merge; preserve edits.
export BLOODLEDGER_DEV_PRIVATE_DIR="$LAT_POPULATION_PRIVATE"
export BLOODLEDGER_DEV_ENV_FILE="$LAT_RUNTIME_ENV"
export BLOODLEDGER_FABRIC_GENERATED_ROOT="$LAT_IDENTITY_ROOT"

# Stop only Lat's existing general worker; do not create a replacement here.
docker stop bloodledger-persistent-sync-worker
# Also stop scheduled census/expiry/forecast writers; keep API/browser domain
# actions quiescent through accepted T0/restart verification. Reads are allowed.
node scripts/development-data/retained-files.mjs capture \
  --output "$LAT_POPULATION_PRIVATE/files-before.json"
```

If the worker has a different container name, resolve the actual project-owned
service first, record it and use that name; the wrapper additionally refuses a
running Compose `sync-worker`. No account migration/reprovisioning, bootstrap,
CA enrollment, global prune, volume deletion or store copy is authorized.

## 2. Fresh backup and reviewed additive lifecycle

```bash
docker exec bloodledger-postgres-1 pg_dump -U postgres -d bloodledger_dev -Fc \
  > "$LAT_POPULATION_PRIVATE/before.dump"
bash scripts/development-data/validate-stock-backup.sh \
  "$LAT_POPULATION_PRIVATE/before.dump"
# Record the returned actual BACKUP_SHA and same Lat database instance.
docker exec bloodledger-postgres-1 psql -U postgres -d bloodledger_dev -Atc \
  'SELECT name FROM public.pgmigrations ORDER BY name'
# Lat previously has 31 migrations including the stock journal. This package
# adds no migration. Do not run migrate:up blindly or repeat account seeding.

# Read-only lifecycle evidence using the retained admin identity.
(
  source network/scripts/inventory-contract-lib.sh
  generated_root="$BLOODLEDGER_FABRIC_GENERATED_ROOT"
  assert_health_prerequisites readonly
  inventory_tools_run peer lifecycle chaincode querycommitted \
    --channelID bloodledger-dev --name bloodledger-inventory --output json
) > "$LAT_POPULATION_PRIVATE/lifecycle-before.json"
```

Jopia reviews the actual definition and package/source changes before the
following **conditional lifecycle action**. If Lat still has the reviewed
sequence-5 predecessor and correct immutable policy, the existing script
builds/packages this reviewed source and increments to sequence 6/version
`institution-accounts-v2`, preserving endorsement, identities and namespace:

```bash
# Execute only after the actual Lat lifecycle/source/package review.
bash network/scripts/deploy-institution-accounts.sh --apply bloodledger-local \
  > "$LAT_POPULATION_PRIVATE/lifecycle-apply.log"
# Read querycommitted and queryapproved at the resulting sequence, privately.
(
  source network/scripts/inventory-contract-lib.sh
  generated_root="$BLOODLEDGER_FABRIC_GENERATED_ROOT"
  assert_health_prerequisites readonly
  inventory_tools_run peer lifecycle chaincode querycommitted \
    --channelID bloodledger-dev --name bloodledger-inventory --output json
) > "$LAT_POPULATION_PRIVATE/lifecycle-committed-after.json"
(
  source network/scripts/inventory-contract-lib.sh
  generated_root="$BLOODLEDGER_FABRIC_GENERATED_ROOT"
  assert_health_prerequisites readonly
  inventory_tools_run peer lifecycle chaincode queryapproved \
    --channelID bloodledger-dev --name bloodledger-inventory --sequence 6 --output json
) > "$LAT_POPULATION_PRIVATE/lifecycle-approved-after.json"
node scripts/development-data/retained-files.mjs compare \
  --baseline "$LAT_POPULATION_PRIVATE/files-before.json" \
  --output "$LAT_POPULATION_PRIVATE/files-after-lifecycle.json"
```

Do not call the older Sprint-3 `deploy:inventory-contract` sequence-2 command.
An already-approved identical v2 package needs no new upgrade. A differing
v2 package, unexpected sequence or changed policy stops for a separate version/
lifecycle review; do not override script refusal. Package IDs/archive hashes
are generated and reviewed on Lat's machine, not copied as Jopia's approval.

Rebuild API from the integrated checkout and restart its existing containers,
preserving the private environment, mount roots, accounts and frontend work:

```bash
docker run --rm -v "$PWD:/workspace" -w /workspace node:24.17.0 \
  npm run build --workspace @bloodledger/api
docker restart bloodledger-persistent-api
curl --fail --silent --show-error http://127.0.0.1:3000/healthz
docker restart bloodledger-persistent-web
bash scripts/development-data/run.sh stock inspect \
  --config "$LAT_POPULATION_PRIVATE/config.json" \
  --output "$LAT_POPULATION_PRIVATE/inspection.json"
```

The wrapper compares installed actor policy against repository policy and obtains
QSCC genesis plus actual database/volume identity. Review the saved fresh
fingerprint and principals before setting config target/policy digests. Expect
9 operational / 522 historical / zero stock runs / six primaries / 12 operators
and 31 migration names. Existing 19 commands, four requests and two reservations
are unrelated baseline, not permission to modify them. Any deviation requires
review; never repair it by resetting or editing retained records.

## 3. Receive the successor and review before preview

Integrate only Buno's exact reviewed successor generator/verifier commits,
preserving unrelated work. Publish/pin the resulting integrated code head.
Current V1 Python cannot replay a successor; **this is still a blocker**.
Supply the private sealed scenario-review object specified by
[stock-review.mjs](../../scripts/development-data/stock-review.mjs), with actual
source/target acceptance reference and separately reviewed `SCENARIO_REVIEW_SHA`.
Its target/policy hashes must match the new inspection/config. A review file
prepared from the supplied artifact is a proposal until the owners accept it.
Do not copy an ACCEPTED flag to simulate that decision.

```bash
sha256sum "$LAT_POPULATION_PRIVATE/source.xlsx" \
  "$LAT_POPULATION_PRIVATE/scenario.json" "$LAT_POPULATION_PRIVATE/scenario.zip"
python3 scripts/operational-scenario/verify.py \
  --workbook "$LAT_POPULATION_PRIVATE/source.xlsx" \
  --manifest "$LAT_POPULATION_PRIVATE/scenario.json" --sha256 "$SCENARIO_FILE_SHA"

stock_review=(--scenario-review "$LAT_POPULATION_PRIVATE/scenario-review.json" \
  --approve-scenario-review "$SCENARIO_REVIEW_SHA")
bash scripts/development-data/run.sh stock preview "${stock_review[@]}" \
  --config "$LAT_POPULATION_PRIVATE/config.json" \
  --archive "$LAT_POPULATION_PRIVATE/scenario.zip" \
  --scenario "$LAT_POPULATION_PRIVATE/scenario.json" \
  --workbook "$LAT_POPULATION_PRIVATE/source.xlsx" \
  --output "$LAT_POPULATION_PRIVATE/preview.json"
```

Preview checks every recognized field, exact source replay, backend IDs/label
collisions, retained stock/global FEFO, locally VALID original receipts and
current ledger/projection, policy/principals and baseline fingerprints. Review
actual 522 units / 24 reservations / 559 commands and all proposed members.
If older eligible units displace intended members, stop and return the conflict
to Buno/Jopia for a reviewed revision. Preserve old units unchanged.

## 4. Explicit confirmation, apply, same-envelope resume

After actual field/member/preview review, bind the returned `PREVIEW_SHA` and
validated `BACKUP_SHA`. Confirmation records the real time and creates a new
frozen digest; it is a separate approval boundary from source/target review.

```bash
bash scripts/development-data/run.sh stock confirm "${stock_review[@]}" \
  --config "$LAT_POPULATION_PRIVATE/config.json" \
  --manifest "$LAT_POPULATION_PRIVATE/preview.json" --approve-manifest "$PREVIEW_SHA" \
  --backup "$LAT_POPULATION_PRIVATE/before.dump" --approve-backup "$BACKUP_SHA" \
  --output "$LAT_POPULATION_PRIVATE/execution.json"
# Jopia/Lat review the actual returned EXECUTION_SHA before submission.
bash scripts/development-data/run.sh stock apply "${stock_review[@]}" \
  --config "$LAT_POPULATION_PRIVATE/config.json" \
  --manifest "$LAT_POPULATION_PRIVATE/execution.json" --approve-manifest "$EXECUTION_SHA" \
  --backup "$LAT_POPULATION_PRIVATE/before.dump" --approve-backup "$BACKUP_SHA" \
  --report "$LAT_POPULATION_PRIVATE/apply-report.json"

# Exact replay; also use this after an interrupted/ambiguous submission.
bash scripts/development-data/run.sh stock resume "${stock_review[@]}" \
  --config "$LAT_POPULATION_PRIVATE/config.json" \
  --manifest "$LAT_POPULATION_PRIVATE/execution.json" --approve-manifest "$EXECUTION_SHA" \
  --backup "$LAT_POPULATION_PRIVATE/before.dump" --approve-backup "$BACKUP_SHA" \
  --report "$LAT_POPULATION_PRIVATE/replay-report.json"
```

A failure stops safely and may retain the population writer lock. Preserve its
journal, execution, command payload and original envelope. Report the stable
error/status privately; do not regenerate submitted work. Local QSCC recovery
precedes resubmission; only explicit not-found permits the original envelope,
and only within the approved population window. Commitment/projection recovery
can occur later, but new submissions cannot. Operator rate limits stay intact.
Never restore the dump over live ledger-backed PostgreSQL to undo acceptance.

## 5. Local T0, API/workflows, independent replay and restart

Within Buno's newly reviewed T0 window, run the original execution:

```bash
bash scripts/development-data/run.sh stock verify "${stock_review[@]}" \
  --config "$LAT_POPULATION_PRIVATE/config.json" \
  --manifest "$LAT_POPULATION_PRIVATE/execution.json" --approve-manifest "$EXECUTION_SHA" \
  --report "$LAT_POPULATION_PRIVATE/t0-report.json"
node scripts/development-data/retained-files.mjs compare \
  --baseline "$LAT_POPULATION_PRIVATE/files-before.json" \
  --output "$LAT_POPULATION_PRIVATE/files-after-population.json"

# Existing six-account test credentials stay private; use Lat's actual config.
export BLOODLEDGER_ACCOUNT_CONFIG="$LAT_BROWSER_ACCOUNT_CONFIG"
export BLOODLEDGER_BROWSER_BASE_URL=http://127.0.0.1:5174
BLOODLEDGER_NAVIGATION_REPORT="$LAT_POPULATION_PRIVATE/browser-before.json" \
  node tests/frontend/operational-navigation-live.mjs

# Ordinary retained services restart; keep other writers quiescent until comparison.
docker stop bloodledger-persistent-web bloodledger-persistent-api
docker restart bloodledger-postgres-1 bloodledger-orderer0-1 \
  bloodledger-ca-mediatrix-1 bloodledger-ca-orderer-1 bloodledger-peer0-mediatrix-1
# Wait for existing database/Fabric health checks to PASS before starting API.
bash scripts/bloodledger-dev.sh status
docker start bloodledger-persistent-api
curl --fail --silent --show-error http://127.0.0.1:3000/healthz
docker start bloodledger-persistent-web
bash scripts/development-data/run.sh stock verify "${stock_review[@]}" \
  --config "$LAT_POPULATION_PRIVATE/config.json" \
  --manifest "$LAT_POPULATION_PRIVATE/execution.json" --approve-manifest "$EXECUTION_SHA" \
  --report "$LAT_POPULATION_PRIVATE/after-restart-report.json"
node scripts/development-data/retained-files.mjs compare \
  --baseline "$LAT_POPULATION_PRIVATE/files-before.json" \
  --output "$LAT_POPULATION_PRIVATE/files-after-restart.json"
BLOODLEDGER_NAVIGATION_REPORT="$LAT_POPULATION_PRIVATE/browser-after.json" \
  node tests/frontend/operational-navigation-live.mjs
```

Compare the two population reports' original transaction/block/commitment
receipts, IDs, twenty series, reservation/member map and census ID/scheduled/
captured/digest/forty rows exactly, plus browser component IDs and preservation.
Late next-day verification reads the original persisted T0 and truthfully shows
STALE API evidence when appropriate. It does not create a new backdated census.
A missed uncaptured T0 remains MISSED_WINDOW and requires a new reviewed plan.
Restore Lat's existing general worker only after writer_lock=false and successful
comparisons (`docker start bloodledger-persistent-sync-worker`); record which
other preexisting scheduled writers are restored. Fault injection is optional,
requires separately reviewed private configuration, and never substitutes for
honest NOT_RUN failure/queued cases.

Expected unchanged-distribution reconciliation, **conditional on reviewed
successor and old nine preservation**:

| Population | AVAILABLE | RESERVED | IN_TRANSIT | EXPIRED | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Scenario additions | 486 | 36 | 0 | 0 | 522 |
| Original operational baseline | 6 | 1 | 1 | 1 | 9 |
| Combined operational | 492 | 37 | 1 | 1 | 531 |
| Historical namespace | Separate | Separate | Separate | Separate | 522 |

Require 559 distinct **Lat-local** VALID commitments for the accepted original
plan, all current ledger assets, actual commitment observations, 24 ACTIVE
reservations / 36 members (18 TRANSFER + 18 LOCAL_RELEASE), 13 destination
requests, original 18 seed receipts plus Lat's unrelated nineteenth command
unchanged. Per-series additions must equal Buno's twenty rows, including the
AB+ platelet zero. Forty census combinations exclude historical rows and
reconcile reportable AVAILABLE+RESERVED separately from date-derived eligible
AVAILABLE. Do not copy Jopia's 491 eligible count: recalculate for new dates and
Lat's preserved old expiries. Historical unknown dates/purpose remain null.

Independently verify real-cookie 5174→3000 V2.1 reads, all five components
including CRYO, donation/collection/expiry/issuer/custodian/version fields,
component→reservation→TRANSFER request and LOCAL_RELEASE purpose/reference→
member navigation. No local-release detail endpoint exists. Read alerts/audit,
state versus lifecycle, institution/role denial, missing/null resources and
logout/401 clearing. The live navigation helper covers six-account scope,
transfer/member/missing/null/401, detects a real LOCAL_RELEASE when present,
and confirms V4 default; manually confirm the census UI and alert/audit reads.
Live QUEUED/FAILED/CONFLICT scenarios are NOT_RUN unless actually executed;
HTTP fixtures are separate software regression, never local population proof.

## Evidence record and remaining boundaries

Package-specific checks and exact grouped commits are recorded below after
execution. They are **JOPIA_SELF_VALIDATION of tooling**, not Lat local stock
acceptance. Buno's original scenario/source tests remain attributed to their
owner. Lat fills actual target/backup/review/preview/execution hashes, lifecycle,
per-series/local-ledger/census/browser/preservation/replay/restart results and
publishes safe aggregates as **LAT_LOCAL_VALIDATION**, keeping details private.

V4 default; V5 binding/job/persistence/activation separate. Near-expiry remains
disabled. Human UAT, research custody/consent/instrument, RQ-07/RQ-14, physical
Android OCR, full NFR-06, clinical/regulatory readiness, deployment and Testing
exit remain open. PR26/27/28/29/30 remain open where integration is unresolved.
