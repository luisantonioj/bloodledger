# Accepted project demonstration stock bands — 2026-10-15

SIMULATION_ONLY. User Yuri, acting as Lat, explicitly approves the exact differentiated
40-series table proposed in Handoff Handler and instructs implementation. User
reports Jopia/Buno acceptance. This is user-supplied project acceptance; independent
institutional clinical approval is not established. Lat implements frontend.

This later explicit instruction supersedes the earlier no-demo-policy decision
and frontend freeze only for this requested demonstration change. defense-baseline.1
remains the immutable previous paper baseline; do not relabel its screenshots.
The uniform earlier table and 150-unit illustration are not this accepted policy.

Authoritative immutable table and metadata:
`apps/web/src/features/dashboard/policy/synthetic-stock-classification-v1.json`.
Version SYNTHETIC_STOCK_CLASSIFICATION_V1. Effective 2026-10-15 Asia/Manila.
All eight groups × five components evaluated separately within the authenticated
blood bank. No institution or component pooling. Three inclusive upper limits
mean Critical 0..C, Low C+1..L, Adequate L+1..A, Surplus A+1 upward.
This table is invented for the official project demonstration, not estimated from
institutional/world demand, not a medical stock-level recommendation.

Frontend reads complete own-institution /api/v2/components using V2.1, including
Cryo. Only AVAILABLE, CURRENT expiry-state, no reservation and expiresAt strictly
later than evaluation enter the demonstration measure. Other ledger states and
label-expired stock are excluded. No state mutation or FEFO/transfer authorization.
Unresolved additional clinical eligibility remains outside this display.

Successful complete empty reads establish zero for supported combinations.
Missing/invalid/foreign/duplicate evidence stays unavailable. Component reads
refresh every 30 seconds while visible; errors immediately clear classification;
read age >60 seconds invalidates bands; a 1-second clock check excludes units
that expire between refreshes. This is a new demo display freshness convention,
not an institutional freshness SLA. Existing aggregate projection age is shown
as recorded; bar heights remain confirmed counts, colors use eligible counts
with accessible eligible-count explanations. Unsupported legacy codes stay neutral.
No evaluated backend read contract is invented or existing backend schema changed.

Forecast-derived source surplus stays separately on Analytics with model/time
provenance. A dashboard Surplus band is above the configured stock band only;
it does not determine transferable quantity, forecast surplus or redistribution
approval. Existing source-surplus 2/10 values are never used as classification
cutoffs. V4 remains default; V5 remains explicit preview. No data/census/model
regeneration, account change, queue submission, FEFO relaxation or domain write.
RQ-16 remains open for real institutional stock policy; FR-04 is partially
implemented, with accepted demo bands now available. Human UAT/clinical/phase
acceptance not implied. Further table changes require a new immutable version.

## Lat validation and continuation

- npm run check:web PASS (existing large-bundle warning).
- npm run test:web PASS: 236 tests / 37 files, including exact boundaries for
  all 40 policy series, zero/unsupported input and eligibility/staleness cases.
- npm exec --workspace @bloodledger/web -- playwright test
  dashboard-inventory-overview.spec.ts defense-analytics.spec.ts
  initial-page-layout.spec.ts --workers=1: 23 PASS, synthetic HTTP fixtures.
- npm run scan:secrets and git diff --check PASS.
- Real ordinary Mediatrix login at 127.0.0.1:5174 PASS, no intercepted reads:
  40 series classify as 25 Critical, 0 Low, 9 Adequate and 6 Surplus at capture.
  Low is implemented/tested but no current series falls in its approved interval;
  no inventory or threshold was changed to fabricate an example.
- PRBC selector: eight groups; A+ 40 confirmed / 38 eligible → Adequate,
  O+ 18 confirmed / 16 eligible → Critical. Heights and color measures differ
  deliberately and are labeled. Expired labels/reservations are excluded.
- Queue unchanged: UAT worker running, pending V1/V2 0, writer lock 0,
  595 committed commands. Census and V5 not rerun; data preserved.

Private captures and live script: build/lat-population-v3/official-stock-bands-live.
Earlier frozen paper screenshots remain historical; new UI is this later
explicitly requested follow-up. No new merge/tag is claimed. Prior handoffs
remain historical.

## Cumulative segment presentation clarification

Yuri clarified that each bar must fill cumulative threshold ranges rather than
use one color for its final classification. A+ FFP with 60 eligible units shows
red 0–10, Low 11–24, Adequate 25–48 and Surplus 49–60. Threshold 48 belongs
to Adequate; Surplus begins at 49. No immutable policy value changed.
Hover/focus/tap help shows the full policy range (Surplus 49+) and a short
explanation. The example's numeric widths are 10/14/24/12; shared chart
endpoints are geometric boundaries, not overlapping integer classifications.
Actual current A+ FFP may include reserved/ineligible units; those remain gray
at the top rather than misrepresenting them as eligible surplus. Existing
counts, eligibility, freshness and transfer-authorization boundaries remain.

Segment follow-up validation: check:web PASS; 240 unit tests / 37 files PASS;
13 affected browser tests PASS, including exact A+ FFP 60-unit segmentation,
hover text, keyboard focus/Escape and tap behavior. Live ordinary Mediatrix
login verified cumulative FFP segments and the 25–48 Adequate tooltip. Captures:
build/lat-population-v3/official-stock-bands-live/segmented-ffp-tooltip.png.
Gitleaks and whitespace checks PASS. No inventory/domain mutation.
