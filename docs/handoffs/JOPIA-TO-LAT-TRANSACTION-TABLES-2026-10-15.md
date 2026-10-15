# Jopia → Lat: transaction-table backend contracts — 2026-10-15

Classification: **SIMULATION_ONLY**. This note answers four Lat requests from
2026-10-15:

| Request | Sections | Read | Policy |
|---|---|---|---|
| Printed-label Unit ID in Blood Inventory | 1–6 | `GET /api/v2/components` (+ detail) | `LABEL_IDENTITY_READ_V1` |
| Blood Unit Transactions history | 7 | `GET /api/v2/unit-history` | `UNIT_HISTORY_READ_V1` |
| Blood Requests, Transfers and PRC Supply tables | 9 | `GET /api/v2/transfers` (Priority), `GET /api/v2/transfer-summaries` | `TRANSFER_SUMMARY_READ_V1` |
| Activity History | 10 | `GET /api/v2/activity-history` | `ACTIVITY_HISTORY_READ_V1` |

Section 8 is the identifier glossary that every table uses. Section 11 is the
validation. PR: luisantonioj/bloodledger#51 (branch
`codex/jopia-label-identity-read`). Jopia implements and self-validates; Lat
owns the frontend handling and its browser rerun.

Machine-readable truth is
[`openapi-v2.json`](../../services/api/openapi-v2.json). The decisions are
ADR-040 to ADR-043 in
[`ARCHITECTURE.md`](../ARCHITECTURE.md#15-architecture-decision-register), and
`PA-DEF-02` to `PA-DEF-05` and `RQ-17` in
[`REQUIREMENTS.md`](../REQUIREMENTS.md#8-prototype-assumption-register). This
note explains them and does not replace them.

All four reads are additive. There are no chaincode, migration, command,
policy-selection or population changes. No reset, recapture, census rerun,
forecast rerun or live command is needed.

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

## 8. Identifier glossary (all tables)

The same column name means the same field everywhere. Never relabel one ID as
another, and never parse prefixes or compare timestamps to link records.

| Column | Field | Example prefix | Meaning |
|---|---|---|---|
| Request ID | `transferId` / `links.transferId` | `TRF_` | The blood transfer request a hospital submitted |
| Transfer ID | `reservationId` / `links.reservationId` when `purpose` / `reservationPurpose` is `TRANSFER` | `RES_` | The custody transfer for that request (allocation → preparation → dispatch → receipt). Selection and custody commands already target it. One request has **at most one** reservation (unique index). |
| Local release ID | `localReleaseId` | `REL_` | A local release; its reservation is never shown as a Transfer ID |
| Scan ID | `scanId` | `INCAP_` | Confirmed inbound OCR capture |
| Transaction ID | `transactionId` (unit history only) | `CMD_` | The durable command (one custody event) |
| Unit ID | `labelIdentity.value` | `MM26-10-1521` | Printed label; `componentId` (`COMP_`) stays the record key |
| Blockchain ID | `ledger.transactionId` | Fabric hex | Actual Fabric transaction, or none |
| — | `correlationId`, `eventId` | `CORR_`, `CMD_`/`IDEM_` | Technical provenance only; never a business ID |

## 9. Blood Requests, Transfers and PRC Supply

### Blood Requests — Priority

`GET /api/v2/transfers` → each `requests[]` row's `urgency`. The enum is
`ROUTINE`, `URGENT` or `CRITICAL`, it is NOT NULL on every V2 request, and
there is no `EMERGENCY` alias. It is the recorded request urgency, not the RPS
score or BROA rank. The current retained data is all `ROUTINE`. Keep your
"Not available" fallback only for older responses that lack the field.

### Transfers — `GET /api/v2/transfer-summaries?limit=&cursor=`

Switch the Transfers table to this read. It replaces the client-side join of
`requests[]` and `reservations[]`, which are each capped at 100 and can be
missing each other's rows.

| Question | Decision |
|---|---|
| Row | One per reservation (custody workflow). Select with `reservationId` and use `version` for custody actions, exactly as today. |
| Transfer ID | `reservationId` for `purpose: TRANSFER`. Show `transferId` as Request ID in detail or as a secondary line. |
| Cardinality | Request → reservation is 1 : 0..1 (unique index), so there are no multi-reservation requests. Requests without a reservation stay in Blood Requests. |
| Blood Type | `bloodType` + `componentType`, from the linked request (or the local-release reserve command). `productAvailability: UNAVAILABLE` means the record is missing; show "Not available". |
| Units | `units.requested` (request quantity), `units.allocated` (committed selection snapshot) and `units.currentStatus` (current status counts of those units, such as `{"RESERVED":2}`). Show requested/allocated in the cell and status counts in detail. Never call these dispatched or received unless `currentStatus` says so. |
| From / To | `source` and `destination` `{institutionId, displayName}`. Names are limited to the two facilities on a returned row. |
| Local releases | Kept in this list as `purpose: LOCAL_RELEASE`: `transferId` and `urgency` are null and `destination` is null with `destinationApplicability: NOT_APPLICABLE`. Label them "Local release" with `localReleaseId`, show "Not applicable" in To, and keep their detail and completion access. A "Transfers / Local releases" filter is fine. |
| Status | `status` (reservation status: `ACTIVE`, `COMPLETED`, `RESERVED`, `PREPARED`, `DISPATCHED`, `IN_TRANSIT`, `RECEIVED`, `RELEASED`, `CANCELLED`, `COMPROMISED`). `requestStatus` is separate, and queued command state stays in the command views. |
| Scope | Same as reservation reads: ROLE-03 sees transfers inbound to its institution; ROLE-01/02 see transfers sourced by or inbound to theirs. ROLE-04/05 get `403`. |
| Order and paging | Newest reservation first (`reservedAt`, then `reservationId`, descending). Pass `nextCursor` back; the list is complete only when it is `null`. Rows missing a reserve command sort last with `reservedAt: null`. |
| Search and PDF | Client-side over loaded rows; the PDF covers loaded rows and keeps `SIMULATION_ONLY`. |

### PRC Supply Requests — no backend (RQ-17)

No PRC supply-request record, command, read or external PRC connection
exists. The only PRC capability is onboarding review. The workflow rules are
unanswered: who records a request, product lines, deadline, how a PRC
reference is obtained, the status lifecycle, and PRC visibility. So they are
recorded as `RQ-17`, and no contract is invented. Keep the six headers, the
single service-unavailable row and the disabled form exactly as you built
them. "Unavailable" must not read as "zero requests". No endpoint will be
added until `RQ-17` is decided.

> **Update 2026-10-15:** Jopia resolved `RQ-17` for simulation as `PA-DEF-06`
> (`SYNTHETIC_PRC_SUPPLY_V1`, ADR-044); see
> [REQUIREMENTS.md](../REQUIREMENTS.md#pa-def-06--synthetic-prc-supply-requests-2026-10-15).
> Keep the unavailable state until Jopia's backend PR adds the endpoints.

## 10. Activity History — `GET /api/v2/activity-history?limit=&cursor=`

Access is ROLE-02 (the audit-reader role) for its own institution; other roles
get `403`. Regulators keep the existing aggregate `/api/v2/audit` and
requesters keep their `/api/v2/transfers` timeline, both unchanged. Switch the
bank Activity History table from `/api/v2/audit` to this read.

| Question | Decision |
|---|---|
| Events and deduplication | Every V2 command the institution recorded, plus its off-chain alert acknowledgements. Each is one row keyed by `eventId`; independent events sharing a ledger transaction or reference stay separate. |
| Date & Time | `eventTime` with `eventTimeSource`. `COMMAND_EVENT_TIME` is the business time recorded on the command and sent to the ledger; `OFF_CHAIN_ACKNOWLEDGED_AT` is the server acknowledgement time. `null` (legacy) shows "—". `recordedAt` is the ordering time. |
| Activity | `activityCode` (operation or `ALERT_ACKNOWLEDGED_OFF_CHAIN`; the full list is in OpenAPI), with labels owned by the frontend. `targetType` is supplementary. |
| User / Source | `actor.kind` (`VERIFIED_OPERATOR`, `INSTITUTION_ACCOUNT`, `USER_ACCOUNT`, `UNKNOWN`), `actor.displayName` and `actor.currentRoleId`. The database forces display names to start with "Synthetic", so no real staff name can appear. `currentRoleId` is the role at read time, not proof of the role at the event. `UNKNOWN` shows "Unknown actor": never the viewer, the institution name or "System". No system worker writes these events. |
| Scan ID | `links.scanId` (`INCAP_`) for OCR intake and OCR-matched receipt only. Otherwise "—" (not applicable). |
| Request ID | `links.transferId`, recorded on the command or linked through its reservation. A submitted request does not gain a later reservation's Transfer ID. |
| Transfer ID | `links.reservationId` when `links.reservationPurpose` is `TRANSFER`; otherwise "—". For local releases, show `links.localReleaseId`. |
| Units | `links.componentIds` lists every unit the event references, for detail or hover; there is no singular unit column. |
| Blockchain ID | `ledger.transactionId` when `ledger.status` is `COMMITTED`. `NOT_COMMITTED` shows "Not committed"; `NOT_APPLICABLE` (off-chain) shows "Off-chain", never pending. |
| Status | `eventStatus`: `CONFIRMED`, `LEDGER_COMMITTED_PROJECTION_PENDING`, `PENDING`, `FAILED`, `CONFLICT`, `OFF_CHAIN_RECORDED`. `processingStatus` and `safeErrorCode` go in detail. A confirmed event is not a usable-inventory claim. |
| Provenance | Keep `correlationId`, `eventId` and `targetType` searchable and in hover or detail, but never shown as business IDs. |
| Order and paging | `recordedAt` then `eventId`, descending. `limit` counts events; the history is complete only when `nextCursor` is `null`. Counts describe loaded rows. |
| Search and PDF | Client-side over loaded rows, including actor display name and references. The PDF covers loaded rows. The payload never includes PINs, credentials, labels, OCR text or command payloads. |

## 11. Validation (Jopia self-validation)

- `npm test` in `services/api`: 170 tests, 170 passed.
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

- `transfer-activity-reads.test.ts` covers:
  - transfer rows taking product and units from their own request;
  - requested, allocated and current-status units kept separate;
  - local releases with destination `NOT_APPLICABLE`;
  - missing linkage shown as `UNAVAILABLE`;
  - cursor tampering;
  - ROLE-03 scoping and a 403 for ROLE-04;
  - activity links taken only from recorded references, with no later
    reservation attached to a submission and no local release shown as a
    Transfer ID;
  - failed, queued, projection-pending and off-chain status and ledger states;
  - `UNKNOWN` actors;
  - ROLE-02-only access;
  - exclusion of sealed material and PINs.
- **Live retained-data check of the transfer and activity reads** (read-only,
  same method as above):
  - **Transfer summaries:**
    - Mediatrix ROLE-02 sees 30 reservations (18 transfers, 12 local
      releases) across 10 pages of 3 with no duplicates.
    - Every row has product, requested and allocated units, current status
      counts and facility names.
    - Local releases show destination `NOT_APPLICABLE`.
    - The Medix blood-bank account (ROLE-02) sees exactly its 16 inbound
      transfers. Medix has no ROLE-03 login, and the reader returned the same
      rows in ROLE-03 scope.
    - All retained urgency is `ROUTINE`.
  - **Activity history:**
    - Mediatrix: 587 of 587 events (commands plus 2 off-chain
      acknowledgements) across 6 pages, unique and ordered. 584 are
      `CONFIRMED` with Fabric IDs, 1 is `FAILED`, and 2 are
      `OFF_CHAIN_RECORDED` with ledger `NOT_APPLICABLE`.
    - Actors at Mediatrix: 571 `VERIFIED_OPERATOR`, 16 `USER_ACCOUNT`.
    - Links at Mediatrix: 531 scan IDs, 34 Request IDs, 34 Transfer IDs,
      16 local-release links, and 9 multi-unit events.
    - Medix: 18 of 18 events.

This is research-prototype display behavior. It does not establish clinical,
regulatory or production readiness, and it does not resolve `RQ-02`.
