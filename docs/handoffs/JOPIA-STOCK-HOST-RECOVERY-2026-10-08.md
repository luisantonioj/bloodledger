# Jopia stock host recovery — 2026-10-08

Classification: **SIMULATION_ONLY**. Disclosed Jopia self-validation. This
follow-up supersedes the account/service/archive prerequisite blockers in
[the initial implementation evidence](JOPIA-OPERATIONAL-STOCK-IMPLEMENTATION-2026-10-08.md).
Population acceptance and Lat's independent browser acceptance remain separate.
The exact live OCR preview was confirmed by the user in this conversation;
the user subsequently approved the exact execution hash. New operational
receipts and full population acceptance remain pending.

## Target and preserved baseline

The user's instruction to fix the blockers authorized recovery on Jopia's
existing host. Lat's earlier evidence describes Yuri's distinct WSL target;
its six legacy actors, manifest and local receipts were not copied as proof.
Jopia's existing two actors were migrated through the opt-in
`JOPIA_RETAINED_TWO_ACCOUNT_V1` contract. Default six-actor migration behavior
and its hashes remain unchanged.

| Evidence | Actual local result |
| --- | --- |
| Target digest | `ee1fcef55cde4b8d698b45faa79a091009acd2e391f0619db1abfc693422afb8` |
| Genesis digest | `edf378b74c9833fcfa12b56e7bc40420b10850a9dee830b355639eba8a7fad1d` |
| Database instance | `ad4170793088b7eac71fa3675178ac1f` |
| PostgreSQL | `bloodledger_dev`; retained `bloodledger_postgres-data`, created 2026-07-30 |
| Schema | Five forward migrations applied; 26 → 31; no applied migration edited |
| Primary accounts | Six exact policy-defined primary institutions; all ordinary-cookie logins pass |
| Original users | Both IDs, usernames, password algorithm/salt/verifier, institution assignments and role rows unchanged |
| Account mapping digest | `858d125b5170a2d4342edf273ec9fc26c8bc6e050a9dbf74e5f7999a467b7e22` |
| Frozen account manifest | `ea55d782247df8701ce97c3597abb85643f77ed156dea03c63713ac6922b5b39` |
| Account apply/replay | `APPLIED`, first `replayed:false`; identical resume `replayed:true` |
| Domain preservation | All 44 migration fingerprints unchanged after apply/replay and service/infrastructure restart |
| Operational baseline | Nine components: 6 AVAILABLE, 1 RESERVED, 1 IN_TRANSIT, 1 EXPIRED; original 18 VALID Fabric transactions verified again |
| Historical baseline | 522 components; all 524 VALID Fabric transactions and current members verified again |
| Fabric identities | All 110 original generated-file fingerprints unchanged |
| Volumes | Five PostgreSQL/peer/orderer named volume identities, creation times and mount points unchanged |

One retained AVAILABLE component already has a past label expiry. Its original
status and dates remain unchanged. Current census/forecast eligibility must
use actual expiry; population reconciliation does not silently expire or
re-date the baseline to force expected totals.

## Infrastructure and read-contract repair

The peer's exit 127 came from an invalid Docker Desktop socket bind after host
restart. Recreating only its container through the original Compose definition
rebound the socket and reused the exact existing MSP/TLS and named volumes.
The reopened channel had height 595. No reset, enrollment or ledger restore ran.

The reviewed institution account package was installed at sequence 5; its
actual local package differs from Yuri's package archive hash. Genuine lifecycle
transactions were VALID. Live preview then found that `ReadComponentByIdentity`
has no policy-version field and defaulted to the four-type V2 list, rejecting
CRYO. Its read list now follows the existing five-type institution policy.
Installed gateway/actor checks, immutable policy files and write authority
remain unchanged. The fix runs at sequence 6, version `institution-accounts-v2`.

Actual sequence-6 package ID:
`bloodledger-institution-accounts-v1_0ac7a6a9e270:0b755f14690e539166f26b23811d8c662a972889d7bc0f7721259326c6f30104`.
The retained package label keeps its original prefix; lifecycle version is v2.
Approval transaction:
`208c02e126bd90f3bc6b4549637f46c888db5028d0b1898b9f5434b69862101d`.
Commit transaction:
`e72826d8b9fa253e45b6af3fc6e5cb12c25186f6a2d4e4aab8c4bc30fd758584`.
Both returned VALID from the local peer. Post-restart channel height was 599.
These lifecycle receipts are separate from operational population receipts.

## Artifact receipt

Authenticated Drive metadata correctly identified the 15,853-byte ZIP, but its
streamed link still returned HTTP 403. The user provided the local Downloads
path. Its actual bytes matched Buno's independently published ZIP SHA-256:
`cf94af36cbc672d58377b13c0e3e9ebbd922289e464f15e9214e03d4abb2c206`.
The archive contains `scenario.json`, `SHA256SUMS`, `validation-summary.json`
and `TRANSFER-AND-EVIDENCE.md`. No ZIP content was committed.

The delivered scenario matches both the pinned file hash and the previous
exact reproduction. Buno's verifier against the original workbook passed:
20 series, 522 singleton donations/units, 486 AVAILABLE, 36 RESERVED,
24 reservations and 18 units for each purpose. Canonical/file/workbook hashes
remain in [Buno's evidence](BUNO-OPERATIONAL-STOCK-522-EVIDENCE.md).

## Reproducible recovery checks

Private configuration, credentials, backups and reports are mode 0600 in
mode-0700 ignored or external directories. No password/PIN is printed. The
new wrappers support `BLOODLEDGER_FABRIC_GENERATED_ROOT` to bind the original
identity directory read-only when using the isolated implementation checkout.
`BLOODLEDGER_DEV_ENV_FILE` selects the existing retained private environment.

```bash
# Original checkout; only the peer container is recreated.
docker compose up -d --no-deps --force-recreate peer0-mediatrix
bash network/scripts/query-channel.sh

# Isolated integration checkout, original environment and identities retained.
docker exec bloodledger-postgres-1 pg_dump -U postgres -d bloodledger_dev -Fc > "$PRIVATE/pre-recovery.dump"
docker exec -i bloodledger-postgres-1 pg_restore --list < "$PRIVATE/pre-recovery.dump"
docker run --rm --network container:bloodledger-postgres-1 \
  --env-file "$ORIGINAL/.env" -v "$PWD:/workspace" -w /workspace \
  node:24.17.0 npm run migrate:up
bash scripts/institution-accounts/run.sh inspect --config "$CONFIG" --output "$TARGET"
bash scripts/institution-accounts/run.sh preview --config "$CONFIG" --output "$PREVIEW"
bash scripts/development-data/validate-stock-backup.sh "$BACKUP" JOPIA_RETAINED_TWO_ACCOUNT_V1
bash network/scripts/deploy-institution-accounts.sh --apply bloodledger-local
bash scripts/institution-accounts/run.sh apply --config "$CONFIG" \
  --manifest "$PREVIEW" --approve-manifest "$ACCOUNT_HASH" --backup "$BACKUP" --output "$APPLIED"
bash scripts/institution-accounts/run.sh resume --config "$CONFIG" \
  --manifest "$PREVIEW" --approve-manifest "$ACCOUNT_HASH" --backup "$BACKUP" --output "$REPLAY"
bash scripts/institution-accounts/run.sh verify --config "$CONFIG" --output "$VERIFIED"
```

The pre-account custom backup was restored completely into disposable
PostgreSQL 17.10 with network disabled and tmpfs storage, using
`--exit-on-error --no-owner --no-acl`. The validated SHA-256 was
`972f4ab82dd89b804870377ce25f36820ef3f06e1e9b775fef915bbfff35062a`;
the restored instance matched the actual target. No older database was restored
over the retained ledger.

| Check | Result |
| --- | --- |
| Versioned two-account migration | PASS: wrong mapping/version/hash rejection, concurrent apply, exact replay, credential/role and domain preservation |
| Existing disposable account suite | PASS: 150 assertions, including the operational journal probe |
| Chaincode format/lint/type/static/unit | PASS: 42 tests, including CRYO identity read/replay and unknown actor/type/gateway denial |
| Runner tests | PASS: 22 tests |
| API tests/type/static | PASS: 125 tests and existing static boundary |
| Repository format/workspace/version/env/database | PASS |
| Dependency audit | PASS: zero vulnerabilities with `--omit=dev --audit-level=high` |
| Secret scan | PASS: history/index/candidate; Gitleaks 8.30.1, unchanged allowlist |
| Real browser 5174 → 3000 | PASS before and after restart: six HttpOnly-cookie logins, scope, historical rows, census, V4 default, V5 unavailable, operator prompt/cancellation, DOH denial and protected-data clearing; no interception |
| Ordinary restart | PASS: PostgreSQL, orderer, peer, API and web; identity/domain/volume preservation verified |
| Live stock intake/reservation/559 VALID receipts | IN_PROGRESS on the corrected approved execution; two genuine interruption/recovery/restart receipts pass; full 559/T0 acceptance pending |
| Live OCR preview | PASS: all 522 fields recognized at confidence ≥90; collision/global FEFO/preservation checks passed; exact hash confirmed by user |
| Independent Lat acceptance | NOT_RUN; Jopia browser checks are self-validation |

The browser regression previously assumed an acknowledgement from an old
operator belonged to the new primary account. It now compares the UI against
actual scoped API acknowledgement ownership. No historical acknowledgement
was changed and no new acknowledgement was submitted to force a test pass.

V4 remains the default and V5 unavailable/separately gated. Physical Android
OCR, human UAT, full latency, institutional/clinical claims and deployment
remain outside scope. Population results must be appended only after actual
execution and independently verified local receipts.


## Durable runtime and confirmed preview

The implementation worktree now lives at
`/home/luisantonioj/projects/bloodledger/build/jopia-operational-stock`.
Private archive/workbook/configuration/backup/preview/review artifacts live at
`/home/luisantonioj/projects/bloodledger/build/operational-stock-private`.
Both paths are ignored by the original checkout. Its tracked tree remains clean.
The original API/web containers and the intermediate recovery containers were
stopped and renamed, preserving their configuration. New API/web containers use
the durable worktree and original read-only Fabric identities. No volume reset,
identity replacement or general worker start occurred.

Live preview generated at `2026-10-08T09:54:50.683Z`:
`fdb2daee3d52a200177ca03d41f5ac9002fe0fcf918fd3e7a7baa2665e8d6701`.
All 522 actual generated synthetic labels passed Tesseract/parser recognition,
minimum field confidence 90. Before OCR, current ledger/API/database identity,
18 original receipts, both projection and ledger identity collisions and global
FEFO membership passed. After OCR all preserved fingerprints still matched.
Private readable field review includes all labels, confidence scores, stable
backend mappings and intended reservation membership. The user confirmed this
exact preview hash; it does not imply approval of an unspecified execution hash.
No raw images/unrestricted OCR text or label references were added to Git.

Fresh post-recovery backup `before-stock.dump` was completely restored into
isolated PostgreSQL 17.10 and matched the actual database instance. Its SHA-256 is
`a6a32ee213d48dacb32b44f04afdafa7d6d92460609aeceaa2f6517fe880b247`.

Tested durable startup and preview commands:

```bash
ORIGINAL=/home/luisantonioj/projects/bloodledger
IMPLEMENTATION="$ORIGINAL/build/jopia-operational-stock"
PRIVATE="$ORIGINAL/build/operational-stock-private"
cd "$IMPLEMENTATION"
export BLOODLEDGER_FABRIC_GENERATED_ROOT="$ORIGINAL/network/generated"
export BLOODLEDGER_DEV_ENV_FILE="$ORIGINAL/build/development-local/runtime.env"
export BLOODLEDGER_DEV_PRIVATE_DIR="$PRIVATE"
# Startup was performed after explicitly stopping/renaming existing API/web
# containers. Do not repeat startup against already existing containers.
BLOODLEDGER_DEV_ENV_FILE="$IMPLEMENTATION/build/recovery/runtime.env" \
  bash scripts/development-data/start-local.sh --apply
bash scripts/development-data/run.sh stock inspect --config "$PRIVATE/stock-runtime.json"
bash scripts/development-data/run.sh stock preview \
  --config "$PRIVATE/stock-runtime.json" --scenario "$PRIVATE/scenario.json" \
  --archive "$PRIVATE/buno-operational-stock-522-v1.zip" \
  --workbook "$PRIVATE/source.xlsx" --output "$PRIVATE/live-preview.json"
```

The preview command ran before the worktree moved; its output bytes and seal
were independently checked after moving. Re-running preview intentionally makes
new capture timestamps and a different preview hash and requires fresh review.


The exact confirmed preview was frozen at `2026-10-08T10:01:47.357Z` with
execution SHA-256
`0c3bda8baba5efd34e5d85e21c8874c5cabd32b706bd0033b17bb061aad00776`.
It contains 559 commands. Full recognized-field/payload/key provenance remains
private. The user approved this exact execution, target and backup in the same
conversation, including controlled interruption/recovery/replay/restart.
Population evidence remains pending.

```bash
# PASS: exact user-confirmed preview, actual confirmation time, restored backup.
bash scripts/development-data/run.sh stock confirm \
  --config "$PRIVATE/stock-runtime.json" --manifest "$PRIVATE/live-preview.json" \
  --approve-manifest fdb2daee3d52a200177ca03d41f5ac9002fe0fcf918fd3e7a7baa2665e8d6701 \
  --backup "$PRIVATE/before-stock.dump" \
  --approve-backup a6a32ee213d48dacb32b44f04afdafa7d6d92460609aeceaa2f6517fe880b247 \
  --output "$PRIVATE/execution.json"
# Approval recorded; apply/recovery started, final acceptance still pending.
bash scripts/development-data/run.sh stock apply \
  --config "$PRIVATE/stock-runtime.json" --manifest "$PRIVATE/execution.json" \
  --approve-manifest 0c3bda8baba5efd34e5d85e21c8874c5cabd32b706bd0033b17bb061aad00776 \
  --backup "$PRIVATE/before-stock.dump" \
  --approve-backup a6a32ee213d48dacb32b44f04afdafa7d6d92460609aeceaa2f6517fe880b247 \
  --output "$PRIVATE/population.json"
```

## Recovery implementation commits and remaining Lat work

- `8b708dcaf455d0418b77a46734c10b5b45e8df5b`: strict versioned two-account
  mapping, immutable default mapping, private manifest checks, preserved
  credentials/roles/domain data, disposable database regression and backup
  baseline validation.
- `34e10d6cda1c9175d028192e59bc4e6446f61e5e`: institution CRYO identity reads,
  deterministic regression and retained-identity deployment wrapper; no write
  policy or permissions expansion.
- `095c808e2ba02195602c65fc7de59ea466867788`: original identity read-only mounts,
  durable startup, private OCR progress and actual scoped acknowledgement
  ownership in live browser checks.

Lat can use the six account/PIN credentials in the local ignored
`build/recovery/LOCAL-ACCOUNT-ACCESS.txt`; this file is never published.
The durable UI is `http://127.0.0.1:5174`, backed by the actual API on 3000.
Lat still independently verifies six-account ordinary-cookie behavior,
scope, logout and restart. Once actual population receipts and reconciliation
pass, verify component → detail → reservation navigation and workflow links:
TRANSFER resolves its `transferId` through scoped `/api/v2/transfers` rows'
`transfer_id`; LOCAL_RELEASE uses reservation purpose, `localReleaseId` and
members, with no invented detail endpoint. Null/unauthorized/missing resources
retain safe scoped errors. Purpose comes from reservation reads. V2.1 includes
CRYO and retains `inventoryStatus`, `inventoryVersion`, `reservationVersion`,
IDs, collection/expiry and issuer/current custodian fields. QUEUED, SUBMITTING,
projection-pending, COMMITTED, RETRY_WAIT, FAILED and CONFLICT remain distinct.
Historical unknown dates/purpose and allocation groups remain unchanged;
near-expiry remains disabled. Fixture interception or port 5175 does not count.

Durable-runtime ordinary-cookie browser verification also passed all six
accounts after moving the worktree and restarting API/web from the tested
startup script. This remains Jopia self-validation.


## Preservation stop and browser regression disposition

Apply of approved execution `0c3bda8baba5efd34e5d85e21c8874c5cabd32b706bd0033b17bb061aad00776`
returned `STOCK_BASELINE_PRESERVATION_FAILED` before creating a run or stock
command. Counts remained: zero operational-stock runs, zero stock commands,
nine components. No new ledger inventory mutation or projection occurred.

The durable-runtime browser invocation omitted its old opt-out flag and ran
its PRC profile-save step. Although the submitted display name was unchanged,
the canonical profile endpoint incremented `INST_SYNTH_MEDIX.version` from
2 to 3. A complete isolated restore of `before-stock.dump` and private row
comparison proved that this was the only institution column difference.
Unrelated domain fingerprints remained unchanged. The version/audit history is
retained; it was not reverted to force the old preview hash to pass.

The live browser now runs reads by default. Profile writes require explicit
`BLOODLEDGER_ACCOUNT_ALLOW_PROFILE_MUTATION=true`. Re-running its default
against 5174 → 3000 passed all six accounts and matched exact before/after
institution rows. No profile action was submitted in the corrected run.
No new operational capture or source scenario change is implied by this repair.

A fresh six-account/nine-unit backup was fully restored and its instance checked:
`ff233d25056b3f6c4e9a2898aae6c5d576f89b93ab82c1605e935752ba17ddea`.
A fresh live OCR preview is being generated from the same reviewed scenario.
The old preview, execution, approval and failure evidence remain private and
unchanged. Fresh exact confirmation/approval is required; this evidence does
not declare the old execution accepted or silently rebase its fingerprints.


Fresh preview completed at `2026-10-08T10:31:10.271Z`:
`680f530d452cdd990f3d6811b6dc94981193c7c55bbab42a2290055b2acbcf5f`.
Actual OCR again recognized all 522 labels at field confidence ≥90. An
independent private comparison proved that recognized label values, backend
mappings, actor bindings, target and reservation membership are identical to
the original confirmed preview. Capture timestamps/confidence evidence are
fresh. Only the institution baseline fingerprint changed; all other baseline
fingerprints remained identical. Collision/global FEFO/current-ledger/original
receipt and preservation checks passed again. Zero stock commands and nine
operational components remain. Exact fresh confirmation/approval is pending.


The user confirmed fresh preview
`680f530d452cdd990f3d6811b6dc94981193c7c55bbab42a2290055b2acbcf5f`.
It was frozen at actual time `2026-10-08T10:36:19.022Z` as execution
`0e6323106027b4c89aafef7354292fa5a9db77bc46129a8ae79bb1d35bda690f`,
using the fresh restored backup
`ff233d25056b3f6c4e9a2898aae6c5d576f89b93ab82c1605e935752ba17ddea`.
Full fields/payloads remain private in `execution-v2.json`. This execution
supersedes the old hash and requires its own exact apply approval.


## Corrected execution: genuine interruption and restart evidence

The user approved exact corrected execution
`0e6323106027b4c89aafef7354292fa5a9db77bc46129a8ae79bb1d35bda690f`,
its actual target and fresh restored backup, including the controlled recovery
checks. Full population is now running with the original authorization pacing.

`apply --pause-after-submit 1` returned the intended
`STOCK_REQUESTED_AMBIGUOUS_PAUSE`: one saved original envelope/transaction,
status SUBMITTING, no saved block and nine projected units. An independent
local QSCC transaction/block read verified the actual commitment as VALID in
block 599 before recovery. Resume inspected that saved transaction, reused its
original envelope, projected it and marked it COMMITTED. It then stopped after
the second commitment using `resume --pause-after-commit 2`; PostgreSQL showed
one COMMITTED and one LEDGER_COMMITTED_PROJECTION_PENDING operation, with ten
projected units. Its independent QSCC evidence returned VALID in block 600.

| Actual transaction | Block | Original signed-envelope SHA-256 |
| --- | --- | --- |
| `9ba6114e72356a66d842b4b1c186e30d5e42170c3f4a14b0e8e19af851b2eaf1` | 599 | `f389d12813f4ed50486a2e9b3bd64fed181a44c32b5d03f6223112f1a0d1c782` |
| `c957e1344c816594b59bb0d180f58f759594972b3f915850fc1f37fffa116609` | 600 | `1053962f13df685487156e01a86894838fd0a409eb7b6af90be9c01717a53654` |

An ordinary PostgreSQL/orderer/peer/API/web stop/restart then ran; no reset or
restore occurred. The original 110 generated-file and five named-volume
fingerprints still matched. Full resume recovered the second projection using
the same saved envelope/transaction. Independent QSCC reads at
`2026-10-08T10:54:22.375Z` again returned the exact two VALID transactions,
blocks and envelope hashes, with both command statuses COMMITTED. No replacement
transaction was created for either interrupted intake. The runner verifies the
preserved baseline after every processed command.

Tested corrected commands (first two exit 2 intentionally at the named pause):

```bash
EXECUTION_HASH=0e6323106027b4c89aafef7354292fa5a9db77bc46129a8ae79bb1d35bda690f
BACKUP_HASH=ff233d25056b3f6c4e9a2898aae6c5d576f89b93ab82c1605e935752ba17ddea
stock() {
  action="$1"; shift
  bash scripts/development-data/run.sh stock "$action" \
    --config "$PRIVATE/stock-runtime.json" --manifest "$PRIVATE/execution-v2.json" \
    --approve-manifest "$EXECUTION_HASH" --backup "$PRIVATE/before-stock-v2.dump" \
    --approve-backup "$BACKUP_HASH" --report "$PRIVATE/population-v2.json" "$@"
}
stock apply --pause-after-submit 1
stock resume --pause-after-commit 2
docker stop bloodledger-persistent-web bloodledger-persistent-api bloodledger-peer0-mediatrix-1
docker restart bloodledger-postgres-1 bloodledger-orderer0-1
docker start bloodledger-peer0-mediatrix-1
# Wait until the peer's reported Docker health is healthy, then:
docker start bloodledger-persistent-api bloodledger-persistent-web
stock resume
```

The full resume is still running; its final reconciliation/replay/restart report
and all 559 accepted receipts must be recorded after completion. T0 census and
acceptance cannot be claimed before the fixed Oct9 08:00 Manila window. Scoped
writer protection remains active until successful T0 verification. Lat can
perform reads while population is pending; independent mutation acceptance and
new workflow navigation require the completed Jopia record.


The user requested a pause during population. Only the population runner and
read-only progress monitor were stopped; API/web/database/Fabric remained up.
The checkpoint contained 18 new COMMITTED intakes, 18 saved VALID receipts and
27 total operational components. The user subsequently authorized continuation
inside the same population window. Resume uses the same execution/backup,
re-verifies the saved operations and continues without rebasing or resubmitting
completed intakes. The private pause checkpoint and both invocation logs remain.

At `2026-10-08T12:50:58.863Z`, an independent authenticated ordinary-cookie API
read returned 37 operational components: 34 AVAILABLE, 1 RESERVED, 1 IN_TRANSIT,
1 EXPIRED. All five component types and actual V2.1 wire fields were present.
The primary institution account read its operator's first command as COMMITTED;
Medix received V2_COMMAND_NOT_FOUND for the same command, proving scoped status
visibility. This is a partial observation, not 531-population acceptance or
Lat's independent browser evidence. Full population/reconciliation/T0 remains
in progress and must be reported after completion.


An unexpected Docker restart later interrupted population at 67 new COMMITTED
intakes. PostgreSQL retained all 67 transaction/block records; combined stock
was 76 units (73 AVAILABLE, 1 RESERVED, 1 IN_TRANSIT, 1 EXPIRED). The peer again
failed its stale Docker Desktop socket bind with exit 127. Recreating only its
container from the original Compose definition re-bound the socket against the
same identities and named volumes; API/web were started from their retained
durable containers. Private before/after comparison again matched all 110
identity files and five named-volume fingerprints. Health returned READY and
resume re-verifies all saved receipts on the same execution before submitting
new work. No applied migration, execution manifest, volume or identity changed.


On continuation, inspection found that the running resume had used `--output`
although execution actions save final evidence using `--report`. The runner alone
was stopped and resumed with the correct report argument and the same approved
execution/backup. Saved commands and receipts remain durable; completed work
is verified before continuing. API/web/Fabric/database and the writer gate
remained active. This corrects the invocation, not the scenario or approval.

The CLI now rejects missing or ambiguous execution report arguments before
reading private configuration or opening the target (`STOCK_REPORT_REQUIRED`).
The new boundary regression plus existing planner/client/recovery checks passed:
23 development-data tests, zero failures. Apply/resume/verify use `--report`;
preview/confirm use `--output`. This guard does not change frozen execution
payloads, actor grants or recovery behavior.


At 424 COMMITTED intakes, the live runner stopped safely with
`OPERATOR_RATE_LIMITED`, before the next command was created. Recorded grant
intervals were approximately 29.9 seconds despite the nominal 31-second pause.
The existing institution/session throttle was not reset or relaxed. The runner
now uses a conservative 35-second pause; recovery waits for the existing window
to expire and re-verifies saved receipts on the same approved execution.
The cause of the recorded timing discrepancy is not asserted. Actual subsequent
intervals and final reconciliation remain to be verified.


## Complete population — actual 2026-10-09 Manila evidence

At `2026-10-08T17:44:45.900Z` (October 9 01:44 Manila), full resume
completed with exit 0 on the same corrected execution, target and restored
backup. All 559 operations are COMMITTED with distinct independently verified
local Fabric VALID transaction IDs in blocks 599–1157: 522 OCR intakes,
13 destination-side transfer requests, 13 transfer reservations and 11 local
release reservations. No dispatch or release completion was submitted.

The runner independently compared all 531 current ledger component assets with
PostgreSQL and authenticated V2.1 component list/detail reads; all 24 ACTIVE
reservations, their version 1, 36 members at inventory version 2 and transfer
request links matched. The original nine component states/dates, original
18 operational receipts, historical 522 members/524 receipts, accounts and
other baseline table fingerprints remain preserved. `population-v2.json` is
private mode 600, with `preservation=PASS` and `t0Verification=PENDING`.
A separate QSCC transaction-and-block read at `2026-10-08T17:46:23.756Z`
again verified all 559 transaction IDs, saved blocks and original signed-envelope
SHA-256 values; all were COMMITTED and unique.

| Population | AVAILABLE | RESERVED | IN_TRANSIT | EXPIRED | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Added scenario | 486 | 36 | 0 | 0 | 522 |
| Preserved combined operational | 492 | 37 | 1 | 1 | 531 |

The following actual per-series additions match all twenty reviewed source
series. All new IN_TRANSIT and EXPIRED counts are zero. The zero AB+ platelet
series is verified from accepted operational data.

| Blood type | Component | AVAILABLE | RESERVED | Total |
| --- | --- | ---: | ---: | ---: |
| A+ | WHOLE_BLOOD | 4 | 0 | 4 |
| A+ | PACKED_RED_BLOOD_CELLS | 37 | 1 | 38 |
| A+ | FRESH_FROZEN_PLASMA | 56 | 3 | 59 |
| A+ | PLATELETS | 11 | 1 | 12 |
| A+ | CRYOPRECIPITATE | 21 | 1 | 22 |
| B+ | WHOLE_BLOOD | 5 | 0 | 5 |
| B+ | PACKED_RED_BLOOD_CELLS | 38 | 6 | 44 |
| B+ | FRESH_FROZEN_PLASMA | 58 | 4 | 62 |
| B+ | PLATELETS | 25 | 2 | 27 |
| B+ | CRYOPRECIPITATE | 19 | 2 | 21 |
| O+ | WHOLE_BLOOD | 7 | 0 | 7 |
| O+ | PACKED_RED_BLOOD_CELLS | 16 | 1 | 17 |
| O+ | FRESH_FROZEN_PLASMA | 58 | 5 | 63 |
| O+ | PLATELETS | 16 | 2 | 18 |
| O+ | CRYOPRECIPITATE | 22 | 2 | 24 |
| AB+ | WHOLE_BLOOD | 8 | 0 | 8 |
| AB+ | PACKED_RED_BLOOD_CELLS | 26 | 2 | 28 |
| AB+ | FRESH_FROZEN_PLASMA | 36 | 4 | 40 |
| AB+ | PLATELETS | 0 | 0 | 0 |
| AB+ | CRYOPRECIPITATE | 23 | 0 | 23 |

The conservative pacing recovery reverified all 424 saved commands before
continuing. Subsequent actual recorded grant intervals were 33.87–34.222 seconds;
the remainder completed without relaxing or resetting authorization limits.
The original transaction/envelope evidence for interrupted commands remained
unchanged. An invocation/report correction and the observed rate-limit failure
are preserved as live failure/recovery evidence, not erased by the final pass.

Read-only real Chromium checks on 5174 → 3000 passed at
`2026-10-08T17:57:46.998Z` using the versioned
`tests/development-data/populated-browser.mjs`: all six primary logins, HttpOnly
cookies, normal UI Sign out / subsequent API 401, exact 531 inventory rows,
36 member links, Medix's 13 request/reservation links, unrelated institution
and local-release isolation, historical 522 VALID members with null dates and
purpose, V4 default, V5 unavailable and disabled near-expiry eligibility.
There was no fixture interception, profile save or operator mutation. These
are **JOPIA_SELF_VALIDATION**, not independent Lat acceptance.

Two initial private browser probes failed because of verifier assumptions:
a direct session DELETE plus a visibility event on Analytics did not exercise
normal UI logout; then the destination expectation was incorrectly applied
to N.L. Villa as well as Medix. The corrected verifier clicks the actual Sign
out button and expects 13 reviewed links only for Medix, zero and scoped 404s
for unrelated institutions. Both failure reports remain private. No application
permission change was needed. The versioned rerun also checked the requestor's
empty component scope and denial of all scenario reservation details.

All 110 original generated-file hashes and five named-volume
Name/CreatedAt/Mountpoint fingerprints matched at
`2026-10-08T17:50:47.254130+00:00`. Final exact replay and populated-state
restart are still running/pending. The 40-row T0 operational census is not
claimed before October 9 08:00 Manila; the writer gate remains true.

## Reproducible read-only population evidence

From the implementation worktree, with the existing private account config and
approved execution (never copy credentials, manifests or label fields into Git):

```bash
PRIVATE=/home/luisantonioj/projects/bloodledger/build/operational-stock-private
EXECUTION_HASH=0e6323106027b4c89aafef7354292fa5a9db77bc46129a8ae79bb1d35bda690f
docker run --rm --network container:bloodledger-persistent-api \
  -v "$PWD:$PWD" -v "$PRIVATE:/private" -w "$PWD" \
  -e BLOODLEDGER_BROWSER_CONFIG_PATH="$PWD/build/recovery/accounts.json" \
  -e BLOODLEDGER_STOCK_EXECUTION_PATH=/private/execution-v2.json \
  -e BLOODLEDGER_STOCK_EXECUTION_SHA256="$EXECUTION_HASH" \
  -e BLOODLEDGER_BROWSER_REPORT_PATH=/private/browser-populated-versioned-before-restart.json \
  mcr.microsoft.com/playwright:v1.61.1-noble \
  node tests/development-data/populated-browser.mjs

docker run --rm --init --user "$(id -u):$(id -g)" \
  --network bloodledger_default \
  --env-file /home/luisantonioj/projects/bloodledger/build/development-local/runtime.env \
  -v "$PWD:$PWD" \
  --mount "type=bind,src=/home/luisantonioj/projects/bloodledger/network/generated,dst=$PWD/network/generated,readonly" \
  -v "$PRIVATE:/private" -w "$PWD" \
  -e BLOODLEDGER_REPOSITORY_ROOT="$PWD" \
  -e FABRIC_PEER_ENDPOINT=peer0-mediatrix:7051 \
  -e BLOODLEDGER_STOCK_EXECUTION_PATH=/private/execution-v2.json \
  -e BLOODLEDGER_STOCK_EXECUTION_SHA256="$EXECUTION_HASH" \
  -e BLOODLEDGER_STOCK_EVIDENCE_REPORT_PATH=/private/all-559-versioned-before-restart.json \
  bloodledger-development-tools:local \
  node tests/development-data/saved-stock-evidence.mjs
```

Reports use exclusive creation. Choose a fresh private report filename for each
replay or restart rerun. The independent verifier checks the saved actor,
idempotency key, run ownership, VALID transaction/block contents and original
envelope hash; it cannot submit or project anything. Browser navigation between
component/reservation/workflow screens and independent Lat pending/error/restart
acceptance remain explicitly NOT_RUN. Existing reads define those links; no
unsupported local-release detail endpoint is introduced.


## Exact replay and populated-state restart follow-up

Exact `stock resume` using the same approved execution/backup and a fresh
`--report replay-v2.json` completed at `2026-10-08T18:02:25.550Z`. Exact
comparison with `population-v2.json` passed all 559 complete receipt records
(including original commitment-observation times), all twenty series, counts,
24 reservations/36 links, current-ledger count and preservation. There were
still exactly 559 scenario commands, all COMMITTED. No replacement transaction
or changed manifest was introduced. T0 remained PENDING and the writer gate true.

An ordinary populated-state restart began at `2026-10-08T18:03:01Z`: API/web/peer
were stopped, PostgreSQL/orderer/both CAs restarted, then peer and API/web
started after infrastructure health checks. All infrastructure reported healthy.
API `/healthz` returned READY for API/database; the general Fabric sync worker
remained DISABLED and the durable command/projection/census configuration
remained CONFIGURED. Forecast readiness was UNAVAILABLE, consistent with the
separate forecast bindings; no model was activated. No reset, live database
restore, volume recreation or identity enrollment ran. The infrastructure health
inspection encountered an automatic-approval timeout; its permitted read-only
retry succeeded. Stop/start timestamps are retained, without treating this
administrative pause as NFR-06 latency evidence.

At `2026-10-08T21:50:42.094810+00:00`, all original 110 generated-file hashes
and five named-volume Name/CreatedAt/Mountpoint fingerprints matched.
The versioned independent QSCC verifier completed at
`2026-10-08T21:52:13.609Z`, returning all 559 original VALID transactions and
COMMITTED statuses. Exact before/after receipt-array comparison, including
every signed-envelope SHA-256, passed. Canonical JSON receipt-array SHA-256
(sorted object keys, compact separators) is
`81cf0a503a855e8bc741795663190458026a711010203a6523b35d77667ea014`.
The private full receipt array is not published as institutional inventory data.

The versioned ordinary-cookie browser rerun completed at
`2026-10-08T21:52:56.513Z`: all six primary accounts, 531 source inventory
rows, all 24 ACTIVE reservations/36 member links, Medix's 13 requests/reservation
links, unrelated/requestor/regulatory scopes, original historical null fields,
normal UI logout and subsequent API 401 passed again. V4 remained default,
V5 unavailable and near-expiry eligibility disabled. No fixture interception
or profile mutation was used. This remains Jopia self-validation.

The full post-restart `stock verify` report is still in progress. It checks
every original/new commitment, all current ledger assets, PostgreSQL and API
contracts and the baseline fingerprints. The fixed 08:00–16:00 Manila T0
window has not yet opened; no forty-row T0 census or writer-gate release
is claimed.

Tested restart and post-restart read-only commands:

```bash
docker stop bloodledger-persistent-web bloodledger-persistent-api bloodledger-peer0-mediatrix-1
docker restart bloodledger-postgres-1 bloodledger-orderer0-1 bloodledger-ca-mediatrix-1 bloodledger-ca-orderer-1
docker start bloodledger-peer0-mediatrix-1
docker inspect bloodledger-peer0-mediatrix-1 bloodledger-postgres-1 bloodledger-orderer0-1 \
  bloodledger-ca-mediatrix-1 bloodledger-ca-orderer-1 \
  --format '{{.Name}} {{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}'
# All reported running/healthy before starting retained applications:
docker start bloodledger-persistent-api bloodledger-persistent-web
curl --fail --silent http://127.0.0.1:3000/healthz
export BLOODLEDGER_FABRIC_GENERATED_ROOT=/home/luisantonioj/projects/bloodledger/network/generated
export BLOODLEDGER_DEV_ENV_FILE=/home/luisantonioj/projects/bloodledger/build/development-local/runtime.env
export BLOODLEDGER_DEV_PRIVATE_DIR="$PRIVATE"
bash scripts/development-data/run.sh stock verify \
  --config "$PRIVATE/stock-runtime.json" --manifest "$PRIVATE/execution-v2.json" \
  --approve-manifest "$EXECUTION_HASH" --report "$PRIVATE/post-restart-v2.json"
# Repeat both versioned read-only evidence commands above with fresh reports:
# browser-populated-versioned-after-restart.json
# all-559-versioned-after-restart.json
```


At `2026-10-08T22:02:11.488Z`, the versioned current-time dry census read
passed all 40 component/blood-type combinations against PostgreSQL and
authenticated V2.1 component data: 492 AVAILABLE, 37 RESERVED, 529 reportable,
491 forecast-eligible AVAILABLE and 21 verified **reportable** zero combinations.
The original past-expiry AVAILABLE component stays unchanged and excluded from
forecast eligibility. IN_TRANSIT/EXPIRED are excluded from census reportable
counts, while the operational component total stays 531.
This uses a READ ONLY transaction and the pure census builder with the actual
current timestamp. It creates no snapshot, writes no inventory and explicitly
reports `persisted=false`, `t0Verification=NOT_ESTABLISHED_BY_DRY_READ`. The
fixed-window T0 capture remains a separate pending check.

Tested current-time dry-read command (same private inputs, fresh report):

```bash
docker run --rm --init --user "$(id -u):$(id -g)" \
  --network bloodledger_default \
  --env-file /home/luisantonioj/projects/bloodledger/build/development-local/runtime.env \
  -v "$PWD:$PWD" -v "$PRIVATE:/private" -w "$PWD" \
  -e BLOODLEDGER_REPOSITORY_ROOT="$PWD" \
  -e BLOODLEDGER_STOCK_CONFIG_PATH=/private/stock-runtime.json \
  -e BLOODLEDGER_STOCK_EXECUTION_PATH=/private/execution-v2.json \
  -e BLOODLEDGER_STOCK_EXECUTION_SHA256="$EXECUTION_HASH" \
  -e BLOODLEDGER_STOCK_EVIDENCE_REPORT_PATH=/private/census-current-time-dry-read.json \
  bloodledger-development-tools:local \
  node tests/development-data/stock-census-dry-read.mjs
```


## Current acceptance disposition — October 9 06:04 Manila

Full post-restart `stock verify` completed successfully at
`2026-10-08T22:03:18.996Z`, with 559 VALID saved commitments, 531 current
ledger assets and exact ledger/PostgreSQL/API reconciliation. A private exact
comparison at `2026-10-08T22:04:16.308022+00:00` matched the original full
receipt records, counts, all twenty series, 24 ACTIVE reservations/36 members
and preservation. PostgreSQL still contains exactly 559 COMMITTED scenario
commands, `writer_lock=true`, and no scenario `census_snapshot_id`. No pending,
failed or conflicted scenario command remains. Both working trees are clean
apart from this scoped evidence update; Lat's original checkout is preserved.

| Check | Current result |
| --- | --- |
| Exact ZIP/workbook/scenario lineage, genuine confirmed OCR and human execution approval | PASS |
| Retained six primary accounts/12 operators, installed policy/target and original identities/volumes | PASS |
| 559 genuine local Fabric VALID commands, current ledger/PG/API 531 reconciliation | PASS |
| Twenty source series, 24 ACTIVE reservations, 36 members and destination request links | PASS |
| Original nine stock, historical 522, original receipts and baseline fingerprints | PASS |
| Ambiguous submission, projection interruption and exact full replay | PASS |
| Ordinary populated-state infrastructure/service restart and unchanged original envelopes | PASS |
| Six-account ordinary-cookie browser/API/scope/logout/V4 checks before/after restart | PASS — JOPIA_SELF_VALIDATION |
| Current-time forty-combination census, 21 reportable zeros, 491 eligible / 529 reportable | PASS — DRY READ ONLY, no snapshot |
| Fixed-window persisted T0 census/API/currentness, writer-gate release and census replay/restart durability | PENDING — October 9 08:00–16:00 Manila |
| Lat's independent detail-navigation/pending/error/scope/logout/restart acceptance | NOT_RUN — separate owner evidence |
| V5 persistence/binding/job activation | BLOCKED — separate review/approval |
| Human UAT, physical Android OCR, full NFR-06, clinical claims and deployment | NOT_RUN — outside this acceptance scope |

The remaining timed Jopia command is `stock verify` using the same exact
approved execution and a **new** report, e.g. `t0-verify-v2.json`, inside
`[2026-10-09T00:00:00Z, 2026-10-09T08:00:00Z)`. No new apply approval or
new units are required. The runner will again verify all evidence, capture
the 40-row actual operational snapshot at the actual generation time,
reconcile its authenticated inventory-evidence API and only then release the
scoped writer gate. Current-time dry-read counts cannot replace this step.
No clock change, future snapshot, manual gate release or backdating is permitted.

```bash
# Run inside the fixed window, with existing private inputs and exports above:
bash scripts/development-data/run.sh stock verify \
  --config "$PRIVATE/stock-runtime.json" --manifest "$PRIVATE/execution-v2.json" \
  --approve-manifest "$EXECUTION_HASH" --report "$PRIVATE/t0-verify-v2.json"
```

Lat can independently read the current Jopia retained target, but mutations
remain gated until this T0 pass. Integrate the reviewed implementation ancestry
without overwriting Lat's working tree or resetting stores. Implement/verify
component-detail → reservation-detail → transfer-request or local-release
purpose/member navigation using the existing V2.1 contracts. Verify null,
missing/denied, queued/submitting/projection-pending/committed/failed/conflicted
states, scoped errors, normal logout and restart on 5174 → 3000; interception
and port 5175 are not acceptance. Existing inventory references are still
plain references, so Jopia API link validation does not claim those UI flows
already exist. A different retained host needs its own target/preservation
review; do not copy the Jopia execution as approval for Lat's distinct database.

V4 remains default. On October 9, yesterday's Manila origin is October 8;
any V5 persistence job must separately review that origin, target/binding and
actual generation time. No V5 activation, historical-date rewrite, near-expiry
enablement, Testing exit or research/clinical/deployment claim is authorized.


After that T0 capture passes, repeat the ordinary restart and `stock verify`
with a fresh `t0-post-restart-v2.json` within the same verification window.
Compare the actual persisted census ID, captured-at instant, 40 rows,
source-projection digest, API currentness, complete original receipts and
preservation. This proves durability of the **new T0 census** as well as the
already verified inventory. Keep competing writers quiescent during that
comparison. The inventory restart is PASS now; future T0-census persistence
across restart is explicitly NOT_RUN until the snapshot exists. Do not
restore the old backup over committed ledger history.

Final helper validation at `2026-10-08T22:05:59.407Z` again passed the actual
current-time dry census after exact schema/scenario guards were added.
Final syntax and full-history/index/candidate Gitleaks checks passed; no
credential, generated identity, private manifest, envelope or unrelated edit
is included in the implementation commits.
