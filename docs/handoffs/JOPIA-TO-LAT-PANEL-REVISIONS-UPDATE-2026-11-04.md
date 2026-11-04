# Jopia → Lat: panel revisions update (2026-11-04)

SIMULATION_ONLY. This adds to [the 2026-11-03 handoff](JOPIA-TO-LAT-PANEL-REVISIONS-2026-11-03.md); keep using its
ownership table and items a–h. From now on Jopia writes updates **here**, and the 2026-11-03 file's status log is
yours, so we stop editing the same lines.

## Your work in progress is not affected

Lat has edits in progress that are not pushed yet. Everything Jopia added since your base is additive and outside
`apps/web/**`, `docs/DESIGN.md` and `docs/frontend/`:

| Merged into `codex/panel-revisions-integration` | What | Effect on your branch |
|---|---|---|
| #103 | Partial approval + receipt discrepancy backend (contract you already use) | Real backend for items b and e; run `npm run migrate:up` (`20261103000000000`) |
| #104 | RPS/BROA sensitivity study (`services/coordination`, `docs/research`) | None |
| #105 | Workload and request-to-receipt evidence (`docs/validation`, `tests/api`) | None |
| #106 | Buno verification, PIN and session decisions; status lines in the 2026-11-03 handoff | Possible conflict **only** in that handoff file: keep both sides |
| This commit | `DASHBOARD_EXACT_STOCK_V1` contract (below) | None until you pick up item i |

**Rebase routine:** `git fetch --all --prune` → `git rebase origin/codex/panel-revisions-integration` → if the
2026-11-03 handoff conflicts, keep both sides' lines → `npm run migrate:up` → `npm run check:web` and `npm run test:web`.

**Please push your WIP now** as a draft PR from `codex/lat-panel-<topic>` into the integration branch, even if it
is unfinished. Jopia will check `gh pr diff` before each merge, so nothing lands on top of your files unannounced.

## New item i — Dean Cherrie #3: exact counts on the dashboard chart

The panel's concern: the dashboard chart shows estimates, not exact counts. There are two causes:

- **Bar totals.** The bar total (`confirmed` in `inventory-overview.ts`) sums every status from the old dashboard
  aggregate: dispatched, received, released, expired and compromised units, plus label-expired units still counted
  as available.
- **Hover.** The tooltip shows threshold ranges ("6–10 units") and a grey "Not eligible" remainder, never the exact
  number.

**Contract** (authoritative: `services/api/openapi-v2.json`, schema `DashboardStockCounts`; decision PA-REV-03, Proposed):
`GET /api/v2/dashboard/stock-counts` for blood-bank ROLE-01/02, own institution only.

- **`rows`:** exactly 40 rows (8 blood types × 5 components, zero-filled, fixed order). Each row has `available`,
  `reserved`, `outgoingInTransit`, `received`, `labelExpiredPendingEvaluation`, `expired`, `onHold`, `compromised`.
- **`totals`:** the same fields plus `usable` (= available + reserved, the "Total Blood Units" card).
- **Freshness:** `evaluatedAt`, `lastProjectedAt`, and `pendingCommands` (not yet ledger-confirmed; never counted).

**What the chart should do (your design calls within `docs/DESIGN.md`):**
1. Bar height and a **visible** number = exact `available`. Today the number is `aria-hidden`.
2. Hover/focus tooltip = exact counts for the statuses above, plus the band name (not just the range).
3. An "Exact counts" table toggle under the chart with the same numbers, used for copy/PDF too.
4. "As of <Asia/Manila time>", plus "N changes pending ledger confirmation" when `pendingCommands > 0`. Refresh
   after a committed transaction and on the existing poll.
5. Keep the band colours, derived from `available`. Drop the grey "Not eligible" remainder, since those units now
   have their own exact fields.

Use route mocks until Jopia's backend PR for this endpoint merges. Item i touches the same dashboard files as items
a and b, so do it after them.

## Decisions since 2026-11-03

- **Operator PIN:** six digits in the manuscript. Both hosts already run `SYNTHETIC_OPERATOR_PIN_6_V1`.
- **Sessions:** the 8-hour cap is accepted (15-minute idle limit).
- **Manuscript:** every edit stays a **suggestion** while code changes. The owner accepts them manually later.
  Edit only frontend sections, in Suggesting mode.
- **Buno:** her manuscript edits are still to come. No action for you.
