# Post-defense forecasting results — 2026-11-02

Buno / SIMULATION_ONLY / self-validation. Research only; no application replacement.

## Outcome

Chronological validation selected **series_median** from 22 frozen configurations. On the previously examined July–December 2025 period, WAPE decreased from 68.67% to 60.85% (7.82 percentage points; 11.38% relative reduction). This is post-defense reanalysis, not a new untouched test or actual hospital validation.

**Do not replace the application model on this evidence.** The median improves the selected absolute-error objective but underpredicts more units and has worse RMSE. All WB, FFP and CRYO forecasts are zero. No operational accuracy, shortage protection, release or redistribution approval follows.

| Measure | Original frozen mean | Selected research median |
|---|---:|---:|
| MAE | 0.6645 | 0.5889 |
| RMSE | 1.2651 | 1.2924 |
| WAPE (%) | 68.6715 | 60.8537 |
| Mean bias (prediction − requested) | 0.0791 | -0.1677 |
| Fraction of series-days underpredicted | 0.1891 | 0.1891 |
| Total underpredicted units | 1077.1278 | 1392.0000 |
| Total overpredicted units | 1368.2636 | 775.0000 |
| Total predicted units | 3852.1357 | 2944.0000 |
| MAE on zero-demand rows | 0.2731 | 0.1246 |

Both use 3680 identical test series-days, 3561 requested units and 2440 zero-demand rows. Total underpredicted units rise by 29.23%. These are forecast residuals, not measured shortages or unmet patient needs.

## Chronology and comparison

Expanding validation folds: July–December 2024 (3,680 rows), January–March 2025 (1,800), April–June 2025 (1,820). Each fit uses earlier targets only. Selection uses pooled validation MAE over 7,300 rows, then a name tie-break. The first fold overlaps the original training era; these validation numbers must not be compared as if they used the original single validation period. Final fitting ends June 30, 2025. Earlier observations update causal state, never future targets or fitted test parameters. The 2026 extension remains excluded.

| Candidate | Validation MAE | Validation WAPE % | Reanalysis MAE | Reanalysis RMSE | Reanalysis WAPE % |
|---|---:|---:|---:|---:|---:|
| series_median | 0.6432 | 61.59 | 0.5889 | 1.2924 | 60.85 |
| seasonal_median_8 | 0.6814 | 65.25 | 0.6334 | 1.3684 | 65.46 |
| boost_poisson_7 | 0.7052 | 67.54 | 0.6552 | 1.2635 | 67.71 |
| mean_28 | 0.7062 | 67.63 | 0.6511 | 1.2721 | 67.29 |
| boost_poisson_15 | 0.7063 | 67.63 | 0.6547 | 1.2745 | 67.66 |
| ridge_10 | 0.7064 | 67.64 | 0.6334 | 1.2591 | 65.46 |
| ridge_1 | 0.7064 | 67.65 | 0.6332 | 1.2592 | 65.44 |
| ridge_100 | 0.7066 | 67.67 | 0.6349 | 1.2590 | 65.61 |
| sba_0.1 | 0.7080 | 67.80 | 0.6530 | 1.2807 | 67.48 |
| series_mean | 0.7091 | 67.91 | 0.6645 | 1.2651 | 68.67 |
| tsb_0.1 | 0.7116 | 68.14 | 0.6567 | 1.2840 | 67.87 |
| ses_0.1 | 0.7125 | 68.23 | 0.6575 | 1.2857 | 67.95 |
| seasonal_median_4 | 0.7217 | 69.11 | 0.6717 | 1.4273 | 69.42 |
| sba_0.3 | 0.7227 | 69.20 | 0.6613 | 1.3346 | 68.34 |
| tsb_0.3 | 0.7406 | 70.92 | 0.6819 | 1.3474 | 70.46 |
| ses_0.3 | 0.7434 | 71.19 | 0.6840 | 1.3535 | 70.69 |
| weighted_7 | 0.7443 | 71.28 | 0.6835 | 1.3549 | 70.63 |
| last_day | 0.9019 | 86.37 | 0.8462 | 1.7693 | 87.45 |
| seasonal_7 | 0.9079 | 86.95 | 0.8440 | 1.7665 | 87.22 |
| boost_absolute_error_15 | 1.0328 | 98.90 | 0.9666 | 2.1107 | 99.89 |
| boost_absolute_error_7 | 1.0328 | 98.90 | 0.9666 | 2.1107 | 99.89 |
| zero | 1.0442 | 100.00 | 0.9677 | 2.1127 | 100.00 |

No candidate configuration was changed after inspecting these test results. All attempts are retained privately: run-01 (Python 3.12 preliminary); run-02-py313 (Python 3.13, artifact packaging); run-03-final (type annotation cleanup); run-04-verified (final type-clean code); run-05-replay (exact replay). Changes between attempts were environment/typing/artifact packaging, not models, folds, data, thresholds or hyperparameters.

## Selected-model component results

| Component | MAE | RMSE | WAPE % | Mean bias | Underpredicted units |
|---|---:|---:|---:|---:|---:|
| CRYO | 0.1196 | 0.4299 | 100.00 | -0.1196 | 88 |
| FFP | 0.1617 | 0.4932 | 100.00 | -0.1617 | 119 |
| PC | 1.0272 | 1.6360 | 60.67 | -0.1929 | 449 |
| PRBC | 1.6060 | 2.2842 | 56.66 | -0.3342 | 714 |
| WB | 0.0299 | 0.1729 | 100.00 | -0.0299 | 22 |

All 20 per-series results, including zero-demand diagnostics for every candidate, are in POST-DEFENSE-FORECASTING-EVALUATION.json. No weekly aggregation, hidden series exclusion or denominator change was used to lower WAPE.

## Secondary demand-occurrence confusion matrix

| Actual / predicted | No demand | Any demand |
|---|---:|---:|
| No demand | 2288 | 152 |
| Any demand | 288 | 952 |

Actual > 0; prediction ≥ 0.5. Accuracy 88.04%, precision 86.23%, recall 76.77%, F1 81.23%, balanced accuracy 85.27%. This is occurrence classification, **not numeric forecast accuracy**. Original mean-model occurrence recall was 87.50%; the median's lower recall reinforces the limitation.

## Evidence and preservation

| Artifact | SHA-256 |
|---|---|
| Unchanged V5 workbook | `5c5997bd4df26f6f0d52d7ea13dde0172706faaa15308ebc87f241f44c241ddb` |
| Protocol | `c2bc54a1133eba151c1be8f47aa1862af41b6e89501593eb8ae8ffd1dd234b0f` |
| Research module | `cd0d4f0b050428311b5c9daaf9419dfe48ac801c3e3fdf23fb8c7909bc751cd3` |
| Unchanged V5 module | `0acda319a60ab946e6172a047dad569668cf973889e1976d7e6c11d09d9d5d64` |
| Selected private research artifact | `43f7ae7509377b176c55822d37500626c455c4a6f03ab85efcc037de9dae161a` |
| Final private evaluation.json | `a38005c2ae8828a85baaceac9dfc54a571f60f7924acfcd321c27c3a8194cc55` |
| Final private selected-predictions.csv | `0765b1cbcedea56e7d97435bfeeec38f97d470783ab77b1219a1839299b7c4f1` |

The median artifact includes twenty fitted medians and their blood-group/component mapping. It is not a deployed mean-model artifact. The original V5 evaluation and model contract remain unchanged. The V4 workbook is not required; V5 retains frozen V4 rate-anchor provenance. See POST-DEFENSE-DATA-AUDIT.md for observed-data scope and uncertainty.

## Limits and acceptance

No independent institutional test set, clinical validation, UAT outcome or operational policy is established. Lower absolute error partly rewards zero forecasts in sparse series; shortage-oriented acceptance criteria remain open under RQ-07. Both simple and complex methods were compared, but this does not establish that simple methods are universally preferable. This comparison is exploratory because the original test period was already examined.

Franze #1 revision wording: "Expanded the reproducible comparison from eight to twenty-two configurations on the unchanged synthetic V5 dataset using chronological validation, and reported error, bias, underprediction and demand-occurrence results. Actual combined institutional-demand validation remains unavailable because the supplied records are incomplete and scope-limited; this unmet portion is stated in limitations and future work."

The code/GitHub stage preceded manuscript editing. The paper was subsequently revised on 2026-11-02; see POST-DEFENSE-MANUSCRIPT-CHANGES.md for exact locations and verification.
