# Jopia → Lat: label extraction and verification contracts

2026-10-17, Asia/Manila · **SIMULATION_ONLY** · Reply to Lat's 2026-10-17
label extraction and verification contracts handoff.

**Status: Accepted by Jopia on 2026-10-17.** Rows marked *Accepted
reference* restate contracts that are already accepted and change nothing.
Rows marked *Accepted direction (Jopia)* fix the agreed shape. Each becomes a
contract only when its ADR, OpenAPI and tests land under separate
implementation authorization; until then, do not wire it. The only backend
change shipped with this reply is the F3 replay fix (J1, below). No schema,
migration, chaincode, account, flag or retained-host change was made. No
deployment or live write is authorized. `RQ-02`, `RQ-03`, `RQ-09`, `RQ-10`
and `RQ-19` stay open.

## Review basis

This reply was first checked against `main` at `25bddeb`, before your preview
was published. You have since published it on
`codex/lat-doh-reporting-dashboard-20261016`: OCR commit `5724b36` and client
follow-up `f87b465`. Later commits on that branch change only documentation.
From `25bddeb` to `f87b465`, the changes are limited to `apps/web`, `docs` and
`scripts/ocr`. No API, contract, capture-policy, migration or chaincode file
changed.

### Contract check of the published client (`f87b465`)

Jopia read the client paths that call existing contracts. This was a code
read. No test or browser check was rerun here. Your recorded results (437 web
tests and the browser suites) are disclosed teammate evidence.

| Path | Result |
| --- | --- |
| Intake body | Built only from the unchanged strict recognition. It sends exactly the 15 keys `INBOUND_OCR_V1` allows, `OCR_LABEL` for both evidence sources, and four engine scores with no component score. The issuer comes from the Donation No. grammar. Edited, manual and preview drafts cannot submit. Conforms to items 1–3 and follow-ups 2–3. |
| Frozen retry | Reuses the same key, body and event time. The retry stays bound to the original operator, and it must: the server finds a key's command only for the same operator (`V2CommandStore.get`), so another operator's retry would miss the replay. Conforms to item 6. |
| Lost-response lookup | Uses the actor-scoped `GET /api/v2/commands?idempotencyKey=` and sends no POST. It checks the resource type, the `INCAP_` ID, the correlation ID and the status URL against the server's command shape. The retained `1124d6a` API also supports this lookup. |
| `ALREADY_REGISTERED` | On a fresh key, it is shown as recorded by another request. On your own key's retry, the attempt stays frozen for lookup. This is correct on both pre-J1 and J1 APIs. |
| Outbound | The V1 body is unchanged. The guard adds a scan only when the OCR-read component equals every reserved member's component. This is a usability guard only; F1 stays open until J2. The ready flag stays off. |
| Requester | `ROLE-03` and requester accounts cannot reach `inbound-captures`. Confirmation is disabled and the reservation `receive` action is untouched. Conforms to item 4 and follow-up 4. |

No new finding. This check covers only contract conformance. It does not
accept the preview's extraction, profiles or recognition quality, and it
does not authorize enabling either flag.

### Buno's plan verification

On 2026-10-17, Buno independently regenerated the planning package from
`f87b465`. She reported a matching manifest SHA-256 (`d4df9d99…cf72d4`),
180 label plans, 540 photo tasks and 0 photographs. She also reported 4/4
tooling tests passing and the complete-evidence gate correctly blocked. This
is planning evidence only. No recognition, training or held-out result exists.
Her next prerequisites include accepted profile versions and field semantics.
For real labels, these remain `RQ-02`/`RQ-03` decisions under item 1, and Jopia
cannot accept a Medix or N.L. Villa profile without institution label
references. For the synthetic corpus, see the decision below.

### Decision for corpus collection (2026-10-17)

Jopia accepted
[`PA-OCR-01` (`SYNTHETIC_LABEL_LAYOUT_V1`)](../REQUIREMENTS.md#pa-ocr-01--synthetic-label-layouts-for-the-ocr-corpus-2026-10-17).
It defines three fictional layouts (`MEDIATRIX`, `MEDIX`, `NLVILLA`) that copy
no real hospital label, plus field semantics for annotation: blood type and
component codes, date format and precision, states, negative cases and
writer privacy. Collection no longer waits for institution references. It is
for the corpus and benchmarks only. Items 1–3 stay open for real labels, and
nothing becomes submittable or activated.

| Owner | Next step |
| --- | --- |
| Lat | Define and freeze the three profiles (ID, version, SHA-256) under `PA-OCR-01`. Keep `MEDIATRIX_BAG_PREVIEW` and the `*_REFERENCE_PENDING` entries separate. |
| Buno | Produce the fictional labels from the frozen profiles, then photograph and double-review them. Record each profile version in the manifest. Finish the scorer work you listed before any benchmark. |
| Jopia | No backend change for the corpus. J2, J3 and J5 are now authorized for implementation; see the implementation decisions below. |

Two independent reviewers means two different people. If one person also covers
Buno's role, the second reviewer must still be someone else, and the record
discloses who did which role.

## Backend findings from this review

F1, F2 and F4 come from reading the code and were not reproduced in a test.
F3 was reproduced: four new regression tests fail on the previous route and
pass with the J1 fix.

| # | Finding | Where | Effect |
| --- | --- | --- | --- |
| F1 | `OUTBOUND_LABEL_VERIFICATION_V1` matches only the keyed Donation No. lookup. Components from one donation share that lookup, so scanning a sibling bag (same Donation No., different component) passes as the reserved unit. | `services/api/src/outbound-verification.ts` `compareLabels` | Outbound proof cannot tell components of one donation apart (your item 5) |
| F2 | The bank OCR-matched receipt (`RECEIVE_INBOUND_COMPONENT`) marks **every** unit of the reservation `RECEIVED` after one scanned label. It does not compare the scanned blood type, component or dates with the recorded unit. | `services/api/src/v2-routes.ts` inbound-captures, chaincode `RecordInboundReceipt` | One label proves the whole shipment (items 4 and 6) |
| F3 | `POST /api/v2/inbound-captures` resolves identity before checking idempotency. After projection, a replay returns 200 `ALREADY_REGISTERED` rather than the original 202 command. A reused key with a different body that matches another existing unit also returns `ALREADY_REGISTERED` instead of `V2_IDEMPOTENCY_CONFLICT`. | `services/api/src/v2-routes.ts` | Not an original-result replay (item 6). This is the same pattern PR #72 fixed for public applications. **Fixed by J1.** |
| F4 | `INBOUND_OCR_V1` (API and chaincode) accepts `componentEvidence.source` `BAG_TYPE` or `OPERATOR_CONFIRMED`, and `bloodTypeEvidence.source` `OPERATOR_CONFIRMED`. No document defines these values, and the server receives no component confidence. The capture PWA sends only `OCR_LABEL`. | `services/api/src/inbound-ocr-policy.ts`, `contracts/inbound-ocr-v1.schema.json` | Conflicts with your rule that a missing component is never inferred from bag colour or volume (items 1 and 3) |

## Decisions by item

| # | Item | Classification | Owner | Contract or reference |
| --- | --- | --- | --- | --- |
| 1 | Label semantics | **Policy decision required** (`RQ-02`), plus one *Accepted reference* | Institution label owners supply references. Jopia records issuer-policy versions. Buno evaluates held-out data. Lat owns profiles. | Accepted today: the issuer comes only from the Donation No. grammar of an enabled issuer policy (`MMYY-MM-NNNN`; synthetic `SYNMEDIX-NNNN-NNNN` and `SYNNLVILLA-NNNN-NNNN` are invented, not real Medix or N.L. Villa formats). The receiving custody comes from the session. Component and blood type must be wire enums. Branding, receiving facility, bag colour, volume and stock lookup never establish issuer, component or Donation No. Aliases, anchors, lot/catalog/barcode exclusions and conflict outcomes are not defined in the backend and need `RQ-02` approval per issuer. |
| 2 | Dates | **Policy decision required** (`RQ-02` grammar; `RQ-03` meaning of date-only expiry; `RQ-19` authority to correct) | Institution/clinical owner, recorded by Jopia | Accepted today: `collectedAt`/`expiresAt` must be exact UTC `YYYY-MM-DDTHH:mm:ss.sssZ`; printed expiry is authoritative; only `expiresAt > collectedAt` is checked. ADR-010 governs storage and display, **not** how a printed local time is read, so treating printed times as Asia/Manila is not yet approved. The contract has no precision field. Date-only expiry would change expiry evaluation and FEFO, so it needs a new contract version after approval. |
| 3 | Manual or corrected intake | **Policy decision required** (`RQ-19`; ADR-035 stays in force) | Jopia (ADR superseding ADR-035) + institution (operator authority) | `fieldConfidence` holds the engine's per-field score, rounded to an integer and at least 90. It is **not** a probability, and the name stays for compatibility. An edited value has no engine score: sending the original score with a corrected value would falsify evidence, so the client must never do it. Your internal field metadata is a good basis for a future contract but is **not** a wire contract. The metadata is: candidate/original value, original score or null, `OCR_REGION`/`OPERATOR_REGION`, profile/version, precision, and the states recognized/needs review/missing/edited. Images, crops and unrestricted text remain volatile. |
| 4 | Requester receipt | **Accepted direction (Jopia)**; not yet a contract. `RQ-09`/`RQ-10` stay open. | Jopia (contract, migration). Institution decides `RQ-09`/`RQ-10`. | Accepted today: ROLE-03 `POST /api/v2/reservations/{id}/receive` is PIN-verified, takes `expectedVersion`, applies to the whole reservation and carries **no label evidence**. `RECEIVED` is not usable stock (`RQ-10`). `inbound-captures` is limited to ROLE-01/02 and is never a requester path. Agreed shape: `POST /api/v2/reservations/{id}/receipt-verifications` (`INBOUND_RECEIPT_LABEL_VERIFICATION_V1`), mirroring ADR-047. It would be PIN-verified, only the destination institution could call it, and the reservation must be `IN_TRANSIT`. It would check `expectedVersion` and exactly match each `{donationNumber, componentType}` against the in-transit members, reporting counts only on mismatch. It would store only digests and component IDs, return `RCV_` evidence that `receive` then references (bound off-chain, chaincode unchanged), and register no stock. This needs a new ADR (next free number, ADR-049) and an additive migration. The same verification would replace F2's single-label bank receipt. |
| 5 | Outbound | *Accepted reference* (ADR-047), plus **Accepted direction (Jopia)** V2 for F1 | Jopia | Accepted reference: PIN-verified ROLE-01/02; only the source institution can call it, others get 404; the reservation must be active and unprepared; `expectedVersion` is checked; up to 50 unique labels; exact-set match; mismatch reports counts only and never echoes a label. Replay returns the stored result with `replayed: true`. Reservations hold one product, and identity is unique per issuer + Donation No. + component, so one Donation No. maps to at most one member. Errors: 409 `RESERVATION_VERSION_CONFLICT`, 409 `RESERVATION_TRANSITION_INVALID`, 409 `OUTBOUND_LABELS_MISMATCH`, 409 `OUTBOUND_VERIFICATION_IDEMPOTENCY_CONFLICT`, 400 `OUTBOUND_LABEL_DUPLICATE`, 400 `OUTBOUND_VERIFICATION_INPUT_INVALID`, 404 `V2_RESERVATION_NOT_FOUND`, 403 `AUTH_SCOPE_FORBIDDEN`, 503 `V2_KEYS_UNAVAILABLE`. Agreed shape: an additive `OUTBOUND_LABEL_VERIFICATION_V2` where each scanned entry carries an OCR-read `componentType` that must equal the reservation's component. If a label has no readable component, it cannot be verified. Typed preparation evidence is still accepted until the separate enforcement decision. |
| 6 | Replay and history | *Accepted reference*, including the F3 fix shipped in J1. New history methods **explicitly deferred**. | Jopia | Accepted reference: the same key with the same payload returns the original command (`replayed`). Since J1 this also holds for `inbound-captures` after the unit is registered or received. A different payload returns 409 `V2_IDEMPOTENCY_CONFLICT`; another actor's key returns 409 `V2_IDEMPOTENCY_SCOPE_CONFLICT`. After a lost response, recover with `GET /api/v2/commands?idempotencyKey=IDEM_…` (actor-scoped). Once consumed, an operator verification stays valid for an exact replay (frozen attempt). Queued/accepted is never committed. `UNIT_HISTORY_READ_V1` method values are `OCR`, `WEB_COMMAND` or null. New method values wait until their write contract is accepted, then arrive through a negotiated `UNIT_HISTORY_READ_V2` (ADR-045 pattern), never inside V1. FEFO and state checks are unchanged. |

## Exact frontend follow-up (Lat)

1. **Flag:** keep `VITE_BLOODLEDGER_LABEL_EXTRACTION_PREVIEW` off by default.
   The new extraction, corrected, date-only, ambiguous and unsupported results
   stay non-submittable, as you have them now.
2. **Evidence sources (F4):** any path that submits `INBOUND_OCR_V1` sends
   `OCR_LABEL` for both `bloodTypeEvidence` and `componentEvidence`. Never
   send `BAG_TYPE` or `OPERATOR_CONFIRMED`, even though the server accepts
   them today.
3. **Scores:** show the field score as an "engine score". Never send a score
   with a value it did not produce. A value re-recognized from a field region
   may be submitted only once a profile is accepted (item 1). Until then, only
   the strict five-line synthetic path submits.
4. **Requester receipt:** keep requester confirmation in the new scanner
   disabled. Leave the existing reservation-level `receive` action untouched.
   Once the item 4 contract lands, wire: scan, then operator confirmation,
   then `receipt-verifications` with `expectedVersion`, then `receive` with
   the returned evidence. Map the counts-only mismatch, stale and scope errors
   without echoing labels.
5. **Outbound (F1):** until V2 lands, add a client-side guard. Post a scanned
   label only when its OCR-read component equals the reservation's component;
   otherwise keep it unverified. This is a usability guard, not a security
   control. Keep `VITE_BLOODLEDGER_OUTBOUND_VERIFICATION_READY` disabled; live
   use needs separate approval.
6. **Replay:** recover lost responses through
   `GET /api/v2/commands?idempotencyKey=`. Treat inbound-capture
   `ALREADY_REGISTERED` as "a different key already recorded this unit". On an
   API that runs J1, a retry of your own key never returns it. Your retained
   host runs `1124d6a` and still can, until a J1 rollout is separately
   authorized. Strict parsers keep rejecting unknown history methods and
   contract versions.
7. **Supplied photo:** keep it out of Git and out of fixtures. If it shows a
   real Donation No. or institution details, it belongs only in the access
   path Buno's dataset handoff defines.

## Jopia backend follow-up (J2–J6 each need explicit implementation authorization)

| # | Work | Change type | Gate |
| --- | --- | --- | --- |
| J1 | **Done in this PR.** F3: `inbound-captures` checks the command store by idempotency key before identity resolution, returns the original command and rejects key reuse with a different capture. New OCR-matched receipts record a body-bound `captureRequestSha256` that never reaches the ledger. Receipts accepted before it existed replay on their recorded fields only. | API + OpenAPI text; no schema, migration or chaincode change | `services/api/test/inbound-capture-replay.test.ts`; API suite 201/201 on the Jopia host. Not deployed to any retained host. From `1124d6a` to `main`, only `services/api` changed (PR #72 and J1), so a rollout would be API-only with no migration. It still needs its own authorization. |
| J2 | F1: additive `OUTBOUND_LABEL_VERIFICATION_V2` with a component per entry; V1 unchanged | API + OpenAPI; reuses `app.v2_outbound_verifications` (`policy_version`), verify whether a migration is needed | Fixtures below |
| J3 | Items 4 and F2: ADR-049 receipt label verification, endpoint, `receive` evidence binding | API + additive migration; chaincode unchanged | Rollout of the migration authorized separately; `RQ-09`/`RQ-10` unchanged |
| J4 | Whether `prepare` must reference stored `EVD_` evidence | Decision, then a versioned API check | After Lat's live-gated outbound wiring |
| J5 | F4: document or retire `BAG_TYPE`/`OPERATOR_CONFIRMED` in a new intake contract version | Contract version; chaincode unchanged unless retired on-ledger | Tied to `RQ-02`/`RQ-19` |
| J6 | Synthetic fixture pack (success, duplicate, stale, conflict, auth, lost-response) for outbound V1/V2, receipt verification and `receive` | Test fixtures only | Synthetic `MM26-08-NNNN`/`SYN*` values; no PHI |

Before you wire J2, J3 or J6, we agree on schema, permissions, paging (none
is needed for a single reservation of at most 50 units), error codes,
compatibility (additive only; V1 shapes frozen) and the fixture pack.

### Implementation decisions (2026-10-17)

Jopia decided J2–J6 on 2026-10-17. Here "authorized" covers code, tests,
OpenAPI and documentation on a branch. Validation runs on the Jopia host, with
a disposable database for any migration. No retained-host deployment, migration
rollout, flag change or live write is authorized; each still needs its own
approval. Branch each item from `main` after PR #73 merges, because J3 and J5
change the same intake route as J1.

| # | Decision | Conditions |
| --- | --- | --- |
| J2 | **Authorized, first.** It closes F1 with the smallest change. | Additive `OUTBOUND_LABEL_VERIFICATION_V2`. V1 request and response shapes stay frozen. A label with no readable component is rejected, not matched. A mismatch reports counts only. |
| J3 | **Authorized, second.** Write ADR-049 as Proposed; it becomes Accepted when its tests pass. | Closes item 4 and F2. Receipt label evidence must match every member's `{donationNumber, componentType}`, so one label can no longer receive a whole reservation. The bank path through `inbound-captures` stops doing so, and ADR-049 sets its replacement route. On `receive`, the `RCV_` evidence is optional in this version. With it, receipt binds to the verified set. Without it, receipt works as today and is recorded as having no label evidence. Making it mandatory is a later decision, like J4. Additive migration only; chaincode unchanged. `RECEIVED` is still not usable stock (`RQ-10`), and signature rules stay open (`RQ-09`). |
| J4 | **Deferred.** Typed preparation evidence stays accepted. | Requiring stored `EVD_` evidence for `prepare` would block preparation wherever outbound verification is disabled, which is every host today. Decide when a host enables `VITE_BLOODLEDGER_OUTBOUND_VERIFICATION_READY` with J2 wired. |
| J5 | **Authorized, third: retire the values.** | The API rejects `BAG_TYPE` and `OPERATOR_CONFIRMED` for new captures. The intake schemas and OpenAPI narrow to `OCR_LABEL`. This corrects the implementation to the accepted `PA-S6-02` assumption, which never defined those values, and no client sends them. Chaincode and the database constraint keep the wider set, so any earlier record still replays and no migration or chaincode change is needed. Operator-confirmed values return only in a new contract version under `RQ-19`. |
| J6 | **Authorized as part of J2 and J3.** | Each item ships its own synthetic fixtures for success, duplicate, stale, conflict, authorization and lost-response cases, using only `MM26-08-NNNN` and `SYN*` values. There is no separate pack. |

The same person may work the Jopia and Lat roles on this host. The agreement
step above still applies: J2 and J3 shapes land in OpenAPI before the frontend
wires them, and any self-validation is disclosed in the evidence.

## Unchanged boundaries

Recognition never registers, dispatches or receives a unit. No image, crop
or unrestricted OCR text reaches the API, logs, Fabric or audit. Before any
profile can be activated or any support claim made for Mediatrix, Medix or
N.L. Villa, three things are needed: physical camera-device evidence, an
accepted per-bank profile and contract, and a completed held-out report.
Passing tests are not clinical, regulatory or production evidence.
