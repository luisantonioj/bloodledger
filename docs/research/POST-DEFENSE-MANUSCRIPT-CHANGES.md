# Buno manuscript changes — 2026-11-02

The research code and evidence were published first, at `5221723`, on
`codex/buno-post-defense-forecasting`. Only then was the existing Google Docs
manuscript edited in place. No application model or main-branch change occurred.

## Exact manuscript locations and changes

| Location | Change |
|---|---|
| Scope and Limitations — Analytics paragraph | Added the incomplete inpatient/external-release/stock evidence limitation; clarified synthetic versus actual-hospital forecasting claims |
| Definition of Terms — ML Demand Forecasting Module | Corrected consumption-from-stock wording to next-day requested units; removed automatic-improvement/retraining implication |
| Methodology — Machine Learning Demand Forecasting — Data sources and privacy | Verified workbook-reference coverage: 229 partial dates, 21 unknown dates, inpatient cohort, 14 uncertain release rows and 400 uncertain stock observations; no new original-file audit claimed |
| Methodology — Synthetic data | Explained frozen V4 rate-anchor provenance retained within V5, invented outpatient scaling, and unchanged workbook; no V4 workbook loaded for fitting |
| Methodology — Features and candidates | Retained eight original candidates and added the expanded 22-configuration comparison, causal histories and frozen settings |
| Methodology — Chronological evaluation | Preserved original splits/results; added expanding validation folds, selection rule, final fit cutoff and explicit previously-examined-test limitation |
| Methodology — Metrics | Added bias, underprediction and zero-demand diagnostics; retained occurrence confusion as secondary, not quantity accuracy |
| Methodology — Interface | Stated that the selected research median has not replaced the frozen mean application model |
| Forecasting Results — Tables 10, 11, 12 | Retained all original values; clarified captions as original V5 evaluation |
| Forecasting Results — new Table 10a | Added a native 23-row × 6-column table containing all 22 candidates, validation MAE/WAPE and reanalysis MAE/RMSE/WAPE |
| Forecasting Results — new post-defense paragraphs | Reported WAPE 60.85% versus 68.67%, worse RMSE, 29.23% more underpredicted units, 14 zero medians, component limitations and research-only status |
| Forecasting Results — secondary confusion/reproducibility | Added TN 2288 / FP 152 / FN 288 / TP 952; occurrence recall 76.77%; code/data lineage and replay evidence |
| Discussion — fourth-problem paragraph | Replaced universal simple-model superiority wording with the observed objective tradeoff |
| Conclusion — ML sentences | Distinguished the original mean result from exploratory median reanalysis; retained unrelated system and UAT statements |
| Recommendations — historical-demand paragraph | Required sufficiently complete, scoped future records and genuinely new evaluation; explicitly left actual-demand validation unresolved |
| References | Added Teunter, Syntetos and Babai (2011), DOI 10.1016/j.ejor.2011.05.018, for intermittent-demand methods |

This was 18 exact, unique text replacements plus one native comparison table and
scoped formatting. Readback matched all 858 expected non-empty paragraphs in order,
including table cells, with zero unintended text differences. All 16 original
tables remain; the document now has 17. The final PDF's comparison pages 45–46
were visually checked: readable 9.5 pt Arial cells, bold repeated header and intact
caption. These page numbers describe this export and may change during later edits.
No raw manuscript, private source data, before/after paragraph dump or exported PDF
is committed. Those verification artifacts remain under ignored build/.

## Repository file inventory

Tooling/protocol commit `b00445d`:

- `services/forecasting/src/bloodledger_forecasting/post_defense.py`
- `services/forecasting/tests/test_post_defense.py`
- `scripts/forecasting-research/audit_v5_references.py`
- `scripts/forecasting-research/requirements.txt`
- `scripts/forecasting-research/README.md`
- `docs/research/POST-DEFENSE-DATA-AUDIT.md`
- `docs/research/POST-DEFENSE-FORECASTING-PROTOCOL.md`

Results/handoff commit `5221723`:

- `docs/research/POST-DEFENSE-FORECASTING-EVALUATION.json`
- `docs/research/POST-DEFENSE-FORECASTING-RESULTS.md`
- `docs/handoffs/BUNO-POST-DEFENSE-FORECASTING-2026-11-02.md`

The subsequent documentation-only follow-up adds this change log and updates the
results/handoff to record manuscript completion. Evaluated code, protocol, metrics,
source workbook and original application model remain unchanged.

## Revision-form disposition

Franze #1: expanded technique comparison and manuscript clarification completed.
Actual institutional historical-demand validation remains unavailable and is
explicitly a limitation/future-work item; do not mark that portion fulfilled.
The lower synthetic WAPE is not a clinical, operational or deployment claim.
