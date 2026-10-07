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
