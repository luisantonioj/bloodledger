from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd

from bloodledger_forecasting.modeling import (
    FEATURE_COLUMNS,
    build_feature_frame,
    evaluate_models,
    make_folds,
    select_model,
    train_model,
    write_model_artifact,
)


def test_features_use_only_prior_observations(synthetic_data: pd.DataFrame) -> None:
    target_date = pd.Timestamp("2025-03-01")
    original = build_feature_frame(synthetic_data)
    changed = synthetic_data.copy()
    changed.loc[changed["business_date"] >= target_date, "requested_units"] += 1000
    recomputed = build_feature_frame(changed)

    keys = ["business_date", "institution_id", "blood_type", "component"]
    original_target = original.loc[original["business_date"] == target_date].sort_values(keys)
    changed_target = recomputed.loc[recomputed["business_date"] == target_date].sort_values(keys)
    pd.testing.assert_frame_equal(
        original_target.loc[:, FEATURE_COLUMNS].reset_index(drop=True),
        changed_target.loc[:, FEATURE_COLUMNS].reset_index(drop=True),
    )

    prior_changed = synthetic_data.copy()
    prior_changed.loc[
        prior_changed["business_date"] == target_date - pd.Timedelta(days=1),
        "requested_units",
    ] += 1
    prior_features = build_feature_frame(prior_changed)
    assert (
        not original_target["lag_1"]
        .reset_index(drop=True)
        .equals(
            prior_features.loc[prior_features["business_date"] == target_date, "lag_1"].reset_index(
                drop=True
            )
        )
    )


def test_locked_fold_boundaries(synthetic_data: pd.DataFrame) -> None:
    folds = make_folds(pd.DatetimeIndex(synthetic_data["business_date"]))
    assert len(folds) == 6
    assert folds[0].train_end == pd.Timestamp("2025-06-29")
    assert folds[0].validation_start == pd.Timestamp("2025-06-30")
    assert folds[4].validation_end == pd.Timestamp("2025-11-26")
    assert folds[5].validation_start == pd.Timestamp("2025-11-27")
    assert folds[5].validation_end == pd.Timestamp("2025-12-31")


def _selection_metrics(
    seasonal: float, weighted: float, forest: float, forest_series: float | None = None
) -> dict[str, Any]:
    series_keys = [
        "A_POSITIVE|PLATELETS",
        "A_POSITIVE|RED_BLOOD_CELLS",
        "O_POSITIVE|PLATELETS",
        "O_POSITIVE|RED_BLOOD_CELLS",
    ]
    per_series = forest if forest_series is None else forest_series
    return {
        "seasonal_naive_7": {
            "pooled": {"mae": seasonal},
            "series": {key: {"mae": seasonal} for key in series_keys},
        },
        "weighted_average_7": {
            "pooled": {"mae": weighted},
            "series": {key: {"mae": weighted} for key in series_keys},
        },
        "random_forest_global": {
            "pooled": {"mae": forest},
            "series": {key: {"mae": per_series} for key in series_keys},
        },
    }


def test_selection_promotes_only_when_both_guards_pass() -> None:
    selected, evidence = select_model(_selection_metrics(1.0, 1.1, 0.9))
    assert selected == "random_forest_global"
    assert evidence["pooled_pass"] is True
    assert evidence["series_pass"] is True

    selected, evidence = select_model(_selection_metrics(1.0, 1.1, 0.9, 1.2))
    assert selected == "seasonal_naive_7"
    assert evidence["series_pass"] is False


def test_selection_uses_weighted_baseline_for_exact_tie() -> None:
    selected, _ = select_model(_selection_metrics(1.0, 1.0, 1.1))
    assert selected == "weighted_average_7"


def test_backtest_reports_required_metrics_without_mape(synthetic_data: pd.DataFrame) -> None:
    predictions, metrics, folds = evaluate_models(synthetic_data)
    assert set(predictions["model"]) == {
        "seasonal_naive_7",
        "weighted_average_7",
        "random_forest_global",
    }
    assert set(predictions["fold"]) == set(range(1, 7))
    assert len(folds) == 6
    for model_metrics in metrics.values():
        assert set(model_metrics["pooled"]) == {"mae", "wape", "rmse"}
        assert "mape" not in model_metrics["pooled"]


def test_model_artifact_is_reproducible(
    tmp_path: Path, synthetic_data: pd.DataFrame, dataset_path: Path
) -> None:
    source_root = Path(__file__).resolve().parents[1] / "src" / "bloodledger_forecasting"
    first, first_manifest = train_model(
        synthetic_data, dataset_path=dataset_path, source_root=source_root
    )
    second, second_manifest = train_model(
        synthetic_data, dataset_path=dataset_path, source_root=source_root
    )
    first_path = tmp_path / "first.pkl"
    second_path = tmp_path / "second.pkl"
    assert write_model_artifact(first, first_path) == write_model_artifact(second, second_path)
    assert first_manifest == second_manifest
