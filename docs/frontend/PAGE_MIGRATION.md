# Page Migration Register

| Feature | Mockup source | Official destination | Audience composition | API dependency | Status |
|---|---|---|---|---|---|
| Authentication | `pages/login.jsx` | `apps/web/src/features/auth/` | shared | session create/read/delete | Implemented; automated validation passed |
| Dashboard | `pages/dashboard.jsx` | `apps/web/src/features/dashboard/` | hospital and regulatory variants | dashboard summary/freshness | Implemented; automated validation passed |
| Inventory | `pages/inventory.jsx` | `apps/web/src/features/inventory/` | institution-scoped | V2 components and inbound-intake status | Connected V2 view implemented; automated validation passed; scoped census discovery exists; reporting capture/export activation remains deferred |
| Transfers and requests | `pages/transfers.jsx` | `apps/web/src/features/transfers/` | operational/requestor variants | V1 reads plus canonical V2 request/local-release commands | V2 request and local release implemented; reservation actions and reconciliation remain disabled pending read/policy inputs |
| Alerts | `pages/alerts.jsx` | `apps/web/src/features/alerts/` | scoped or aggregate read-only | alerts and acknowledgement | Implemented; automated validation passed |
| Consortium | `pages/consortium.jsx` | `apps/web/src/features/consortium/` | approved aggregate only | dashboard/report aggregates | Implemented; automated validation passed |
| Audit | `pages/audit.jsx` | `apps/web/src/features/audit/` | permission-scoped | redacted audit events | Implemented; automated validation passed |
| Reporting | `pages/reporting.jsx` | `apps/web/src/features/reporting/` | regulatory read-only | simulation JSON/CSV reports | Implemented; automated validation passed |
| Profile | `pages/profile.jsx` | `apps/web/src/features/profile/` | own safe principal/institution metadata | current session/profile | Implemented; automated validation passed |
| Accounts/onboarding | `pages/accounts.jsx` and login application flow | `features/auth/access-page.tsx` and `features/accounts/accounts-parity-preview.tsx` | frontend-only preview for applicants and administrative compositions | BL-API-02 | Visual parity extension implemented after Sprint 5; all submission, persistence, review, authorization, and mutation behavior deferred |
| Scanner | `pages/scanner.jsx` | `apps/capture-pwa/` | ROLE-01 and ROLE-02 | V2 inbound OCR and command status | Mockup-derived appearance retained; OCR-only V2 integration and automated validation passed; offline replay and physical Android evidence deferred |
| Analytics | `pages/reporting.jsx` | `apps/web/src/features/analytics/` | official forecast roles ROLE-01, ROLE-02 and ROLE-03 | V4/V5 forecast plus independent internal ML inventory-evidence HTTP reads under official session cookie | V4 default and explicit V5 preview with validated 40-series census implemented; Jopia prior isolated cookie evidence preserved; Lat accepted and incorporated grouped code fixes with passing unit/mocked browser and disposable database reruns; Lat isolated real producer/database/cookie/Chromium rerun passed at `b5601cc`; see [Lat real rerun](VALIDATION.md#lat-verified-runtime-transfer-and-real-v5-rerun--2026-10-07). History, redistribution, calculations, and exports remain deferred |
| Staff Directory | `pages/accounts.jsx` | `apps/web/src/features/profile/profile-parity-preview.tsx` | hospital and system administrators | staff-directory and access-PIN contracts not approved | Latest-mockup visual preview implemented; mutation, credentials, persistence, and scheduling deferred |

All selected runtime pages use typed official API services. Fixtures are limited
to tests and isolated component validation; there is no runtime mock fallback.
The post-Sprint-05 visual-only boundary and every missing activation dependency
are recorded in [`FRONTEND_ONLY_EXTENSION.md`](./FRONTEND_ONLY_EXTENSION.md),
while scanner-specific differences are recorded in
[`CAPTURE_PWA_VISUAL_PARITY.md`](./CAPTURE_PWA_VISUAL_PARITY.md).


### Desktop continuation gap tracking — 2026-10-09
The dashboard and requester Requests & Transfers backend/API dependency checklist is maintained in [Backend/API gaps](BACKEND_API_GAPS.md). Missing request-detail, pickup, document and notes fields are displayed as disabled placeholders. Existing operator verification remains functional through its submission dialog. Add and update entries as this frontend continuation proceeds; distinguish absent contracts from available APIs awaiting frontend wiring.

Requester Blood Unit Receipt: `/receipts` follows the MetroLipa mockup inbound-only launch/scanner layout. GET `/api/v2/transfers` supplies destination-scoped IN_TRANSIT choices and RECEIVED history; reservation details use the existing verified reader. Photos stay in volatile object URLs, cleared on close/change/access loss; nothing is uploaded. Confirmation remains disabled pending GAP-19. No outbound flow or synthetic scan/ledger identifiers.

Receipt capture amendment: incoming transfer selection removed from scanner. Scan/Manual tabs and inset manual form now expose the mockup input layout. Preview Entry is memory-only and explicitly unverified; no POST, receipt or inventory registration is performed. Actual received history/detail reads remain unchanged.

2026-10-10 receipt manual layout amendment: Manual tab now immediately displays the fields inline in the phone input card. Enter/Edit unit details button and nested overlay removed. Draft survives tab changes, clears on scanner close, and Preview Entry remains local/unverified with no submission.

### 2026-10-10 institution-account profile/staff separation

Supersedes the legacy Staff Directory preview status for primary institution sessions: `/profile` shows scoped institution metadata plus extended field placeholders, while `/accounts` (Accounts / Staff) shows actual operators with supported administrator enrollment, PIN reset and revocation. No duplicate operator table on Profile. PRC directory/application operations remain in Accounts. Legacy sessions retain their preexisting parity components. GAP-20–21 track additional institution/staff fields; existing services are not treated as absent. The supplied full HTML mockup is a visual reference only.

### Active application and Profile amendment — 2026-10-10

The active Apply for Access screen now uses category selection plus four mockup-based steps. This supersedes earlier visual-only application descriptions: existing basic V2 application submission, applicant-status reads and withdrawal remain connected. Expanded qualification/contact/personnel fields, declarations and uploads are disabled and never submitted. Success describes only the basic application. Profile includes Licensing & Qualification, Credentials & Access, Application Record and Security, with unavailable values and disabled unsupported controls; Accounts / Staff continues supported operator administration. No backend schema or endpoint changed.

### Blood-bank operations visual amendment — 2026-10-10

Inventory: scoped component chips/counts/search and expiry ordering; confirmed status and expiry evaluation evidence retained. Requests & Transfers: request/reservation tabs, search/status filters, inline authorized details, compact supported forms and collapsed workflow/operation evidence. Activity History: action chips, search, real counts, refresh and redacted references. All three use shared page/section information controls and responsive card layouts. Current V2/V2.1 data and command contracts take precedence over the full mockup's synthetic inventory/import/approval/export behavior. No API, database or ledger changes were made.

Live inspection found /api/v2/components returns nine records without expiryState, while the current source route and parser include/require it. GAP-24 records running-service contract alignment; the frontend retains rejection rather than inventing expiry evidence. Supported-response browser fixtures validate the inventory layout and behavior. This does not establish that live inventory data loaded successfully.


### Blood-bank inventory / separate transactions amendment — 2026-10-10

The mockup Blood Inventory maps to `/inventory`; its Blood Unit Transactions maps to the new separate `/transactions` tab. The latter is distinct from `/audit` Activity History and `/transfers` Requests & Transfers. Inventory and Transactions now support real filtered-snapshot PDF downloads, superseding earlier deferral of these two exports only. The requester page-level export remains removed. Import CSV is a visible disabled placeholder, pending an approved intake path. Transactions reuses the capture PWA in a phone frame and permitted recorded operation/audit history; unsupported outbound/manual capture and missing scan metadata are not simulated.

Requests & Transfers adopts mockup-inspired Blood Requests / Transfers / PRC Supply Requests tabs, supplier workflow, record/detail columns and an inline new-request form below them. PRC Supply Requests remains empty pending GAP-16. Bank dashboards now add Requests and Network Blood Availability while retaining their own stock overview. Existing bank read scope does not expose a network aggregate; GAP-26 tracks that dependency. GAP-24 still applies to the running inventory service. No API/database/ledger changes were made.


2026-10-10 bank scanner amendment: `/transactions` now launches a native receipt-style phone matching `/receipts`, with Inbound/Outbound and Scan/Manual tabs. Verified inbound OCR remains available through the compact capture PWA iframe `/capture/?layout=receipt`; it is not replaced with a photo-only preview. Outbound photo/manual previews are local, confirmation remains gated under GAP-25, and supported dispatch stays in Requests & Transfers. Direction changes and close clear local previews. Requester inbound-only behavior remains unchanged.


2026-10-10 requester Alerts preview cleanup: removed all five frontend PREVIEW_ALERT/PREVIEW_UNIT samples and the development-only FeatureRouter override. Requester Alerts now consumes /api/v2/alerts through the normal authorized live-data hook. Existing severity summaries/filters remain. No persisted API, database, ledger, or local-account data was deleted.


2026-10-10 Activity History amendment: `/audit` has a dedicated read/header wrapper preserving the existing V1/V2 endpoint choice and last-confirmed-data behavior. Header/Refresh share a row; duplicate loaded-record caption removed. AuditView summary edges align with record container, and activity chips are replaced by a dropdown/search row. No new reads or commands.

2026-10-10 bank Requests & Transfers amendment: row selection and linked detail navigation implemented; Cancel Request / Offer Available Units / Approve Transfer placeholders shown for pending requests, supplier actions scoped to source. Receipt placeholder is destination-only, outbound placeholder source-only, after validated detail reads. PRC Supply Request opens an inline requirements placeholder matching mockup; no unsupported requests sent. Supplier workflow uses the requester card presentation. Deferred per user: revisit Facility Operations, Start Local Release and Recorded Operations placement later; preserve all three for now.

2026-10-10 bank Request Details / Transfer Details restyled after mockup review: replaced stacked technical fields with paired label/value rows, moved reference/status into the body identity row, grouped requester requirements, and added current-state transfer progress/lifecycle presentation. Unsupported controls remain disabled; no change to commands or API policy.

2026-10-11 local release: removed frontend initiation and actions for LOCAL_RELEASE reservations; no Transactions replacement or outbound-to-local-release alias added. Backend/API support retained. Transfer request form remains accessible via New Blood Request; operations heading removed.

2026-10-11 supersedes earlier recovery/history retention on bank Requests & Transfers: page-level manual recovery and operation timeline removed; detail-level manual recovery hidden via workspace-specific option. Existing request/transfer actions and their submission feedback remain. No backend deletion.

2026-10-11 all-screen initial-read polish: shared useLiveData no longer flashes failure before its first effect. Quiet first transient retry and silent stale-account read recovery added; actual denied access is preserved. Dashboard layouts for requester/PRC/DOH now render before reads; Alerts and Activity History retain page structure with unavailable counts. Existing form/filter layouts remain. No API changes or runtime sample data.
