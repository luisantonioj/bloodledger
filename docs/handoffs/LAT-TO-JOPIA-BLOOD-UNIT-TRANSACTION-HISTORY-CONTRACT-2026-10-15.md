# Lat → Jopia: Blood Unit Transactions mockup history contract

Date: 2026-10-15 (Asia/Manila)
Requested owner: Jopia — backend/API, authoritative event linkage and read contract
Frontend follow-up: Lat
Classification: SIMULATION_ONLY
Status: contract handoff; no new API or table redesign implemented by this document

## User decision

Follow the supplied full mockup's Blood Unit Transactions table, including its field names and order:

**Time | Type | Scan ID | Transaction ID | Unit ID | Blood | Method | Status | Blockchain ID**

Reference file: `C:\Users\Yuri\OneDrive\Documents\Bloodledger\Bloodledger Frontend\bloodledger-full-mockup.html`.

The user asked whether the official frontend has these values. Some exist in current reads, others exist elsewhere but need reliable linkage, and some need an explicitly defined contract. This handoff requests that contract before Lat populates the redesigned table.

Related dependency: [Inventory printed-label identifier handoff](LAT-TO-JOPIA-INVENTORY-LABEL-IDENTIFIER-2026-10-15.md). Use the same approved printed Unit ID representation across inventory, transaction history and details.

## Why the existing table differs

`apps/web/src/features/transactions/blood-unit-transactions-page.tsx` currently composes permitted rows from:

- `/api/v2/transfers`: timeline rows with `command_id`, `resource_id`, `operation`, `status`, `accepted_at`, `ledger_transaction_id`.
- `/api/v2/audit`: institution-scoped events with `auditEventId`, `actionCode`, `correlationId`, `outcome`, `eventTime`, `ledgerTransactionId`.

The current columns are **Time | Type | Record reference | Unit ID | Activity | Status | Ledger reference**.

Timeline rows use command acceptance time, resource ID as Record reference, and the resource as Unit ID only when it starts with `COMP_`. Audit fallback rows use audit event time and correlation ID, without a unit link. Inbound/outbound comes from matching operation/action codes. Activity describes the operation; Status is command state or audit outcome. Audit rows with a ledger ID already present in the timeline are skipped, but this does not establish a canonical per-unit history or reliable deduplication for every workflow.

The mockup instead renders local scanner history (`scanId`, `txId`, `isbt`, type/component, method, status, blockchainId). It creates local scan/transaction IDs and a blockchain-looking value in the browser. Those values show intended presentation only; do not copy this generation logic into official history or represent mock values as ledger evidence.

## Required field mapping and decisions

| Display column | Current evidence | Backend contract needed |
| --- | --- | --- |
| Time | Timeline `accepted_at` or audit `eventTime` | Define which event time is shown: scan, confirmation, custody event, command acceptance or ledger commitment. Supply a timezone-qualified timestamp; do not silently substitute one meaning for another. Store UTC and display Asia/Manila. |
| Type | Direction inferred from action text | Return a documented inbound/outbound value based on the event and authenticated facility's perspective. A dispatch by one bank and receipt by another need correct institution-relative direction. |
| Scan ID | Not linked in current history; inbound capture IDs exist elsewhere | Supply the actual authorized scan/capture reference and its meaning, nullable when the event has no scan. Do not relabel a command ID as a scan ID. Outbound/manual preview does not create a verified scan record. |
| Transaction ID | Current resource/correlation references are not a dedicated history transaction ID | Define the canonical business transaction/event reference and relationships to capture, command, transfer, reservation and local release. Reuse an existing authoritative ID if appropriate; do not invent a frontend TX number. |
| Unit ID | Internal `COMP_` sometimes available; printed label number absent | Return the linked component ID plus the separately authorized printed-label display identifier from the related handoff. Missing label evidence needs an explicit unavailable fallback. |
| Blood | Blood type and component exist in component/request records, not in these history rows | Return event-linked blood type and component. Define historical snapshot versus current projection semantics and reject mismatched/foreign joins. No inference from the identifier or label appearance. |
| Method | Not supplied in current history | Define recorded method values and provenance: OCR, barcode/QR or other supported evidence, as applicable. Manual/photo preview is not a completed transaction. Use unavailable/not applicable for absent evidence; do not default every row to Scan. |
| Status | Command processing state or audit outcome available | Define business-event status separately from command/ledger processing state. Queued, projection pending, committed, failed and conflict must remain distinguishable. A committed registration is not automatically a received transfer, and an audit success is not proof of release. |
| Blockchain ID | `ledger_transaction_id` / `ledgerTransactionId` when supplied | Return the actual ledger transaction reference and the event it proves. Null/missing reference must have a defined reason/state; never generate a hash for presentation. Distinguish commitment from projection readiness. |

## Row identity and coverage

Please settle these before frontend implementation:

1. **Row granularity:** one physical component event, one scan, one command or one reservation transaction? A reservation can contain several units; the table's singular Unit ID must not imply a false one-to-one relationship. Recommended direction for discussion: one component-linked event per row, with a stable row key and a shared transaction reference where multiple rows belong together. This is a proposal, not an accepted schema.
2. **Coverage:** identify which registration, transfer receipt, dispatch, local-release completion and other events belong here. Keep unrelated approvals/reconciliation/admin audit records out unless explicitly part of the agreed transaction history.
3. **Deduplication:** scan/capture, command, audit and ledger projections may describe the same event. Provide canonical linkage/row identity; do not deduplicate solely by time, displayed Unit ID or a shared ledger hash.
4. **Missing historical linkage:** older retained records may lack scan, method, printed ID or unit membership. Return explicit field availability or an agreed fallback rather than reconstructing unsupported facts.
5. **Timestamps/order:** define deterministic newest-first ordering and tie-breaks. Specify refresh behavior, completeness, pagination/cursors and whether current counts represent a complete history or only the loaded page.
6. **Institutions/roles:** define source/destination access and direction by account context. A receiving facility must not gain unrelated source inventory/capture evidence. Regulatory aggregate access must not expose detailed labels by accident.
7. **Search/export:** state which fields are searchable and exportable, whether filtering is server-side and whether PDF covers the loaded/filtered snapshot or the complete result. Printed IDs must follow the same permissions as display.

## Expected deliverable from Jopia

An institution-scoped read contract joining existing evidence may be a dedicated history endpoint or an explicitly documented extension to existing reads. Jopia should choose and specify the route, version/header, payload, nullable fields, pagination, authorization and safe error behavior in `services/api/openapi-v2.json` and applicable documentation.

Please include stable technical links to the relevant component, capture/scan, command, transfer/reservation/local release and actual ledger event where available. They need not all become visible columns. Do not force Lat to guess relationships by parsing reference prefixes or comparing approximate timestamps.

A field list/schema is deliberately not frozen in this handoff: the canonical transaction meaning, row granularity and privacy rules need to be established first. The requested nine display labels are fixed by the user's presentation decision; underlying field names and evidence semantics remain Jopia's contract work.

## Lat implementation after the contract is ready

- Replace visible columns and PDF headers with the nine requested mockup labels/order.
- Use the approved date, direction, status and identifier mappings; preserve missing/queued/error distinctions.
- Retain technical IDs for row keys and exact detail navigation without presenting them as printed bag IDs or scan IDs.
- Show Blood as the actual blood type plus component; Method from the event's recorded evidence only.
- Handle multi-unit transactions according to the agreed row model, and maintain current search, direction filtering, pagination and accessibility.
- Match the mockup table/badge design without importing its fake record generation or fake blockchain references.

## Acceptance checks

- Verified synthetic inbound registration and transfer receipt, outbound dispatch and local release appear with the correct facility-relative direction and actual event linkage.
- One event represented in several backend stores does not produce duplicate rows; multi-unit events remain complete and unambiguous.
- Scan ID, business Transaction ID, internal component ID, printed Unit ID, command ID and Blockchain ID retain their distinct meanings.
- Legacy missing evidence is visibly unavailable; no invented Scan/OCR/Received/Released defaults or generated ledger hashes.
- Queued/failed/conflicted commands never appear as confirmed inventory movement; committed and projection-pending evidence are rendered accurately.
- Foreign institutions cannot retrieve unauthorized rows or printed identifiers through list/detail/search/export.
- Backend contract tests cover linkage, authorization, deduplication, multi-unit and missing-evidence cases; frontend parser and browser tests cover the nine fields and safe states.
- Preserve retained bags, identifiers, commands, accounts, identities, volumes and edits. No reset, repopulation, census rerun, forecast rerun or live scan/dispatch is authorized by this document. Test with isolated synthetic fixtures.

## Current scanner boundary

The current scanner wrapper supports verified inbound OCR through the existing capture flow. Its manual input and outbound photo/manual screens are previews with confirmation disabled; supported custody commands live in Requests & Transfers. This handoff requests truthful history reads, not an unrequested implementation of those missing submission workflows.

## Reply requested

Please send the backend branch/PR and final OpenAPI contract, together with decisions on row granularity, Transaction ID meaning, Scan ID/capture mapping, printed Unit ID dependency, event time, Method/status definitions, multi-unit behavior, access rules and retained-record fallbacks. Lat can then implement the mockup table against verified fields.
