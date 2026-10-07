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
No source/date has yet been approved in this conversation. Actual loading is gated.
See the inspection section added with implementation evidence for runnable commands.

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
folder; the workbook requires authenticated access. No selected day or Buno snapshot
review reference has been provided. No actual historical snapshot has been loaded.

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

The peer is now healthy, but channel queries with the current admin identity are
denied by /Channel/Application/Readers. Peer logs separately report an orderer TLS
CA verification failure. A healthy container does not establish channel trust.
The historical lifecycle upgrade and live Fabric import were not performed.
Restoring trusted identities/roots matching the retained channel configuration is
a prerequisite; resetting the channel would violate this task's preservation scope.

Automatic approval review rejected a combined orderer/API/worker startup action
because API/worker startup could process transactions before the source review gate.
That rejected action was not executed. API and sync-worker remain stopped; the
standalone historical CLI does not depend on starting those application services.

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
- Existing chaincode static-boundary checks and shell syntax checks passed.
- Pinned Gitleaks 8.30.1: candidate source and the new commit range passed with no
  leaks. Scanning all existing refs/history reports 11 inherited findings and does
  not pass; history was not rewritten and no blanket exclusion was added.

Reproduction: run `npm run test:historical-inventory` with the pinned Node runtime;
run `bash tests/historical-inventory/database.sh` on the Docker-enabled host. Run
forecasting quality/testing with the pinned service runtime. The disposable database
uses no published ports and no application network and is removed by its own trap.

Completion remains partial: implementation and synthetic technical checks pass,
but actual workbook loading, reviewed date selection, additive lifecycle deployment
and live transaction/block verification remain pending. Empty historical tables
must not be reported as an accepted or imported Buno snapshot.
