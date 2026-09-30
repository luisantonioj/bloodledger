# V5 simulation research protocol

Status: implementation authorized by the user on 2026-09-29. Buno owns ML preparation,
evaluation and handoff; Jopia owns application persistence/API activation and Lat owns
application presentation. This protocol does not accept a clinical policy or resolve RQ-07.
Baseline: origin/main 40b8c64. V4 remains independently versioned and active.

## Frozen protocol before evaluation

Use only the external V5 workbook's Synthetic_Daily_Requests,
Synthetic_Daily_Movements, Synthetic_Daily_Stocks and ML_Training_View. Never ingest
observed sheets into training. Validate all 20 series across 2023-2026, integer counts,
classification, uniqueness, stock continuity and movement reconciliation. Recompute
features and next-day targets rather than trusting spreadsheet calculations.

Target: next-day total requested units (inpatient plus outpatient), not releases.
Origin is end of the Asia/Manila business day. WB, PRBC, FFP, PC and CRYO across
A+, B+, O+, AB+ are supported. MWB and negative-Rh forecasts are out of scope.
V4 is only an upstream provenance source for V5 generation; no V4 file is required
by the V5 runner and no V4 performance is reused.

Train target dates through 2024-12-31; validate 2025-01-01 through 2025-06-30;
test 2025-07-01 through 2025-12-31; 2026 is a demonstration extension. Exclude
27 warmup origins and the last origin with no next-day label. Compare last day,
seasonal lag seven, weighted seven, rolling mean 28, training series mean, and
Ridge regression with alpha 1, 10 and 100. Select lowest validation MAE, tie-break
by model name. Refit selected learned parameters on train plus validation only.
Use rolling one-day holdout evaluation: prior test-day observations are available
for later origins, but test labels never fit coefficients or choose the model.

Primary metrics: MAE, RMSE and WAPE (null for zero total actual demand), overall,
per component and per series. No arbitrary accuracy threshold or 100-minus-WAPE
accuracy claim. A secondary confusion matrix defines actual any-demand as units > 0
and predicted any-demand as forecast >= 0.5. It reports precision, recall,
specificity, F1, balanced accuracy, prevalence and majority baseline. It is not
accuracy of the numeric forecast or a clinical availability classifier.

Sensitivity uses three fixed Poisson resampling seeds and outpatient multipliers
0.5, 1.0 and 1.5, with the selected coefficients frozen. These are perturbation
stress tests, not additional hospital evidence or complete regenerated inventories.
A separate stock-availability stress display uses multipliers 0.5, 1.0 and 1.5;
this does not model receipts, expiry, clinical reserves or true next-day shortages.

## Integration boundary

Export a distinct V5 research bundle with institution, requested origin/horizon,
workbook/code/protocol/model/input hashes, null uncertainty and explicit unavailable
attempts. Never masquerade as the accepted V4 database/API contract. Export a
standalone simulation preview and owner handoff. Application activation requires
additive contracts, persistence, API/frontend wiring and producer-to-API tests;
keep V4 active until that verification is complete. No automatic transfer approval.

## Evidence

The executable runner, tests and generated report are authoritative for actual
results. Workbook/source records and large generated artifacts remain outside Git.
See the completed handoff for actual checks, exact hashes, results and remaining
activation work. Technical checks do not constitute human UAT or clinical validation.
