# Lat → Jopia: Activity History mockup columns and missing audit links

Date: 2026-10-15 (Asia/Manila)
Requested backend/API owner: Jopia
Frontend follow-up: Lat
Classification: SIMULATION_ONLY
Status: frontend layout implemented; actor and reference enrichment await an explicit safe read contract

## User’s decision

Use these Activity History columns, in this order:

**Date & Time | Activity | User / Source | Scan ID | Request ID | Transfer ID | Blockchain ID | Status**

Reference: `C:\Users\Yuri\OneDrive\Documents\Bloodledger\Bloodledger Frontend\bloodledger-full-mockup.html`.

The user also questioned the four summary containers: Permitted events, Institutions shown, Failed outcomes and Ledger-linked. Lat removed them: these were counts of the loaded, permitted rows, not authoritative system-wide totals. The existing filtered loaded-record count, activity filter, search, refresh and PDF export remain.

## Current authorized data and frontend behavior

For bank institution accounts, Activity History reads `/api/v2/audit`. Existing legacy access may use `/api/v1/audit`. The safe event shape currently includes:

`auditEventId`, `institutionDisplayName`, `actionCode`, `targetType`, `outcome`, `safeErrorCode`, `correlationId`, `ledgerTransactionId`, `eventTime` (and institution scope evidence where supplied).

Source implementations include `services/api/src/development-read.ts` and `services/api/src/database-application-read.ts`. The former composes permitted command history and off-chain acknowledgements; the latter queries authorized audit events. Different adapters can therefore use command acceptance versus audit event time; this distinction needs an explicit contract.

Requester Activity History already uses its own permitted `/api/v2/transfers` timeline rather than gaining broader audit access. `permittedActivity` validates requester ownership and can retain a verified request resource reference. Its access path is preserved.

Frontend implementation:

- `apps/web/src/features/audit/audit-view.tsx`: eight requested columns, no summary cards, empty/loading headings retained.
- `apps/web/src/features/audit/activity-export.ts`: safe normalization/search and matching eight-column PDF output. Unknown actor/reference fields are not automatically trusted or copied into the display/export.
- Actual recorded status, safe error and blockchain reference remain truthful; no mock value generation or mutation behavior was introduced.

## Field-by-field contract request

| Column | Current presentation | Required backend clarification or enrichment |
| --- | --- | --- |
| Date & Time | `eventTime`, displayed in Asia/Manila; original timestamp retained in HTML time metadata | Define the timestamp meaning for each source: action, scan, verification, command acceptance, ledger commitment or acknowledgement. Return UTC/timezone-qualified values and deterministic ordering. |
| Activity | Human-readable `actionCode`; target type remains supplementary | Provide/document stable action codes and safe display labels for each adapter. Do not conflate registration, request approval, dispatch, receipt or off-chain acknowledgement. |
| User / Source | Actual `institutionDisplayName`, explicitly labeled **Institution source** | Acting user/operator/source identity is not currently supplied. Define an authorized actor/source representation: operator reference/role, approved display alias or explicit system source, as supported by evidence and privacy rules. The current account is not necessarily the historical actor. |
| Scan ID | **Not available** in bank audit reads | Link the actual scan/capture event where it exists. Distinguish inbound capture ID, scan ID and preview-only data. No scan is expected for every audit event; define absent versus not applicable. |
| Request ID | **Not available** for bank audit rows | Return the explicitly linked business request identifier. A requester's already verified `TRANSFER_REQUEST` resource can populate this field in its restricted timeline. Do not turn a correlation ID into Request ID. |
| Transfer ID | **Not available** | Define the linked business transfer identifier separately from request, reservation and command references. Current audit rows do not establish that mapping. Do not relabel `RES_…`, correlation or audit event IDs as Transfer ID. |
| Blockchain ID | Actual `ledgerTransactionId` when supplied, otherwise **Not available** | Define ledger reference availability and meaning for failed, queued, off-chain and projection-pending events. An off-chain event is not automatically pending blockchain synchronization. No generated hashes. |
| Status | Recorded `outcome` or requester command state | Document the status taxonomy/source. Preserve queued, failed, conflict, committed and off-chain acknowledgement distinctions. Audit success is not automatic transfer completion or usable inventory. |

## Actor/source privacy boundary

The mockup uses examples such as actor/user/source names and fallback System. These are presentation fixtures, not authority to disclose real staff names, employee IDs or identifiers from unrelated accounts.

Please specify:

- Which historical actor identity the event establishes: verified operator versus institution account versus scheduler/worker/system source.
- Allowed labels/references by account category and institution scope; use synthetic fixtures and approved display forms.
- Explicit unavailable/not-applicable semantics for legacy records. Do not substitute the viewer's current account, an institution name as a person's name, or System for an unknown actor.
- Search/export permissions for actor references. No PINs, credentials, raw label images/OCR, diagnoses, patient/donor records or unrestricted payloads in the read.

The frontend currently preserves the existing safe-field whitelist. Returning an arbitrary new field will not automatically enable its display; Lat needs the finalized schema and access semantics first.

## Linkage and event-model decisions for Jopia

1. Supply explicit scan/capture, request, business transfer, reservation, component and command relationships where supported. Relationships may be nullable; do not require the UI to parse action strings, infer from prefixes, join on approximate timestamps or fetch every private record.
2. Coordinate Request ID / Transfer ID terminology with the existing [Requests / Transfers / PRC handoff](LAT-TO-JOPIA-REQUESTS-TRANSFERS-PRC-TABLE-CONTRACTS-2026-10-15.md) and [Blood Unit Transactions history handoff](LAT-TO-JOPIA-BLOOD-UNIT-TRANSACTION-HISTORY-CONTRACT-2026-10-15.md). Activity History is the broader audit trail; the other table is physical blood-unit transaction history. They must not become inconsistent duplicate models.
3. Define cardinality for multi-unit and multi-reservation events. A single audit event can legitimately reference more than one unit or workflow; agree how singular Request ID / Transfer ID columns render that relationship without dropping evidence.
4. Identify and deduplicate overlapping command/audit/acknowledgement sources using authoritative event identity. Keep independent events distinct even if they share one ledger transaction or business reference.
5. Keep correlation ID, audit event ID, command ID, target type and safe error available as approved technical provenance even though they are no longer separate visible columns. Correlation currently remains searchable and in the Activity hover metadata; do not repurpose it as a missing business ID.
6. Specify coverage, history completeness, pagination/cursors, stable ordering and refresh/error semantics. Existing database audit reads can limit results to 200; removed summary cards must not be interpreted as a request for global counts.
7. Preserve role-specific institution versus regulatory aggregate scope. No additional audit permissions or cross-institution raw actor/label access should be granted merely to fill a table cell.
8. Update `services/api/openapi-v2.json` and any applicable legacy/shared read documentation, with enum/nullability, compatibility/versioning and authorized search/PDF behavior. A documented existing-read extension or a dedicated read is Jopia's implementation choice; this handoff does not freeze a new endpoint or field naming scheme.

## Frontend work after the contract is ready

Lat will extend the safe typed parser, map the approved actor/source and explicit references, render availability states, and update PDF/search consistently. Technical IDs remain distinct from display labels. The eight visible mockup headings stay; the four removed summary cards do not need to return.

Until then, unavailable cells are deliberate. They do not mean that no request/scan/transfer exists, only that the current authorized read does not establish it.

## Acceptance checks

- Synthetic verified operator, institution-account and system/off-chain events show the correct evidence-based actor/source type; legacy unknown actors stay unavailable.
- Scan ID, Request ID and Transfer ID resolve to the actual authorized linked records, with clear nullable/not-applicable behavior and correct multi-record relationships.
- Correlation/audit/command/reservation IDs are not relabeled as business IDs, and no values are copied from mockup fixtures into retained history.
- Queued/failed/conflicted and off-chain outcomes are never promoted to confirmed custody or invented blockchain transactions. Projection-pending remains distinguishable from current committed projection.
- List/detail/search/export follow the same actor/reference scope rules. Requesters retain their own permitted timeline; regulatory access does not acquire unauthorized raw staff/label information.
- Missing or malformed evidence and foreign/ambiguous links fail safely. Backend contract and frontend parser/browser tests cover the new fields, status/time meaning, scope and PDF output.
- Preserve all retained events, bags, accounts, identities, reservations, volumes and edits. No data reset, reseeding, recapture, census/forecast rerun, live command submission or service deployment is required by this presentation handoff.

## Reply requested

Please return the backend branch/PR, finalized schema/OpenAPI and the decisions on actor/source privacy, event time/status provenance, explicit scan/request/transfer links, multi-record cardinality, missing legacy evidence, role scope and pagination/search/export behavior. Lat can then replace the unavailable cells with verified values.

## Frontend validation completed by Lat

Web build/type check passed; 251 unit tests across 40 files passed; 10 affected browser tests passed; 2 design-token checks passed. Live Mediatrix verified all eight column names, removed summary cards, institution-source labeling, truthful unavailable references and mobile layout without page overflow. No live domain commands were submitted. Existing bundle-size warning remains.
