# Frontend backend/API gap register

Updated: 2026-10-15. Saved frontend branch: `codex/lat-analytics-activity-layouts` (baseline `3d56bdb`). Classification: `SIMULATION_ONLY`.

This is the working checklist for all frontend work in this desktop continuation: blood-bank, requester, PRC and DOH dashboards; dashboard shortcuts; and requester Requests & Transfers. Update it with every future frontend addition that has an incomplete dependency, and update an existing row when its API is connected. A placeholder is not evidence of an implemented backend workflow. This register complements [Page Migration](PAGE_MIGRATION.md) and [Frontend-Only Extension](FRONTEND_ONLY_EXTENSION.md); it does not supersede requirements, approved contracts, or phase gates.

Status meanings: **Not supported** means the current consumed contract does not carry the feature. **Not connected** means relevant service functionality exists but this frontend presentation is not wired to it. **Contract/policy pending** means the intended behavior needs a defined approved contract or policy. No new endpoint names are prescribed here. Existing APIs must be reviewed before implementation.

## Requester Requests & Transfers

| ID | Feature | Frontend state | Dependency / remaining work | Status |
|---|---|---|---|---|
| GAP-01 | Requester and clinical details | Disabled placeholders for Requesting Person, Employee / Staff ID, Attending Physician, Patient / Case Reference, Required Date & Time | Current V2 request command carries source, destination, product, quantity, urgency and event time, not these details. Define approved synthetic data scope, validation, permission-scoped storage/reads, retention and detail display. A case reference is not automatically permission to collect clinical information. | Not supported; contract/policy pending |
| GAP-02 | Authorized pickup | Disabled representative and ID / authorization-reference placeholders | Define authorized representative/reference fields and validation, scoped reads and persistence; do not equate a typed name with verified pickup authority. | Not supported; contract/policy pending |
| GAP-03 | Supporting documents | Disabled request-form and pickup-document attachment cards; no file input or file storage | Define secure upload/read/delete, allowed formats and sizes, access control, retention, document metadata and request linkage. The HTML’s file-metadata simulation is not an upload service. | Not supported; contract/policy pending |
| GAP-04 | Request notes | Disabled notes placeholder | Add approved request-note scope, validation, persistence and detail reads before enabling entry. | Not supported |
| GAP-05 | Automatic supplier routing | Primary requester form now shows read-only Assign automatically with label-side information help. Source-bank dropdown removed; submission disabled until routing is supported. Legacy role fixtures retain their preexisting fixed-source contract. | Define eligible-bank/routing response and human review. Current V2 command requires a source institution, so the placeholder cannot silently choose Mediatrix. Available inventory alone does not establish transfer eligibility; no automatic approval or submission is introduced. | Contract/policy pending; primary requester submission gated |
| GAP-06 | Requester page-level PDF export | Removed by user decision on 2026-10-10 | No page-level export planned. A per-transfer handover record or receipt may be considered only after a confirmed user need and approved document content; it is not an active implementation dependency. | Removed from current scope; possible future requirement |
| GAP-07 | Transfer custody / receipt controls | Actual reservation statuses and verified details are readable; requester custody buttons unavailable | Canonical reservation command services already exist. Connect only after required read inputs, version checks, operator permissions and workflow policy are available and verified. Backend absence has not been established. | Not connected; policy/read-input dependency |
| GAP-08 | Ordinary request decisions, partial offers and cancellation | Bank AWAITING_DECISION requests use the verified FEFO approval panel; table shows decision_state plus reservation_status, preserving all rows. Requester work remains separate | ADR-046 / PR #67 supplies decision reads; existing reservation bridge approves full requests. Reject, request cancellation and partial offers need approved transitions (RQ-18); reservation cancellation is already separate | Bank approval connected; reject/cancel/partial offers remain disabled under RQ-18 |
| GAP-09 | Expanded request detail panel | Shows existing verified request projection; new details remain unavailable | Once GAP-01–04 are supported, expose permitted details and document references in the read contract and connect the panel. | Not supported by current request read shape |

**Operator authorization is already implemented**, rather than missing from the API: institution sessions requiring verification use the existing operator/PIN dialog and `/api/v2/auth/operator-verifications` before command submission. The form now has a visible “Operator authorization required” section explaining that flow. It does not add a second PIN store or a simulated authorization action. Legacy test fixtures without verification-required sessions follow their existing contract. Embedding operator/PIN controls directly into this form would be an optional frontend change, not a missing backend feature.

## Dashboards and shortcuts from this continuation

| ID | Surface / feature | Frontend state | Dependency / remaining work | Status |
|---|---|---|---|---|
| GAP-10 | Blood-bank summary: Total, Expiring Soon, Low Stock, Pending Requests | Complete BLOOD_BANK_SUMMARY_V1 counts connected. Total = label-current AVAILABLE + RESERVED; label-expired pending evaluation shown separately with Inventory filter. Pending = incomingAwaitingDecision. Low Stock counts Critical/Low series using existing eligible/fresh demo-band evidence | ADR-046 / PR #67. Expiring Soon stays unavailable under RQ-03; demo bands do not establish clinical policy | Connected and Lat-host read-only verified; RQ-03 remains open |
| GAP-11 | Requester summary: Submitted Requests, Awaiting Review, On the Way, Received | Unavailable dashes; own-request list and network availability already connected | Define authoritative counts and distinguish request states from reservation/custody states. Do not infer receipt or approval from a queued command. Existing request/reservation lists may support part of the mapping. | Not connected; definitions/contract pending |
| GAP-12 | PRC summary: Participating Blood Banks, Redistributable Supply, Critical Blood Types, Open Supply Requests | Unavailable dashes | Define authorized metrics; redistributability and shortage thresholds require policy. Inventory totals are not redistribution recommendations. | Not connected; definitions/contract pending |
| GAP-13 | DOH summary: Monitored Blood Banks, Fully Compliant, Reports Due, Late Submissions | Unavailable dashes | Define facility/report population, due schedules and compliance status. Inventory reports do not establish regulatory compliance. | Contract/policy pending |
| GAP-14 | PRC Blood-Bank Inventory Overview | Connected to permitted city dashboard aggregates in isolated 5175; defaults to PRBC with all-five-component selector and full Network View link | Reuses Network View validation, per-bank counts and coverage rules. Only reported AVAILABLE stock is charted; reservations excluded, missing records unavailable. Fixture checks do not validate live backend reads. Reporting status and replenishment remain separate GAP-15/16 dependencies. | Connected in fixture preview; live integration deferred |
| GAP-15 | PRC Blood-Bank Reporting Status | Empty table | Needs per-bank update/submission times, available counts and defined freshness/reporting states; inspect existing aggregates/census services first. | Not connected; reporting-status shape pending |
| GAP-16 | PRC supply coordination | Connected UI merged in #60/#64; Lat-host approved populated live flow completed: five new writes and one explicit replay, two persistent requests and five PRC audit events | RQ-17 resolved for simulation by PA-DEF-06 `SYNTHETIC_PRC_SUPPLY_V1`, ADR-044. Backend #57 and replay/timestamp fix #61 merged. Recorded protected-state fingerprints unchanged (532 components / 595 commands on Lat host). Off-chain only; ordinary OCR intake remains necessary for supplied stock. See [live results](../validation/lat-prc-supply-2026-10-15/README.md#lat-host-approved-live-results--2026-10-15). | Complete for the implemented simulation flow and approved live plan; institutional/external PRC integration not established |
| GAP-17 | DOH Compliance Reports | Empty table; View reports links to existing reports page | Needs authorized facility reporting/submission cadence and status data. Existing census/inventory reports are functional but are not compliance determinations. | Contract/policy pending; not connected |
| GAP-18 | DOH dashboard compliance alerts | Empty section; View all alerts links to existing alerts page | Define DOH follow-up/compliance exceptions and permitted detail shape, then wire dashboard list. Existing operational alerts do not establish this compliance feed. | Contract/policy pending; not connected |

Already connected: actual blood-bank inventory overview, requester own-request list and network AVAILABLE aggregates, Request Blood navigation, refresh/error handling, PRC Manage Account navigation, and PRC/DOH alerts/report links. A working link does not make its destination’s deferred features complete. Institution-account management and operator verification already have V2 support; do not relabel them as missing because old visual-preview records describe their earlier state.

## Other existing frontend deferrals

For screens outside this continuation, retain the detailed feature/dependency records in [Frontend-Only Extension](FRONTEND_ONLY_EXTENSION.md), [Page Migration](PAGE_MIGRATION.md), and [Capture visual parity](CAPTURE_PWA_VISUAL_PARITY.md). Known examples include full PDF exports/report formatting, analytics history/redistribution/calculation/export controls, shell global search/notification feeds, password recovery and document handling, legacy staff-directory administration previews, and secure offline capture replay. Some features have since gained APIs; consult each register’s dated integration amendments and current services before marking a backend missing. This document is not an exhaustive audit of all server routes.

## Requester inbound receipts

| ID | Surface / feature | Frontend state | Dependency / remaining work | Status |
|---|---|---|---|---|
| GAP-19 | Blood Unit Receipt / inbound scan | Requester-only `/receipts`; actual scoped RECEIVED history, volatile local JPG/PNG camera/file input with on-device OCR and validated five-field scan preview, plus a separate Manual preview. No upload or receipt mutation. | Incoming transfer selector removed from capture by user decision; source facility options use actual scoped incoming transfer sources. Manual drafts remain memory-only and never create inventory or custody records. Existing V2 receipt command is available for authorized ROLE-03 operators in IN_TRANSIT. Connect permitted received-label recognition and reservation-component matching, operator verification, expected version, command acknowledgement and confirmed readback. Existing blood-bank OCR intake is not requester receipt matching. | On-device OCR connected for label review; transfer matching and receipt confirmation remain unconnected |

## Profile and Accounts / Staff

| ID | Surface / feature | Frontend state | Dependency / remaining work | Status |
|---|---|---|---|---|
| GAP-20 | Extended institution profile | Facility/participation/status/IDs use current scoped profile/session. Legal name, ownership, classification, address, official contact and category-specific licensing/qualification show Not available. Supporting document controls remain disabled. Own display-name editing retains existing verified/versioned command and its Synthetic-prefix validation. | Extend approved institution profile reads/edits for these fields; inspect onboarding application data and policy before wiring. Current profile endpoint returns identity/category/status/version only. | Extended fields not exposed by current profile service |
| GAP-21 | Staff directory metadata | Accounts / Staff uses actual operator IDs, roles, capability profiles and status; search/status filters and supported Add administrator / Reset PIN / Revoke remain connected. No sample people, staff names or credentials. | Approved read/edit fields for operator names/contact/professional metadata are not exposed by current operator list. General staff enrollment/classification must be mapped to existing services before introducing additional commands. | Current operator administration connected; extended directory mapping pending |

## Application / Profile audit — 2026-10-10

See [Application-to-profile field map](APPLICATION_PROFILE_FIELD_MAP.md) for both mockup application categories and supported official reads.

| ID | Surface / feature | Frontend state | Dependency / remaining work | Status |
|---|---|---|---|---|
| GAP-22 | Full blood-bank/requester onboarding and application record on Profile | Four-step category-specific mockup layout implemented; supported invitation-based basic submission retained. Expanded fields/declarations/uploads disabled and excluded from payload. Profile application metadata displays Not available | Approved expanded institution/application field validation, storage, role-scoped reads and document handling. Own profile requires authorized linkage to its application and actual approval/submission metadata. Existing PRC application and applicant-status APIs are present but do not provide that own-profile read. | Expanded shape / linked read not supported |
| GAP-23 | Credentials & Access / Security | Profile Credentials & Access and Security sections implemented with actual session role/status/scope. Missing login metadata is unavailable; Change password disabled. Passwords/PINs never read back; operator PIN reset remains functional in Accounts / Staff | Official applicant password is separate from PRC-provisioned institution login and initial administrator PIN. Verify secure credential setup/handoff, login email/last-sign-in reads and self-service password change/recovery before adding active controls. Existing PRC account replacement is available, not self-service password change. | Setup/handoff and self-service flow incomplete; current provisioner-entered activation retained |

## Maintenance and activation

For each new or changed feature, record its ID, visible placeholder, current contract, specific missing dependency and status. Keep API absence separate from frontend wiring or policy gaps. When activated, replace placeholder behavior with the authorized service, update this row and the migration register, and record checks for scope, validation, errors and persistence. Unsupported fields remain disabled and excluded from request payloads; no sample records or successful upload/authorization claims are inserted. New sections cannot silently become required submission fields before the approved API supports them.

Validation for the placeholder addition is recorded in the persistent-development validation log after the checks finish.

2026-10-10 receipt manual layout amendment: Manual tab now immediately displays the fields inline in the phone input card. Enter/Edit unit details button and nested overlay removed. Draft survives tab changes, clears on scanner close, and Preview Entry remains local/unverified with no submission.

## Blood-bank operational polish — 2026-10-10

| ID | Surface / feature | Frontend state | Dependency / remaining work | Status |
|---|---|---|---|---|
| GAP-24 | Live inventory expiry contract alignment | Current V2.1 reads parse labels, expiryState and inventory versions; summary link opens the expired-pending filter | Retained API rebuilt from merged #67 with user approval; scope and first-load regression checks retained | Running-service mismatch resolved on Lat host; no expiry command executed |

Blood-bank request/reservation tabs and read details are now connected to existing scoped reads; GAP-07/08 still apply to deferred custody/decision/offer controls. Activity History filters existing redacted records; mockup staff names, scan IDs and additional linked references require supported authorized reads before display. Mockup inventory CSV import and operational PDF exports were not introduced; retain existing extension-register dependencies. No API absence is inferred solely from a mockup difference.


## Separate blood-unit transactions and bank dashboard additions — 2026-10-10

The earlier operational-PDF deferral is superseded for Blood Inventory and Blood Unit Transactions: both now download real PDFs of loaded, filtered, permitted records. Snapshot exports perform no commands. Requester page-level PDF remains removed.

| ID | Surface / feature | Frontend state | Dependency / remaining work | Status |
|---|---|---|---|---|
| GAP-25 | Blood Unit Transactions metadata and capture modes | Unit-history metadata remains connected (ADR-041). Prepare now contains OCR, per-unit confirmation, PIN-bound synchronous outbound verification and server evidence prefilling (ADR-047), tested with fixtures | Migration 20261016000000000 is NOT applied on Lat host. Jopia must separately approve migration/readiness before enabling VITE_BLOODLEDGER_OUTBOUND_VERIFICATION_READY=true. Standalone outbound preview/manual intake remain disabled; RQ-19 governs intake | History complete; Prepare scanner implemented and fixture-verified, live verification gated; manual intake disabled |
| GAP-26 | Blood-bank dashboard network availability | NETWORK_AVAILABILITY_V1 connected to bank widget: CITY_AGGREGATE label-current AVAILABLE units, absent combination = 0 recorded, institution projection times shown | ADR-046 / PR #67, GET /api/v2/network-availability; never relabel own-institution stock as network data | Connected; Lat-host authenticated read/browser verified |
| GAP-27 | Inventory CSV import | Disabled Import CSV action explains RQ-19 and verified OCR intake alternative | Approved bulk intake/verification path and permission rules required; ADR-035 remains in force | Policy pending (RQ-19); no import or unverified registration |

Bank requests are connected to existing scoped transfer reads and supported request commands. PRC Supply Requests is connected with the approved populated live evidence under GAP-16. GAP-24’s historical service mismatch is resolved on the current Lat host.


2026-10-10 GAP-25 presentation update: bank mobile scanner now has Inbound/Outbound and Scan/Manual tabs styled like the official requester receipt scanner. Inbound Scan is the existing verified OCR intake workflow in a compact presentation. Outbound photo/manual fields are local previews; no outbound scan match or dispatch command is synthesized, and confirmation remains disabled. Existing Requests & Transfers remains the supported dispatch route. Manual intake remains unsupported by the consumed verified intake contract. Destination/source choices use permitted request data only. Missing scan linkage and metadata dependencies remain open.

2026-10-10 GAP-07/08/09/16 update: bank detail selection and linked reservation/request reads are wired. Mockup cancellation, partial offer and approval remain disabled: `/api/v2/transfers/:id/:action` explicitly rejects legacy aliases with 410, and no approved offer/decision command exists there. Existing canonical reservation actions are distinct from request approval/cancellation and need preparation evidence, expected-version and operator authorization integration before activation. Reservation receive currently allows ROLE-03, so a bank receipt control must not bypass that policy. Missing requester/clinical/pickup/document metadata remains unavailable. PRC supply button opens the mockup requirements (product, units, priority, required time, coordination note, authorization); fields/submission are disabled and no fake supply records are created. GAP-16 remains open.

2026-10-10 issue36 integration: canonical reservation prepare/dispatch/transit/
receive/cancel/compromise/local-release-complete, authenticated compromise and
reconciliation policy selectors, hold placement, command recovery by ID or saved
request key, and census discovery are connected in PR37. These close the former
frontend wiring gaps only; fixture evidence is not live API/Fabric validation.
Request approval/cancellation/partial offers and automatic requestor supplier
routing remain separate unsupported decisions. Bank receipt uses the existing
verified inbound-label path, never a ROLE-03 authorization bypass. See
[LAT UAT frontend validation](LAT-UAT-FRONTEND-VALIDATION-2026-10-10.md).


### Isolated Compliance Reports design — 2026-10-11

GAP-17 presentation update: blood-bank accounts and DOH use Compliance Reports; PRC retains Reports and requester accounts have neither reporting tab. The new layout follows the full HTML checkpoint/records/details/stock matrix composition. Existing V2 census index/detail reads authorize ROLE-01/02/04; bank visibility uses that read contract, without adding backend reports:read permissions. Bank reads remain institution-scoped, DOH reads regulatory-scoped. Snapshot detail validates the selected record reference, schedule/capture/policy metadata and component counts. Stored census records do not establish verification, compliance or DOH submission.

Remaining dependencies: catch-up capture already exists, but is disabled in this 5175 design until approved report policy, scheduling and operator/command authorization are integrated and validated. Verification metadata/action has no consumed supported contract; Pending Verification and Verified Records remain unavailable. Official PDF format/export remains gated. Captured-by/verified-by fields are unavailable. No fake verified records or capture commands are created. Preview fixtures provide an empty contract-valid census index; temporary populated browser responses are test-only and not saved. UAT, workers and backend untouched.


### Regulatory Analytics dependencies — 2026-10-12

PRC current stock summaries consume the already authorized city consortium aggregate. DOH recorded capture activity consumes the validated regulatory census index, with loaded-batch scope explicitly explained. Forecast APIs and their permissions are unchanged. Remaining dependencies: dated network inventory/request history for supply-demand trends; authorized PRC replenishment and coordination records/outcomes; approved releasable/safety-stock rules; required reporting facility population, due/grace rules and submission timestamps for completion and lateness; verification outcomes and compliance follow-up records. These sections show unavailable states, never fabricated time series, completion percentages or failure counts. Report capture is not evidence of DOH submission; missing records are not noncompliance. All reads in 5175 remain isolated synthetic fixtures.


### Observed-demand Analytics replacement — 2026-10-12

Supersedes the active forecast-based hospital Analytics presentation. Scoped V2 requests support product/quantity/status and request-time fields; bank demand selects source institution, requester demand selects destination institution. The public V3 preview requests do not supply request_time, so monthly history remains unavailable despite known request counts/quantities. Never derive request dates from unit collection/expiry or mix the separate historical stock fixtures into demand. Department identity/aggregate ranking remains unsupported. PRC needs an authorized dated network request history before hospital ranking or monthly demand can populate; its current consortium stock snapshot cannot satisfy this. Missing months and historical coverage are unknown, not zero. Redistribution eligibility, expected demand, safety allowance, minimum reserve, assessed surplus/status/freshness need approved backend values/policy; frontend does not invent calculations. Requester dated confirmed receipts remain separate from submitted request dates/quantities. DOH uses existing census capture records with filterable dates/facilities, while required reporting population, submission deadlines, verification and follow-up outcomes remain outstanding. Forecast services/version contracts are preserved but not called by active Analytics pages. Controls for unavailable category sources are disabled; no new clinical data or fake demand records are persisted.


### Activity History exports and requester history — 2026-10-12

PDF exports are client-side exports of safe fields already loaded through permitted reads; no export endpoint or extra audit permission is introduced. Their filters apply to loaded records, not unreturned server history. Bank/PRC/DOH retain existing audit scopes. Requester general audit access remains denied by backend policy. Its Activity History uses the existing destination-scoped V2 transfer read and command timeline, excluding unrelated requests/reservations; accepted/pending commands are not presented as committed ledger events. Broader requester activity, complete historical coverage, server paging and missing audit target references require a separately approved supported read contract. Fixture timeline/audit data is currently empty, so preview exports remain disabled until permitted records are present. No new persistent fake history or backend changes were made.

2026-10-12 PRC consolidation follow-up (GAP-14): overview and availability matrix share the existing scoped dashboard inventory, with All/product selection and total/per-bank chart views. All requires complete reported product coverage rather than silently treating absent products as zero. No extra API, policy grant or summary/redistribution definition added. Reporting-status and replenishment dependencies remain GAP-15/16. Only PRC navigation is consolidated; protected UAT and other-role Network View unchanged.

2026-10-12 unavailable-action help: unavailable frontend controls now expose concise reasons through hover/focus/tap explanations, including pending document upload, supplier routing, PRC supply/coordination, scanner matching, report capture/verification/official PDF and self-service passwords. This is presentation only: native operations remain disabled, no API is added, no permission is granted and none of these dependencies is marked connected. Existing data-dependent PDF/scanner controls explain missing loaded records without losing enabled behavior. Compliance wording now distinguishes Reports for Today (saved reports by scheduled checkpoint date) and Saved Stock Reports from verified compliance. Pagination/count displays preserved by user decision.

### Official project demonstration stock bands — 2026-10-15

The user's subsequent explicit approval authorizes the versioned 40-series
[demonstration policy](../handoffs/LAT-OFFICIAL-DEMO-STOCK-BANDS-DECISION-2026-10-15.md).
Frontend colors evaluate fresh own-institution V2.1 components and expose the
policy table; no new backend read/schema or operational clinical rule is implied.
This supersedes the earlier no-demo-band decision only for this project display.
RQ-16 remains open for institutional policy; full FR-04 and redistribution
authorization remain incomplete. Missing component evidence stays unavailable.


## PR #51/#52 transaction-read closure and #54 follow-up — 2026-10-15

This section supersedes the earlier bank-table metadata/linkage deferrals, not the remaining scanner, extended clinical-field, regulatory or requester-history gaps. Backend reads are frozen as merged in `services/api/openapi-v2.json`. No new endpoint or policy is invented to fill missing fields.

| ID | Surface / feature | Frontend state | Dependency / disposition | Status |
|---|---|---|---|---|
| GAP-28 | Inventory printed Unit ID | Exact authorized `labelIdentity` with explicit unavailability; technical `componentId` remains the action key | PR #51/#52, ADR-040. PR #54 fixes initial verifier-context inventory refresh | Closed — supported read and frontend wiring |
| GAP-29 | Blood Unit Transactions history metadata | Dedicated cursor read, per-event/unit identity, scan/command/Fabric references, recorded method/product and distinct processing states | PR #51/#52, ADR-041; supersedes the history-metadata portion of GAP-25 | Closed — history contract/wiring; scanner submission is separate |
| GAP-30 | Transfer summaries and identifier vocabulary | Dedicated cursor summary, RES Transfer ID, TRF Request ID, separate requested/allocated counts, facility names and local-release semantics; Priority uses recorded urgency | PR #51/#52, ADR-042; no client join across capped sources | Closed — summary read and frontend wiring |
| GAP-31 | Bank ROLE-02 Activity History recorded actor and links | Dedicated cursor read with actor kind/display/current role, explicit links, off-chain and ledger status | PR #51/#52, ADR-043; regulatory audit and requester timelines retain original authorization/contracts | Closed — bank activity contract/wiring |

Medix: **complete — Jopia host, see [PR #52 comment](https://github.com/luisantonioj/bloodledger/pull/52#issuecomment-6189519671)**. ROLE-03 live check waived by Jopia; backend tests cover scope. PR #53 establishes ADR-040–043 (the earlier account decisions retain their own IDs). See the [post-merge read audit](../validation/lat-pr51-tables-2026-10-15/READ-CONTEXT-AUDIT.md) for each caller's retry/cancellation disposition and validation commands. This closes the four specific read gaps, not institutional acceptance or all of FR-04.

**GAP-16 / RQ-17 current disposition (2026-10-15):** RQ-17 is resolved for simulation by PA-DEF-06 (`SYNTHETIC_PRC_SUPPLY_V1`), ADR-044. Backend #57, UI #60 and replay/timestamp fix #61 are merged. Lat independently backed up and migrated its retained host (31 applied/1 pending to 32/0), preserving all pre-existing app table counts; initial empty-list checks were followed by Jopia's explicitly approved populated live plan. The completed results and screenshots are in [Lat-host live validation](../validation/lat-prc-supply-2026-10-15/README.md#lat-host-approved-live-results--2026-10-15): five new writes plus one explicit replay, A FULFILLED v3 (1 of 2), B CANCELLED v2, two requests/five PRC audit rows, unchanged protected contents and 532 components/595 commands. These host-specific recorded counts are not assumptions for another host. Ordinary PIN-bound actions, expected versions, original frozen attempts and scope remain intact; replay precedes the moving submission-window check and preserves timestamp milliseconds. PRC remains off-chain, with no inventory receipt or custody effect. This closes the prepared plan's pending-live disposition; it does not authorize additional live actions, external PRC integration or clinical use. **RQ-02 remains open**.

Historical 2026-10-15 PRC preparation note (superseded by the completed live results above): #60/#61 were merged on main `014d862`.
GAP-16 now distinguishes implemented simulation coordination from the unexecuted
[populated live plan](../validation/lat-prc-supply-2026-10-15/LIVE-PLAN.md).
PRC remains excluded from `ACTIVITY_HISTORY_READ_V1`; its detail history is the
current source. A [V2 coordination proposal](../handoffs/LAT-TO-JOPIA-PRC-ACTIVITY-V2-PROPOSAL-2026-10-15.md) is documentation only and grants no new visibility.

2026-10-15 Activity History PRC follow-up: ADR-045 / merged PR #65 supplies ACTIVITY_HISTORY_READ_V2. The frontend explicitly negotiates V2 with a strict separate parser and contract-bound cursors, includes off-chain PRC events by default with a source filter, and keeps the eight headers. Only an explicit unsupported-contract 400 downgrades to V1, with a per-request-history notice. V1 and role grants are unchanged.


## Blood-bank owner handoff disposition — 2026-10-15

The saved visual baseline is ready for integration review; remaining functionality
is assigned in [Jopia's backend completion handoff](../handoffs/LAT-TO-JOPIA-BLOOD-BANK-BACKEND-COMPLETION-2026-10-15.md)
and [Buno's forecasting completion/expansion handoff](../handoffs/LAT-TO-BUNO-BLOOD-BANK-FORECASTING-COMPLETION-2026-10-15.md).
Lat continues Requestor Hospital frontend work. PR #66 was closed without
merging by user instruction; the saved frontend commits remain on the branch.

Inventory labels, unit history, transfer summaries, guarded canonical reservation
actions, operator verification, Activity V2 and the approved PRC flow are existing
connections. Do not infer backend absence from an older dated placeholder note.
Dashboard summary definitions, the bank widget's network-aggregate scope,
unsupported request decisions/capture modes, historical completeness and
extended profile/staff/security fields still require itemized review. Buno
validates the current twenty forecast series and prepares a separate expansion
proposal; forty inventory combinations do not establish forty forecast series.
No new API, policy, activation, retained-data rerun or live-write authority is
introduced by these documentation updates.


## Blood-bank completion integration — 2026-10-15 (ADR-046/047)

[Current validation](../validation/lat-blood-bank-completion-2026-10-15/README.md) supersedes earlier unavailable claims for bank summaries, bank network availability and bank observed-demand history. Bank Analytics now uses complete institution-scoped `/analytics/request-history` aggregates, sequentially chunked into inclusive ranges of at most 366 days. Incoming request counts and requested quantities stay separate from forecasts and receipts; departments remain NOT_RECORDED. The requester/PRC historical Analytics limitations in older notes remain outside this bank-only change. Source-surplus and V5 preview remain connected separately; V4 remains default. No removed RPS panel was restored.

Saved layouts and requester OCR were rebased intact on merged PR #67. API/web-only rollout was explicitly approved in chat, privately backed up and read-only checked; no migration or live domain action ran. Outbound verification is implemented behind a host-readiness gate, **not live-enabled**. Read audit additions: summary/network use `useValidatedRead` → `useLiveData`; complete history uses one context-change retry guarded by the active abortable request; outbound POST never auto-retries. PRC’s five-write/one-replay live evidence remains complete; it does not authorize further writes.
