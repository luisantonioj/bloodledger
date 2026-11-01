# Post-defense data audit — 2026-11-01

Buno research / SIMULATION_ONLY. Audit basis: the locally supplied V5 workbook,
SHA-256 `5c5997bd4df26f6f0d52d7ea13dde0172706faaa15308ebc87f241f44c241ddb`.
This equals the original V5 evaluation's workbook hash. No source was altered.
The original request Excel and source images were not independently re-audited
in this run; conclusions below describe the workbook's retained references.

| Reference | Verified coverage / limitation |
|---|---|
| Frozen inpatient aggregate | 955 date/category rows; 229 represented dates within Jan 1–Sep 7, 2026; 21 unrecorded dates |
| Revised inpatient aggregate | Same date coverage and row count; descriptive recovery remains separate from frozen calibration |
| Coverage register | Both scopes mark 229 dates PARTIAL_RECORDED_DATE and 21 UNKNOWN_NO_ACCEPTED_RECORDS; no date certified as zero demand |
| Outpatient/external release samples | 14 rows, zero confirmed release dates; all row-unit quantities unconfirmed; outpatient versus external care setting remains unconfirmed at row level |
| Stock photographs | 400 component/category observations; 300 have no visible year and 100 an unverified year; Rh and available-stock status unknown for all 400 |
| Earlier census reference | 48 rows, not a continuous daily stock history |

User confirmed the original request extract is **inpatient**, not outpatient.
The outpatient/external reference records releases, not total requests. Missing
request dates remain unknown, even where the synthetic workbook has generated
zero counts. Sample stock differences cannot isolate requests from receipts,
releases, expiry, reservations and corrections.

The inability to validate combined institutional demand follows from incomplete
coverage, uncertain sample interpretation and mismatched outcomes—not a universal
rule that nine months is too short for all forecasting research. No claim is made
that the partial extract is useless for descriptive analysis or a separately
scoped, approved inpatient pilot.

V5's inpatient scale anchors derive from frozen V4 Scenario_Rates. Its outpatient
rate (20% of the floored inpatient anchor), minimum rate .03, seasonal amplitude,
trend and inventory transitions are scenario assumptions. No observed rows are
mixed into the synthetic target history, but the synthetic series are not wholly
independent of the observed scale anchors. No V4 workbook was loaded for fitting.
The unchanged V5 includes this upstream provenance.

Private audit details (including the missing-date list) stay under ignored build/.
Reproduce with `scripts/forecasting-research/audit_v5_references.py --workbook PATH
--output NEW_PRIVATE_JSON` using openpyxl 3.1.5. Do not publish raw reference sheets.
