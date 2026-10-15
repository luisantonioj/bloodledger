# Jopia → Lat (and Buno): blood-bank backend completion report — 2026-10-15

Classification: **SIMULATION_ONLY**. This replies to
`LAT-TO-JOPIA-BLOOD-BANK-BACKEND-COMPLETION` (2026-10-15). Owner: Jopia
(self-validation). It is not a clinical, regulatory, production or ISBT 128
acceptance, and not a statement that every blood-bank function or institutional
gate is complete.

| Item | Detail |
|---|---|
| Branch | `codex/jopia-blood-bank-completion`, from `main` `b3bd63c` |
| Saved frontend | `codex/lat-analytics-activity-layouts` (`3d56bdb`, closed #66) was not touched. Rebase it on `main` after this merges; no web file changed here. |
| Contracts | [`openapi-v2.json`](../../services/api/openapi-v2.json): `BloodBankSummary`, `NetworkAvailability`, `RequestHistoryAggregate`, `OutboundVerification*`, and the `/transfers` description |
| Decisions | ADR-046, ADR-047, `RQ-18`, `RQ-19` |
| Live | No live command, PRC write, reset, census or forecast rerun, deployment or account change. Retained-data checks were read-only. |

## 1. What changed in the backend

1. **`GET /api/v2/dashboard/summary`** (`BLOOD_BANK_SUMMARY_V1`; ROLE-01/02,
   own institution):
   - `inventory.available` and `inventory.reserved` count label-current units.
   - `inventory.labelExpiredPendingEvaluation` counts AVAILABLE/RESERVED units
     whose printed label has expired but which haven't been ledger-evaluated.
     These are not usable stock.
   - `requests.incomingAwaitingDecision` and `outgoingAwaitingDecision` count
     PENDING requests with no reservation.
   - `expiringSoon` is `{availability: POLICY_BLOCKED, count: null, blocker: RQ-03}`.
   - Every count is a complete aggregate, never a capped list.
2. **`GET /api/v2/network-availability`** (`NETWORK_AVAILABILITY_V1`;
   ROLE-01/02/03):
   - Scope is `CITY_AGGREGATE`, with one row per ACTIVE institution × blood
     type × component that holds label-current AVAILABLE units.
   - Each row has a per-institution `lastProjectedAt`.
   - Access follows the permission matrix row "View city-wide aggregate
     availability" (Yes for Technologist, Hospital Admin and Secondary User).
     Regulators keep their own aggregate reads and get 403 here.
3. **`GET /api/v2/analytics/request-history?from=&to=`**
   (`REQUEST_HISTORY_AGGREGATE_V1`; ROLE-01/02):
   - A complete aggregate by Asia/Manila request date × direction
     (INCOMING/OUTGOING) × blood type × component × urgency.
   - Returns `requestCount` and `requestedUnits`.
   - At most 366 days per call; `departmentAvailability: NOT_RECORDED`.
4. **`/api/v2/transfers` requests** gain additive fields `reservation_id`,
   `reservation_status` and `decision_state`:
   - `decision_state` is `AWAITING_DECISION`, `RESERVATION_RECORDED`, or the
     recorded status.
   - **Defect fixed:** the ledger request asset stays `PENDING` after approval,
     so the table showed received requests as pending. On the Jopia host, 18 of
     19 "PENDING" requests already have a reservation; only 1 is actually
     awaiting a decision.
5. **`POST /api/v2/reservations/{id}/outbound-verifications`**
   (`OUTBOUND_LABEL_VERIFICATION_V1`, additive migration
   `20261016000000000`). The source-custody, PIN-verified ROLE-01/02 operator
   scans the label of every reserved unit:
   - The server matches the exact set by keyed lookup (no missing, extra or
     duplicate labels).
   - It stores only digests and component IDs.
   - It returns `EVD_` evidence plus a digest for the existing
     `POST /reservations/{id}/prepare`.
   - It is synchronous, idempotent and off-chain.
   - A mismatch reports counts only, never label values.
   - Typed evidence remains accepted until enforcement is decided (see
     section 4).

Migration note: the new table needs the documented migrator on any host
before outbound verification works there (one additive migration; take a
private backup first). It was not applied on the retained hosts in this
change.

## 2. Completion matrix

Dispositions: **complete** · **existing API needs wiring** · **backend change
required** · **policy decision required** · **deferred**.

| Screen / item | Disposition | Route / schema / ADR | Owner | Missing behavior | Policy blocker | Lat / Buno follow-up |
|---|---|---|---|---|---|---|
| Dashboard: Total units | Existing API needs wiring (better source) | `/dashboard/summary` `inventory` (ADR-046) | Lat | The current total adds every status from `/dashboard`, including label-expired stock | — | Show `available` (+ `reserved` if the card means on hand) from the summary. Show `labelExpiredPendingEvaluation` separately as "Label expired, awaiting evaluation", linking to the Inventory `LABEL_EXPIRED_PENDING_EVALUATION` filter. |
| Dashboard: Pending Requests | Existing API needs wiring | `/dashboard/summary` `requests.incomingAwaitingDecision` | Lat | Counting `status=PENDING` overstated it (19 vs 1) | — | Use `incomingAwaitingDecision` and label it "Awaiting your decision". Optionally show `outgoingAwaitingDecision` as "Your requests awaiting supplier". |
| Dashboard: Low Stock | Existing API needs wiring | `/api/v2/components` (V2.1) + `SYNTHETIC_STOCK_CLASSIFICATION_V1` | Lat (decision: Jopia) | Not served by the backend, by design | RQ-16 remains open for real policy | Count the series classified **Critical or Low** by the accepted demo bands, with the same eligibility, freshness and staleness rules. Label it "Demo bands" and show "unavailable" when the classification is unavailable. |
| Dashboard: Expiring Soon | Policy decision required | `expiringSoon` POLICY_BLOCKED | Institution (RQ-03) / Jopia | No approved near-expiry threshold; the 3/7-day inventory display bands are display-only | **RQ-03** | Keep "unavailable" and render the blocker from the summary. Don't derive it from display bands. |
| Network Blood Availability | Complete in backend; existing API needs wiring | `/network-availability` (ADR-046) | Lat | — | — | Bank widget: show `availableUnits` by product, labelled "City-wide, label-current available", with the per-institution `lastProjectedAt`. An absent combination is 0 recorded, not unknown. Never relabel institution data as network data. |
| Inventory (labels, expiry, versions) | Complete | ADR-040, `/components` | — | — | — | None. |
| Inventory: CSV import | Policy decision required | ADR-035 (forbids unverified import) | Jopia + institution (**RQ-19**) | Bulk intake has no approved verification path | **RQ-19** | Keep it disabled, with the RQ-19 explanation. |
| Transactions: history | Complete | ADR-041 | — | — | — | None. |
| Capture: inbound OCR | Complete | `/inbound-captures` (ADR-035) | — | — | — | None. |
| Capture: outbound scan | Backend change done; wiring needed | `/reservations/{id}/outbound-verifications` (ADR-047) | Lat | — | Enforcement is a separate decision (section 4) | Add an outbound scan step to **Prepare**: OCR each reserved unit's label, operator-confirm it, post all labels with `expectedVersion`, then prefill `preparedEvidenceId`/`Digest` from the result. Handle the 409 mismatch counts; never echo labels. Map the action to capability `transfer:prepare`. |
| Capture: manual intake | Policy decision required | ADR-035 (no manual repair) | Jopia + institution (**RQ-19**) | — | **RQ-19** | Keep it as a disabled preview. |
| Blood Requests: approve | Complete | `/reservations` bridge (RESERVE_COMPONENTS, FEFO) | — | — | — | Already wired for redistribution. For any `AWAITING_DECISION` request addressed to this bank, offer the same verified approval panel. Use `decision_state` to show the action only when awaiting. |
| Blood Requests: status display | Defect fixed; wiring needed | `/transfers` `decision_state`, `reservation_status` | Lat | — | — | Show `decision_state` (and the reservation's custody status) instead of the raw `status`, which stays PENDING after approval. |
| Blood Requests: reject / cancel / partial offer | Backend change required + policy decision required | none today (no ledger transition) | Jopia + institution (**RQ-18**) | Chaincode reject and cancel functions, API routes and reason codes; partial-offer rules | **RQ-18**; needs a chaincode lifecycle upgrade, which is separately authorized | Keep disabled with the RQ-18 explanation. Request cancellation is not reservation cancellation (`/reservations/{id}/cancel`, which already exists). |
| Transfers: guarded custody actions | Complete (existing) | `/reservations/{id}/{action}`, ADR-034/042 | — | — | — | Preserve the current guards. Prepare gains the outbound scan above. |
| PRC Supply | Complete | ADR-044, #57/#60/#61 | — | — | — | None. Keep replay-before-window and synchronous semantics. |
| Activity History | Complete | ADR-043/045 | — | — | — | None. |
| Analytics: observed requests | Backend change done; wiring needed | `/analytics/request-history` (ADR-046) | Lat; Buno validates | — | — | Replace aggregation over the 100-row `/transfers` list with this complete aggregate, chunked at 366 days. Label requested, not received or transfused, units. |
| Analytics: departments | Policy decision required | not recorded | Requester work (GAP-01) | Department and clinical fields are not collected | GAP-01 decisions | Keep departments unavailable. Missing departments are not hospitals. |
| Analytics: forecast and surplus | Complete (existing) | ADR-033/V4/V5 reads | Buno | — | — | Buno: confirm the request-history aggregate meets the observed-demand definition (counts by request date, requested units). |
| Alerts | Complete (existing) | `/api/v2/alerts`, `/alerts/{id}/acknowledge` | — | Alerts list ledger-evaluated EXPIRED units only | Near-expiry alerts are blocked on RQ-03 | Don't add near-expiry alerts. Surface `labelExpiredPendingEvaluation` from the summary and point to the existing expiry evaluation, which is a live write needing operator authorization. |
| Reports (census) | Complete (existing), coverage-dependent | `/reports/doh-census*`, `/reports/inbound-intake` | Jopia (operations) | Census tables are empty on the Jopia host because no capture has run | A census run is an operational step, separately authorized | Show "no census captured" truthfully. A census capture is not proof of external submission or compliance. |
| Profile: extended institution fields | Policy decision required | `/onboarding/institutions/{id}` (identity only) | Jopia + institution | Application `detail` is purged 30 days after closure (ADR-039); no durable profile store | **RQ-14** (retention) + approved field set | Keep the fields unavailable. |
| Operator administration | Complete (existing) | `/onboarding/operators*` | — | — | — | None. |
| Staff directory metadata / security self-service | Policy decision required | — | Jopia + institution | Names, contacts, password change and recovery | Credential setup/handoff decision (GAP-23) | Keep disabled; never read back passwords or PINs. |

## 3. Test evidence (Jopia host)

| Check | Command | Result |
|---|---|---|
| API unit and route tests | `cd services/api && npm test` | **PASS 189/189** (new `blood-bank-completion.test.ts`: summary shape and RQ-03 block, zero vs null freshness, network shape, history range and direction, outbound input and match counts, operator binding, role scopes 200/403/400) |
| Disposable DB integration (all migrations, real login and PIN) | `bash tests/accounts/postgres-integration.sh` | **PASS 2/2 runs**: blood-bank completion probe **38**, PRC **78**, accounts **150** assertions |
| What the probe covers | — | summary = DB counts and `RQ-03` block; DOH/PRC/requester 403; network sum = DB, requester 200, DOH 403; history = DB count and 4 invalid ranges; `decision_state` per request; outbound mismatch, partial, duplicate, stale version, other institution 404, ROLE-03 403, success, replay, idempotency conflict, labels never stored |
| Read-only retained data (Jopia host) | ad hoc reader script | **PASS**: Mediatrix 297 available / 1 reserved / **224 label-expired pending evaluation**; 1 request awaiting a decision (18 of 19 have reservations); network 11 rows, only Mediatrix stock; history 19 incoming requests, 24 units |
| OpenAPI formatting, version consistency | `node tests/repository/json-format.mjs`, `version-consistency.mjs` | **PASS** |
| Web types, parsers, browsers | Lat | **NOT_RUN** (no web change here) |

## 4. Decisions needed (named)

| Question | Approver | Acceptance condition |
|---|---|---|
| **RQ-03** Expiring Soon threshold | Institution / clinical owner, recorded by Jopia | Approved threshold, unit and boundary; then summary V2 replaces POLICY_BLOCKED |
| **RQ-18** Reject, cancel and partial-offer rules | Jopia + institution | Reason codes and terminal states; then authorized chaincode functions and lifecycle upgrade, API routes, contract tests |
| **RQ-19** Manual or bulk intake | Jopia + institution | A verification path that supersedes ADR-035 |
| Enforce verified outbound evidence for prepare | Jopia | After Lat wires the outbound scan, decide whether prepare must reference a stored `EVD_` for the same reservation version (backend check, versioned) |
| Apply migration `20261016000000000` on retained hosts | Jopia (operations) | Private backup, migration-status shows only this pending, counts unchanged; separately authorized |
| **RQ-14** Profile and application retention | Institution | Before extended profile fields |
