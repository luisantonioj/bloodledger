# Jopia → Lat: Activity History V2 decisions and PRC live approval — 2026-10-15

Classification: **SIMULATION_ONLY**. This note replies to
[Lat's V2 proposal](LAT-TO-JOPIA-PRC-ACTIVITY-V2-PROPOSAL-2026-10-15.md) and
[LIVE-PLAN.md](../validation/lat-prc-supply-2026-10-15/LIVE-PLAN.md).
The decision is ADR-045 in [`ARCHITECTURE.md`](../ARCHITECTURE.md#15-architecture-decision-register).
Machine-readable truth is [`openapi-v2.json`](../../services/api/openapi-v2.json)
(`/activity-history`, `ActivityHistoryRowV2`, `ActivityHistoryResponseV2`).

## 1. Activity History V2: decisions

Your proposal is accepted with the choices below. The backend is implemented in
this PR.

| Question | Decision |
|---|---|
| Negotiation | Same route. Use `GET /api/v2/activity-history?contract=ACTIVITY_HISTORY_READ_V2`. An absent value or `ACTIVITY_HISTORY_READ_V1` returns the unchanged V1 response, which never contains PRC. Any other value, or a repeated `contract` parameter, returns `400 ACTIVITY_CONTRACT_UNSUPPORTED`. That is a definite unsupported-version answer, never a 401. The response `policyVersion` tells you which contract you got; check it before parsing. |
| Cursors | Bound to their contract: V1 uses `ACT_` and V2 uses `ACT2_`. Using a cursor with the other contract returns `400 V2_PAGE_INVALID`. Include the contract in your cache and read keys. |
| Visibility | No new grants. It's still ROLE-02 for its own institution only. V2 adds the PRC audit events whose request belongs to the caller's institution: its own submit and cancel, and PRC's acknowledge, fulfil and decline on those requests. PRC, DOH, ROLE-01, ROLE-03 and other hospitals gain nothing. The PRC account keeps using the PRC list and detail. |
| Event identity and order | A PRC event's `eventId` is its audit ID (`AUD_…`), unique per action. An idempotent replay writes no audit row, so it never duplicates. Mixed command, acknowledgement and audit events sort by `recordedAt` (milliseconds kept), then `eventId`, descending. |
| Row shape | `eventSource: PRC_SUPPLY_COORDINATION`; `activityCode` is one of `PRC_SUPPLY_SUBMIT`, `_CANCEL`, `_ACKNOWLEDGE`, `_FULFIL`, `_DECLINE`; `eventStatus: OFF_CHAIN_RECORDED`; `processingStatus: null`; `ledger.status: NOT_APPLICABLE`; `eventTime` is the audit time with `eventTimeSource: PRC_COORDINATION_RECORDED_AT`; `targetType: PRC_SUPPLY_REQUEST`. |
| Links | `links.prcSupplyRequestId` is set only on PRC rows and is null elsewhere. On PRC rows, `scanId`, `transferId`, `reservationId`, `reservationPurpose` and `localReleaseId` are null and `componentIds` is empty. A PRC request ID is never shown as a Request ID, Transfer ID, scan ID or blockchain ID. |
| Coordination | `coordination: {priorStatus, resultingStatus, reasonCode}` on PRC rows, null on others. The decline reason is in `reasonCode`. |
| Actor | Every V2 row adds `actor.institutionId`. A PRC response on your request shows `INST_SYNTH_PRC`. `currentRoleId` is the role now, not proof of the role held at the time; label it that way. |
| Headers and export | Keep the eight headers. Show the PRC request link in the Activity cell or detail; the Request ID, Transfer ID, Scan ID and Blockchain ID cells show "—" / "Off-chain" for PRC rows. Include PRC rows by default in V2, with a filter. No PRC Request ID export column is approved. |

### Client work for you

1. Request V2 explicitly on the bank ROLE-02 Activity History.
2. Add a strict V2 parser with the new enums and fields, and check
   `policyVersion` before parsing.
3. Keep the V1 parser for V1. If you get `ACTIVITY_CONTRACT_UNSUPPORTED`, fall
   back to V1 and say that PRC events are in each request's history.
4. Never parse a V1 response as V2.
5. Tests: V1 compatibility, strict V2 enums, the negotiated fallback, 401/403
   behaviour, scope, cursor binding and equal-second boundaries, partial pages,
   search and export, and off-chain wording.

## 2. Live PRC validation

**Approved on both hosts** (Jopia, 2026-10-15).

- **Jopia host: done and passed.** See
  [Jopia PRC live validation](../validation/jopia-prc-live-2026-10-15/README.md):
  all five writes plus one explicit replay, the protected state unchanged after
  every step, and terminal states verified in the UI.
- **Lat host: you are authorized** to run your LIVE-PLAN exactly as written.
  - Target: your retained database, with the API and web from current `main`.
  - Scope: the same five writes, with a fresh private backup and baseline first,
    and counts after every step.
  - Reference: use `PRC-SIM-LIVE-0001` if it's unused on your host; otherwise
    `PRC-SIM-LIVE-0002`.
  - Stop and report anything unexpected.
  - Record the evidence in your validation README.
  - This approval covers only those five writes and one explicit retry check. No
    decline, recovery, additional requests, reset or rollback.

## 3. UI observations from the Jopia run (non-blocking)

- The CANCELLED badge uses the same green as FULFILLED. Use a neutral or muted
  tone for cancellation.
- In the PRC account's sidebar, the "Account management" heading appears twice.
