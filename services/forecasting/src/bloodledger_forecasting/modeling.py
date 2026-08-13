"""Leakage-safe one-day demand model evaluation and selection."""

from __future__ import annotations

import hashlib
import json
import math
import pickle
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from .constants import (
    CLASSIFICATION,
    DATASET_VERSION,
    DEFAULT_SEED,
    EVALUATION_CLASSIFICATION,
    GENERATOR_VERSION,
    MODEL_VERSION,
    SERIES_COLUMNS,
)
from .errors import ForecastingError
from .validation import sha256_file, validate_dataset

TARGET_COLUMN = "requested_units"
MODEL_NAMES = ("seasonal_naive_7", "weighted_average_7", "random_forest_global")
FEATURE_COLUMNS = (
    "blood_type",
    "component",
    "weekday",
    "month",
    "lag_1",
    "lag_7",
    "weighted_7",
    "mean_14",
)
NUMERIC_FEATURES = ("weekday", "month", "lag_1", "lag_7", "weighted_7", "mean_14")
CATEGORICAL_FEATURES = ("blood_type", "component")


@dataclass(frozen=True)
class Fold:
    """One expanding-window, one-day-ahead validation fold."""

    fold: int
    train_end: pd.Timestamp
    validation_start: pd.Timestamp
    validation_end: pd.Timestamp


def build_feature_frame(data: pd.DataFrame) -> pd.DataFrame:
    """Create only shifted demand features, so the target day is never an input."""

    ordered = data.sort_values([*SERIES_COLUMNS, "business_date"], kind="stable").copy()
    grouped = ordered.groupby(list(SERIES_COLUMNS), sort=False)[TARGET_COLUMN]
    ordered["lag_1"] = grouped.shift(1)
    ordered["lag_7"] = grouped.shift(7)
    ordered["weighted_7"] = grouped.transform(
        lambda values: (
            values.shift(1)
            .rolling(7)
            .apply(lambda window: float(np.dot(window, np.arange(1, 8)) / 28.0), raw=True)
        )
    )
    ordered["mean_14"] = grouped.transform(lambda values: values.shift(1).rolling(14).mean())
    ordered["weekday"] = ordered["business_date"].dt.weekday.astype("int64")
    ordered["month"] = ordered["business_date"].dt.month.astype("int64")
    return ordered


def make_folds(dates: pd.DatetimeIndex) -> list[Fold]:
    """Create the locked 180 + 5x30 + 35 expanding-window split."""

    unique_dates = pd.DatetimeIndex(sorted(pd.unique(dates)))
    if len(unique_dates) != 365:
        raise ForecastingError(
            "TRAINING_RANGE_INVALID", "SYNTHETIC_FORECAST_V1 must contain 365 days"
        )

    validation_lengths = [30, 30, 30, 30, 30, 35]
    folds: list[Fold] = []
    position = 180
    for fold_number, length in enumerate(validation_lengths, start=1):
        validation_dates = unique_dates[position : position + length]
        folds.append(
            Fold(
                fold=fold_number,
                train_end=unique_dates[position - 1],
                validation_start=validation_dates[0],
                validation_end=validation_dates[-1],
            )
        )
        position += length
    if position != len(unique_dates):
        raise AssertionError("Locked validation folds must consume all 365 days")
    return folds


def _new_random_forest() -> Pipeline:
    preprocessing = ColumnTransformer(
        transformers=[
            (
                "categories",
                OneHotEncoder(handle_unknown="error", sparse_output=False),
                list(CATEGORICAL_FEATURES),
            ),
            ("numeric", "passthrough", list(NUMERIC_FEATURES)),
        ],
        remainder="drop",
    )
    regressor = RandomForestRegressor(
        n_estimators=300,
        max_depth=5,
        min_samples_leaf=3,
        random_state=DEFAULT_SEED,
        n_jobs=1,
    )
    return Pipeline([("preprocessing", preprocessing), ("regressor", regressor)])


def _metric_values(actual: pd.Series, predicted: pd.Series) -> dict[str, float]:
    residual = actual.to_numpy(dtype=float) - predicted.to_numpy(dtype=float)
    absolute = np.abs(residual)
    denominator = float(np.abs(actual.to_numpy(dtype=float)).sum())
    return {
        "mae": float(absolute.mean()),
        "wape": float(absolute.sum() / denominator * 100.0) if denominator else 0.0,
        "rmse": float(math.sqrt(np.mean(np.square(residual)))),
    }


def _summarize_predictions(predictions: pd.DataFrame) -> dict[str, Any]:
    metrics: dict[str, Any] = {}
    for model_name, model_rows in predictions.groupby("model", sort=True):
        series_metrics: dict[str, dict[str, float]] = {}
        for (blood_type, component), series_rows in model_rows.groupby(
            ["blood_type", "component"], sort=True
        ):
            series_key = f"{blood_type}|{component}"
            series_metrics[series_key] = _metric_values(
                series_rows["actual"], series_rows["prediction"]
            )
        metrics[str(model_name)] = {
            "pooled": _metric_values(model_rows["actual"], model_rows["prediction"]),
            "series": series_metrics,
        }
    return metrics


def select_model(metrics: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    """Apply the accepted promotion and deterministic baseline tie-break rules."""

    seasonal_mae = float(metrics["seasonal_naive_7"]["pooled"]["mae"])
    weighted_mae = float(metrics["weighted_average_7"]["pooled"]["mae"])
    forest_mae = float(metrics["random_forest_global"]["pooled"]["mae"])

    pooled_pass = forest_mae <= 0.95 * seasonal_mae and forest_mae <= 0.95 * weighted_mae
    series_pass = True
    series_evidence: dict[str, dict[str, float | bool]] = {}
    for series_key in metrics["random_forest_global"]["series"]:
        candidate = float(metrics["random_forest_global"]["series"][series_key]["mae"])
        best_baseline = min(
            float(metrics["seasonal_naive_7"]["series"][series_key]["mae"]),
            float(metrics["weighted_average_7"]["series"][series_key]["mae"]),
        )
        passed = candidate <= 1.10 * best_baseline if best_baseline else candidate == 0.0
        series_pass = series_pass and passed
        series_evidence[series_key] = {
            "candidate_mae": candidate,
            "best_baseline_mae": best_baseline,
            "passed": passed,
        }

    if pooled_pass and series_pass:
        selected = "random_forest_global"
    elif seasonal_mae < weighted_mae:
        selected = "seasonal_naive_7"
    else:
        selected = "weighted_average_7"

    return selected, {
        "rule": "RF_5_PERCENT_POOLED_AND_MAX_10_PERCENT_SERIES_REGRESSION",
        "pooled_pass": pooled_pass,
        "series_pass": series_pass,
        "series_evidence": series_evidence,
        "baseline_tie_break": "weighted_average_7",
        "selected_model": selected,
    }


def evaluate_models(data: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, Any], list[Fold]]:
    """Walk forward through locked folds using only prior-day observations."""

    validated = validate_dataset(data)
    features = build_feature_frame(validated)
    eligible = features.dropna(subset=list(NUMERIC_FEATURES)).copy()
    folds = make_folds(pd.DatetimeIndex(validated["business_date"]))
    prediction_parts: list[pd.DataFrame] = []

    for fold in folds:
        train = eligible.loc[eligible["business_date"] <= fold.train_end]
        validation = eligible.loc[
            (eligible["business_date"] >= fold.validation_start)
            & (eligible["business_date"] <= fold.validation_end)
        ].copy()
        if train.empty or validation.empty:
            raise ForecastingError("TRAINING_FOLD_EMPTY", "A locked fold has no rows")

        baselines = {
            "seasonal_naive_7": validation["lag_7"].to_numpy(dtype=float),
            "weighted_average_7": validation["weighted_7"].to_numpy(dtype=float),
        }
        random_forest = _new_random_forest()
        random_forest.fit(train.loc[:, FEATURE_COLUMNS], train[TARGET_COLUMN])
        baselines["random_forest_global"] = random_forest.predict(
            validation.loc[:, FEATURE_COLUMNS]
        )

        for model_name, prediction in baselines.items():
            part = validation.loc[
                :, ["business_date", "institution_id", "blood_type", "component"]
            ].copy()
            part["fold"] = fold.fold
            part["model"] = model_name
            part["actual"] = validation[TARGET_COLUMN].to_numpy(dtype=float)
            part["prediction"] = np.maximum(0.0, prediction)
            prediction_parts.append(part)

    predictions = pd.concat(prediction_parts, ignore_index=True)
    metrics = _summarize_predictions(predictions)
    return predictions, metrics, folds


def hash_source_tree(source_root: Path) -> str:
    """Hash tracked forecasting Python source by relative path and bytes."""

    digest = hashlib.sha256()
    for path in sorted(source_root.rglob("*.py")):
        if "__pycache__" in path.parts:
            continue
        digest.update(path.relative_to(source_root).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def train_model(
    data: pd.DataFrame,
    *,
    dataset_path: Path,
    source_root: Path,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Evaluate, select, and refit the model while preserving full lineage."""

    validated = validate_dataset(data)
    predictions, metrics, folds = evaluate_models(validated)
    selected_model, selection_evidence = select_model(metrics)
    features = build_feature_frame(validated).dropna(subset=list(NUMERIC_FEATURES))
    fitted_model: Pipeline | None = None
    if selected_model == "random_forest_global":
        fitted_model = _new_random_forest()
        fitted_model.fit(features.loc[:, FEATURE_COLUMNS], features[TARGET_COLUMN])

    selected_predictions = predictions.loc[predictions["model"] == selected_model].copy()
    residual_quantiles: dict[str, float] = {}
    for (blood_type, component), rows in selected_predictions.groupby(
        ["blood_type", "component"], sort=True
    ):
        series_key = f"{blood_type}|{component}"
        residual_quantiles[series_key] = float(
            np.quantile(np.abs(rows["actual"] - rows["prediction"]), 0.95)
        )

    config = {
        "target": TARGET_COLUMN,
        "seed": DEFAULT_SEED,
        "features": list(FEATURE_COLUMNS),
        "models": list(MODEL_NAMES),
        "random_forest": {
            "n_estimators": 300,
            "max_depth": 5,
            "min_samples_leaf": 3,
            "random_state": DEFAULT_SEED,
            "n_jobs": 1,
        },
        "split": {"initial_days": 180, "validation_days": [30, 30, 30, 30, 30, 35]},
        "promotion": {
            "pooled_improvement": 0.05,
            "maximum_series_regression": 0.10,
            "baseline_tie_break": "weighted_average_7",
        },
    }
    config_bytes = json.dumps(config, sort_keys=True, separators=(",", ":")).encode("utf-8")
    artifact = {
        "artifact_format": "BLOODLEDGER_FORECAST_MODEL_V1",
        "model_version": MODEL_VERSION,
        "selected_model": selected_model,
        "fitted_model": fitted_model,
        "residual_quantiles": residual_quantiles,
        "dataset_sha256": sha256_file(dataset_path),
        "code_sha256": hash_source_tree(source_root),
        "environment_sha256": sha256_file(source_root.parents[1] / "requirements.lock"),
        "config_sha256": hashlib.sha256(config_bytes).hexdigest(),
        "training_start": validated["business_date"].min().date().isoformat(),
        "training_end": validated["business_date"].max().date().isoformat(),
    }
    manifest = {
        "schema_version": "BLOODLEDGER_MODEL_MANIFEST_V1",
        "classification": EVALUATION_CLASSIFICATION,
        "model_version": MODEL_VERSION,
        "selected_model": selected_model,
        "target": TARGET_COLUMN,
        "dataset": {
            "name": dataset_path.name,
            "sha256": artifact["dataset_sha256"],
            "classification": CLASSIFICATION,
            "dataset_version": DATASET_VERSION,
            "generator_version": GENERATOR_VERSION,
            "seed": DEFAULT_SEED,
            "start_date": artifact["training_start"],
            "end_date": artifact["training_end"],
        },
        "code_sha256": artifact["code_sha256"],
        "environment_sha256": artifact["environment_sha256"],
        "config": config,
        "config_sha256": artifact["config_sha256"],
        "folds": [
            {
                "fold": fold.fold,
                "train_end": fold.train_end.date().isoformat(),
                "validation_start": fold.validation_start.date().isoformat(),
                "validation_end": fold.validation_end.date().isoformat(),
            }
            for fold in folds
        ],
        "metrics": metrics,
        "selection_evidence": selection_evidence,
        "residual_interval": "SERIES_ABSOLUTE_RESIDUAL_95TH_PERCENTILE",
        "limitations": [
            "Synthetic data only; metrics do not estimate Mediatrix performance.",
            "RQ-07 is unresolved; outputs cannot justify operational use.",
            "One-day demand forecasts do not approve redistribution or transfer.",
        ],
    }
    return artifact, manifest


def write_model_artifact(artifact: dict[str, Any], path: Path) -> str:
    """Write the fitted artifact and return its SHA-256 digest."""

    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as destination:
        pickle.dump(artifact, destination, protocol=5)
    return sha256_file(path)


def load_model_artifact(path: Path) -> dict[str, Any]:
    """Load only a local artifact produced by the trusted training command."""

    if not path.is_file():
        raise ForecastingError("MODEL_ARTIFACT_NOT_FOUND", "Model artifact does not exist")
    with path.open("rb") as source:
        artifact: dict[str, Any] = pickle.load(source)  # noqa: S301 - trusted local artifact
    if artifact.get("artifact_format") != "BLOODLEDGER_FORECAST_MODEL_V1":
        raise ForecastingError("MODEL_ARTIFACT_INVALID", "Unsupported model artifact format")
    return artifact
