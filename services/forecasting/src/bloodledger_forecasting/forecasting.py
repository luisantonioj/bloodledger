"""Create one-day, simulation-only forecasts from a trusted local artifact."""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from .constants import (
    EVALUATION_CLASSIFICATION,
    MODEL_VERSION,
    RECOMMENDATION_ELIGIBILITY,
    SERIES_COLUMNS,
)
from .errors import ForecastingError
from .modeling import FEATURE_COLUMNS, NUMERIC_FEATURES, build_feature_frame
from .validation import sha256_file, validate_dataset


def canonical_json_bytes(value: object) -> bytes:
    """Return stable UTF-8 JSON bytes used by idempotency evidence."""

    return json.dumps(
        value, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False
    ).encode("utf-8")


def _sha256_json(value: object) -> str:
    return hashlib.sha256(canonical_json_bytes(value)).hexdigest()


def _next_day_features(data: pd.DataFrame, horizon_date: pd.Timestamp) -> pd.DataFrame:
    future_rows = []
    for institution_id, blood_type, component in sorted(
        set(data.loc[:, SERIES_COLUMNS].itertuples(index=False, name=None))
    ):
        future_rows.append(
            {
                "business_date": horizon_date,
                "institution_id": institution_id,
                "blood_type": blood_type,
                "component": component,
                "requested_units": np.nan,
            }
        )
    extended = pd.concat([data, pd.DataFrame(future_rows)], ignore_index=True)
    features = build_feature_frame(extended)
    horizon = features.loc[features["business_date"] == horizon_date].copy()
    if horizon.empty or horizon.loc[:, NUMERIC_FEATURES].isna().any().any():
        raise ForecastingError(
            "FORECAST_FEATURE_UNAVAILABLE", "Historical lags are unavailable for the horizon"
        )
    return horizon.sort_values(list(SERIES_COLUMNS), kind="stable")


def create_forecast_bundle(
    data: pd.DataFrame,
    *,
    dataset_path: Path,
    artifact: dict[str, Any],
    artifact_path: Path,
    manifest: dict[str, Any],
    horizon_date: str,
    generated_at: str | None = None,
) -> dict[str, Any]:
    """Forecast exactly the next Asia/Manila business date for all four series."""

    validated = validate_dataset(data)
    if sha256_file(dataset_path) != artifact.get("dataset_sha256"):
        raise ForecastingError("DATASET_LINEAGE_MISMATCH", "Dataset digest differs from training")
    artifact_sha256 = sha256_file(artifact_path)
    if manifest.get("model_artifact_sha256") != artifact_sha256:
        raise ForecastingError("MODEL_LINEAGE_MISMATCH", "Model artifact digest is not approved")
    if manifest.get("selected_model") != artifact.get("selected_model"):
        raise ForecastingError("MODEL_LINEAGE_MISMATCH", "Model selection evidence differs")

    horizon = pd.Timestamp(horizon_date).normalize()
    latest_date = pd.Timestamp(validated["business_date"].max()).normalize()
    if horizon != latest_date + pd.Timedelta(days=1):
        raise ForecastingError(
            "FORECAST_HORIZON_INVALID", "Sprint 3 supports exactly the next business date"
        )

    horizon_features = _next_day_features(validated, horizon)
    selected_model = str(artifact["selected_model"])
    if selected_model == "seasonal_naive_7":
        point_predictions = horizon_features["lag_7"].to_numpy(dtype=float)
    elif selected_model == "weighted_average_7":
        point_predictions = horizon_features["weighted_7"].to_numpy(dtype=float)
    elif selected_model == "random_forest_global":
        fitted_model = artifact.get("fitted_model")
        if fitted_model is None:
            raise ForecastingError("MODEL_ARTIFACT_INVALID", "Fitted candidate is missing")
        point_predictions = fitted_model.predict(horizon_features.loc[:, FEATURE_COLUMNS])
    else:
        raise ForecastingError("MODEL_ARTIFACT_INVALID", "Selected model is unsupported")

    if generated_at is None:
        generation_time = datetime.now(UTC)
    else:
        try:
            generation_time = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
        except ValueError as error:
            raise ForecastingError(
                "FORECAST_GENERATION_TIME_INVALID", "generated_at must be ISO-8601"
            ) from error
        if generation_time.tzinfo is None or generation_time.utcoffset() is None:
            raise ForecastingError(
                "FORECAST_GENERATION_TIME_INVALID", "generated_at must include an offset"
            )
        generation_time = generation_time.astimezone(UTC)
    generated_at_utc = generation_time.isoformat().replace("+00:00", "Z")

    forecasts: list[dict[str, Any]] = []
    for (_, row), raw_prediction in zip(
        horizon_features.iterrows(), point_predictions, strict=True
    ):
        point = max(0.0, float(raw_prediction))
        series_key = f"{row['blood_type']}|{row['component']}"
        residual = float(artifact["residual_quantiles"][series_key])
        forecasts.append(
            {
                "institution_id": str(row["institution_id"]),
                "blood_type": str(row["blood_type"]),
                "component": str(row["component"]),
                "horizon_date": horizon.date().isoformat(),
                "point_forecast": round(point, 6),
                "lower_forecast": round(max(0.0, point - residual), 6),
                "upper_forecast": round(point + residual, 6),
                "uncertainty_note": "SERIES_ABSOLUTE_RESIDUAL_95TH_PERCENTILE",
                "forecast_status": "AVAILABLE",
                "stale_after": horizon.date().isoformat(),
                "classification": EVALUATION_CLASSIFICATION,
                "recommendation_eligibility": RECOMMENDATION_ELIGIBILITY,
            }
        )

    run_identity = {
        "dataset_sha256": artifact["dataset_sha256"],
        "model_artifact_sha256": artifact_sha256,
        "model_version": MODEL_VERSION,
        "selected_model": selected_model,
        "horizon_date": horizon.date().isoformat(),
        "classification": EVALUATION_CLASSIFICATION,
    }
    run_key = _sha256_json(run_identity)
    run = {
        "run_id": f"FRUN_{run_key[:32].upper()}",
        "run_key": run_key,
        "dataset_version": manifest["dataset"]["dataset_version"],
        "generator_version": manifest["dataset"]["generator_version"],
        "dataset_sha256": artifact["dataset_sha256"],
        "code_sha256": artifact["code_sha256"],
        "config_sha256": artifact["config_sha256"],
        "model_artifact_sha256": artifact_sha256,
        "model_version": MODEL_VERSION,
        "model_name": selected_model,
        "target": "requested_units",
        "input_start_date": artifact["training_start"],
        "input_end_date": artifact["training_end"],
        "horizon_date": horizon.date().isoformat(),
        "generated_at": generated_at_utc,
        "classification": EVALUATION_CLASSIFICATION,
        "run_status": "COMPLETED",
        "safe_error_code": None,
        "lineage": {
            "dataset": manifest["dataset"],
            "folds": manifest["folds"],
            "environment_sha256": manifest["environment_sha256"],
            "limitations": manifest["limitations"],
        },
        "selection_evidence": manifest["selection_evidence"],
    }
    for forecast in forecasts:
        forecast_identity = (
            f"{run_key}|{forecast['institution_id']}|{forecast['blood_type']}|"
            f"{forecast['component']}|{forecast['horizon_date']}"
        )
        forecast["forecast_id"] = (
            "FCST_" + hashlib.sha256(forecast_identity.encode("utf-8")).hexdigest()[:32].upper()
        )
    payload_run = {
        key: value for key, value in run.items() if key not in {"generated_at", "payload_sha256"}
    }
    run["payload_sha256"] = _sha256_json({"run": payload_run, "forecasts": forecasts})
    return {
        "schema_version": "BLOODLEDGER_FORECAST_BUNDLE_V1",
        "run": run,
        "forecasts": forecasts,
    }


def bundle_is_stale(bundle: dict[str, Any], as_of_business_date: date) -> bool:
    """A one-day forecast is stale after its declared Asia/Manila business date."""

    stale_after = date.fromisoformat(str(bundle["forecasts"][0]["stale_after"]))
    return as_of_business_date > stale_after
