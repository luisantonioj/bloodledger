# Lat → Jopia: Blood Requests, Transfers and PRC Supply table contracts

Date: 2026-10-15 (Asia/Manila)
Backend/API owner requested: Jopia
Frontend owner/follow-up: Lat
Scope: blood-bank facility accounts; SIMULATION_ONLY retained dataset
Status: frontend columns implemented; remaining read/submission gaps need Jopia's contract

## User’s requested table changes

Reference: `C:\Users\Yuri\OneDrive\Documents\Bloodledger\Bloodledger Frontend\bloodledger-full-mockup.html`.

1. **Blood Requests:** add **Priority**. Other existing fields remain.
2. **Transfers:** replace prior Reservation ID / Workflow reference / Purpose / Status columns with **Transfer ID | Blood Type | Units | From | To | Status**.
3. **PRC Supply Requests:** show **Request ID | Product | Units | Required By | PRC Reference | Status**.

Lat implemented the supported frontend presentation and safe unavailable states. This handoff requests the missing backend semantics/data; it does not claim PRC integration exists or authorize invented records.

## 1. Blood Requests — Priority

### Available and implemented

`services/api/src/development-read.ts`, institution transfer read, already selects `urgency` from `app.v2_transfer_requests` along with request ID, product, quantity, source/destination, state and ledger reference.

The frontend now displays Priority from the recorded `urgency` and includes it in search. Missing values show **Not available**, not an assumed Routine. This is request urgency, not the computed RPS score or BROA destination rank. Existing technical request ID and detail selection are unchanged.

### Jopia: confirm/document

- Document the exact urgency enum, nullability and role visibility in the applicable list/detail contract. Current core examples use ROUTINE / URGENT / CRITICAL; do not introduce Emergency as a silent alias without a defined mapping.
- Ensure list/detail provide consistent recorded urgency, including older records where evidence is absent.
- No new ranking policy or mutation is required merely to show this column.

## 2. Transfers — completed display and remaining gaps

### Available and implemented

Current `/api/v2/transfers` institution read returns separate `requests` and `reservations` arrays. Reservation rows currently select `reservation_id`, `purpose`, `transfer_id`, `status`, `version`, preparation time, source `institution_id` and linked `destination_institution_id`.

The frontend maps the new table as follows:

| Column | Current mapping | Limitation |
| --- | --- | --- |
| Transfer ID | Reservation's non-null `transfer_id` | This is the existing linked transfer-request reference, not a renamed reservation ID. Confirm intended business display semantics. |
| Blood Type | Unique matching scoped request's `blood_type`, with component shown beneath it | Missing/ambiguous/inconsistent request linkage yields Not available. |
| Units | Matching request's positive integer `quantity` | Requested full quantity, not independently measured prepared/dispatched/received units. |
| From | Matching request's source, falling back to scoped reservation `institution_id` | Uses the existing facility display-name helper; unknown labels retain their actual identifier. |
| To | Matching request's destination, falling back to scoped reservation destination | Missing data stays unavailable. Local release has no hospital destination. |
| Status | Reservation `status` | Custody/reservation state, kept separate from request and queued-command status. |

Selection still opens the exact `reservation_id`, preserving current preparation, dispatch and custody workflows. Displaying Transfer ID must not switch the detail action to the request by accident. Search covers displayed product/facility fields plus retained technical references.

### Important retained-read limitations

`services/api/src/development-read.ts` independently limits requests and reservations to 100 rows. A returned reservation may therefore lack its matching request in the current response. Lat does not fill blood type or quantity from unrelated rows, infer zero, make per-row private lookups, or match on approximate timestamps.

Local-release reservations are already included in the existing Transfers list. Lat preserves those rows and their detail access, marks **Local release**, leaves Transfer ID/product/units unavailable when not supplied, and shows **Not applicable** for its absent hospital destination. No artificial transfer ID or destination is created.

### Jopia: required decisions/read improvement

1. Supply a stable, authorized joined transfer/reservation summary so every visible row has authoritative product, quantity and source/destination metadata, with pagination/completeness documented. A documented extension or dedicated read is acceptable; Lat is not freezing a new route/schema here.
2. Define the relationship and cardinality of business Transfer ID, request `transfer_id` and `reservation_id`. If a request has multiple reservations, define whether the table uses one row per reservation or a grouped business transfer and how selection identifies the correct custody workflow.
3. Define **Units** precisely: requested, allocated, active reserved, prepared, dispatched or received. Expose distinct counts where necessary; do not silently relabel one as another. Frontend currently uses linked requested quantity only.
4. Decide how local releases should appear under these hospital-transfer columns. Options include a separate explicit list/filter or documented local-release summaries. Preserve access to existing local-release completion/custody records; do not hide retained records as a side effect of replacing headers.
5. Provide approved facility display names, scoped to the user’s permitted source/destination relationships. Do not expand access to arbitrary institution inventory.
6. Define missing legacy linkage, unknown fields, stale reads, conflicts, sorting and pagination. No fabricated quantity or successful status fallback.

## 3. PRC Supply Requests — backend integration missing

### Current frontend state

Before this change, this tab already had an unavailable-state card and no connected PRC record list. The existing PRC form is a disabled presentation in `apps/web/src/features/transfers/prc-supply-request-form.tsx`; it does not persist or send a PRC request.

Lat now displays the six requested table headers and a single service-unavailable row. No fake requests, counts, required dates or PRC acknowledgements were added. Existing PRC submission remains disabled. An unavailable service is not evidence of zero real PRC requests.

### Jopia: requested contract

| Column | Required authoritative meaning |
| --- | --- |
| Request ID | Stable PRC supply request reference, distinguished from local hospital transfer IDs. |
| Product | Requested blood type and component; define whether one request can contain multiple product lines and the resulting row granularity. |
| Units | Requested quantity per product line, with fulfilled/approved quantities separate if applicable. |
| Required By | Recorded requested deadline, with timezone and nullable/not-specified behavior; not inferred from creation time or expiry. |
| PRC Reference | Actual external PRC acknowledgement/coordination reference, with provenance, visibility and missing/pending semantics. Do not generate a reference or assume acknowledgement. |
| Status | Defined PRC supply workflow state; distinct from command processing, hospital transfer reservation status and stock receipt. |

Also specify owning institution, PRC role visibility, list/detail endpoints, filtering/pagination, operator capabilities, audit, idempotency/version checks, accepted-versus-committed behavior and safe errors. If external coordination is manual, document the authorized recording/evidence process rather than implying an automated PRC connection.

A submission contract must explicitly support the displayed form’s product, units, urgency, required date/time and coordination note, or identify fields deferred from submission. This frontend change does not enable the form or establish those business rules.

## Frontend files and boundaries

- `apps/web/src/features/transfers/v2-transfer-evidence-view.tsx`: changed table columns, Priority and PRC unavailable table.
- `apps/web/src/features/transfers/bank-transfer-list.ts`: scoped/consistent request-to-reservation summary mapping; missing joins remain unknown.
- `apps/web/src/features/transfers/prc-supply-request-form.tsx`: existing disabled PRC form, preserved.
- `apps/web/src/features/transfers/bank-record-details.tsx` and reservation workflow components: existing exact-record detail/custody behavior retained.

No backend, policy, chaincode, request body, operator capability or domain command was changed by this table work. No real patient/donor/personnel data is needed in these list contracts.

## Acceptance checks for Jopia’s follow-up

- Priority reflects the actual recorded urgency; no unsupported default or RPS substitution.
- Transfer metadata is complete for the authorized returned row even when its original request falls outside a separately paged request list.
- Transfer IDs, request IDs and reservation IDs retain distinct meanings; row selection and versioned custody actions target the correct reservation.
- Multi-reservation requests and local releases remain traceable without duplicate/hidden custody records or fabricated hospital destinations.
- Units and status do not claim dispatch, receipt or usable stock from a request or queued command alone.
- PRC list/detail expose actual authorized records and real reference/deadline values, or explicit unavailability. Submission requires the agreed verified command workflow.
- Cross-institution list/detail/search/export access stays scoped, with synthetic tests for missing/foreign/ambiguous links, older records, pagination and failure states.
- Preserve all retained inventory, accounts, identities, reservations, volumes and edits. No resets, repopulation, census reruns, forecast reruns or live transfers are required by this handoff.

## Reply requested

Please return the branch/PR and finalized OpenAPI contract, including Priority enum/nullability, joined transfer summary and Units semantics, Transfer ID/reservation cardinality, local-release handling, facility-name policy, and PRC record/submission/deadline/reference/status contracts. Lat can then replace unavailable placeholders with verified values and enable only the supported workflow.

Related handoffs: [Printed Unit IDs](LAT-TO-JOPIA-INVENTORY-LABEL-IDENTIFIER-2026-10-15.md) and [Blood Unit Transactions history](LAT-TO-JOPIA-BLOOD-UNIT-TRANSACTION-HISTORY-CONTRACT-2026-10-15.md).

## Frontend validation completed by Lat

Web build/type check passed; 250 unit tests across 40 files passed; 29 affected browser tests passed; 2 design-token checks passed. Live Mediatrix verified all three header sets, populated linked transfer product/quantity/from/to/status and PRC unavailable-state table. Mobile tabs wrap without page overflow. No live domain commands or backend/data changes were made. Existing bundle-size warning remains.
