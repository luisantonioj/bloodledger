# Jopia → Lat: printed-label Unit ID and Blood Unit Transactions history — 2026-10-15

Classification: **SIMULATION_ONLY**. This note answers two Lat requests from
2026-10-15: the printed-label ID in Blood Inventory (sections 1–6) and the
Blood Unit Transactions history contract (section 7). Branch: `codex/jopia-label-identity-read`,
based on `main` `37d998a`. Jopia implements and self-validates; Lat owns the
frontend handling and its browser rerun. Machine-readable truth is
[`openapi-v2.json`](../../services/api/openapi-v2.json) (`LabelIdentity`,
`ComponentProjection`, `/unit-history`, `UnitHistoryRow`). The decisions are
ADR-036 and ADR-037 in
[`ARCHITECTURE.md`](../ARCHITECTURE.md#15-architecture-decision-register), and
`PA-DEF-02` (`LABEL_IDENTITY_READ_V1`) and `PA-DEF-03`
(`UNIT_HISTORY_READ_V1`) in
[`REQUIREMENTS.md`](../REQUIREMENTS.md#8-prototype-assumption-register). This
note explains them and does not replace them.

There are no chaincode, migration, command, policy-selection or population
changes. No reset, recapture, census rerun or forecast rerun is needed.

## 1. Which value is displayed

The displayed identifier is the **recorded printed-label Donation No.**,
returned exactly as it was captured. It is not reformatted. Synthetic
Mediatrix labels use `MMYY-MM-NNNN`: for example, `MM26-08-4064` means Mary
Mediatrix, 2026, August, unit 4064. The retained operational stock was captured
in this format through confirmed OCR. Other issuers keep their enabled issuer
format, including its prefix, separators and leading zeros.

Do not use the mockup string `=)W0381 2509 100023`. It is not a recorded label,
and this value is not an ISBT 128 claim.

## 2. Response shape

`GET /api/v2/components` and `GET /api/v2/components/{componentId}` add one
field per component, for both the `V2` and `V2.1` contract headers:

```json
"labelIdentity": {
  "status": "AVAILABLE",
  "kind": "DONATION_NUMBER",
  "value": "MM26-08-4064",
  "source": "CONFIRMED_OCR_CAPTURE",
  "unavailableReason": null,
  "policyVersion": "LABEL_IDENTITY_READ_V1"
}
```

| Field | Values |
|---|---|
| `status` | `AVAILABLE` or `UNAVAILABLE` |
| `value` | Exact string (1–64 characters) when `AVAILABLE`, otherwise `null` |
| `source` | `CONFIRMED_OCR_CAPTURE` or `LEGACY_REGISTRATION` (registered before OCR-only intake); `null` when unavailable |
| `unavailableReason` | `NOT_RECORDED` (no encrypted value exists), `TEMPORARILY_UNAVAILABLE` (keys, key version, decryption or sealed read failed), or `NOT_COMMITTED` (unit history only: the event is not ledger-committed and your institution does not hold the unit); `null` when available |

The field is additive, so no contract header or version change is needed.
Existing fields are unchanged: `componentId`, `donationId`, reservation
references, `inventoryVersion`, and command, version and idempotency behavior.
Older responses that lack `labelIdentity` should be treated as unavailable.

## 3. Access

| Caller | Label |
|---|---|
| ROLE-01, ROLE-02, ROLE-03 for components their institution **currently holds** | Full exact value, no masking |
| Components held by another institution | Not returned (existing 404 / not listed) |
| ROLE-01, ROLE-02, ROLE-03 in unit history (section 7) | Full value for units in their institution's own ledger-committed custody events, or held now |
| ROLE-04 regulatory, ROLE-05 administration | No component or history reads (existing 403) |
| Reservations, transfers, census, reports, audit, coordination, Fabric, logs | Not included |

After a transfer is received, the inventory label moves with custody: the
receiving institution sees it in inventory and the source no longer does. The
source still sees it on its own committed dispatch row in unit history.

## 4. Shared donations

One donation can produce several components with different component types.
Those rows share the same `value` and `donationId`. Show the component type
next to the label so the rows can be told apart, and use `componentId` for the
row key, detail link, deep link and every command. A label is unique only
together with `issuerInstitutionId`.

## 5. Search and PDF

- **Search:** allowed only as client-side filtering over the list the browser
  already received. Never put a label value in a URL, query string, route state
  that is serialized into the URL, log or analytics. The server has no label
  query filter.
- **PDF:** the browser-generated inventory PDF may include the label in the
  Unit ID column. Keep the `SIMULATION_ONLY` marking.

## 6. Fallback

When `status` is `UNAVAILABLE`, show a clear "Label unavailable" state, styled
so it cannot be mistaken for an ID. Never show `componentId`, `donationId`, a
hash, the row position or a mock value in that column.

## 7. Blood Unit Transactions history

New route: `GET /api/v2/unit-history?limit=&cursor=`. It needs no contract
header. Access is ROLE-01, ROLE-02 and ROLE-03; ROLE-04 and ROLE-05 get `403`.

### Decisions

| Question | Decision |
|---|---|
| Source and deduplication | Only `app.v2_commands`. That table already backs the transfer timeline and the audit read, so each event exists once. Drop the timeline/audit merge for this table, and don't deduplicate by time, label or ledger hash. |
| Row granularity | One row per custody event **per unit**. `rowId` = `{transactionId}:{componentId}` is the stable row key. A multi-unit transfer gives several rows with the same `transactionId`. |
| Coverage | `INBOUND_REGISTERED` (confirmed OCR registration, or legacy registration), `TRANSFER_RECEIVED` (receipt, including a receipt matched by OCR capture), `TRANSFER_DISPATCHED`, `LOCAL_RELEASE_COMPLETED`. Reservation, preparation, transit, cancellation, holds, expiry, compromise, approvals and admin records are excluded. |
| Scope and direction | Rows are events your institution acted on as the custody party. Registrations and receipts are `INBOUND`; dispatches and local releases are `OUTBOUND`. The source sees its dispatch and the destination sees its receipt; neither sees the other side's event or capture evidence. |
| Time | `eventTime` is the business event time recorded on the command and submitted to the ledger, stored in UTC; show it in Asia/Manila. Legacy commands can have `null`; show "—", not another time. `acceptedAt` is for ordering only. |
| Transaction ID | `transactionId` is the durable command ID (`CMD_…`). In this system one command is one custody event and at most one ledger transaction, and there is no separate transaction table to reference. Transfer, reservation and local-release IDs are under `links`. |
| Scan ID | `scanId` is the confirmed inbound OCR capture ID (`INCAP_…`) on OCR events, otherwise `null`. A command ID is never relabeled as a scan ID. |
| Unit ID | `labelIdentity` (same object as inventory) plus `componentId` for navigation. Your institution sees the label for units in its own ledger-committed events or units it holds now. Otherwise the reason is `NOT_COMMITTED`, `NOT_RECORDED` or `TEMPORARILY_UNAVAILABLE`. |
| Blood | `bloodType` and `componentType` are fixed at registration and read by `componentId` from the committed component (`unitAttributesSource: LEDGER_PROJECTION`). A registration that isn't committed yet shows its confirmed capture values (`PENDING_COMMAND`). Unknown is `null`. |
| Method | `OCR` (confirmed capture), `WEB_COMMAND` (Requests & Transfers action, no scan) or `null` (legacy, not recorded). Don't default to Scan. |
| Status | `eventStatus`: `CONFIRMED` (committed; the only state that is a completed movement), `LEDGER_COMMITTED_PROJECTION_PENDING`, `PENDING` (queued, submitting or retry wait), `FAILED`, `CONFLICT`. The raw `processingStatus` and `safeErrorCode` are also returned. |
| Blockchain ID | `ledger.transactionId` is the actual Fabric transaction for this event's command, with `committedAt`, `blockNumber` and `validationStatus`. When `ledger.status` is `NOT_COMMITTED` it is `null`; never generate a value. |
| Multi-unit membership | Units come from the committed reservation's `selectedComponentIds` snapshot (reallocation is disabled). Without it the row has `unitMembership: UNAVAILABLE` and null unit fields. |
| Paging and order | Newest first by `acceptedAt`, then `transactionId`, both descending; units within one event are ordered by `componentId`. `limit` (1–100, default 50) counts events, so an event's units are never split across pages. Pass `nextCursor` back as `cursor`. The history is complete only when `nextCursor` is `null`; any count describes loaded rows only. Refresh by reading the first page again. |
| Search and export | No server-side search. Filter loaded rows in the browser by direction, label, type and so on. The PDF covers the loaded or filtered rows and should say so. It keeps the `SIMULATION_ONLY` marking. The label follows the same permissions as display and never goes into URLs or logs. |

### Column mapping

| Mockup column | Field |
|---|---|
| Time | `eventTime` (Asia/Manila) |
| Type | `direction` |
| Scan ID | `scanId`, or "—" when null |
| Transaction ID | `transactionId` |
| Unit ID | `labelIdentity.value`, with the label-unavailable state from section 6; link with `componentId` |
| Blood | `bloodType` + `componentType` |
| Method | `method`, or "Not recorded" when null |
| Status | `eventStatus` |
| Blockchain ID | `ledger.transactionId`, or "Not committed" when null |

The scanner boundary is unchanged. Manual input and outbound photo screens stay
previews, and this read adds no submission workflow.

## 8. Validation (Jopia self-validation)

- `npm test` in `services/api`: 163 tests, 163 passed.
- `test/label-identity.test.ts` covers exact values with preserved issuer
  format and leading zeros, provenance, shared-donation rows keeping distinct
  `componentId` values, custody scope, a 404 for another institution's
  component, a 403 for ROLE-04, missing keys, a wrong key or key version, a
  tampered tag, and a failed sealed read. None of these leak values or
  diagnostics.
- `test/unit-history.test.ts` covers an OCR registration row, a pending
  registration that isn't shown as confirmed, a multi-unit dispatch sharing
  one transaction, projection-pending versus failed receipt, a withheld label
  on a failed receipt, missing membership, a legacy registration without a
  method, cursor round-trip and tampering, page limits, institution scoping,
  exclusion of sealed material, and a 403 for ROLE-04.
- OpenAPI JSON formatting and the V2/inbound static-boundary patterns pass.
- `unit-history.test.ts` also covers an OCR-matched transfer receipt, which is
  `OCR` with its `INCAP_` scan ID even though its payload has no
  `captureMethod` key. The live check below found this case.
- **Live retained-data check, 2026-10-15.** The branch's own Postgres readers
  and assembler ran read-only against the retained `bloodledger_dev` database,
  using the existing keys. No commands were sent, nothing was reset, and the
  API container was not restarted.
  - Inventory: Mediatrix has 530 rows and `INST_SYNTH_MEDIX` has 1. All 531
    labels are `AVAILABLE` from `CONFIRMED_OCR_CAPTURE`, all match
    `MMYY-MM-NNNN` (for example `MM26-10-1521`), and all are distinct.
  - History at Mediatrix: 537 of 537 events load across 6 pages with unique
    row IDs, no duplicate events across pages, and correct ordering. They are
    531 OCR registrations with `INCAP_` scan IDs, 4 dispatches and 2 local
    releases (both `WEB_COMMAND`). All are `CONFIRMED` with a Fabric
    transaction ID, none have a null event time, and every unit has its label.
  - History at `INST_SYNTH_MEDIX`: 2 OCR-matched receipts, one `CONFIRMED`
    with a ledger transaction and one `FAILED` (`CORE_FIELD_NOT_ALLOWED`,
    `NOT_COMMITTED`). The failed row still shows the label because that
    institution holds the unit now.
  - The retained data has no multi-unit transfer, so row expansion for
    multi-unit transfers is covered only by unit tests. The persistent API
    container was not running, so HTTP-level reads were checked with inject
    tests rather than a live session.

This is research-prototype display behavior. It does not establish clinical,
regulatory or production readiness, and it does not resolve `RQ-02`.
