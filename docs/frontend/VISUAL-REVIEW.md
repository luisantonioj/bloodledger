# Populated local frontend visual review

**Owner:** Lat. **Classification:** SIMULATION_ONLY. **Scope:** BL-TST-01
technical preparation, FR-03/09/11/12/14 presentation and NFR-11 visual review.
This is an explicitly selected local fixture server, separate from the normal
application and its database. It renders the existing frontend components with
Vite live reload so layout changes can be inspected immediately.

## Start and view

From WSL Ubuntu, with the repository dependencies already installed:

```bash
cd /home/yuri/projects/bloodledger-current
npm run review:web
```

Open **http://127.0.0.1:5175/**. Keep that terminal running; Ctrl+C stops it.
No Docker service, application account, database seed or model package is
needed. The command binds to loopback and refuses an occupied port rather than
silently changing URLs. It does not install dependencies.

**All pages** is the default navigation mode. All ten current web tabs are
shown together: Dashboard, Inventory, Transfers, Alerts, Network view, Audit,
Reports, Analytics, Accounts and Profile. The host supplies the appropriate
synthetic page role for otherwise hidden views (e.g. regulatory Reports and
System Administrator Accounts); the institution/principal context shows that
page role. Your selected review role remains the base role for supported pages.
Switch to **Role view** to inspect the canonical navigation for just that role.
On shorter windows, scroll inside the sidebar to reach the lower links.
The capture PWA remains a separate application.

Use the persistent **UI REVIEW · SAMPLE DATA · NO BACKEND CONNECTION** toolbar:

- Page: jump directly to any of the ten web tabs from the top toolbar.
- ROLE-01: populated dashboard, inventory, transfers, alerts, Analytics and profile.
- ROLE-02: blood-bank administrator view, including Audit.
- ROLE-03: hospital requestor composition and recipient-scoped transfers.
- ROLE-04: regulatory inventory, network aggregates, Audit and Reports.
- ROLE-05/06: administrative dashboard, Accounts preview and profile.
- Data state: Populated, Empty or Unavailable. Changing role/state reloads the
  dashboard; then navigate to the page you want to inspect.

Role view retains the canonical permission map from `web-access.ts`. All pages
uses a separate test-only application entry loaded exclusively by this review
server. It exposes the full existing navigation list and selects a permitted
synthetic role per page; it never grants extra permissions to a real account. Accounts/profile expanded controls remain
visual previews. Capture is separate at `http://127.0.0.1:3000/capture/` and is
not supplied by this dashboard review command.

## Data and interaction boundary

The host uses synthetic fixtures shaped like the existing browser tests and
current typed readers. Inventory includes multiple blood groups/components,
reserved/available states and intake failures; other views include alert cards,
transfer states/details, safe audit rows, regulatory aggregates and forecast
presentation. Analytics includes complete twenty-series V4/V5 display fixtures
and forty-series synthetic census shapes. Quantities are layout examples, not
Jopia's persisted inventory or Buno's model outputs. Synthetic reference strings
are not real Fabric transactions. Forecast dates are generated for presentation;
no inference, binding, snapshot capture or freshness validation is performed
against operational stores.

All `/api` requests are handled by this isolated host; none is forwarded to the
live API. Every non-GET API request returns `405 VISUAL_REVIEW_READ_ONLY`.
Submission, approval, acknowledgement and logout therefore do not mutate any
system. This server automatically supplies a synthetic review principal;
ordinary login/session security is tested separately. Returning to the review
URL supplies that principal again. Unknown routes fail explicitly; missing
fixtures never fall back to live data. CSV contains only a fixture disclaimer.
Role/state selection uses separate non-secret review cookies on the loopback
host; the real API does not consume those cookies.

Normal `npm run dev --workspace @bloodledger/web` on port 5174 still uses the
real API on port 3000. The built application on port 3000 still uses persistent
database state. The original design work remains preserved on `codex/ui-polish-first-batch` at
`f61a60f`. Its shell/dashboard polish is restored on `codex/lat-restore-design`
around the current backend consumers. The normal frontend keeps official
permissions; all-pages navigation is limited to this sample host.
Visual review is not full system testing, participant UAT, activation or proof of
ledger/forecast correctness. All research, physical-device and latency gates
remain unchanged.

## Verification

With the review server running:

```bash
node tests/frontend/visual-review/check.mjs
```

This uses headless Chromium to inspect each role's visible pages, all ten tabs with direct reloads, inventory and
forecast rendering, role deny behavior, blocked writes, toolbar/page switching and
empty/unavailable states. It writes a synthetic dashboard screenshot only to
`/tmp/bloodledger-visual-review-dashboard.png`. Execution evidence is recorded
in [VALIDATION.md](VALIDATION.md).

## Restored design — 2026-10-08

The user requested the prior polished design with sample data and top navigation.
The shared shell, compact page heads, grouped navigation and three-signal dashboard
are restored from `f61a60f`. The current V2, historical and V5 readers remain.
Both 5174 and 5175 render the same editable source; 5174 reads the real API, while
5175 supplies isolated samples. The top toolbar includes a direct Page selector.

Historical samples use 200 illustrative components and 20 count combinations,
with `SAMPLE_ONLY` validation and `SYNTHETIC_VISUAL_REFERENCE` identifiers. These
are not the requested 522-unit workbook import or valid local Fabric receipts.
Transfer samples separate PENDING requests from ACTIVE/IN_TRANSIT reservations.
Expiry samples do not imply an enabled near-expiry alert policy.
# Dashboard stock chart restoration — 2026-10-08

The inventory overview restores the original mockup's quantity axis, stock-color
legend, surplus segment and View inventory link. Fixed sample stock indicators
are injected only by this isolated review host. The normal frontend uses actual
dashboard aggregates and displays surplus as unavailable: its API does not
supply approved stock indicators or predicted surplus. AVAILABLE stock is never
relabeled as redistributable stock.

## Temporary local account switcher — 2026-10-09

On port 5174, the Vite development server adds a top account bar when the existing
ignored `build/accounts/private.json` is present. Select any of the six retained
institution accounts to sign in and return to its Dashboard. Accounts are grouped
as blood bank, requestor, PRC and DOH, matching the external dashboard reference.
The bar uses real local API sessions and data; it does not supply sample stock or
change permissions. The previous session is revoked on switching. Credentials are
read server-side only, and Vite denies HTTP access to `build` artifacts. This
temporary tool is excluded from production builds and the isolated 5175 host.

Verification: `npm run check:web`, `npm run test:web`, and
`node tests/frontend/local-account-switcher.mjs` (requires the retained API and
frontend on 3000/5174). The browser check uses its own sessions and verifies all
six accounts, prior-session revocation, keyboard access, narrow layout and
rejected cross-origin/unknown-account requests. This is frontend technical
preparation under BL-TST-01, not participant UAT or Testing-phase completion.

## Dashboard refresh — 2026-10-09

Lat frontend implementation: the shared dashboard header now supplies the
Refresh control described in [DESIGN.md](../DESIGN.md#page-head) for all account
types. It reuses the scoped polling reader and preserves confirmed data after
transient failure. The icon follows the external HTML reference.

Technical self-validation on this host: `npm run check:web` passed;
`npm run test:web` passed 80 tests; `npm run test:web:e2e` passed 68 tests with
7 existing retired V1 fixtures skipped; `node tests/frontend/local-account-switcher.mjs`
passed all six retained accounts; `npm run scan:secrets` passed. Browser coverage
includes explicit refresh for Blood bank, Requestor, PRC and DOH, busy/keyboard
behavior, data update without browser reload, and transient-failure recovery.
This evidence does not complete BL-TST-01 or participant UAT.

## Account-specific summary cards — 2026-10-09

At Lat's request, the external six-account HTML reference supersedes the shared
three-card technical summary. The four card sets and data boundary are defined
in [DESIGN.md](../DESIGN.md#page-head). `DashboardView` selects them from the
authenticated account category; synchronization evidence remains a compact
secondary row. Only confirmed inventory totals are supplied by the current
dashboard response. Expiry/stock/request, PRC supply/facility and DOH compliance
summaries have no dashboard contract and remain Unavailable, including on the
isolated review host. Fixed reference numbers are not copied into the live UI.

Lat technical self-validation: `npm run check:web` passed;
`npm run test:web` passed 86 tests; `npm run test:web:e2e` passed 68 tests with
7 retired V1 fixtures skipped; `node tests/frontend/local-account-switcher.mjs`
verified the four exact label sets across all six retained accounts;
`npm run scan:secrets` passed. Missing metrics are distinct from confirmed zero,
and available stock is not inferred as redistributable supply. No UAT or phase
completion is claimed.

Follow-up simplification on 2026-10-09: removed the summary cards' colored edge
accents and third helper row at Lat's request. Cards retain title and count only;
unavailable counts keep a dash with an accessible label, and confirmed zero
remains `0`. `npm run check:web` passed; the retained-account browser check covers
the two-row structure and absence of edge decoration across all six accounts.

Further dashboard simplification: the synchronization row is removed, and the
last successful projection is displayed as a muted `Last updated` label beside
Refresh. Source/timezone remain in its tooltip; a missing timestamp displays
Unavailable. The label wraps with the action group on narrow screens.
`npm run check:web` and all 68 active frontend browser tests passed (7 retired
fixtures skipped). The retained-account check passed all six accounts and
verified narrow-screen action-group fit. The header was also visually inspected
using a temporary screenshot under `/tmp`; no screenshot is committed.


## Requester dashboard layout — 2026-10-09

Scoped frontend continuation on `codex/lat-uat-frontend`, using the existing WSL
checkout and retained live preview on port 5174. The Metro Lipa HTML dashboard
is a layout reference only. Requester accounts now show My Requests and Network
Blood Availability instead of the blood-bank inventory chart. The existing
summary cards and missing-metric semantics are preserved.

My Requests reads `/api/v2/transfers`, filters the authenticated destination,
shows recent request state with pending ledger confirmation when applicable,
and links to the existing request/detail workflow. Network availability uses
only AVAILABLE blood-type/component rows from the authorized city-wide
projection. No sample supply, predicted surplus, guaranteed eligibility, or
automatic source routing is introduced. Refresh updates both reads; transient
request errors preserve earlier results, while authorization errors clear them.

Validation (simulation-only technical checks; no UAT or integration gate closed):

- `npm run check:web`: PASS; TypeScript and production build.
- `npm run test:web`: PASS, 89 unit tests.
- `npm run test:web:e2e`: 70 PASS, 7 existing retired V1 tests skipped,
  one new filter-label lookup failed. Explicit accessible filter names fixed
  that failure. The focused rerun below covers all affected requester cases.
- `npm run test:e2e --workspace @bloodledger/web -- --grep "requester|two synthetic secondary"`:
  PASS, 5 browser cases, including the additional authorization-loss regression.
- `node tests/frontend/local-account-switcher.mjs`: PASS for all six live local
  accounts, keyboard/narrow viewport, scope checks and credential isolation.
- `npm run scan:secrets`: PASS, no leaks found.
- Live Metro Lipa at 1440px and 390px: both panels visible, no inventory chart,
  no page overflow or JavaScript page errors. Request Blood opens the existing
  request form without submitting a request. The current default O+/PRBC filter
  returned zero and the request list was empty; no fixture records were added.
- Desktop/mobile screenshots were reviewed in the Codex artifacts directory as
  `requester-1440.png` and `requester-390.png`.

## Separate design preview recovery — 2026-10-11

Jopia-approved preview runs only from `/home/yuri/projects/bloodledger-design` on loopback 5175. The saved design at c0c2f8d retains the full restored frontend; the final inventory black text and bottom options have been reconstructed here from read-only checkpoint comparisons. No shared stash was applied or dropped. Fixture-only principals now carry account categories so current institution pages render, with synthetic profile/operator and empty census fixtures. Top navigation and sample scenarios remain. Every API write remains blocked and there is no live API forwarding. UAT on 5174 is protected and unchanged. This is display verification only.

Recovery verification: one Chromium smoke check on 5175 confirmed plain black borderless inventory blood types, both options after the table, current institution Profile/Staff Accounts, and bank/requester/PRC/DOH layouts. No JavaScript page errors and no port-3000 requests occurred. No build, full test suite, dependency install or UAT operation was run.

## Six institution accounts in the design preview — 2026-10-11

The current 5175 toolbar supersedes the older role/all-pages preview controls. It matches the local 5174 account-bar styling and groups exactly six synthetic institution identities from the public account policy: Mediatrix, Medix, N.L. Villa, Metro Lipa, PRC Lipa and DOH CALABARZON. One login per institution; operators are nested under that account. Account selection sets only the `bloodledger_review_account` cookie; it never logs into the live API or reads private credentials. Navigation is derived from the selected account permissions and category, with no automatic account substitution per page. Sample state controls remain. One lightweight browser verified all six account/institution identities, bank/requester/regulatory navigation and zero JavaScript errors or port-3000 requests. No live authorization claim is made.

## V3 operational design fixture — 2026-10-11

The isolated 5175 host now uses `scenario-v3.mjs`: exactly 522 scenario additions, 486 AVAILABLE and 36 RESERVED, across all five component types. Public twenty-series counts come from `docs/handoffs/BUNO-OPERATIONAL-STOCK-522-EVIDENCE.md`; V3 evidence confirms unchanged counts. Dates, ordering and alternating reservation purposes reproduce `scripts/operational-scenario/scenario.py` without opening a workbook or private population artifact. These are technical date offsets, not clinical shelf lives. Fresh COMP/DON/RES/TRF/LR_PREVIEW_V3 IDs carry SIMULATION_ONLY provenance; requests have null ledger references, timeline/audit are empty, and no fixture implies actual ledger commitment.

Exactly 24 ACTIVE reservations cover 36 unique members, split into 18 TRANSFER and 18 LOCAL_RELEASE units. Mediatrix is issuer/current custodian; transfer destination is Medix. Scoped component and reservation handlers support the existing detail explorer, linked transfer requests and member drill-down. Other bank accounts have no added stock; Medix can see destination reservations but cannot inspect Mediatrix-owned components. Requester/regulatory network aggregates see this fixture only. Neither the retained nine baseline units nor separate historical records enter totals. Historical layout examples remain 200 independently named HIST_PREVIEW_SEPARATE records with HISTORICAL_LAYOUT_SAMPLE_200 provenance, not copies of the private historical 522.

AB+ platelets is the documented source zero. Negative-Rh source coverage is unknown, not verified zero source stock; the fixture contains zero negative-Rh records and explicitly labels that distinction in provenance. Neutral chart quantities replace invented critical/low/adequate/surplus sample indicators. No agreed stock threshold or clinical classification is inferred.

Lightweight validation: `node tests/frontend/visual-review/check-scenario-v3.mjs` checks totals, uniqueness, member versions, purpose balances, scoped linked routes and empty states. A direct comparison to the public Python generator checks every unit state/date and each reservation grouping. These validate fixture consistency only. UAT checkout, shared stashes, containers, workers, accounts, stores and private artifacts were untouched.

V3 browser smoke result: 522 visible inventory rows; component → reservation → transfer request → back → member and component → reservation → local-release purpose → member both PASS. Close button remains accessible above the preview bar. Neutral chart legend PASS, no JavaScript errors, no port-3000 requests, and a fixture POST returned 405. Browser closed after checking. No build or browser suite was run.

2026-10-11 inventory interaction polish: one lightweight 5175 browser check verified 20 records on initial/next pages, 2 records on the final page of 522, disabled Next on the last page, search resetting to page one, neutral row hover without a stripe, and the standalone rightmost reservation action opening its detail. No JavaScript errors. Expiry-state text unchanged. No UAT changes or heavy build/test suite.

2026-10-11 white-button and reservation-dialog check: enabled Export PDF transitioned from white to the neutral Refresh shade over 160ms. One fixture browser verified aligned reservation fields, member cards, transfer/request and member drill-down, 390px dialog fit and Escape close, with no JavaScript errors. Disabled controls retain their unavailable state. All changes stay in the design checkout; no builds, live API calls or UAT operations were performed.

2026-10-11 reservation dialog tab-style rebuild: visually reviewed desktop and mobile screenshots after replacing mixed heading/member-card styling with Profile-style paired fields and a Requests & Transfers-style member table. Actual inherited h3 borders cleared. Previously rejected manual command-recovery form removed from inventory overlays; automatic outcome recovery remains. Fixture browser confirmed linked request/member navigation, transparent close, mobile dialog fit, no JS errors and no header dividers. Analytics styles were excluded. UAT unchanged.

2026-10-11 Analytics fixture scope: populated forecasts and V3 stock snapshots are explicitly Mediatrix-only layout samples; other blood banks receive unavailable envelopes. Requester Analytics reads only scoped V2 requests and displays an empty summary for Metro Lipa in this scenario. Dated receipt trends remain an API gap; no synthetic historical receipt curve is invented. Browser checks passed bank forecast/version absence, 486/36 snapshot totals, requester foreign-record filtering, confirmed-only fulfillment, unavailable aggregates and mobile width; TypeScript and V3 scenario checks passed. All validation is fixture-only.

2026-10-11 pagination review (BL-WEB-05/06): shared controls passed four focused unit checks for twenty-row limits, retained headers/empty states, final-page ranges/boundaries and unknown data. One browser session used temporary intercepted synthetic overflow records to verify 51-record bank/requester lists, transactions, dashboard requests, activity, alerts and census tables; scoped network aggregate (60 rows) and inventory (522) passed. First/previous/last boundaries, search/severity reset, PRC supply unavailable controls and mobile width passed. Temporary overflow data is browser-only and was not added to the V3 fixture. Historical batch controls remain tied to the existing cursor mechanism; pagination counts only the loaded batch. TypeScript checked without building; UAT unchanged.

2026-10-11 Network view review: all six fixture institution accounts display Network view and consortium page-help text. Hospital views read only CITY_AGGREGATE data and show Mediatrix's scenario stock (486 AVAILABLE/36 RESERVED); institutions without stock records are not assigned invented zero rows. PRC/DOH oversight tables retained. Four focused aggregate tests passed scope validation, count validation, missing-versus-explicit-zero and oldest-row freshness. Browser checks passed six-account visibility/help, hospital filtering/paging, request product prefills, mobile width and invalid-scope unavailable state. TypeScript and whitespace checks passed without a build. Fixture-only hospital consortium permission is separate from the unchanged live role policy; post-UAT backend integration remains pending.


2026-10-11 Consortium mockup composition: Network view across the six isolated design accounts now shares four summary cards, all five component filters, Network Total / Compare Blood Banks bar controls, selectable blood types and the Blood Bank Availability Matrix with shared record pagination. This supersedes the simple hospital table and PRC/DOH network table composition; Reports is unchanged. Bar values are reported AVAILABLE counts, not approved redistributable units. Available to Redistribute and matrix redistribution values remain unavailable because neither an approved safety-stock rule nor released quantities are supplied. Participating count explicitly means facilities with reported inventory (currently Mediatrix only); missing facilities are not fabricated. Missing type/component coverage remains unknown, and negative-group zeros describe this synthetic fixture only. Requests preserve selected blood type/component without forcing source selection. All data uses the existing authorized consortium read and isolated fixture permissions; backend role integration remains deferred. Protected UAT, API 3000 and port 5174 unchanged.

Validation: six aggregate tests, web TypeScript check, one Chromium session covering all six account compositions, component controls, compare view, selected/cleared matrix columns, requester product navigation, empty/unavailable table structure, and 390px document sizing passed. V3 scenario invariants remain 522 additions, 486 available, 36 reserved, 24 active reservations. Browser checks verify fixture presentation only, not live backend behavior.


2026-10-11 Compliance Reports design: full-mockup-derived bank/DOH page with shared compact white cards, top-right Refresh, four summary cards with title information buttons, bank-only 9 AM/4 PM checkpoint selection, record search/date filter and shared twenty-row pagination, selected report details and eight-blood-group/five-component recorded-stock matrix. PRC Reports retained; requester reporting absent. Uses the existing scoped census index contract and validates selected snapshot metadata/counts; missing stock or verification stays unavailable. Report capture, verification and official PDF controls remain disabled (existing catch-up API distinguished from missing verification and gated export). All fixtures remain isolated on loopback 5175; no UAT/API/policy writes. See Backend/API gaps GAP-17 update.

Validation: 13 focused reporting/index tests plus TypeScript passed. Chromium checked visibility and empty layout for all six accounts, bank/DOH composition differences, test-only selected report detail counts, twenty-row paging and search reset, mobile fit and unavailable table structure. No mutation requests or JavaScript errors. Populated reporting responses were temporary browser intercepts, not persisted fixture records or evidence of live backend operation.


2026-10-12 regulator Analytics: PRC and DOH institution accounts now have distinct read-only Analytics pages, superseding their previous lack of navigation. Existing hospital/requester Analytics and ROLE-01/02/03 forecast gate remain unchanged. Regulatory page visibility requires ROLE-04, assigned PRC/DOH category and the relevant existing aggregate read permission; it never grants forecast access. PRC summarizes the authorized consortium snapshot into reported available/reserved stock by all five components; historical supply/demand, approved redistributable stock and PRC replenishment/coordination outcomes remain unavailable. DOH groups the first loaded census batch by Manila capture date, showing loaded records and represented institutions. It does not infer late reports, reporting completion, verification or compliance from capture times or missing records. The Reports page is the path to remaining census batches. Summary cards use shared title information controls and border color; current stock and dated capture activity are distinguished from unsupported trends. No backend/policy, fixture population, UAT or port-5174 changes.

Validation: six focused regulator/access tests and web TypeScript passed. Chromium verified PRC/DOH visibility, 486 available/36 reserved fixture counts, five product bars, report batch/date grouping, preserved bank/requester compositions, populated/empty/unavailable states and mobile document width. No regulator forecast API calls, mutations or JavaScript errors. A temporary browser-only census record exercised activity grouping without persisting new sample reports. Existing V3 scenario totals remain unchanged; these checks do not validate a live backend.


2026-10-12 final Analytics mockup direction: bank/requester Analytics now uses observed request records instead of the forecast demand overview, version controls, forecast metrics/table and inventory-evidence panel. Those services/components remain preserved in source but are not mounted or called by these pages. Full-HTML-derived Reporting Filters (date range, eight blood types, five components, department/hospital placeholder), request/unit summaries, department/hospital ranking section, monthly units/request-count chart and bank/PRC Redistribution Assessment replace the prior compositions. Bank observed demand includes returned requests naming that bank as source, excluding its own procurement; requester demand is destination-scoped. Monthly aggregation uses request time in Manila, skips undated records, does not fill missing months, and does not claim complete historical coverage. Public V3 fixture request rows lack request dates: Mediatrix shows 13 requests/18 requested units while month/department/assessment views stay unavailable. No dates were inferred from component stock and no extra stored sample demand was invented.

PRC’s authorized network stock snapshot is not dated demand history; its new historical layout has unavailable request/hospital/month/assessment values until an authorized history contract exists. DOH retains its reporting/follow-up composition with new capture-date/facility filters applied to loaded census records; no department/product controls or redistribution assessment is introduced for DOH. Requester receipt trends remain unavailable without dated confirmed quantities. Current table/info styles, shared borders, neutral buttons and red field focus preserved. Forecast API contracts, backend role policy, UAT and port 5174 unchanged; all work remains in isolated 5175 design checkout.

Validation: ten focused analytics/access tests and TypeScript passed. Chromium covered all six roles, absence of forecast/model UI and API calls, unknown request dates, bank source/requester destination scope, temporary browser-only monthly date/units-count/product filters, DOH capture-date/facility filters, unavailable states and mobile width. No mutation requests or JavaScript errors. Public V3 fixture invariants retained; no fixture results establish live backend validation.


2026-10-12 Activity History: compact PDF/CSV export actions added beside Refresh for bank, requester, PRC and DOH institution accounts. Shared pagination, existing design and filters preserved. Export scope is all matching loaded records, with safe fields, filters, generated time and SIMULATION_ONLY provenance. Requester Activity History is limited to its existing permitted transfer command timeline; no backend audit grant. Empty/unavailable/no-match actions disabled.

Validation: web TypeScript and five focused FR-11/12 tests passed (scope/date/duplicate rejection, whitelist privacy, regulatory aggregate scope, 51-row filtering, CSV escaping/formula protection and exclusion of foreign requester commands). One Chromium instance completed 42 checks across all six accounts: 20-row display, full 51-row CSV, filtered 31-row CSV, real PDF download signatures, disabled empty/no-match controls and mobile width. No JavaScript errors, mutations or requester audit endpoint reads. Populated records were temporary browser intercepts only, not stored sample data or live ledger evidence. Existing loopback design preview reused; UAT and public V3 fixture distribution unchanged.

2026-10-12 Activity History PDF-only refinement: removed Export CSV, its generation/download helpers and CSV help text. PDF retains the same safe scope, active filters and all matching loaded records. TypeScript, four focused activity export tests and browser verification of PDF-only controls across all six accounts passed. Existing 5175 preview reused; UAT untouched.

2026-10-12 request-row polish: TypeScript and whitespace checks passed. One browser verified 12 bank/requester checks for compact references, full hover references, no wrapping, absence of repeated ledger captions in table status cells, accessible selection and persistent selected-row color. Mediatrix request details retain the full reference and missing ledger-confirmation information. Requester populated rows were temporary browser intercepts, not saved fixture records. Existing design preview reused; backend and UAT untouched.


2026-10-12 PRC dashboard inventory: replaced the blank overview chart with the existing authorized city dashboard aggregates using Network View count/coverage validation. Added all-five-component selector, reported-bank legend, full Network View link and header information control; available-only chart, no thresholds or fabricated missing-bank zeros. Existing dashboard Refresh owns updates; no additional server or polling read. Reporting/replenishment sections and Analytics heights preserved.

Validation: web TypeScript and ten focused overview/network tests passed. Chromium completed 20 checks comparing dashboard and Network View for all five products, explicit negative-group fixture zeros, existing Refresh, mobile width, empty/unavailable states and rejection of institution-only scope. No mutations or JavaScript errors. Public V3 scenario records remain unchanged; these checks validate only isolated synthetic preview behavior, not the protected live UAT backend.

2026-10-12 PRC dashboard consolidation: added availability matrix beneath stock chart; All/product selector updates both, Network Total / Compare Blood Banks updates chart. All shows 486 available fixture component units, excluding 36 reserved; matrix preserves separate products. PRC-only Network View nav removed and old route resolves to Dashboard. Bank/requester/DOH Network View retained.

Validation: web TypeScript, eleven focused aggregate/coverage tests and whitespace checks passed. One browser completed 17 checks for All default/486 total, five-product matrix, product selection, chart toggle/legend, PRC nav removal/old URL, mobile width and other-role navigation. Temporary browser-only five-bank aggregate response exercised 25 matrix rows, 20-row first page/five-row second page and 40 comparison bars. No JavaScript errors or mutations. No additional persistent fixture data, servers, backend edits or UAT changes; Analytics heights preserved. Fixture checks do not validate live data.

2026-10-12 unavailable-action explanations and compliance labels: shared disabled-action help is accessible by hover, focus, Enter/tap, and dismissible with Escape. Original native buttons stay disabled; explanation triggers do not execute handlers or submit forms. Tooltips render outside clipping containers, clamp to viewport and dismiss on scroll/resize. Reports for Today accurately describes saved reports scheduled for today's checkpoint; Saved Stock Reports replaces the table heading without changing count logic or claiming verification. Pagination buttons and record counts retained.

Validation: web TypeScript, twelve focused compliance/pagination/activity tests and whitespace checks passed. One browser verified 33 checks across all four institution categories for explanation content, focus descriptions, Escape/tap, mobile position/document width, revised report labels and preserved enabled inventory PDF download. Seven further scanner/PRC form checks verified keyboard help, native disabled controls, Escape preserving phone dialogs and no commands. No mutation requests or JavaScript errors; fixture-only preview reused, backend/UAT untouched. Previously unavailable dependencies remain unimplemented.

2026-10-12 dropdown consistency: replaced network component/chart chips and PRC chart-view buttons with matching dropdowns; added All to bank/requester/DOH and shared All count logic with PRC. Web TypeScript, eleven focused aggregate/coverage tests and 65 browser checks across six accounts passed. Checks cover six component options/two chart options, 486 available All fixture total, separate five-product matrix, product selection, comparison legend, chart blood-type filtering/reset, mobile width and arrow padding. No JavaScript errors or mutations. UAT/backend and source fixture distribution unchanged.

2026-10-12 Analytics heading refinement: TypeScript and whitespace checks passed. Browser checked all six accounts for one Analytics heading, removal of standalone scope-description row, right-aligned same-row Refresh, existing accessible page information help and mobile width. Missing PRC history remains unavailable and its Refresh explanation performs no action; no backend/UAT changes.

2026-10-14 PRC toolbar refinement: TypeScript and whitespace checks passed. Browser completed 24 checks across the three blood-bank institution accounts: correct action on each tab, exactly one PRC request button in the toolbar, removed chapter container, hidden general form on PRC tab, open/scroll/repeated-click/cancel behavior and form cleanup on tab changes. No mutation requests or JavaScript errors. Existing loopback fixture preview reused; UAT and backend untouched.

2026-10-14 temporary alert layout population, explicitly requested by Yuri: isolated V2 alert fixtures now use temporary-alerts.mjs with 24 synthetic sample records per account, eight each Critical/Warning/Information, varied dates and open/closed states. No stock thresholds or real unit/transaction links are inferred; regulatory accounts receive aggregate-shaped samples. Classification/provenance identifies TEMPORARY_ALERT_LAYOUT_24, not ledger commitment. Remove these samples by setting temporaryAlertsEnabled=false in that module and restarting only review:web. Empty-state selection still returns no alerts. Browser verified six accounts, 20/4 pagination and eight matching cards per severity, with no acknowledgement actions available. Protected UAT and backend untouched.

2026-10-14 logo integration: web and capture TypeScript and whitespace checks passed. Browser verified the 5175 sidebar image loads at original 1000x1000 dimensions and web favicon returns successfully; screenshot visually reviewed. Asset SHA-256 matches the supplied Downloads file for both copies. No B/BL brand placeholders remain in web/capture source searches. Capture source/manifest updated only; no additional capture server/build or live UAT change. Original image preserved.

2026-10-14 temporary alerts removed at Yuri's request: deleted temporary-alerts.mjs and its fixture import, restoring V2 alert responses to empty scoped arrays. The design preview was restarted on loopback 5175 only. Browser verified No alerts and zero card/response records across all six accounts. Alert UI, filters, pagination and supplied logo preserved. Backend/UAT untouched. This supersedes the temporary alert population entry above.

2026-10-14 updated logo replacement: supplied BLOODLEDGER_LOGO.png replaces the previous artwork everywhere via bloodledger-logo-updated.png in web/capture brand, empty-state, favicon and capture manifest references. Fresh filename avoids old browser-cache assets. Copies retain identical SHA-256 to the original updated file; 5175 browser verified sidebar image and favicon loading. Old logo asset removed only from design checkout. No image transformation, backend or UAT changes.

2026-10-14 sidebar identity cleanup: removed top Current institution block and bottom initials avatar. Bottom name/role/title/sign-out retained; single-line ellipsis uses freed space. Screenshots reviewed, web TypeScript and whitespace checks passed. Browser verified all six accounts retain a single text-only sidebar identity and sign-out. Preview-only edits; UAT untouched.

2026-10-14 stock legend restored at Yuri's request: removed preview override hiding Critical/Low/Adequate/Surplus labels. Four semantic legend colors visible again; available stock is not labelled approved redistributable stock. No thresholds or per-blood-type classifications invented. Existing inventory counts/bars preserved. Browser verified four labels and distinct colors; design preview restarted only, UAT untouched.
