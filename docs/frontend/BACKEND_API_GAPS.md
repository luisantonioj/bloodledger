# Frontend backend/API gap register

Updated: 2026-10-09. Branch: `codex/lat-uat-frontend`. Classification: `SIMULATION_ONLY`.

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
| GAP-08 | Mockup request decisions, partial offers and cancellation | No requester approval/decline or offer simulation | Reconcile each action with approved commands, role boundaries and state transitions. Existing canonical reservation APIs do not by themselves implement every mockup decision/offer field. | Contract/policy pending; not connected |
| GAP-09 | Expanded request detail panel | Shows existing verified request projection; new details remain unavailable | Once GAP-01–04 are supported, expose permitted details and document references in the read contract and connect the panel. | Not supported by current request read shape |

**Operator authorization is already implemented**, rather than missing from the API: institution sessions requiring verification use the existing operator/PIN dialog and `/api/v2/auth/operator-verifications` before command submission. The form now has a visible “Operator authorization required” section explaining that flow. It does not add a second PIN store or a simulated authorization action. Legacy test fixtures without verification-required sessions follow their existing contract. Embedding operator/PIN controls directly into this form would be an optional frontend change, not a missing backend feature.

## Dashboards and shortcuts from this continuation

| ID | Surface / feature | Frontend state | Dependency / remaining work | Status |
|---|---|---|---|---|
| GAP-10 | Blood-bank summary: Expiring Soon, Low Stock, Pending Requests | Unavailable dash rather than fabricated zero; Total Blood Units uses actual dashboard aggregate | Provide or approve the specific summary definitions and authorized data mapping. Existing expiry/alert/request functionality must be considered before adding endpoints. | Not connected to summary cards; definitions/contract pending |
| GAP-11 | Requester summary: Submitted Requests, Awaiting Review, On the Way, Received | Unavailable dashes; own-request list and network availability already connected | Define authoritative counts and distinguish request states from reservation/custody states. Do not infer receipt or approval from a queued command. Existing request/reservation lists may support part of the mapping. | Not connected; definitions/contract pending |
| GAP-12 | PRC summary: Participating Blood Banks, Redistributable Supply, Critical Blood Types, Open Supply Requests | Unavailable dashes | Define authorized metrics; redistributability and shortage thresholds require policy. Inventory totals are not redistribution recommendations. | Not connected; definitions/contract pending |
| GAP-13 | DOH summary: Monitored Blood Banks, Fully Compliant, Reports Due, Late Submissions | Unavailable dashes | Define facility/report population, due schedules and compliance status. Inventory reports do not establish regulatory compliance. | Contract/policy pending |
| GAP-14 | PRC Blood-Bank Inventory Overview | Empty chart scaffold, no sample bars | Existing city inventory aggregates are available; verify whether permitted per-bank PRBC breakdown is exposed and connect the chart when authorized. | Not connected; exact breakdown requires verification |
| GAP-15 | PRC Blood-Bank Reporting Status | Empty table | Needs per-bank update/submission times, available counts and defined freshness/reporting states; inspect existing aggregates/census services first. | Not connected; reporting-status shape pending |
| GAP-16 | PRC Hospital Replenishment Requests / Open coordination records | Empty table and disabled coordination button | Define and connect PRC supply/replenishment read model, reference detail navigation and allowed coordination actions. Ordinary requester transfers are not equivalent to PRC replenishment records. | Contract/policy pending; not connected |
| GAP-17 | DOH Compliance Reports | Empty table; View reports links to existing reports page | Needs authorized facility reporting/submission cadence and status data. Existing census/inventory reports are functional but are not compliance determinations. | Contract/policy pending; not connected |
| GAP-18 | DOH dashboard compliance alerts | Empty section; View all alerts links to existing alerts page | Define DOH follow-up/compliance exceptions and permitted detail shape, then wire dashboard list. Existing operational alerts do not establish this compliance feed. | Contract/policy pending; not connected |

Already connected: actual blood-bank inventory overview, requester own-request list and network AVAILABLE aggregates, Request Blood navigation, refresh/error handling, PRC Manage Account navigation, and PRC/DOH alerts/report links. A working link does not make its destination’s deferred features complete. Institution-account management and operator verification already have V2 support; do not relabel them as missing because old visual-preview records describe their earlier state.

## Other existing frontend deferrals

For screens outside this continuation, retain the detailed feature/dependency records in [Frontend-Only Extension](FRONTEND_ONLY_EXTENSION.md), [Page Migration](PAGE_MIGRATION.md), and [Capture visual parity](CAPTURE_PWA_VISUAL_PARITY.md). Known examples include full PDF exports/report formatting, analytics history/redistribution/calculation/export controls, shell global search/notification feeds, password recovery and document handling, legacy staff-directory administration previews, and secure offline capture replay. Some features have since gained APIs; consult each register’s dated integration amendments and current services before marking a backend missing. This document is not an exhaustive audit of all server routes.

## Requester inbound receipts

| ID | Surface / feature | Frontend state | Dependency / remaining work | Status |
|---|---|---|---|---|
| GAP-19 | Blood Unit Receipt / inbound scan | Requester-only `/receipts`; actual scoped RECEIVED history, volatile local JPG/PNG camera/file preview and Scan/Manual tabs with manual entry overlay and unverified local preview. No upload or receipt mutation. | Incoming transfer selector removed from capture by user decision; source facility options use actual scoped incoming transfer sources. Manual drafts remain memory-only and never create inventory or custody records. Existing V2 receipt command is available for authorized ROLE-03 operators in IN_TRANSIT. Connect permitted received-label recognition and reservation-component matching, operator verification, expected version, command acknowledgement and confirmed readback. Existing blood-bank OCR intake is not requester receipt matching. | Scan matching and receipt confirmation UI not connected; preview only |

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
| GAP-24 | Live inventory expiry contract alignment | Faceted filters and current component layout implemented; invalid live response shows unavailable inventory and Retry. No guessed expiry or fabricated units. | Live 5174 API returned nine components without expiryState. Current source v2-routes.ts supplies it and the parser requires it. Align the running service with the current contract and verify authenticated readback; do not mark the source API absent or weaken expiry validation. | Running-service mismatch observed; supported-response fixtures pass |

Blood-bank request/reservation tabs and read details are now connected to existing scoped reads; GAP-07/08 still apply to deferred custody/decision/offer controls. Activity History filters existing redacted records; mockup staff names, scan IDs and additional linked references require supported authorized reads before display. Mockup inventory CSV import and operational PDF exports were not introduced; retain existing extension-register dependencies. No API absence is inferred solely from a mockup difference.


## Separate blood-unit transactions and bank dashboard additions — 2026-10-10

The earlier operational-PDF deferral is superseded for Blood Inventory and Blood Unit Transactions: both now download real PDFs of loaded, filtered, permitted records. Snapshot exports perform no commands. Requester page-level PDF remains removed.

| ID | Surface / feature | Frontend state | Dependency / remaining work | Status |
|---|---|---|---|---|
| GAP-25 | Blood Unit Transactions extended metadata and mockup capture modes | Separate page, authorized audit/operation history, direction/search filters, working PDF and existing capture PWA launcher | Current reads do not consistently link scan ID, component ID/product, capture method and operator display name. Define authorized linkage before displaying them. Existing inbound OCR and supported receipt matching remain available; mockup outbound/manual registration must map to approved commands and permissions before activation. | Extended metadata not supported by consumed reads; outbound/manual workflow not connected |
| GAP-26 | Blood-bank dashboard network availability | Requests and network product selectors/Request Blood navigation present for all banks; count unavailable | Existing bank dashboard inventory scope is INSTITUTION. Connect an authorized network aggregate for bank principals, with explicit availability scope. Never present own-stock totals as network units or elevate to requester/city access. | Authorized aggregate not connected; contract/access scope requires verification |
| GAP-27 | Inventory CSV import | Disabled Import CSV action with explanatory title | Existing direct component creation requires verified OCR intake. Define an approved bulk intake/verification path and permission/validation rules before enabling file import. No local CSV import or fake registration added. | Contract/policy pending |

Bank requests are connected to existing scoped transfer reads and supported request commands. PRC Supply Requests remains an empty tab under GAP-16. GAP-24 is still a running-service mismatch, not an absent source implementation.


2026-10-10 GAP-25 presentation update: bank mobile scanner now has Inbound/Outbound and Scan/Manual tabs styled like the official requester receipt scanner. Inbound Scan is the existing verified OCR intake workflow in a compact presentation. Outbound photo/manual fields are local previews; no outbound scan match or dispatch command is synthesized, and confirmation remains disabled. Existing Requests & Transfers remains the supported dispatch route. Manual intake remains unsupported by the consumed verified intake contract. Destination/source choices use permitted request data only. Missing scan linkage and metadata dependencies remain open.

2026-10-10 GAP-07/08/09/16 update: bank detail selection and linked reservation/request reads are wired. Mockup cancellation, partial offer and approval remain disabled: `/api/v2/transfers/:id/:action` explicitly rejects legacy aliases with 410, and no approved offer/decision command exists there. Existing canonical reservation actions are distinct from request approval/cancellation and need preparation evidence, expected-version and operator authorization integration before activation. Reservation receive currently allows ROLE-03, so a bank receipt control must not bypass that policy. Missing requester/clinical/pickup/document metadata remains unavailable. PRC supply button opens the mockup requirements (product, units, priority, required time, coordination note, authorization); fields/submission are disabled and no fake supply records are created. GAP-16 remains open.
