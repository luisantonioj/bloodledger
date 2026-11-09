"""SIMULATION_ONLY post-defense reanalysis; no application or runtime writes."""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import platform
from pathlib import Path
from typing import Any, cast

import numpy as np
import pandas as pd
from numpy.typing import NDArray
from sklearn.ensemble import HistGradientBoostingRegressor

from . import v5_experiment as v5

VERSION = "SYNTHETIC_V5_POST_DEFENSE_REANALYSIS_V1"
FOLDS = (("2024-07-01", "2024-12-31"), ("2025-01-01", "2025-03-31"), ("2025-04-01", "2025-06-30"))
CANDIDATES = (
    *v5.MODEL_NAMES,
    "zero",
    "series_median",
    "seasonal_median_4",
    "seasonal_median_8",
    "ses_0.1",
    "ses_0.3",
    "sba_0.1",
    "sba_0.3",
    "tsb_0.1",
    "tsb_0.3",
    "boost_absolute_error_7",
    "boost_absolute_error_15",
    "boost_poisson_7",
    "boost_poisson_15",
)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def smooth(values: NDArray[np.float64], kind: str, alpha: float) -> NDArray[np.float64]:
    """Forecast next day after observing current day; start with no future knowledge."""
    result = []
    level = size = probability = 0.0
    interval = 1.0
    gap = 0
    seen = False
    for i, value in enumerate(values):
        gap += 1
        if kind == "ses":
            level = float(value) if i == 0 else alpha * value + (1 - alpha) * level
            forecast = level
        else:
            if kind == "tsb":
                probability = alpha * float(value > 0) + (1 - alpha) * probability
            if value > 0:
                if not seen:
                    size, interval, seen = float(value), float(gap), True
                else:
                    size = alpha * value + (1 - alpha) * size
                    interval = alpha * gap + (1 - alpha) * interval
                gap = 0
            forecast = size * probability if kind == "tsb" else (1 - alpha / 2) * size / interval
        result.append(forecast)
    return np.asarray(result)


def extend(full: pd.DataFrame) -> pd.DataFrame:
    """Use observed origin history only; missing counts/dates fail, never become zero."""
    blocks = []
    for _, g in full.groupby(["blood_type", "component"], sort=False):
        g = g.sort_values("origin_date").copy()
        y = g.total_requested_units.to_numpy(dtype=float)
        v5.require(bool(np.isfinite(y).all() and (y >= 0).all()), "REANALYSIS_COUNTS")
        v5.require(
            bool(g.origin_date.diff().dropna().eq(pd.Timedelta(days=1)).all()), "REANALYSIS_GAPS"
        )
        s = pd.Series(y, index=g.index)
        for weeks in (4, 8):
            # target t+1: previous matching weekdays are t-6, t-13, ...
            g[f"seasonal_median_{weeks}"] = pd.concat(
                [s.shift(6 + 7 * k) for k in range(weeks)], axis=1
            ).median(axis=1, skipna=True)
        for kind in ("ses", "sba", "tsb"):
            for alpha in (0.1, 0.3):
                g[f"{kind}_{alpha}"] = smooth(y, kind, alpha)
        blocks.append(g)
    return pd.concat(blocks, ignore_index=True)


def fit_predict(name: str, train: pd.DataFrame, evaluation: pd.DataFrame) -> NDArray[np.float64]:
    v5.require(
        bool(train.target_date.max() < evaluation.target_date.min()), "REANALYSIS_CHRONOLOGY"
    )
    if name in v5.MODEL_NAMES:
        return v5.predict(v5.fit(name, train), evaluation)
    if name == "zero":
        return np.zeros(len(evaluation))
    if name == "series_median":
        medians = train.groupby(["blood_type", "component"]).target_requested_units.median()
        return np.asarray(
            [
                medians.loc[b, c]
                for b, c in zip(evaluation.blood_type, evaluation.component, strict=True)
            ]
        )
    if name.startswith("boost_"):
        loss, leaves = name.removeprefix("boost_").rsplit("_", 1)
        estimator = HistGradientBoostingRegressor(
            loss=loss,
            max_leaf_nodes=int(leaves),
            max_iter=100,
            learning_rate=0.05,
            min_samples_leaf=30,
            l2_regularization=1.0,
            early_stopping=False,
            random_state=20261101,
        )
        estimator.fit(v5.design(train), train.target_requested_units.to_numpy(dtype=float))
        return cast(NDArray[np.float64], np.maximum(0, estimator.predict(v5.design(evaluation))))
    return cast(NDArray[np.float64], evaluation[name].to_numpy(dtype=float))


def score(actual: NDArray[np.float64], predicted: NDArray[np.float64]) -> dict[str, Any]:
    actual, predicted = np.asarray(actual, dtype=float), np.asarray(predicted, dtype=float)
    v5.require(
        actual.shape == predicted.shape and actual.ndim == 1 and len(actual) > 0, "REANALYSIS_SHAPE"
    )
    v5.require(
        bool(
            np.isfinite(actual).all()
            and np.isfinite(predicted).all()
            and (actual >= 0).all()
            and (predicted >= 0).all()
        ),
        "REANALYSIS_VALUES",
    )
    result = v5.metrics(actual, predicted)
    result.update(
        actual_units=float(actual.sum()),
        predicted_units=float(predicted.sum()),
        bias_units_per_series_day=float((predicted - actual).mean()),
        underprediction_rate=float((predicted < actual).mean()),
        underpredicted_units=float(np.maximum(actual - predicted, 0).sum()),
        overpredicted_units=float(np.maximum(predicted - actual, 0).sum()),
        zero_demand_rows=int((actual == 0).sum()),
        zero_demand_mae=float(predicted[actual == 0].mean()) if (actual == 0).any() else None,
    )
    return result


def groups(frame: pd.DataFrame, predicted: NDArray[np.float64]) -> dict[str, Any]:
    f = frame.assign(prediction=predicted)

    def metric(g: pd.DataFrame) -> dict[str, Any]:
        return score(g.target_requested_units.to_numpy(), g.prediction.to_numpy())

    return {
        "overall": metric(f),
        "components": {str(k): metric(g) for k, g in f.groupby("component")},
        "series": {f"{b}/{c}": metric(g) for (b, c), g in f.groupby(["blood_type", "component"])},
    }


def select(rows: list[dict[str, Any]]) -> str:
    return str(min(rows, key=lambda r: (r["validation"]["mae"], r["model"]))["model"])


def run(workbook: Path, output: Path, protocol: Path) -> dict[str, Any]:
    v5.require(workbook.is_file() and protocol.is_file(), "REANALYSIS_EVIDENCE")
    v5.require(not output.exists(), "REANALYSIS_OUTPUT_EXISTS")
    source_hash = sha(workbook)
    full = extend(v5.validate(v5.read_synthetic(workbook)))
    eligible = full[full.training_eligible].copy()
    rows = []
    for name in CANDIDATES:
        actuals, fold_predictions, folds = [], [], []
        for start, end in FOLDS:
            train = eligible[eligible.target_date < start]
            validation = eligible[eligible.target_date.between(start, end)]
            predicted = fit_predict(name, train, validation)
            actual = validation.target_requested_units.to_numpy(dtype=float)
            actuals.append(actual)
            fold_predictions.append(predicted)
            folds.append(
                {
                    "start": start,
                    "end": end,
                    "train_rows": len(train),
                    "metrics": score(actual, predicted),
                }
            )
        rows.append(
            {
                "model": name,
                "folds": folds,
                "validation": score(np.concatenate(actuals), np.concatenate(fold_predictions)),
            }
        )
    selected = select(rows)  # Fixed before any test scoring; never choose by test results.
    train = eligible[eligible.target_date <= "2025-06-30"]
    test = eligible[eligible.partition == "TEST"]
    tests: dict[str, Any] = {}
    selected_predictions: NDArray[np.float64] | None = None
    for name in CANDIDATES:
        predictions = fit_predict(name, train, test)
        tests[name] = groups(test, predictions)
        if name == selected:
            selected_predictions = predictions
    if selected_predictions is None:
        raise RuntimeError("Selected research candidate was not scored")
    report = {
        "version": VERSION,
        "classification": "SIMULATION_ONLY",
        "selected": selected,
        "selection": "Pooled chronological-validation MAE; model-name tie break; no test selection",
        "test_status": "POST_DEFENSE_REANALYSIS_PREVIOUSLY_EXAMINED_TEST_PERIOD",
        "workbook_sha256": source_hash,
        "protocol_sha256": sha(protocol),
        "code_sha256": sha(Path(__file__)),
        "v5_code_sha256": sha(Path(v5.__file__)),
        "environment": {
            "python": platform.python_version(),
            **{
                p: importlib.metadata.version(p)
                for p in ("numpy", "pandas", "scikit-learn", "scipy", "joblib")
            },
        },
        "partition_counts": {str(k): len(g) for k, g in eligible.groupby("partition")},
        "validation": rows,
        "test": tests,
        "selected_confusion": v5.confusion(
            test.target_requested_units.to_numpy(), selected_predictions
        ),
        "model_policy": "Research configuration only; refit after selection through 2025-06-30. "
        "No runtime artifact replacement; history-based methods update causal state only.",
    }
    artifact: dict[str, Any] = {
        "version": VERSION,
        "selected": selected,
        "fit_through": "2025-06-30",
        "code_sha256": report["code_sha256"],
        "workbook_sha256": source_hash,
        "protocol_sha256": report["protocol_sha256"],
        "application_activation": False,
        "artifact_kind": "RESEARCH_REPLAY_CONFIGURATION",
    }
    if selected == "series_median":
        artifact["artifact_kind"] = "RESEARCH_FROZEN_SERIES_MEDIANS"
        artifact["series"] = [
            {
                "blood_type": b,
                "component": c,
                "median": float(
                    train.loc[
                        (train.blood_type == b) & (train.component == c), "target_requested_units"
                    ].median()
                ),
            }
            for b, c in v5.SERIES
        ]
    artifact_text = json.dumps(artifact, indent=2, allow_nan=False) + "\n"
    report["selected_artifact_sha256"] = hashlib.sha256(artifact_text.encode()).hexdigest()
    v5.require(sha(workbook) == source_hash, "REANALYSIS_SOURCE_CHANGED")
    output.mkdir(parents=True)
    (output / "evaluation.json").write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    test[
        ["origin_date", "target_date", "blood_type", "component", "target_requested_units"]
    ].assign(prediction=selected_predictions).to_csv(
        output / "selected-predictions.csv", index=False
    )
    (output / "selected-research-config.json").write_text(artifact_text)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workbook", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--protocol", required=True, type=Path)
    args = parser.parse_args()
    result = run(args.workbook, args.output, args.protocol)
    print(
        json.dumps(
            {
                "selected": result["selected"],
                "metrics": result["test"][result["selected"]]["overall"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
