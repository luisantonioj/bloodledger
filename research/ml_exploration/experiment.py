"""Deterministic comparison of the accepted model and an isolated candidate."""

from __future__ import annotations

import hashlib
import json
import math
import re
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from bloodledger_forecasting.constants import (
    DEFAULT_SEED,
    EVALUATION_CLASSIFICATION,
    PROHIBITED_FIELD_TERMS,
    RECOMMENDATION_ELIGIBILITY,
    SERIES_COLUMNS,
)
from bloodledger_forecasting.forecasting import create_forecast_bundle
from bloodledger_forecasting.modeling import (
    NUMERIC_FEATURES,
    build_feature_frame,
    evaluate_models,
    make_folds,
    train_model,
    write_model_artifact,
)
from bloodledger_forecasting.synthetic import generate_synthetic_data, write_synthetic_csv
from bloodledger_forecasting.validation import sha256_file, validate_dataset

from .xlsx_reader import ReadOnlyXlsx

EXPERIMENT_VERSION = "ML_EXPERIMENT_V1"
REPORT_SCHEMA_VERSION = "BLOODLEDGER_ML_EXPLORATION_REPORT_V1"
RAW_SHEET = "DOH_Daily_Stock_Report"
TRAINING_SHEET = "ML_Training_Dataset"
REQUIRED_RAW_COLUMNS = (
    "Date",
    "Hospital",
    "BloodType",
    "Component",
    "Stock_9AM",
    "Stock_4PM",
    "Units_Received",
    "Units_Issued",
    "Units_Expired",
    "Stockout_Flag",
)


def canonical_json_bytes(value: object) -> bytes:
    return json.dumps(
        value, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False
    ).encode("utf-8")


def _normalized_name(value: object) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(value).strip().lower()).strip("_")


def _safe_file_lineage(path: Path) -> dict[str, str]:
    return {"name": path.name, "sha256": sha256_file(path)}


def _metric_values(actual: pd.Series, predicted: pd.Series) -> dict[str, float]:
    residual = actual.to_numpy(dtype=float) - predicted.to_numpy(dtype=float)
    absolute = np.abs(residual)
    denominator = float(np.abs(actual.to_numpy(dtype=float)).sum())
    return {
        "mae": float(absolute.mean()),
        "wape": float(absolute.sum() / denominator * 100.0) if denominator else 0.0,
        "rmse": float(math.sqrt(np.mean(np.square(residual)))),
    }


def _summarize(
    predictions: pd.DataFrame, *, series_columns: tuple[str, ...]
) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for model_name, model_rows in predictions.groupby("model", sort=True):
        series_metrics: dict[str, dict[str, float]] = {}
        for series_values, rows in model_rows.groupby(list(series_columns), sort=True):
            values = series_values if isinstance(series_values, tuple) else (series_values,)
            key = "|".join(str(value) for value in values)
            series_metrics[key] = _metric_values(rows["actual"], rows["prediction"])
        result[str(model_name)] = {
            "pooled": _metric_values(model_rows["actual"], model_rows["prediction"]),
            "series": series_metrics,
        }
    return result


def _new_per_series_forest() -> RandomForestRegressor:
    return RandomForestRegressor(
        n_estimators=300,
        max_depth=5,
        min_samples_leaf=3,
        random_state=DEFAULT_SEED,
        n_jobs=1,
    )


def evaluate_per_series_candidate(data: pd.DataFrame) -> dict[str, Any]:
    """Evaluate one forest per accepted series against the exact control folds."""

    validated = validate_dataset(data)
    features = build_feature_frame(validated).dropna(subset=list(NUMERIC_FEATURES)).copy()
    folds = make_folds(pd.DatetimeIndex(validated["business_date"]))
    prediction_parts: list[pd.DataFrame] = []
    for fold in folds:
        for series_values, series in features.groupby(list(SERIES_COLUMNS), sort=True):
            train = series.loc[series["business_date"] <= fold.train_end]
            validation = series.loc[
                (series["business_date"] >= fold.validation_start)
                & (series["business_date"] <= fold.validation_end)
            ].copy()
            model = _new_per_series_forest()
            model.fit(train.loc[:, NUMERIC_FEATURES], train["requested_units"])
            part = validation.loc[:, ["business_date", *SERIES_COLUMNS]].copy()
            part["fold"] = fold.fold
            part["model"] = "random_forest_per_series"
            part["actual"] = validation["requested_units"].to_numpy(dtype=float)
            part["prediction"] = np.maximum(
                0.0, model.predict(validation.loc[:, NUMERIC_FEATURES])
            )
            prediction_parts.append(part)
    predictions = pd.concat(prediction_parts, ignore_index=True)
    metrics = _summarize(predictions, series_columns=SERIES_COLUMNS)
    residual_quantiles: dict[str, float] = {}
    for series_values, rows in predictions.groupby(list(SERIES_COLUMNS), sort=True):
        key = "|".join(str(value) for value in series_values)
        residual_quantiles[key] = float(
            np.quantile(np.abs(rows["actual"] - rows["prediction"]), 0.95)
        )
    return {
        "model": "random_forest_per_series",
        "metrics": metrics["random_forest_per_series"],
        "residual_interval": "SERIES_ABSOLUTE_RESIDUAL_95TH_PERCENTILE",
        "residual_quantiles": residual_quantiles,
        "non_negative_predictions": bool((predictions["prediction"] >= 0).all()),
    }


def candidate_gate(control_metrics: dict[str, Any], candidate: dict[str, Any]) -> dict[str, Any]:
    candidate_metrics = candidate["metrics"]
    candidate_mae = float(candidate_metrics["pooled"]["mae"])
    control_names = (
        "seasonal_naive_7",
        "weighted_average_7",
        "random_forest_global",
    )
    pooled_comparisons = {
        name: candidate_mae <= 0.95 * float(control_metrics[name]["pooled"]["mae"])
        for name in control_names
    }
    series_evidence: dict[str, dict[str, float | bool]] = {}
    series_pass = True
    for key, values in candidate_metrics["series"].items():
        best_control = min(
            float(control_metrics[name]["series"][key]["mae"]) for name in control_names
        )
        candidate_series = float(values["mae"])
        passed = candidate_series <= 1.10 * best_control if best_control else candidate_series == 0
        series_pass = series_pass and passed
        series_evidence[key] = {
            "candidate_mae": candidate_series,
            "best_control_mae": best_control,
            "passed": passed,
        }
    pooled_pass = all(pooled_comparisons.values())
    return {
        "rule": "CANDIDATE_5_PERCENT_OVER_ALL_CONTROLS_AND_MAX_10_PERCENT_SERIES_REGRESSION",
        "pooled_comparisons": pooled_comparisons,
        "pooled_pass": pooled_pass,
        "series_pass": series_pass,
        "series_evidence": series_evidence,
        "passed": pooled_pass and series_pass and candidate["non_negative_predictions"],
    }


def _privacy_scan(frame: pd.DataFrame) -> dict[str, Any]:
    normalized_headers = [_normalized_name(column) for column in frame.columns]
    prohibited_headers = sorted(
        {
            column
            for column, normalized in zip(frame.columns, normalized_headers, strict=True)
            if any(term in normalized for term in PROHIBITED_FIELD_TERMS)
        }
    )
    email = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    phone = re.compile(r"^\+?\d[\d\s()\-]{7,}$")
    email_count = 0
    phone_count = 0
    prohibited_value_count = 0
    for value in frame.to_numpy().ravel():
        if not isinstance(value, str):
            continue
        normalized = _normalized_name(value)
        prohibited_value_count += int(any(term in normalized for term in PROHIBITED_FIELD_TERMS))
        email_count += int(bool(email.match(value.strip())))
        phone_count += int(bool(phone.match(value.strip())))
    return {
        "prohibited_headers": prohibited_headers,
        "prohibited_value_count": prohibited_value_count,
        "email_pattern_count": email_count,
        "phone_pattern_count": phone_count,
        "passed": not prohibited_headers
        and prohibited_value_count == 0
        and email_count == 0
        and phone_count == 0,
    }


def _contact_pattern_scan(frame: pd.DataFrame) -> dict[str, int | bool]:
    """Scan every cached worksheet value without treating guidance text as schema."""

    email = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    phone = re.compile(r"^\+?\d[\d\s()\-]{7,}$")
    email_count = 0
    phone_count = 0
    for value in frame.to_numpy().ravel():
        if not isinstance(value, str):
            continue
        email_count += int(bool(email.match(value.strip())))
        phone_count += int(bool(phone.match(value.strip())))
    return {
        "email_pattern_count": email_count,
        "phone_pattern_count": phone_count,
        "passed": email_count == 0 and phone_count == 0,
    }


def _build_generic_features(
    data: pd.DataFrame, *, target: str, series_columns: tuple[str, ...]
) -> pd.DataFrame:
    ordered = data.sort_values([*series_columns, "business_date"], kind="stable").copy()
    grouped = ordered.groupby(list(series_columns), sort=False)[target]
    ordered["lag_1"] = grouped.shift(1)
    ordered["lag_7"] = grouped.shift(7)
    ordered["weighted_7"] = grouped.transform(
        lambda values: values.shift(1)
        .rolling(7)
        .apply(lambda window: float(np.dot(window, np.arange(1, 8)) / 28.0), raw=True)
    )
    ordered["mean_14"] = grouped.transform(lambda values: values.shift(1).rolling(14).mean())
    ordered["weekday"] = ordered["business_date"].dt.weekday.astype("int64")
    ordered["month"] = ordered["business_date"].dt.month.astype("int64")
    return ordered


def _new_global_forest(
    *, categorical_columns: tuple[str, ...], numeric_columns: tuple[str, ...]
) -> Pipeline:
    preprocessing = ColumnTransformer(
        transformers=[
            (
                "categories",
                OneHotEncoder(handle_unknown="error", sparse_output=False),
                list(categorical_columns),
            ),
            ("numeric", "passthrough", list(numeric_columns)),
        ],
        remainder="drop",
    )
    return Pipeline(
        [("preprocessing", preprocessing), ("regressor", _new_per_series_forest())]
    )


def evaluate_issued_units(raw: pd.DataFrame) -> dict[str, Any]:
    data = raw.loc[:, ["Date", "BloodType", "Component", "Units_Issued"]].rename(
        columns={
            "Date": "business_date",
            "BloodType": "blood_type",
            "Component": "component",
            "Units_Issued": "issued_units",
        }
    )
    data["business_date"] = pd.to_datetime(data["business_date"], errors="raise").dt.normalize()
    data["issued_units"] = pd.to_numeric(data["issued_units"], errors="raise").astype("int64")
    series_columns = ("blood_type", "component")
    numeric_columns = ("weekday", "month", "lag_1", "lag_7", "weighted_7", "mean_14")
    feature_columns = (*series_columns, *numeric_columns)
    features = _build_generic_features(
        data, target="issued_units", series_columns=series_columns
    ).dropna(subset=list(numeric_columns))
    dates = pd.DatetimeIndex(sorted(pd.unique(data["business_date"])))
    if len(dates) != 184:
        raise ValueError("Workbook issued-unit experiment requires exactly 184 daily dates")
    fold_lengths = (30, 30, 30)
    position = 94
    prediction_parts: list[pd.DataFrame] = []
    for fold_number, length in enumerate(fold_lengths, start=1):
        validation_dates = dates[position : position + length]
        train_end = dates[position - 1]
        validation_start = validation_dates[0]
        validation_end = validation_dates[-1]
        train = features.loc[features["business_date"] <= train_end]
        validation = features.loc[
            (features["business_date"] >= validation_start)
            & (features["business_date"] <= validation_end)
        ].copy()
        predictions: dict[str, np.ndarray] = {
            "seasonal_naive_7": validation["lag_7"].to_numpy(dtype=float),
            "weighted_average_7": validation["weighted_7"].to_numpy(dtype=float),
        }
        global_forest = _new_global_forest(
            categorical_columns=series_columns, numeric_columns=numeric_columns
        )
        global_forest.fit(train.loc[:, feature_columns], train["issued_units"])
        predictions["random_forest_global"] = global_forest.predict(
            validation.loc[:, feature_columns]
        )
        per_series_parts: list[pd.DataFrame] = []
        for _, series_validation in validation.groupby(list(series_columns), sort=True):
            key = tuple(series_validation.iloc[0][column] for column in series_columns)
            mask = pd.Series(True, index=train.index)
            for column, value in zip(series_columns, key, strict=True):
                mask &= train[column] == value
            series_train = train.loc[mask]
            forest = _new_per_series_forest()
            forest.fit(series_train.loc[:, numeric_columns], series_train["issued_units"])
            part = series_validation.loc[:, ["business_date", *series_columns]].copy()
            part["fold"] = fold_number
            part["model"] = "random_forest_per_series"
            part["actual"] = series_validation["issued_units"].to_numpy(dtype=float)
            part["prediction"] = np.maximum(
                0.0, forest.predict(series_validation.loc[:, numeric_columns])
            )
            per_series_parts.append(part)
        prediction_parts.extend(per_series_parts)
        for name, prediction in predictions.items():
            part = validation.loc[:, ["business_date", *series_columns]].copy()
            part["fold"] = fold_number
            part["model"] = name
            part["actual"] = validation["issued_units"].to_numpy(dtype=float)
            part["prediction"] = np.maximum(0.0, prediction)
            prediction_parts.append(part)
        position += length
    predictions_frame = pd.concat(prediction_parts, ignore_index=True)
    return {
        "classification": EVALUATION_CLASSIFICATION,
        "target": "issued_units",
        "target_equivalence": "NOT_EQUIVALENT_TO_REQUESTED_UNITS",
        "series_granularity": "blood_type|component",
        "series_count": int(data.groupby(list(series_columns)).ngroups),
        "split": {"initial_days": 94, "validation_days": list(fold_lengths)},
        "metrics": _summarize(predictions_frame, series_columns=series_columns),
        "runtime_integration_eligible": False,
        "broa_input_eligible": False,
    }


def assess_workbook(path: Path) -> tuple[dict[str, Any], pd.DataFrame]:
    with ReadOnlyXlsx(path) as workbook:
        required_sheets = {
            "README",
            RAW_SHEET,
            TRAINING_SHEET,
            "Data_Dictionary",
            "Methodology_and_Assumptions",
            "Real_Data_Checklist",
        }
        missing_sheets = sorted(required_sheets - set(workbook.sheet_names))
        if missing_sheets:
            raise ValueError(f"Workbook is missing required sheets: {missing_sheets}")
        sheet_frames = {
            sheet_name: workbook.read_sheet(sheet_name).as_frame()
            for sheet_name in workbook.sheet_names
        }
        readme = sheet_frames["README"]
        raw_sheet = workbook.read_sheet(RAW_SHEET)
        training_sheet = workbook.read_sheet(TRAINING_SHEET)
        raw = raw_sheet.as_frame()
        training_all = training_sheet.as_frame()

    missing_columns = sorted(set(REQUIRED_RAW_COLUMNS) - set(raw.columns))
    if missing_columns:
        raise ValueError(f"Raw workbook sheet is missing columns: {missing_columns}")
    structured_privacy = {
        RAW_SHEET: _privacy_scan(raw),
        TRAINING_SHEET: _privacy_scan(training_all),
    }
    all_sheet_contact_scan = {
        name: _contact_pattern_scan(frame) for name, frame in sheet_frames.items()
    }
    if not all(result["passed"] for result in structured_privacy.values()):
        raise ValueError("Workbook structured data contains prohibited or identifying fields")
    if not all(result["passed"] for result in all_sheet_contact_scan.values()):
        raise ValueError("Workbook contains email or phone-like identifying values")

    raw = raw.loc[:, REQUIRED_RAW_COLUMNS].copy()
    raw["Date"] = pd.to_datetime(raw["Date"], errors="raise").dt.normalize()
    quantity_columns = (
        "Stock_9AM",
        "Stock_4PM",
        "Units_Received",
        "Units_Issued",
        "Units_Expired",
        "Stockout_Flag",
    )
    for column in quantity_columns:
        raw[column] = pd.to_numeric(raw[column], errors="raise").astype("int64")
    key_columns = ["Date", "Hospital", "BloodType", "Component"]
    ordered = raw.sort_values(["Hospital", "BloodType", "Component", "Date"])
    prior_afternoon = ordered.groupby(["Hospital", "BloodType", "Component"])[
        "Stock_4PM"
    ].shift(1)
    overnight_comparable = prior_afternoon.notna()
    overnight_discontinuities = int(
        (
            ordered.loc[overnight_comparable, "Stock_9AM"]
            != prior_afternoon.loc[overnight_comparable]
        ).sum()
    )
    balance_expected = (
        raw["Stock_9AM"]
        + raw["Units_Received"]
        - raw["Units_Issued"]
        - raw["Units_Expired"]
    )
    balance_failures = int((raw["Stock_4PM"] != balance_expected).sum())

    training = training_all.loc[training_all.get("BloodType").notna()].copy()
    note_rows = len(training_all) - len(training)
    daily_usage = pd.to_numeric(training["Daily_Usage"], errors="coerce")
    formula_targets = [
        formula
        for reference, formula in training_sheet.formulas.items()
        if reference.startswith("K")
    ]
    readme_text = " ".join(str(value) for value in readme.to_numpy().ravel())
    synthetic_claim = "not real hospital data" in readme_text.lower()
    result = {
        "lineage": _safe_file_lineage(path),
        "classification": "SYNTHETIC_RESEARCH_INPUT" if synthetic_claim else "UNCONFIRMED",
        "sheet_names": workbook.sheet_names,
        "privacy_scan": {
            "structured_prohibited_term_scan": structured_privacy,
            "all_sheet_contact_pattern_scan": all_sheet_contact_scan,
        },
        "raw": {
            "rows": len(raw),
            "columns": list(raw.columns),
            "date_start": raw["Date"].min().date().isoformat(),
            "date_end": raw["Date"].max().date().isoformat(),
            "daily_dates": int(raw["Date"].nunique()),
            "series_count": int(raw.groupby(["Hospital", "BloodType", "Component"]).ngroups),
            "blood_type_count": int(raw["BloodType"].nunique()),
            "component_count": int(raw["Component"].nunique()),
            "duplicate_keys": int(raw.duplicated(key_columns).sum()),
            "missing_values": {column: int(raw[column].isna().sum()) for column in raw.columns},
            "balance_identity_failures": balance_failures,
            "overnight_stock_discontinuities": overnight_discontinuities,
        },
        "training_sheet": {
            "records": len(training),
            "excluded_note_rows": note_rows,
            "formula_count": len(training_sheet.formulas),
            "daily_usage_formula_count": len(formula_targets),
            "daily_usage_stock_difference_formulas": sum(
                bool(re.fullmatch(r"H\d+-H\d+", formula)) for formula in formula_targets
            ),
            "daily_usage_missing": int(daily_usage.isna().sum()),
            "daily_usage_negative": int((daily_usage < 0).sum()),
            "target_disposition": "REJECT_STOCK_DIFFERENCE_PROXY",
        },
        "contract_compatibility": {
            "can_reproduce_synthetic_forecast_v1": False,
            "reasons": [
                "The workbook has 184 days instead of the locked 365-day contract.",
                "The workbook has eight blood types and four components instead of four approved series.",
                "The workbook has no requested_units target.",
                "The workbook lacks adjustment, unmet-demand, classification, and dataset-version fields.",
                "The workbook inventory identities do not satisfy the accepted validator.",
            ],
        },
    }
    return result, raw


def _source_tree_hash(root: Path) -> str:
    digest = hashlib.sha256()
    for path in sorted(root.rglob("*.py")):
        digest.update(path.relative_to(root).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def build_exploration_report(
    *,
    repository_root: Path,
    output_directory: Path,
    workbook_path: Path,
    notebook_path: Path,
    manuscript_path: Path,
) -> dict[str, Any]:
    repository_root = repository_root.resolve()
    output_directory = output_directory.resolve()
    if output_directory == repository_root or repository_root in output_directory.parents:
        raise ValueError("Experiment output directory must be outside the repository")
    output_directory.mkdir(parents=True, exist_ok=True)

    generated_path = output_directory / "control-synthetic-forecast-v1.csv"
    model_a_path = output_directory / "control-model-a.pkl"
    model_b_path = output_directory / "control-model-b.pkl"
    data = generate_synthetic_data()
    write_synthetic_csv(data, generated_path)
    control_predictions, control_metrics, control_folds = evaluate_models(data)
    del control_predictions
    source_root = repository_root / "services/forecasting/src/bloodledger_forecasting"
    artifact_a, manifest_a = train_model(
        data, dataset_path=generated_path, source_root=source_root
    )
    artifact_b, _ = train_model(data, dataset_path=generated_path, source_root=source_root)
    model_hash_a = write_model_artifact(artifact_a, model_a_path)
    model_hash_b = write_model_artifact(artifact_b, model_b_path)
    manifest_a["model_artifact_sha256"] = model_hash_a
    bundle = create_forecast_bundle(
        data,
        dataset_path=generated_path,
        artifact=artifact_a,
        artifact_path=model_a_path,
        manifest=manifest_a,
        horizon_date="2026-01-01",
        generated_at="2026-08-18T00:00:00Z",
    )
    candidate_a = evaluate_per_series_candidate(data)
    candidate_b = evaluate_per_series_candidate(data)
    candidate_deterministic = canonical_json_bytes(candidate_a) == canonical_json_bytes(candidate_b)
    gate = candidate_gate(control_metrics, candidate_a)
    gate["deterministic_replay"] = candidate_deterministic
    gate["passed"] = bool(gate["passed"] and candidate_deterministic)

    workbook, raw = assess_workbook(workbook_path)
    issued_benchmark_a = evaluate_issued_units(raw)
    issued_benchmark_b = evaluate_issued_units(raw)
    issued_deterministic = canonical_json_bytes(issued_benchmark_a) == canonical_json_bytes(
        issued_benchmark_b
    )

    forecast_safety = {
        "forecast_count": len(bundle["forecasts"]),
        "non_negative": all(item["point_forecast"] >= 0 for item in bundle["forecasts"]),
        "classification_values": sorted({item["classification"] for item in bundle["forecasts"]}),
        "recommendation_eligibility_values": sorted(
            {item["recommendation_eligibility"] for item in bundle["forecasts"]}
        ),
        "stale_after_values": sorted({item["stale_after"] for item in bundle["forecasts"]}),
    }
    keep_control = not gate["passed"]
    return {
        "schema_version": REPORT_SCHEMA_VERSION,
        "experiment_version": EXPERIMENT_VERSION,
        "classification": EVALUATION_CLASSIFICATION,
        "recommendation_eligibility": RECOMMENDATION_ELIGIBILITY,
        "inputs": {
            "workbook": workbook["lineage"],
            "notebook": _safe_file_lineage(notebook_path),
            "manuscript": _safe_file_lineage(manuscript_path),
        },
        "control": {
            "dataset_sha256": sha256_file(generated_path),
            "dataset_rows": len(data),
            "series_count": int(data.groupby(list(SERIES_COLUMNS)).ngroups),
            "target": "requested_units",
            "folds": [
                {
                    "fold": fold.fold,
                    "train_end": fold.train_end.date().isoformat(),
                    "validation_start": fold.validation_start.date().isoformat(),
                    "validation_end": fold.validation_end.date().isoformat(),
                }
                for fold in control_folds
            ],
            "metrics": control_metrics,
            "selected_model": manifest_a["selected_model"],
            "selection_evidence": manifest_a["selection_evidence"],
            "model_artifact_sha256": model_hash_a,
            "model_replay_sha256": model_hash_b,
            "model_artifact_deterministic": model_hash_a == model_hash_b,
            "code_sha256": artifact_a["code_sha256"],
            "environment_sha256": artifact_a["environment_sha256"],
            "config_sha256": artifact_a["config_sha256"],
            "forecast_safety": forecast_safety,
        },
        "candidate": {
            **candidate_a,
            "experiment_version": EXPERIMENT_VERSION,
            "deterministic_replay": candidate_deterministic,
            "gate": gate,
            "runtime_default_changed": False,
            "broa_mode": "SCENARIO_ONLY_IF_COMPATIBLE",
        },
        "workbook": workbook,
        "issued_units_benchmark": {
            **issued_benchmark_a,
            "deterministic_replay": issued_deterministic,
        },
        "research_code_sha256": _source_tree_hash(
            repository_root / "research/ml_exploration"
        ),
        "decision": {
            "keep_accepted_sprint_3_control": keep_control,
            "candidate_gate_passed": gate["passed"],
            "workbook_runtime_integration": "REJECTED",
            "broa_conclusion": (
                "Synthetic data is sufficient for deterministic, disabled BROA simulation only."
            ),
            "operational_claim": "BLOCKED",
            "unresolved": [
                "BL-ML-01",
                "BL-ML-02",
                "BL-ML-03",
                "RQ-07",
                "approved safety allowance",
                "approved minimum reserve",
            ],
        },
    }
