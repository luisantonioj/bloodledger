# Historical synthetic inventory import

Status: implementation authorized by Jopia in the current conversation on 2026-10-07.
Owner and technical validator: Jopia; self-validation disclosed. Source reviewer: Buno.
Base: `origin/main` at `b028515`; merged PRs #19/#20 contain V5 source/runtime dependencies.
PR #21 remains open; its frontend changes are unnecessary for this local CLI/DBeaver release.
Branch: `codex/historical-synthetic-inventory`.
Links: FR-13 synchronization, FR-14 source lineage, NFR-01/NFR-02 integrity, and
[Testing phase](TESTING-PHASE.md). This addition does not activate operational intake or V5.

## Input contract

One external V5 workbook, exact SHA-256, explicit business date and a Buno-reviewed
selection reference are mandatory for apply. Preview needs no review approval.
Only the four synthetic allowlisted V5 sheets are read with the existing V5 validator.
All 20 stock series must be present, including zeros; available + reserved = closing.
The source alias remains SIM_INSTITUTION_01, separate from the Mediatrix gateway/operator.
No source workbook or raw research rows are committed to Git.

Historical manifest version HISTORICAL_SYNTHETIC_INVENTORY_V1 identifies the workbook
hash, research version, date, canonical 20 counts and derived snapshot/component/allocation
IDs. Units are constructed representations of counts. Dates of collection/expiry,
donation numbers, donor identity and original reservation purpose are unknown.
A reserved allocation is a generated grouping, not an operational reservation.

## Ledger and processing contract

HistoricalInventoryContract uses only historical-inventory:* keys, authenticated
Mediatrix API gateway credentials and the explicit USR_SYNTH_HISTORICAL_IMPORT actor.
BeginSnapshot freezes the manifest; RegisterUnit records deterministic members;
FinalizeSnapshot verifies exact membership and totals before marking COMPLETE.
ReadSnapshot and ReadUnit expose committed assets. The real Fabric timestamp and
transaction ID are separate from sourceBusinessDate. This namespace never feeds FEFO,
census, transfers, forecasting stock inputs, donation registry or OCR intake.

Local commands progress QUEUED -> SUBMITTING -> LEDGER_COMMITTED_PROJECTION_PENDING
-> COMMITTED. Submitted envelopes are durably saved before submission. Ambiguous
outcomes are queried before the identical envelope can be resubmitted; no new proposal
is created for an unresolved submission. Invalid transactions fail the command.
Projection failure preserves the ledger receipt and retries PostgreSQL only.
Completed views require finalized, verified ledger evidence and complete projection.

## Source approval and execution

Apply/resume require --target bloodledger-local, --approve-manifest <SHA256>,
--review-reference <Buno review reference> and --operator USR_SYNTH_HISTORICAL_IMPORT.
These explicit inputs are an operator attestation, not independent verification of
Buno's identity. Jopia checks the external review before executing apply.
The user supplied the selection review for 2026-10-07 in this conversation: all 20
combinations, 486 available closing units and 36 reserved closing units. The original
downloaded workbook independently matched those counts and date. The recorded review
reference is `CONVERSATION_2026-10-07_STOCK_REVIEW_486_AVAILABLE_36_RESERVED`; it identifies
the user-provided confirmation, not independently authenticated Buno identity evidence.
The frozen manifest SHA-256 is
`7b8c831d37667b1459c2b16707c5bf37cf72fe6cc12b2f24bf17a6ab2449af04`.
This review covers this one synthetic snapshot; it does not approve other dates or
sources. See the inspection section for runnable commands and execution evidence.

## CLI and DBeaver inspection

The runner uses the existing Bash/Docker tooling, Node 24.17.0 and the locally
verified forecasting runtime image
`sha256:dcb2ccd36834bcec33e3d5cb8158f2b7a75b0881f695821cc705764667fba4c1`.
It builds chaincode helpers, validates the external workbook through the full V5
reader, then runs the Node CLI. No additional HTTP endpoint or explorer is needed.
Generated manifest/report files belong outside Git or under ignored `build/`.
Writes refuse to overwrite existing files. The v1 manifest is bounded to 2,000
components per selected day; oversized sources fail explicitly rather than truncate.

Preview (no database/Fabric mutation):

```bash
bash scripts/historical-inventory/run.sh preview \
  --workbook /absolute/external/BloodLedger_ML_Research_Dataset_v5.xlsx \
  --sha256 EXPECTED_WORKBOOK_SHA256 --business-date YYYY-MM-DD \
  --output build/reviewed-historical-manifest.json
```

After the source/date review and successful Fabric trust/lifecycle checks:

```bash
bash network/scripts/deploy-historical-inventory.sh --apply bloodledger-local
bash scripts/historical-inventory/run.sh apply \
  --workbook /absolute/external/BloodLedger_ML_Research_Dataset_v5.xlsx \
  --sha256 EXPECTED_WORKBOOK_SHA256 --business-date YYYY-MM-DD \
  --manifest build/reviewed-historical-manifest.json --target bloodledger-local \
  --approve-manifest EXACT_PREVIEW_MANIFEST_SHA256 \
  --review-reference BUNO_REVIEW_REFERENCE --operator USR_SYNTH_HISTORICAL_IMPORT \
  --report build/historical-reconciliation.json
```

`resume` takes the same source, manifest, target, approval and review arguments.
It refuses to proceed past a terminal FAILED command. Investigate its safe error
before changing any command data; committed transactions are never erased.
`verify` takes the same workbook/hash/date/manifest and target arguments but needs
no write approval arguments. It compares all command receipts and units against
fresh QSCC transaction/block queries, the ledger snapshot and database projections.
Verification is unavailable when peer/channel trust is unavailable. Stored VALID
fields alone are not a substitute for the fresh verifier.

In DBeaver, refresh the connection, expand Schemas -> app -> Tables, then open the
Data tab of `synthetic_inventory_snapshots`, `synthetic_inventory_counts`,
`synthetic_inventory_units`, or `synthetic_inventory_import_commands`.
The `synthetic_inventory_completed_units` view appears under Views and excludes
incomplete imports. [Read-only inspection SQL](../scripts/historical-inventory/inspect.sql)
shows source dates, available/reserved counts, constructed allocation groups,
unknown individual fields, transaction IDs, block numbers and validation status.
The existing `inventory_projection` holds the earlier operational prototype unit.
Historical AVAILABLE/RESERVED means status on the source day, not present-day stock.

## Local implementation evidence — 2026-10-07

Jopia self-validation; tests use fabricated synthetic fixtures, not Buno's source.
The reviewed external workbook/day remains an execution gate. The user supplied
Drive file ID `1jtgBPBijaO-mKht1fNrKFDst2DwT9ZpT`, in the thesis Machine Learning/final
folder. Authenticated read-only access through the connected BloodLedger Google Drive
account retrieved the original 6,271,434-byte XLSX outside the repository. Its SHA-256 is
`5c5997bd4df26f6f0d52d7ea13dde0172706faaa15308ebc87f241f44c241ddb`.
The existing full allowlisted V5 validator passed: 1,461 stock days from 2023-01-01
through 2026-12-31, with daily closing totals between 431 and 614. The range includes
future simulation dates; it is not evidence of current or actual clinical stock.
At initial implementation validation, no selected day or snapshot review reference had
been provided and no historical snapshot had been loaded. The subsequent selection
confirmation is recorded above; source validation alone does not constitute that review.

The branch was created from the freshly fetched merged `origin/main` at `b028515`,
containing PRs #19/#20. PR #21 was confirmed open; its frontend is outside this CLI
release. Existing later-branch dependencies/build artifacts were identified and
independent lockfile installation and regression checking were used for validation.

Before migrations, a local PostgreSQL custom-format dump and peer-volume/identity
archives were saved below ignored `build/historical-backup-*`, with permissions
restricted by umask 077. The peer was recreated using its same persistent volumes
to resolve an obsolete Docker socket bind. No reset, identity enrollment, channel
configuration change or removal of domain records occurred. PostgreSQL now has
24 applied migrations, including the historical addition. The original unit and
its state/version/transaction reference were preserved.

Read-only channel-scoped queries with the retained Sprint 4 admin identified identity
drift: the current node/admin material used different roots from the retained channel.
The older organizational roots matched the channel genesis, and the older orderer
TLS certificate exactly matched both pinned consenter certificates. Identity validity
and certificate/key correspondence were checked without exposing private keys.
Peer/orderer configuration and data volumes were archived while stopped, and the
complete matching organizational identity tree was restored from the retained local
Sprint 4 checkout. Previous material is retained in the restricted backup directory.
No CA enrollment, channel reset, channel configuration update or volume deletion occurred.
The running CA services retain their separate current roots: do not issue replacement
channel identities from them or run identity assembly without a reviewed trust plan.

After restoration, the current admin passed read-only trust/health checks and peer/
orderer heights matched. The additive `bloodledger-inventory` upgrade to `historical-v1`
at sequence 3 succeeded with the existing Mediatrix peer endorsement policy. Its
installed package is
`bloodledger-historical-v1_551b871d4eb0:c276bd2ed06fdcadb5d31980de062a72b4495426478b553b59fa7f5286460a64`.
Approval transaction `b88ec6be78866f28e5d8346b498c3d4b3555ca8ec798280f23e7624a8dbff4a5`
and definition transaction `1723c18b6efc87f34d5a131a20ecb0597ba499fe1703cf547ba018efcb91538a`
both committed VALID. Existing chaincode definitions and domain state remain intact.

Using the restored gateway, the original operational unit was read directly from the
upgraded contract: `UNIT_SYNTH_S4_LIVE_001`, AVAILABLE, version 1, unchanged transaction
`03b925d4e80af5ba359845b0363c39d7871659de09c07eaddc7cee023e25278a`.
QSCC transaction and containing block evidence confirmed VALID in block 45, including
the block validation flag and matching transaction envelope. A read-only query through
the new historical contract returned the expected HISTORICAL_SNAPSHOT_NOT_FOUND for
an absent snapshot, proving contract availability and gateway authorization without
creating an import. Before the reviewed import, PostgreSQL had zero historical snapshots
and import commands.

Automatic approval review rejected a combined orderer/API/worker startup action
because API/worker startup could process transactions before the source review gate.
That rejected action was not executed. API and sync-worker remain stopped; the
standalone historical CLI does not depend on starting those application services.
The subsequent node-only restoration described above was approved and executed.

Validation results:

- Clean `npm ci --ignore-scripts` installation in an isolated temporary checkout:
  repository foundation checks, chaincode formatting/lint/types, 36 chaincode tests,
  8 importer/evidence/recovery tests, and 100 API regression tests passed. Local
  ignored API build artifacts from the previous branch were preserved under `build/`
  before the API was rebuilt, preventing stale tests from contaminating results.
- Forecasting: 118 passed, 1 existing database-dependent case skipped; Ruff formatting,
  lint and strict mypy passed. The two new extractor tests verify hash/date gating and
  delegation to the full V5 validator. No Buno-source accuracy is claimed.
- Disposable PostgreSQL 17.10 integration passed: migration, duplicate/review conflict,
  projection replay, completed view, direct-verifier reconciliation, runtime privilege
  checks and preservation of an unrelated operational fixture.
- End-to-end preview with a fabricated full-coverage zero-stock XLSX passed: exactly
  20 source series, zero components, deterministic manifest, no database imports.
  [Fixture producer](../tests/historical-inventory/create-preview-fixture.py) writes
  only an explicitly selected external test file; no workbook is committed.
- Private-file preview also passed with a mode-0600 fabricated workbook and an
  operator-owned, readable output manifest. Python extraction and Node execution use
  the host UID/GID. Live installation validated Fabric's standard Node package layout;
  an earlier package build failure changed no channel definition and was corrected
  before the successful sequence-3 deployment.
- Existing chaincode static-boundary checks and shell syntax checks passed.
- Pinned Gitleaks 8.30.1: candidate source and the new commit range passed with no
  leaks. Scanning all existing refs/history reports 11 inherited findings and does
  not pass; history was not rewritten and no blanket exclusion was added.

Reproduction: run `npm run test:historical-inventory` with the pinned Node runtime;
run `bash tests/historical-inventory/database.sh` on the Docker-enabled host. Run
forecasting quality/testing with the pinned service runtime. The disposable database
uses no published ports and no application network and is removed by its own trap.

## Reviewed snapshot execution — 2026-10-07

The user-provided selection confirmation was compared with the original V5 workbook:
all 20 combinations, including the explicit zero AB+ platelet row, reconciled to
486 available + 36 reserved = 522 closing-stock components. Column M
`available_close_units` and column I `reserved_close_units` were used; column J
`available_before_release_units` was not substituted. The source workbook was read-only.

Snapshot `HSNAP_913241C895D1447FEC7E6022E33412D8C45474B0` is COMPLETE in PostgreSQL and
Fabric, with 522 expected and verified components. All 524 durable commands are
COMMITTED: one BeginSnapshot, 522 RegisterUnit and one FinalizeSnapshot. The importer
performed fresh QSCC transaction/block verification and ledger/member/database
reconciliation for every command and all 20 source combinations. All transactions
were VALID. Finalization transaction
`5a76a6f44e1a6741700cb3962b64be9218a6f8d91ae869b1352caea523d2a440` is in block 574.
The ignored local report is `build/historical-reviewed-2026-10-07-reconciliation.json`;
the reviewed generated manifest also stays under ignored `build/`, outside Git.

An environment restart interrupted the first run after 238 projected components.
PostgreSQL retained the durable queue and signed submission. Docker Desktop access
was restored and the peer recreated with its existing volumes to resolve a stale
Docker socket bind. The original workbook was fetched read-only again and its SHA-256
matched the frozen source. Resume recovered step 239 using transaction
`a67deb1eaaa9a9e3745a8dce4f3b326d3689b7e2313b114e08ee5ce03b3a73c4`, which remained the
same ID and finished COMMITTED/VALID. No source date, manifest, source count or review
reference changed during recovery. A fresh PostgreSQL backup was taken before import.

To inspect this snapshot in DBeaver, refresh the connection (right-click the connection
and choose Refresh), then expand Schemas -> app. Under Tables, open
`synthetic_inventory_snapshots` and its Data tab: the selected source date is
2026-10-07 and status is COMPLETE. Open `synthetic_inventory_counts` for the original
20 aggregate rows. Under Views, open `synthetic_inventory_completed_units` and its
Data tab for all 522 individually identified constructed components and their VALID
transaction/block references. Historical status totals are also available in the
[read-only inspection SQL](../scripts/historical-inventory/inspect.sql).

Acceptance is satisfied for this one user-reviewed synthetic snapshot: source counts,
generated components, directly verified ledger evidence and database rows reconcile.
Jopia self-validation is disclosed. These constructed research assets do not establish
original bags, actual historical custody, approved clinical inventory or present-day
operational stock. Forecast activation and frontend integration remain outside scope.
