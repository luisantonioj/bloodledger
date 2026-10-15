# Lat → Jopia: proposed PRC coordination in Activity History V2

2026-10-15. **PROPOSED — documentation only; no parser or contract change.**
SIMULATION_ONLY, PA-DEF-06 / ADR-044; RQ-02 remains open.

## Current boundary

`ACTIVITY_HISTORY_READ_V1` intentionally excludes PRC. Its strict parser only
accepts COMMAND / OFF_CHAIN_ACKNOWLEDGEMENT event sources and its frozen activity
codes; passing PRC records through that contract would break existing clients.
The merged PRC detail `history[]` remains the supported view. Do not widen V1,
map PRC to a Fabric command, or grant new Activity History permissions.

## Suggested client behavior for a coordinated V2

Offer PRC coordination as an explicitly labeled filter in Activity History only
for a principal authorized to read both that surface and the new scoped source.
An approved PRC read does not itself grant general audit/Activity History access.
Keep normal inventory/custody events distinct from off-chain coordination.

Proposed new V2 vocabulary (names for Jopia to review, not published fields):

- eventSource: `PRC_SUPPLY_COORDINATION`.
- activityCode: `PRC_SUPPLY_SUBMIT`, `PRC_SUPPLY_ACKNOWLEDGE`,
  `PRC_SUPPLY_FULFIL`, `PRC_SUPPLY_DECLINE`, `PRC_SUPPLY_CANCEL`.
- eventStatus: existing `OFF_CHAIN_RECORDED`; processingStatus null;
  ledger.status `NOT_APPLICABLE`, with no fabricated ledger transaction.
- A dedicated nullable `links.prcSupplyRequestId`, never a TRF request, RES
  transfer, scan ID or blockchain ID. Display a "PRC request" link in the Activity
  cell/detail, leaving unrelated existing ID columns as not applicable. Retain
  the eight current export headers unless a separately approved revision adds
  an explicit PRC identifier column.
- Display verified actor/source and actual audited time (milliseconds preserved).
  Use coordination prior/resulting statuses and decline reason in detail. A
  current operator role must remain labeled current, never assumed historical.

## Compatibility and backend decisions needed

Use a separately negotiated `ACTIVITY_HISTORY_READ_V2` response, for example an
explicit read-version query on the existing route. Jopia must choose/publish the
route or negotiation mechanism before implementation. A version parameter must
be validated, not silently ignored. New clients request V2 deliberately and
validate its version before parsing. Old/unversioned clients continue receiving
V1 with the old enums and PRC excluded. Cache/read keys include the requested
contract version. On unsupported V2 (an explicit supported error, not a genuine
401), the new UI may explain that PRC events are available in per-request history;
it must not parse a V1 result as V2 or silently hide a failed authorization.

Please decide:

1. Negotiation/route and version field, including explicit unsupported-version
   behavior and a rollout that leaves V1 unchanged.
2. Visibility: own-bank PRC events and PRC-all events only if explicitly granted
   for this surface; no new ROLE-01/general audit, other-hospital, ROLE-03 or DOH
   access is inferred from existing PRC detail permissions.
3. Stable unique event IDs and millisecond-safe ordering/cursors for mixed
   command/audit events; no duplicate event on idempotent replay.
4. V2 link/status shape and actor/time semantics, including safe declined reason.
5. Whether to keep eight headers with a PRC detail link or approve an explicit
   PRC Request ID export column, and whether inclusion is opt-in by default.

Client tests would cover V1 compatibility, strict V2 enums, negotiated fallback,
403/401 behavior, institution scope, partial pages/search/export, equal-second
cursor boundaries and off-chain wording. No client/backend work or live action
is authorized by this proposal. Until accepted and implemented together, keep
PRC history solely in its request detail.
