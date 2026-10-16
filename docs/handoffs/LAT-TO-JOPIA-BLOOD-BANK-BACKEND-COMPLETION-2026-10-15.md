# Lat → Jopia: blood-bank backend and integration completion

Date: 2026-10-15 · Owner: Jopia · Frontend owner: Lat.
Classification: **SIMULATION_ONLY**. Blood-bank visual work is ready for
integration review. Functional completion remains subject to the checklist
below; this is not clinical, regulatory, production or ISBT 128 acceptance.

## 1. Baseline, scope and working agreement

Act as Jopia using the repository-local bloodledger-role skill. Read
[AGENTS.md](../../AGENTS.md), [Testing phase](../TESTING-PHASE.md), relevant
[requirements](../REQUIREMENTS.md) and [architecture decisions](../ARCHITECTURE.md).
[OpenAPI V2](../../services/api/openapi-v2.json) owns existing wire contracts;
[the gap register](../frontend/BACKEND_API_GAPS.md) supplies the working checklist.
Check dated amendments and current code before treating an old gap as missing.

- Saved frontend branch: `codex/lat-analytics-activity-layouts`.
- Saved frontend baseline: `3d56bdb554496766e8fe8f5eed12b8463107686e`.
- Main at this audit: `b3bd63c90e0c936420b9e4d2eb6c3064162ef6bc`, including
  merged #64 and #65. Later Analytics/Activity layout commits are on the saved
  frontend branch; main alone does not contain every latest visual edit.
- PR #66 was **closed without merging at Lat's request**. Its changes remain
  committed. Inspect and preserve that branch when integrating backend work;
  do not replace it with an older main checkout or overwrite unrelated edits.
- Retained API/web mount `/home/yuri/projects/bloodledger-current`. The saved
  local frontend uses `http://127.0.0.1:5174/`. Verify the actual target/build
  before validation; this note does not assert another host matches Lat's data.
- Lat is moving on to **Requestor Hospital frontend work** and will wire the
  contracts you return. Preserve blood-bank layouts and report frontend work
  separately. Frontend-only edits are saved as commits, without an unsolicited PR.

Your assignment is to audit, implement supported missing backend behavior and
fix backend defects needed by blood-bank screens. Where a contract already
exists, identify the precise wiring task instead of building a duplicate API.
Where policy is missing, record the decision and owner rather than inventing it.

## 2. Completed connections and evidence to preserve

| Area | Implemented baseline | Evidence / qualification |
|---|---|---|
| Inventory labels and first load | Exact `labelIdentity`; opaque component ID remains the command key; expiry state and verifier-context retry | ADR-040; #51/#52/#54; [table validation](../validation/lat-pr51-tables-2026-10-15/README.md) and [read audit](../validation/lat-pr51-tables-2026-10-15/READ-CONTEXT-AUDIT.md) |
| Unit transaction history | Scoped cursor reads, scan/command/product/label/Fabric references and truthful processing states | ADR-041; metadata gap closed; unsupported capture modes are separate |
| Transfer summaries | Request/transfer identifier vocabulary, facility names, requested/allocated units, cursor reads | ADR-042; summary gap closed |
| Reservations and operator verification | Existing permitted preparation, dispatch, transit, cancellation, compromise and other guarded canonical controls; PIN-bound actions and queued-command polling | Inspect current reservation-action policy and OpenAPI. Guards depend on role, institution, purpose and state; this does not mean every transition was live-tested on every host. Local-release actions remain retired from the current frontend. |
| Redistribution approval | Dashboard recommendation opens the specific existing request in the full Blood Requests table; current request, eligible units and FEFO are rechecked before verified reservation | Existing pending request required; recommendation does not create another institution's request or approve a transfer automatically |
| Activity History | V1 remains compatible; V2 explicitly negotiated with strict parser, contract-bound cursors and fallback only on `400 ACTIVITY_CONTRACT_UNSUPPORTED` | ADR-043/045; [Jopia's V2 handoff](JOPIA-TO-LAT-ACTIVITY-V2-AND-PRC-LIVE-2026-10-15.md); eight columns, PRC link in Activity, source filter; latest layout uses one cursor-aware pagination control |
| PRC coordination | Bank submit/cancel, PRC response actions, six-column list, detail/history, synchronous replay and off-chain semantics | PA-DEF-06 / ADR-044; #57/#60/#61; [approved live results](../validation/lat-prc-supply-2026-10-15/README.md#lat-host-approved-live-results--2026-10-15) |
| Profile/operator administration | Existing scoped profile and supported administrator/PIN-reset/revoke workflows | Extended directory/profile/security fields remain distinct gaps; do not describe existing identity services as absent |

Medix's #52 check is complete on **Jopia's host**: 16 summaries, two OCR
receipts (one CONFIRMED and one FAILED / Not committed), 18 activity events.
The ROLE-03 live check was waived; preserve its backend-test coverage and do
not reactivate the retired Medix recipient.

Lat's completed PRC run used exactly **five new writes plus one explicit replay**.
A reached FULFILLED v3 with **1 of 2** units; B reached CANCELLED v2. PRC rows/audit
went from 0/0 to **2/5**; replay added neither a version nor an audit row.
Protected table fingerprints were unchanged after each step and final reads:
**532 components, 595 commands**, no pending V1/V2 work or population writer lock.
These are recorded Lat-host results, not assumed current counts on every host.
The two coordination records persist and fulfilment created no stock.

Latest saved layout validation: web build passed; **362 unit tests / 43 files**,
including design-token checks; **40 affected browser tests**, one worker.
Analytics separately passed 23 browser cases during its edits. Read-only live
checks covered desktop/mobile alignment and Activity rows 41–60 across the
50-row API / 20-row visible-page boundary, with zero domain POSTs.

## 3. Screen-by-screen completion checklist

The dispositions below are audit starting points. For each item return one of
**complete**, **existing API needs wiring**, **backend change required**,
**policy decision required**, or **deferred**, backed by evidence. Split a row
when different parts have different dispositions.

| Screen | Current state / gap to resolve | Lead and expected next step |
|---|---|---|
| Dashboard summaries | Total uses the confirmed projection; Expiring Soon, Low Stock and Pending Requests currently remain unavailable (GAP-10) | Jopia: identify reusable reads, agree definitions and complete scoped counts; coordinate Low Stock semantics with Buno/Lat and the accepted demo-band decision |
| Network Blood Availability | Widget requires `CITY_AGGREGATE`; bank dashboard supplies `INSTITUTION` data, which must not be relabeled as network availability (GAP-26) | Jopia: verify existing authorized network reads, permitted aggregate fields, coverage and freshness; return the approved consumer mapping to Lat |
| Inventory | Label/expiry/version reads and supported expiry evaluation are connected; CSV import disabled (GAP-27) | Preserve completed reads; audit genuine failures. Bulk intake needs an approved verification path, not direct projection inserts or fabricated bag IDs |
| Transactions / capture | History and verified inbound OCR connected; outbound matching and manual intake remain previews (GAP-25) | Jopia: map each missing mode to a supported command, permissions and custody evidence; report unsupported modes with required decisions |
| Blood Requests | Supported request reads/submission and redistribution-specific approval exist; ordinary pending-request approval, cancellation and partial-offer placeholders remain | Jopia: reconcile canonical commands with actual request semantics and define missing approved transitions; distinguish request cancellation from reservation cancellation (GAP-08/09) |
| Transfers | Canonical guarded reservation controls and detail/summary reads exist | Verify preparation evidence, eligible role/source/recipient, versions and confirmed readback. Separate requester receipt dependencies from blood-bank behavior; do not broadly reopen GAP-07 as an absent API |
| PRC Supply | Connected and populated live flow completed | Maintain replay-before-window behavior, synchronous actions, institutional/PRC scope and terminal-state history; no new live rehearsal requested |
| Activity History | V2 integration completed; V1 excludes PRC by design | Preserve ACT_/ACT2_ cursor binding, millisecond ordering, eight export columns and existing role scope; do not reintroduce a separate Load more footer |
| Analytics | Forecast/surplus/evidence reads connected; observed request analytics uses returned transfer records; departmental and complete historical demand remain limited | Jopia: establish date completeness, pagination/aggregate coverage and approved department metadata; Buno validates mathematical meaning. Return backend dependencies separately from model work |
| Alerts | Existing V2 operational alerts, supported acknowledgement and expiry behavior | Verify actual bank role/institution coverage, unavailable/stale/failure handling and acknowledged outcomes. Do not infer a new generic alert feed is required without inspecting existing routes |
| Reports | Existing census/report reads and exports support recorded evidence | Audit bank permissions, date/coverage completeness and export accuracy. Census capture is not proof of external submission, verification or regulatory compliance |
| Profile | Basic identity/status/profile services exist; extended profile/application/licensing fields remain unavailable (GAP-20/22) | Jopia: map existing onboarding data before adding storage/reads; specify approved field validation, scope, retention and document dependencies |
| Operator administration / security | Supported operator administration exists; extended staff metadata and self-service security remain gaps (GAP-21/23) | Jopia: distinguish existing commands from unsupported enrollment/recovery/change-password features. Never expose stored passwords/PINs; any account mutation needs separate live authorization |

Requester-only clinical details, pickup authority, documents, routing and
receipt matching (GAP-01–05/19) are coordination inputs for Lat's next role,
not authorization to redesign Requestor Hospital pages in this assignment.

## 4. Priority and decision questions

**First: summaries and network scope.** For each summary specify counted unit,
included/excluded statuses, institution scope, timestamp/freshness, legitimate
zero versus unknown, and how totals remain complete across capped/paged reads.
Reuse existing contracts where sufficient. Expiring Soon needs an explicit
accepted display definition; do not invent a clinical RQ-03 threshold. Low Stock
must state whether it uses the accepted project-only bands; institutional
RQ-16 and full FR-04 remain open. A stock Surplus band is not transferable supply.

**Second: supported workflows.** For each inactive request/scanner action answer:
what intent and state transition does it represent; which actor may perform it;
what existing command/evidence can support it; what is genuinely missing; and
what decision must precede enabling it? Do not restore the removed RPS panel or
Redistribution tab, alter the full Blood Requests table, or create fake approvals.

**Third: historical and extended metadata.** Specify what current returned
records can truthfully establish, what historical completeness means, and what
approved extra data is necessary. Missing departments are not hospitals;
requested quantities are not transfused/received quantities. Coordinate with
[Buno's handoff](LAT-TO-BUNO-BLOOD-BANK-FORECASTING-COMPLETION-2026-10-15.md).

The gap register has been reconciled for completed PRC live validation and
Activity V2. Older dated notes remain history; do not revive their superseded
claims. RQ-17 resolved synthetic PRC coordination, not all request decisions.

## 5. Contract delivery, tests and acceptance

Return an updated matrix containing: screen/item, disposition, existing route
or schema/ADR, owner, exact missing behavior, policy blocker if any, test
command/result, evidence location, and the exact follow-up for Lat or Buno.
For a backend change, publish its versioned contract before dependent frontend
wiring: scope/roles, enums/units/nulls, date/time/freshness, paging/counts, errors,
idempotency/version/replay and compatibility behavior, plus synthetic fixtures.
Do not silently change frozen read meanings or prescribe speculative endpoints.

Implement and test approved missing backend behavior; leave policy-blocked
behavior unavailable with named questions, approver and acceptance conditions.
Test role/institution isolation, genuine zero versus missing coverage, cursor
boundaries, duplicate/replay, stale versions, invalid transitions and failure
states. Queue acceptance remains separate from ledger commitment; PRC remains
synchronous and off-chain. Run relevant API/database checks for changed layers;
Lat validates affected web types, parsers, units, design tokens and browsers
(`--workers=1`). Report PASS/FAIL/BLOCKED/NOT_RUN and self-validation accurately.

Preserve data, volumes, identities, credentials, accounts and prior screenshots.
This handoff does not inherit the completed live plan's authority: no additional
live command/PRC writes, resets, repopulation, census/forecast reruns, model
activation, deployment or account changes. Prepare required operational steps
and seek separately scoped authorization before execution. V4 stays default;
V5 stays explicit preview. Existing guarded UAT worker/general-worker state
must not be changed as an incidental part of this audit.

Acceptance is a traceable completion report with implementable contracts and
an actionable Lat follow-up for every gap, not a blanket statement that all
blood-bank functionality or institutional gates are complete.

## Copyable message

> Jopia — please use this handoff to complete the remaining blood-bank backend
> and integration work. Audit existing contracts first, prioritize dashboard
> summaries/network availability and unsupported request/capture actions, and
> return supported contracts, tests and exact Lat follow-ups. Preserve the saved
> frontend branch; PRC live validation and Activity V2 are already complete.
> Lat is continuing Requestor Hospital frontend work. No additional live writes
> or data/model resets are authorized by this handoff.
