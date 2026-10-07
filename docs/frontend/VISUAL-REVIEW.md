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
