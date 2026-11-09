# Post-defense forecasting protocol V1

Status: Accepted for research execution by Buno's user instruction, 2026-11-01.
Classification: SIMULATION_ONLY. Linked: FR-14 forecasting / RQ-07 and Testing-phase BL-TST-01.
This extends ML-V5-EXPLORATION.md; it does not supersede its results or runtime contract.

## Frozen experiment

Use the unchanged V5 workbook, the original four synthetic allowlisted sheets and
recomputed features/targets, 20 positive-Rh/component series, and next-day total
requested units. Observed reference sheets are audited separately and never fit.
Do not regenerate data or impute missing observations. The original eight models
remain comparisons, with zero as a diagnostic, series median, matching-weekday
medians over 4/8 weeks, SES, Croston-SBA and TSB (alpha 0.1/0.3), and histogram
gradient boosting (absolute-error/Poisson loss, 7/15 leaves). Boosting uses the
original causal design matrix, 100 iterations, learning rate .05, minimum 30
samples/leaf, L2=1, random seed 20261101 and no random early-stopping split.
TSB uses the same alpha for size and occurrence. SBA initializes size and interval
at the first nonzero observation; TSB probability starts at zero. State only uses
observations through each origin. Seasonal medians use available prior matching
weekdays; the common original 28-day eligibility is unchanged.

Expanding validation folds: Jul–Dec 2024, Jan–Mar 2025, Apr–Jun 2025. Each fit uses
eligible targets strictly before its fold. Select lowest pooled validation MAE,
with model-name tie break. On identical rows WAPE and MAE rankings are equivalent.
The first fold overlaps the original training era; disclose this revised protocol.
Freeze selection before scoring Jul–Dec 2025. Fit learned parameters through Jun 30
2025 only. Earlier test observations may update causal history for later origins,
never fitted parameters. 2026 remains a demonstration extension, not a fresh test.

The original Jul–Dec 2025 test was already examined and prompted this work. All new
results on it are post-defense reanalysis, not independent confirmatory evidence.
Do not iterate candidates based on test results. Preserve all attempts. No promise
of lower error. Compare all models on the same target rows. Report MAE/RMSE/WAPE,
mean signed bias (prediction minus actual), fraction of underpredicted series-days,
missing units, excess predictions, and zero-demand MAE overall/component/series.
WAPE is null at zero total demand. Report the selected model's any-demand confusion
matrix (>0 actual, >=.5 prediction) separately from quantity error. Lower absolute
error can favor medians/zero and does not imply safe shortage protection.

## Preservation and reproducibility

Run the separate `bloodledger_forecasting.post_defense` module with explicit workbook,
protocol and a new private `build/` output directory. Never overwrite an attempt.
Hash workbook, both code modules, protocol and selected research configuration;
record exact dependency versions. Configuration plus pinned code/data reproduces
research fitting; it is deliberately not a deployable runtime model artifact.
Preserve original ML-V5-EVALUATION.json and selected_model.json. No V4 workbook is
needed; V4 remains upstream provenance. No application/model/default/API change.
Additional candidates or changed folds require a new protocol version.

## Method references

- Teunter, Syntetos and Babai (2011), *Intermittent demand: Linking forecasting to
  inventory obsolescence*, European Journal of Operational Research 214, 606–615,
  https://doi.org/10.1016/j.ejor.2011.05.018 (Croston/SBA/TSB context).
- scikit-learn HistGradientBoostingRegressor documentation:
  https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.HistGradientBoostingRegressor.html
  (implementation version is pinned and recorded in each result).
