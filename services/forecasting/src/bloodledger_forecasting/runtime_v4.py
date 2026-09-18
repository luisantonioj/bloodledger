"""Deterministic V4 runtime forecast path.

This module is deliberately separate from the accepted V1 random-forest path.
It consumes aggregate requested-unit history only and never reads the research
workbook or emits calibrated uncertainty bounds.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import pandas as pd

from .errors import ForecastingError

V4_DATASET_VERSION = "SYNTHETIC_FORECAST_V4_RUNTIME_V1"
V4_BUNDLE_SCHEMA = "BLOODLEDGER_FORECAST_BUNDLE_V4_RUNTIME_V1"
V4_MODEL_VERSION = "bloodledger-weighted-average-7-1.0.0"
V4_MODEL_NAME = "weighted_average_7"
V4_TARGET = "requested_units"
V4_CLASSIFICATION = "SIMULATION_ONLY"
V4_RECOMMENDATION_ELIGIBILITY = "DISABLED_UNAPPROVED_POLICY"
V4_UNCERTAINTY_STATUS = "UNCERTAINTY_UNAVAILABLE"
V4_UNCERTAINTY_NOTE = "UNCERTAINTY_UNAVAILABLE_NOT_CALIBRATED"
V4_WEIGHTS = (1, 2, 3, 4, 5, 6, 7)
V4_WEIGHT_DENOMINATOR = sum(V4_WEIGHTS)

V4_BLOOD_TYPES = ("A_POSITIVE", "B_POSITIVE", "AB_POSITIVE", "O_POSITIVE")
V4_COMPONENTS = (
    "PACKED_RED_BLOOD_CELLS",
    "PLATELETS",
    "FRESH_FROZEN_PLASMA",
    "CRYOPRECIPITATE",
    "WHOLE_BLOOD",
)
V4_SERIES = tuple(
    (blood_type, component) for blood_type in V4_BLOOD_TYPES for component in V4_COMPONENTS
)
V4_COMPONENT_ALIASES = {
    "PRBC": "PACKED_RED_BLOOD_CELLS",
    "PC": "PLATELETS",
    "FFP": "FRESH_FROZEN_PLASMA",
    "CRYO": "CRYOPRECIPITATE",
    "WB": "WHOLE_BLOOD",
    **{component: component for component in V4_COMPONENTS},
}
V4_CONFIGURATION = {
    "method": V4_MODEL_NAME,
    "weights_oldest_to_newest": list(V4_WEIGHTS),
    "weight_denominator": V4_WEIGHT_DENOMINATOR,
    "horizon_days": 1,
    "uncertainty": "unavailable",
}
V4_MODEL_DEFINITION = {
    "name": V4_MODEL_NAME,
    "version": V4_MODEL_VERSION,
    "weights_oldest_to_newest": list(V4_WEIGHTS),
    "denominator": V4_WEIGHT_DENOMINATOR,
}


def _sha256(value: object) -> str:
    encoded = json.dumps(
        value, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False
    )
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


# Hash the implementation and model definition, rather than using a release
# label as a substitute for the bytes that generated a run.
V4_CODE_SHA256 = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
V4_CONFIGURATION_SHA256 = _sha256(V4_CONFIGURATION)
V4_MODEL_SHA256 = _sha256(V4_MODEL_DEFINITION)
MANILA_ZONE = ZoneInfo("Asia/Manila")


def _iso_date(value: object) -> str:
    if isinstance(value, pd.Timestamp):
        return str(value.date().isoformat())
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    parsed = pd.to_datetime(value, errors="coerce")
    if pd.isna(parsed):
        raise ForecastingError("V4_DATE_INVALID", "V4 business_date contains an invalid value")
    return str(pd.Timestamp(parsed).date().isoformat())


def _canonical_rows(data: pd.DataFrame) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for row in data[["business_date", "blood_type", "component", "requested_units"]].itertuples(
        index=False
    ):
        rows.append(
            {
                "business_date": _iso_date(row.business_date),
                "blood_type": str(row.blood_type),
                "component": str(row.component),
                "requested_units": None
                if pd.isna(row.requested_units)
                else float(row.requested_units),
            }
        )
    return sorted(
        rows,
        key=lambda item: (
            str(item["business_date"]),
            str(item["blood_type"]),
            str(item["component"]),
            json.dumps(item["requested_units"], allow_nan=False),
        ),
    )


def _payload_material(bundle: dict[str, Any]) -> dict[str, Any]:
    """Return semantic bundle content, excluding execution-time timestamps."""

    run = dict(bundle["run"])
    lineage = dict(run.get("lineage", {}))
    lineage.pop("payloadSha256", None)
    run["lineage"] = lineage
    run.pop("generatedAt", None)
    return {
        "schemaVersion": bundle["schemaVersion"],
        "run": run,
        "forecasts": bundle["forecasts"],
    }


def payload_sha256(bundle: dict[str, Any]) -> str:
    """Hash content that defines replay identity, not when execution occurred."""

    return _sha256(_payload_material(bundle))


def run_identity_sha256(run: dict[str, Any]) -> str:
    """Bind all immutable run metadata; timestamps and derived IDs are not identity."""
    material = {
        key: value
        for key, value in run.items()
        if key not in {"runId", "runKey", "generatedAt", "lineage"}
    }
    material["lineage"] = {
        key: value for key, value in run["lineage"].items() if key != "payloadSha256"
    }
    return _sha256(material)


def forecast_identity(run: dict[str, Any], blood_type: str, component: str) -> str:
    digest = _sha256(
        {"run": run_identity_sha256(run), "bloodType": blood_type, "component": component}
    )
    return f"FC_{digest[:40].upper()}"


def _validate_input(data: pd.DataFrame) -> pd.DataFrame:
    required = {"business_date", "blood_type", "component", "requested_units"}
    if set(data.columns) != required:
        raise ForecastingError(
            "V4_INPUT_SCHEMA_INVALID", "Unexpected V4 input fields or missing required fields"
        )
    normalized = data.loc[:, ["business_date", "blood_type", "component", "requested_units"]].copy()
    normalized["business_date"] = pd.to_datetime(
        normalized["business_date"], errors="coerce"
    ).dt.date
    if normalized["business_date"].isna().any():
        raise ForecastingError("V4_DATE_INVALID", "V4 business_date contains an invalid value")
    normalized["blood_type"] = normalized["blood_type"].astype(str)
    normalized["component"] = normalized["component"].map(
        lambda value: V4_COMPONENT_ALIASES.get(str(value), str(value))
    )
    quantities = pd.to_numeric(normalized["requested_units"], errors="coerce")
    if (quantities.isna() & ~normalized["requested_units"].isna()).any():
        raise ForecastingError("V4_QUANTITY_INVALID", "requested_units must be numeric or null")
    normalized["requested_units"] = quantities
    if any(
        not math.isfinite(float(value)) or float(value) < 0
        for value in quantities.dropna().tolist()
    ):
        raise ForecastingError(
            "V4_QUANTITY_INVALID", "requested_units must be finite and nonnegative"
        )
    return normalized


def _requested_date(value: str, code: str) -> date:
    try:
        parsed = date.fromisoformat(value)
    except (ValueError, TypeError) as error:
        raise ForecastingError(code, "Requested date must be YYYY-MM-DD") from error
    if parsed.isoformat() != value:
        raise ForecastingError(code, "Requested date must be YYYY-MM-DD")
    return parsed


def _resolve_dates(
    data: pd.DataFrame, generated: datetime, origin_date: str | None, horizon_date: str | None
) -> tuple[date, date]:
    origin = _requested_date(origin_date, "V4_ORIGIN_INVALID") if origin_date is not None else None
    horizon = (
        _requested_date(horizon_date, "V4_HORIZON_INVALID") if horizon_date is not None else None
    )
    if origin is None:
        if horizon is not None:
            origin = horizon - timedelta(days=1)
        elif not data.empty:
            origin = max(data["business_date"].tolist())
        else:
            origin = generated.astimezone(MANILA_ZONE).date() - timedelta(days=1)
    if horizon is None:
        horizon = origin + timedelta(days=1)
    if horizon != origin + timedelta(days=1):
        raise ForecastingError(
            "V4_HORIZON_INVALID", "V4 supports exactly one day after origin_date"
        )
    return origin, horizon


def create_v4_runtime_bundle(
    data: pd.DataFrame,
    *,
    dataset_path: Path | None = None,
    generated_at: str,
    institution_id: str = "INST_MEDIATRIX",
    origin_date: str | None = None,
    horizon_date: str | None = None,
) -> dict[str, Any]:
    """Create a complete or unavailable attempt for the same resolved target window.

    Missing/null history never generates zero forecasts. A supplied path identifies
    file bytes; otherwise canonical allowlisted memory rows identify the dataset.
    """
    if not generated_at.endswith("Z"):
        raise ForecastingError(
            "V4_GENERATED_AT_INVALID", "generated_at must be an explicit UTC instant"
        )
    try:
        generated = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
    except ValueError as error:
        raise ForecastingError(
            "V4_GENERATED_AT_INVALID", "generated_at must be ISO-8601"
        ) from error
    if generated.tzinfo != UTC:
        raise ForecastingError("V4_GENERATED_AT_INVALID", "generated_at must be UTC")
    if re.fullmatch(r"INST_[A-Z0-9_-]{1,59}", institution_id) is None:
        raise ForecastingError("V4_INSTITUTION_INVALID", "institution_id is invalid")
    normalized = _validate_input(data)
    origin, horizon = _resolve_dates(normalized, generated, origin_date, horizon_date)
    if dataset_path is not None:
        try:
            dataset_sha256 = hashlib.sha256(dataset_path.read_bytes()).hexdigest()
        except OSError as error:
            raise ForecastingError(
                "V4_DATASET_READ_FAILED", "Supplied dataset must be a readable file"
            ) from error
    else:
        dataset_sha256 = _sha256(_canonical_rows(data))
    lineage = {
        "datasetSha256": dataset_sha256,
        "codeSha256": V4_CODE_SHA256,
        "configurationSha256": V4_CONFIGURATION_SHA256,
        "modelSha256": V4_MODEL_SHA256,
        "inputSha256": _sha256(_canonical_rows(normalized)),
    }
    input_start = origin - timedelta(days=6)
    window = normalized[normalized["business_date"].between(input_start, origin)]
    reason = None
    if set(normalized["blood_type"]) - set(V4_BLOOD_TYPES) or set(normalized["component"]) - set(
        V4_COMPONENTS
    ):
        reason = "V4_CATEGORY_UNSUPPORTED"
    elif normalized.duplicated(["business_date", "blood_type", "component"]).any():
        raise ForecastingError("V4_HISTORY_DUPLICATE", "V4 history contains a duplicate series day")
    elif (
        any(
            value > origin or value >= generated.astimezone(MANILA_ZONE).date()
            for value in normalized["business_date"]
        )
        or origin >= generated.astimezone(MANILA_ZONE).date()
    ):
        reason = "V4_HISTORY_FUTURE_OBSERVATION"
    elif len(window) != 140 or normalized["requested_units"].isna().any():
        reason = "V4_HISTORY_UNAVAILABLE"
    run = {
        "institutionId": institution_id,
        "datasetVersion": V4_DATASET_VERSION,
        "modelVersion": V4_MODEL_VERSION,
        "modelName": V4_MODEL_NAME,
        "target": V4_TARGET,
        "inputStartDate": input_start.isoformat(),
        "inputEndDate": origin.isoformat(),
        "originDate": origin.isoformat(),
        "horizonDate": horizon.isoformat(),
        "generatedAt": generated_at,
        "classification": V4_CLASSIFICATION,
        "recommendationEligibility": V4_RECOMMENDATION_ELIGIBILITY,
        "runStatus": "UNAVAILABLE" if reason else "COMPLETED",
        "lineage": lineage,
    }
    if reason:
        run["unavailableReason"] = reason
    identity = run_identity_sha256(run)
    run["runId"] = f"RUN_{identity[:32].upper()}"
    run["runKey"] = f"RUNKEY_{identity[:32].upper()}"
    records: list[dict[str, Any]] = []
    if not reason:
        for blood_type, component in V4_SERIES:
            series = window[
                (window["blood_type"] == blood_type) & (window["component"] == component)
            ].sort_values("business_date")
            values = [float(value) for value in series["requested_units"].tolist()]
            point = (
                sum(weight * value for weight, value in zip(V4_WEIGHTS, values, strict=True))
                / V4_WEIGHT_DENOMINATOR
            )
            records.append(
                {
                    "forecastId": forecast_identity(run, blood_type, component),
                    "institutionId": institution_id,
                    "bloodType": blood_type,
                    "component": component,
                    "asOfDate": origin.isoformat(),
                    "horizonDate": horizon.isoformat(),
                    "pointForecast": point,
                    "lowerForecast": None,
                    "upperForecast": None,
                    "uncertaintyStatus": V4_UNCERTAINTY_STATUS,
                    "uncertaintyNote": V4_UNCERTAINTY_NOTE,
                    "forecastStatus": "AVAILABLE",
                    "staleAfter": horizon.isoformat(),
                    "classification": V4_CLASSIFICATION,
                    "recommendationEligibility": V4_RECOMMENDATION_ELIGIBILITY,
                }
            )
    bundle = {"schemaVersion": V4_BUNDLE_SCHEMA, "run": run, "forecasts": records}
    lineage["payloadSha256"] = payload_sha256(bundle)
    return bundle
