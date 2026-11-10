# Lat → Jopia and Buno: panel revisions update (2026-11-10)

SIMULATION_ONLY. Frontend owner: Lat. This note explains everything pushed on
2026-11-10 so you can review, pull and run it without asking. Nothing here is
clinical, regulatory or production evidence.

## TL;DR

- **Branch:** `codex/lat-panel-evidence-20261107` (pushed, 5 new commits on top of `8952617`).
- **Mostly frontend:** new requestor and PRC dashboard cards, PRC dashboard tables,
  a new PRC Reports page, a redesigned PDF export with the logo, and several UI fixes.
- **One backend change (approved by Jopia):** stock checkpoints can now save
  **cryoprecipitate**. It needs a migration and one environment setting (see
  [Setup after you pull](#setup-after-you-pull)).
- **Your data is not affected.** Only code was pushed. Lat's demo units
  (400 / 350 / 300 usable units at the three banks) live on Lat's laptop and are not in Git.
- **Tests:** API 254/254, web unit 517/517, capture 28/28. Browser suite: 6 known
  failures, all already failing before today (details in [Known issues](#known-issues)).

## Commits

| Commit | Type | Summary |
|---|---|---|
| `4b8ce00` | chore(web) | Lat's Nov 9 UI work, committed as a checkpoint: export and refresh moved to section headers, Type column on Transfers, "loaded rows" counter removed, dashboard label cleanup, checkpoint copy and local-release adjustments, scanner and outbound tweaks |
| `044f4a1` | feat(web) | Table "Columns" picker moved into the card header row for requestor and PRC tables (blood banks unchanged) |
| `78e410f` | feat(api) | Stock checkpoints record cryo: new policy `SYNTHETIC_STOCK_CHECKPOINT_V2`, additive migration, REQUIREMENTS amendment |
| `7354bf4` | feat(web) | Dashboards, PRC tables, PRC Reports page, PDF redesign, navigation and polish |
| `123ff0d` | test(web) | Tests updated for the new UI and for compressed PDF exports |

## What changed, by screen

### Requestor (Metro Lipa) dashboard

| Card | What it counts |
|---|---|
| Submitted Requests | All of this facility's own requests |
| Awaiting Review | Requests the supplier has not decided yet (no reservation recorded) |
| On the Way | Linked reservation is Dispatched, In transit or Delayed |
| Received | Linked reservation is Received |

Source: the existing `/api/v2/transfers` read (`reservation_status`, `decision_state`).
That read returns the newest 100 requests, so counts cover at most 100.

### PRC (Lipa City Chapter) dashboard

| Card | What it counts |
|---|---|
| Participating Blood Banks | Banks reporting inventory |
| Redistributable Supply | Sum of each bank's available units **above its "adequate" band** in the synthetic stock-classification policy. Decision support only; it never approves or reserves anything |
| Critical Blood Types | Blood types where any reporting bank has a product at the "critical" band |
| Open Supply Requests | PRC supply requests that are Submitted or Acknowledged (all pages read) |

The two "Redistributable" and "Critical" definitions are Lat's choice because no
contract defined them. They reuse the same policy file that drives the blood-bank
"Low Stock" card (`apps/web/src/features/dashboard/policy/synthetic-stock-classification-v1.json`).
Change them there or in `dashboard-summary.ts` if the team prefers another rule.

Other PRC dashboard changes:

- **Blood-Bank Inventory Overview:** filters side by side with the hospital legend
  on the right (same layout as the blood-bank chart), y-axis scale and gridlines,
  a count above every bar, **Compare Blood Banks** is the default view, and the
  repeated "Available units" captions and the note line were removed.
- **Blood Bank Availability Matrix:** a cell with no reserved units shows
  "0 reserved" instead of "Reserved: —".
- **Blood-Bank Reporting Status** (was a placeholder): per bank, the time of its
  latest saved 09:00/16:00 stock record, live available units, and a status:
  Up to date / Saving … record (inside the 30-minute window) / Missed … record /
  No saved records. A missed record is never filled from current stock.
- **Hospital Replenishment Requests** (was a placeholder): the real PRC supply
  requests, open ones first. Each reference links to that request, and
  "Coordination records →" opens PRC Supply Requests.

### PRC Reports page

The old flat 40-row "Stored census" list was replaced by a **Saved Stock Records**
card: choose a blood bank (by name) and one of its saved records, then read it as
an 8 blood type × product matrix with a Total column, the same layout the blood
banks copy for DOH. The page header has the standard Refresh button with the
record's capture time beside it. Only institution accounts with the regulatory
viewer role (PRC) get this view; DOH and blood banks keep their own pages.

### Stock-record copy and cryo (Dean Cherrie #4)

- With `SYNTHETIC_STOCK_CHECKPOINT_V2`, saved records include cryo, and **Copy**
  pastes the real cryo counts.
- Records saved earlier under V1 never captured cryo; their Cryo cells are left
  **blank** (not 0) so nobody reads a fake zero.
- The clipboard always has the same columns: Blood type, Whole Blood, PRBC, FFP,
  Platelets, Cryo, Total; rows O+, A+, B+, AB+, O−, A−, B−, AB−.
- Verified on Lat's demo: the 09:00 record for Mediatrix copied 40 values and the
  Cryo column summed to 83, matching the bank's live cryo stock.
- Lat confirmed the copy follows the team's current DOH report spreadsheet;
  REQUIREMENTS now says so (it is the team's template, not a DOH approval).

### PDF exports (all five export buttons)

Blood Inventory, Blood Unit Transactions, Transfers, PRC Supply Requests and
Activity History all use `apps/web/src/services/pdf/table-report.ts`, so they all
changed together:

- The BloodLedger **logo** replaces the "B" placeholder (falls back to the "B"
  mark if the image cannot load).
- Header with name and a SIMULATION ONLY badge; title and facility; a summary box
  with Generated (Asia/Manila time), Records, Sort and readable Filters.
- Striped table with the header repeated on every page; continuation pages get a
  slim running header; every page has a footer with `SIMULATION_ONLY`, the
  disclaimer and "Page X of Y".
- **Compressed** output (inventory PDF 803 KB → 111 KB).
- **Column widths from content.** This fixed a real defect: long IDs (64-character
  blockchain hashes) used to squeeze other columns to one letter wide, making the
  Activity History PDF 99 pages; it is now 6 readable pages with every ID intact.

All information the old PDFs carried is still present.

### Navigation and smaller fixes

- **Activity History** moved from Operations to **Insights** for every account.
  Alerts stays in Operations because it is actionable work.
- **+ Local Release** uses the primary (red) button style, like + New Blood Request.
- **No overscroll:** the page no longer bounces or swipe-navigates, in the web app
  and the capture PWA (`overscroll-behavior: none` on `html, body`).
- **PRC Supply Requests (standalone page)** has its Export PDF and Refresh buttons
  back; they had been lost when the Nov 9 work moved them into the embedded tab.
- **Columns picker** sits in the card header for requestor and PRC tables
  (commit `044f4a1`).

## Setup after you pull

Only needed for the cryo change. Everything else is frontend-only.

```bash
npm ci --ignore-scripts
npm run migrate:up            # applies 20261110000000000_allow-stock-checkpoint-v2-policy
npm run build --workspace @bloodledger/api
```

Then set, on the **API, the command worker and the checkpoint service**:

```
BLOODLEDGER_DOH_REPORT_POLICY_VERSION=SYNTHETIC_STOCK_CHECKPOINT_V2
```

and restart them. Without this setting nothing breaks: records keep the old
four-product V1 format, and Copy leaves Cryo blank. The migration only widens one
check constraint; existing census records are untouched.

## What was not pushed (on purpose)

- **Demo data:** Lat's units, ledger and saved stock records live in Lat's local
  Docker demo (`bloodledger-sample-20261105`). Your host keeps showing your own data.
- **Demo scripts and private files** under `build/` (population scripts,
  credentials, backups) — Git-ignored by design.
- Lat's local notes under `logs/`.

## Tests

| Check | Result |
|---|---|
| `npm run check:api` (TypeScript) | passed; the static-boundary step needs `rg` (ripgrep), which is not installed on Lat's host, so it did not run |
| `npm run test:api` | 254 / 254 |
| `npm run check:web` | passed |
| `npm run test:web` | 517 / 517 |
| `npm run check:capture` / `npm run test:capture` | passed / 28 / 28 |
| Playwright full suite | 6 failures, all pre-existing (below) |
| Secret scan, files being committed | no leaks |
| Secret scan, all local refs | 1 known false positive on Lat's old commit `67ff03e` (a 64-hex build SHA in `docs/validation/lat-institution-staff-2026-10-21/README.md:137`), not in this branch's history |

PDF content tests now read compressed PDFs through `apps/web/e2e/fixtures/pdf-text.ts`.

## Known issues

### 6 browser tests fail, all pre-existing

On the commit before today (`044f4a1`) the same specs failed **12** tests; today's
work brought that down to **6**, and none is new. They follow from Lat's Nov 9
design changes and still need a decision on whether to update the test or the UI:

| Spec | Likely cause |
|---|---|
| `blood-bank-completion.spec.ts:4`, `:48` | Dashboard card labels shortened ("Expired", "Expiring Soon") |
| `blood-bank-pages.spec.ts:44` | Same card label/order change |
| `compliance-reports.spec.ts:21` | Copy is limited to the 30-minute capture window (Nov 9 change) |
| `dashboard-inventory-overview.spec.ts:82` | Nov 9 chart change |
| `blood-unit-receipt.spec.ts:17` | Nov 9 phone scanner change |

### For Jopia: stuck local-release commands and a worker classification bug

Lat's demo has 3 `COMPLETE_LOCAL_RELEASE` commands (same Mediatrix reservation,
created 2026-11-09 by an earlier UI version) stuck in `RETRY_WAIT` with
`FABRIC_GATEWAY_UNAVAILABLE`, about 180 attempts each. The peer log shows the real
cause: the chaincode rejects them with **`RELEASE_PREPARATION_REQUIRED`** (the
reservation was never prepared). The worker treats this permanent chaincode
rejection as a transient gateway error and retries forever. It also blocks the
demo's `runtime.sh finalize/restart` idle check. The current frontend only offers
"Complete local release" after preparation, so new ones should not appear.
**Decision needed (Jopia):** classify endorsement rejections like this as permanent
in the worker, and decide how to close these three demo commands. Lat did not edit
the database.

### Open decisions

- **Copy time window:** since Nov 9, Copy works only 09:00–09:29 and 16:00–16:29.
  No requirement asks for this; keep or remove.
- **Local release:** the Nov 9 work brought the frontend local-release flow back,
  which reverses the 2026-10-11 retirement recorded in DESIGN.md. Keep or retire.
- **PRC "Reports" tab:** visible because the PRC operator has `reports:read`
  (unchanged since Oct 16). Hide it for PRC if the team prefers.

## Panel revisions status (from the panel form, 2026-11-10)

Status after reading the panel form and searching the final IMRAD manuscript for each item.

| Panelist | Item | Status | Owner |
|---|---|---|---|
| Franze #1 | Forecasting model and validation with actual historical data | Partly: WAPE 60.85% (Table 10a); real-data validation still unresolved | Buno |
| Franze #2 | Justify weights and reserves; sensitivity analysis on RPS **and BROA** | Partly: RPS sensitivity is in the paper, BROA's is not; no professional consultation reported | Jopia |
| Franze #3–#5 | Multi-organization network; expand UAT; security, access control, governance | Done (Recommendations) | — |
| Franze #6 | Latency, throughput, recovery, consistency | Done (measured, Table 15a, and in Recommendations) | — |
| Franze Q1–Q3 | Consortium justification; request-to-receipt demo; disputed delivery | Done (paper; Table 15b; discrepancy flow built) | — |
| Dean Cherrie #1–#3, #5 | Dashboard expired/zero; non-batch (partial) approval; exact counts; inbound/outbound | Done | Lat |
| Dean Cherrie #4 | Report heading based on the current DOH report | Done: team spreadsheet built from the DOH report; Copy matches it, now with real cryo | Lat |
| Cruzette #1 | Proof that Lipa City hospitals agreed to participate | Not done: no proof found in the manuscript | Team |
| Cruzette #2 | Who maintains the system after the project | Done (end of Recommendations) | — |
| Cruzette #3 | Basis of the minimum inventory threshold | Partly: formula and 20 − 12 = 8 example present; reserve values are placeholders | Jopia |

The panel form's Status column is still empty; mark items OK once accepted.

### Lat's remaining work

- Assemble paper **Figures 15–19** from the Nov 7 candidate screenshots, including a
  Figure 19 note that the copied report follows the team's DOH format.
- Apply Lat's frontend manuscript wording (`docs/frontend/PANEL-MANUSCRIPT-SUGGESTIONS-2026-11-04.md`)
  as suggestions in the final IMRAD.

## Where to look in the code

| Area | Files |
|---|---|
| Dashboard cards | `apps/web/src/features/dashboard/dashboard-summary.ts`, `use-open-supply-requests.ts` |
| PRC tables | `apps/web/src/features/dashboard/prc-dashboard-placeholder.tsx`, `prc-reporting-status.ts`, `use-checkpoint-records.ts` |
| PRC chart | `apps/web/src/features/dashboard/prc-network-overview.tsx` |
| PRC Reports page | `apps/web/src/features/reporting/saved-stock-records-view.tsx` |
| Stock-record copy | `apps/web/src/features/reporting/checkpoint-copy.ts` |
| PDF exports | `apps/web/src/services/pdf/table-report.ts` |
| Cryo checkpoints | `services/api/src/census-worker.ts`, `database/migrations/20261110000000000_allow-stock-checkpoint-v2-policy.js` |
| Navigation | `apps/web/src/config/navigation.ts`, `apps/web/src/components/layout/application-shell.tsx` |
