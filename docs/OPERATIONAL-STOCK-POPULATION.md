# Controlled operational stock population

Status: Accepted implementation scope by the user's Jopia instruction on
2026-10-08; retained-target population acceptance remains pending.
Classification: **SIMULATION_ONLY**. Jopia owns backend implementation and
self-validation; Buno owns source/scenario lineage; Lat owns independent
retained-host and browser verification.

## Selected Testing task and decisions

TP-STOCK-01 selects technical preparation under BL-TST-01: FR-01–05, FR-08–09,
FR-12–14, BR-INV-01–07, NFR-01–02/05/08–09. It implements PR27 using PR26's
separately versioned scenario. ADR-035 confirmed OCR remains the only intake
path; this is no workbook-import exception. Existing account capabilities and
immutable Fabric policies remain authoritative.

The user's accepted plan retains Buno's proposed scenario-only
`SIM_INSTITUTION_01 -> INST_MEDIATRIX` mapping, separate Mediatrix issuer and
custodian, Medix destination and `SYNTHETIC_522_DATES_V1` nonclinical offsets.
Acceptance is conditional on the exact source/scenario hashes, current target,
operator authority and global FEFO preflight. It does not map historical or
forecast evidence, approve clinical shelf life, or authorize a different target.

V1 population is permitted in [2026-10-08T08:00:00Z,
2026-10-09T00:00:00Z); verify T0 counts in [2026-10-09T00:00:00Z,
2026-10-09T08:00:00Z). A missed window needs a new Buno scenario version and
review. Submitted evidence may be recovered afterward, but unsubmitted work
must stop and T0 acceptance cannot be invented.

## Population and preservation contract

Start from retained integration `954f170b840fce1a346bb3bd393748a731be1913`, not
main. Source generator/evidence revisions are `7e29fd98` / `17e22d1e`.
The source/scenario specifications and hashes have one home in
[Buno's evidence](handoffs/BUNO-OPERATIONAL-STOCK-522-EVIDENCE.md).

The controlled runner uses a distinct scenario journal, exact target/policy
digests, six existing primary accounts, genuine OCR, explicit confirmation,
bound operator grants and official V2.1 command endpoints. Raw label
images/OCR text remain volatile. Private credentials, scenario manifests,
labels, backups, envelopes and reports remain outside Git.

Preview is read-only for domain data. It checks collisions and global FEFO
against all eligible stock and predicts backend IDs using existing backend
rules. Confirmation records the actual instant and freezes command payloads.
Apply requires the exact reviewed execution digest and validated backup; resume
retains that manifest, actor, payload, idempotency key and signed envelope.
Every accepted command requires its own locally verified VALID Fabric
transaction and block before projection or acceptance. An unavailable ledger
query never permits blind resubmission.

Register all 522 units; then TRANSFER before LOCAL_RELEASE per series, with
backend-ID ordering for ties. Establish 24 ACTIVE reservations covering
18 TRANSFER and 18 LOCAL_RELEASE units. Do not dispatch or complete them.
If older eligible stock displaces intended members, stop for reviewed scenario
revision; never skip, consume, relabel or re-date unrelated stock.

Preserve baseline rows, original commitments, six primary credentials, actors,
keys, identities and volumes. The conditional total is 531 components:
492 AVAILABLE, 37 RESERVED, one IN_TRANSIT and one EXPIRED, only if the existing
nine remain unchanged. Historical 522 stays separately namespaced.
Verification must report per-series additions, whole-database totals,
40 actual operational census combinations and preserved row fingerprints.

## API and Lat navigation

The actual V2.1 component read exposes `componentId`, `donationId`,
`issuerInstitutionId`, `institutionId`, `collectedAt`, `expiresAt`,
`inventoryStatus`, `inventoryVersion`, `reservationId` and
`reservationVersion`. OpenAPI owns the complete response shape; retain these
wire names and CRYO support.

Row -> component detail -> reservation detail. Reservation purpose and member
versions come from `/api/v2/reservations/{reservationId}`. TRANSFER uses its
`transferId` to find the scoped request in `/api/v2/transfers`; LOCAL_RELEASE
uses `localReleaseId` and reservation detail. No separate local-release detail
endpoint exists. Null references produce no link; absent/denied/missing states
must not reveal another institution. Exact Donation No. material is private.

Commands retain QUEUED, SUBMITTING, LEDGER_COMMITTED_PROJECTION_PENDING,
COMMITTED, RETRY_WAIT, FAILED and CONFLICT distinctions. Historical unknown
collection/expiry/purpose remain null. Near-expiry remains disabled.

Lat verifies ordinary cookies and real reads on 5174 -> 3000 without fixture
interception, including isolation, navigation, pending/error states, logout
and restart. Jopia's disclosed self-validation cannot substitute for Lat's
host evidence. V4 stays default; V5 job/binding review, activation, human UAT,
physical Android OCR, full latency, clinical interpretation and deployment
remain separate.

## Private configuration and controlled commands

Integrate this branch into the reviewed retained integration before running
population. Reinspect its thirty-migration/six-account baseline; take the
backup before applying the new forward migration
`20261008040000000_add-operational-stock-journal.js`, then rebuild/restart the
API using the retained-host startup runbook. This adds the thirty-first
migration. Never run account provisioning, rollback, reset or enrollment to
make the target match. The current implementation host is blocked as recorded
in [Jopia's evidence](handoffs/JOPIA-OPERATIONAL-STOCK-IMPLEMENTATION-2026-10-08.md).

Use an external mode-0700 directory and mode-0600 JSON configuration with
`classification=SIMULATION_ONLY`, `scope=PERSISTENT_LOCAL_DEVELOPMENT`,
authentication mode `INSTITUTION_OPERATOR_V1`, `labelSequenceStart=1000` and
`writersQuiesced=true` only after competing writers are actually stopped.
The selected label range is a preview proposal, subject to collision checks.
`accounts.coordinator` and `accounts.recipient` each need the existing primary
`username`, `password`, individual `operatorId` and eight-digit `pin`.
The source operator is `USR_SYNTH_REVIEW_ROLE02`; Medix's administrator is
`USR_OP_BA806C9407FF05B6F3ECDA4D9CF4FCD9`. Both require installed ROLE-02
capabilities; primary accounts alone do not authorize mutations. Credentials
must come from private custody, never a PR or generated example.

Set `targetSha256` and `policySha256` only from an independently reviewed live
inspection. The previously recorded target digest is a reference, not approval.
Use `BLOODLEDGER_DEV_ENV_FILE` for the retained private environment file and
`BLOODLEDGER_DEV_PRIVATE_DIR` to mount the external artifact directory. The
original workbook, delivered ZIP and extracted manifest must reside there.
The wrapper accepts only the local development PostgreSQL/API/Fabric targets
and refuses a running general synchronization worker.

The following are executable handoff commands; live population commands are
**NOT_RUN on this host**. Variables refer to privately held paths and reviewed
hashes. Inspection can run before the new migration. Forecast maintenance
uses this same primary/operator configuration through `run.sh inspect` and
`run.sh census`; its existing separate binding/job approvals remain mandatory.

```bash
export BLOODLEDGER_DEV_PRIVATE_DIR="$PRIVATE"
bash scripts/development-data/run.sh stock inspect --config "$PRIVATE/config.json"
umask 077
docker exec bloodledger-postgres-1 pg_dump -U postgres -d bloodledger_dev -Fc > "$PRIVATE/before.dump"
bash scripts/development-data/validate-stock-backup.sh "$PRIVATE/before.dump"
# Review the returned backup SHA and instance ID; add only the stock migration.
python3 scripts/operational-scenario/verify.py --workbook "$PRIVATE/source.xlsx" \
  --manifest "$PRIVATE/scenario.json" \
  --sha256 4ad33820481b1e331e71ac03bbf37ed719096a3fc33c6321829a73d7e3b5fe70
bash scripts/development-data/run.sh stock preview --config "$PRIVATE/config.json" \
  --archive "$PRIVATE/buno-operational-stock-522-v1.zip" \
  --scenario "$PRIVATE/scenario.json" --workbook "$PRIVATE/source.xlsx" \
  --output "$PRIVATE/preview.json"
# Review every recognized field, proposed member, target and policy first.
bash scripts/development-data/run.sh stock confirm --config "$PRIVATE/config.json" \
  --manifest "$PRIVATE/preview.json" --approve-manifest "$PREVIEW_SHA" \
  --backup "$PRIVATE/before.dump" --approve-backup "$BACKUP_SHA" \
  --output "$PRIVATE/execution.json"
# Review the newly frozen execution hash, including actual confirmation time.
bash scripts/development-data/run.sh stock apply --config "$PRIVATE/config.json" \
  --manifest "$PRIVATE/execution.json" --approve-manifest "$EXECUTION_SHA" \
  --backup "$PRIVATE/before.dump" --approve-backup "$BACKUP_SHA" \
  --report "$PRIVATE/apply-report.json"
bash scripts/development-data/run.sh stock resume --config "$PRIVATE/config.json" \
  --manifest "$PRIVATE/execution.json" --approve-manifest "$EXECUTION_SHA" \
  --backup "$PRIVATE/before.dump" --approve-backup "$BACKUP_SHA" \
  --report "$PRIVATE/replay-report.json"
# At T0, within the verification window:
bash scripts/development-data/run.sh stock verify --config "$PRIVATE/config.json" \
  --manifest "$PRIVATE/execution.json" --approve-manifest "$EXECUTION_SHA" \
  --report "$PRIVATE/t0-report.json"
```

The wrapper restores the approved backup into a disposable network-isolated
PostgreSQL container and compares its development instance identity. It never
restores over the retained database. Committed ledger history cannot be undone
by restoring an older PostgreSQL backup.

New grant attempts are paced at least 31 seconds apart per institution;
successful attempts count toward the existing 30-per-15-minute protection.
Expect several hours for intake. A rejected/rate-limited grant stops safely;
use the same execution file for resume after the existing window clears.
Do not relax the limit or alter dates. Fault-injection options
`--stop-after`, `--pause-after-submit` and `--pause-after-commit` additionally
require privately reviewed `validationFaultInjection=true`.

## Durable recovery and acceptance

`operational_stock_runs` holds immutable hashes, private scenario/backend ID
mapping and request digests, excluding recognized Donation No. values.
`operational_stock_commands` owns only existing durable commands and saves
the original signed transaction before submit. General workers exclude those
commands; the database's single active population and an advisory lock prevent
overlapping executions. The API gates inventory writes before provisional
intake and checks command actor ownership again during enqueue. Primary login
and action-bound operator authorization remain required.

A stopped run retains its writer gate. Resume inspects saved transaction/block
evidence first. Only an explicit not-found result permits submitting the exact
saved envelope, and only inside the population window. A committed operation
retries its projection; an outage, different owner/hash/version or invalid
receipt fails closed. `commitmentFirstObservedAt` is the actual first successful
local inspection time, not an invented block timestamp or confirmation time.

Apply reports before T0 have `t0Verification=PENDING`. Within the reviewed
verification window, verify reconciles all receipts/current assets/API reads,
captures the independent forty-series operational census, verifies its API
evidence and releases the writer gate only after preservation checks pass.
Later evidence recovery reports `MISSED_WINDOW`; it cannot establish T0 PASS.
The captured census ID is journaled before capture for interruption recovery.
Account session/grant/attempt/audit tables are transient authentication evidence;
domain, account/credential, operator, original command/receipt and historical
tables are fingerprinted. Unexpected baseline differences stop acceptance.

The local-release request wire shape stays unchanged. The API now freezes
globally eligible FEFO IDs and expected versions, and sends canonical
`ReserveComponents` through the gateway; the saved request digest permits
exact replay even after inventory changes. Stale versions and non-FEFO
membership still fail at chaincode. No new permission or direct stock insert
is introduced. Existing `/api/v2/transfers` request entries use snake-case
`transfer_id`, `source_institution_id` and `destination_institution_id`;
Lat should match the reservation's `transferId` against that existing wire
shape without changing it.

After accepted apply/replay/T0 verification, follow the ordinary retained-host
stop/start commands, preserving all project volumes and generated identities,
then verify with the identical execution hash and a new report path. Compare
receipt IDs/blocks, per-series counts, forty census rows, baseline fingerprints,
identity/volume fingerprints and ordinary-cookie API reads. Retained restart
and Lat's 5174 → 3000 browser acceptance remain pending until the real target
is available. Neither fixture interception nor the disposable database probe
constitutes that evidence.
