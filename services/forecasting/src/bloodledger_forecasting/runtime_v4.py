"""Deterministic V4 runtime forecast path.

This module is deliberately separate from the accepted V1 random-forest path.
It consumes aggregate requested-unit history only and never reads the research
workbook or emits calibrated uncertainty bounds.
"""

from __future__ import annotations

import hashlib
import json
import math
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

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
        value, sort_keys=True, separators=(",", ":"), ensure_ascii=True, default=str
    )
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


# Hash the implementation and model definition, rather than using a release
# label as a substitute for the bytes that generated a run.
V4_CODE_SHA256 = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
V4_CONFIGURATION_SHA256 = _sha256(V4_CONFIGURATION)
V4_MODEL_SHA256 = _sha256(V4_MODEL_DEFINITION)


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
                "requested_units": float(row.requested_units),
            }
        )
    return sorted(
        rows,
        key=lambda item: (
            str(item["business_date"]),
            str(item["blood_type"]),
            str(item["component"]),
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


def _unavailable_bundle(
    *,
    data: pd.DataFrame,
    generated_at: str,
    reason: str,
    dataset_sha256: str,
) -> dict[str, Any]:
    dates = [_iso_date(value) for value in data["business_date"].tolist()] if not data.empty else []
    input_start = min(dates) if dates else generated_at[:10]
    input_end = max(dates) if dates else generated_at[:10]
    horizon = (date.fromisoformat(input_end) + timedelta(days=1)).isoformat()
    input_hash = _sha256(_canonical_rows(data))
    lineage = {
        "datasetSha256": dataset_sha256,
        "codeSha256": V4_CODE_SHA256,
        "configurationSha256": V4_CONFIGURATION_SHA256,
        "modelSha256": V4_MODEL_SHA256,
        "inputSha256": input_hash,
    }
    run_identity = _sha256(
        {
            "dataset": V4_DATASET_VERSION,
            "institution": "INST_MEDIATRIX",
            "input": input_hash,
            "model": V4_MODEL_VERSION,
            "configuration": V4_CONFIGURATION_SHA256,
            "horizon": horizon,
            "reason": reason,
        }
    )
    run = {
        "runId": f"RUN_{run_identity[:32].upper()}",
        "runKey": f"RUNKEY_{run_identity[:32].upper()}",
        "datasetVersion": V4_DATASET_VERSION,
        "modelVersion": V4_MODEL_VERSION,
        "modelName": V4_MODEL_NAME,
        "target": V4_TARGET,
        "inputStartDate": input_start,
        "inputEndDate": input_end,
        "originDate": input_end,
        "horizonDate": horizon,
        "generatedAt": generated_at,
        "classification": V4_CLASSIFICATION,
        "recommendationEligibility": V4_RECOMMENDATION_ELIGIBILITY,
        "runStatus": "UNAVAILABLE",
        "unavailableReason": reason,
        "lineage": lineage,
    }
    bundle = {"schemaVersion": V4_BUNDLE_SCHEMA, "run": run, "forecasts": []}
    lineage["payloadSha256"] = payload_sha256(bundle)
    return bundle


def _validate_input(data: pd.DataFrame) -> tuple[pd.DataFrame, str]:
    required = {"business_date", "blood_type", "component", "requested_units"}
    unexpected = set(data.columns) - required
    if unexpected:
        raise ForecastingError(
            "V4_INPUT_SCHEMA_INVALID", f"Unexpected V4 input fields: {sorted(unexpected)}"
        )
    missing = required - set(data.columns)
    if missing:
        raise ForecastingError(
            "V4_INPUT_SCHEMA_INVALID", f"Missing V4 input fields: {sorted(missing)}"
        )
    if data.empty:
        raise ForecastingError("V4_HISTORY_UNAVAILABLE", "V4 requires seven prior days")
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
    normalized["requested_units"] = pd.to_numeric(normalized["requested_units"], errors="coerce")
    if normalized["requested_units"].isna().any():
        raise ForecastingError("V4_QUANTITY_INVALID", "requested_units must be numeric")
    if any(
        not math.isfinite(float(value)) or float(value) < 0
        for value in normalized["requested_units"].tolist()
    ):
        raise ForecastingError(
            "V4_QUANTITY_INVALID", "requested_units must be finite and nonnegative"
        )
    unsupported_types = set(normalized["blood_type"]) - set(V4_BLOOD_TYPES)
    unsupported_components = set(normalized["component"]) - set(V4_COMPONENTS)
    if unsupported_types or unsupported_components:
        raise ForecastingError("V4_CATEGORY_UNSUPPORTED", "V4 input contains an unsupported series")
    if normalized.duplicated(["business_date", "blood_type", "component"]).any():
        raise ForecastingError("V4_HISTORY_DUPLICATE", "V4 history contains a duplicate series day")
    return normalized, _sha256(_canonical_rows(normalized))


def create_v4_runtime_bundle(
    data: pd.DataFrame,
    *,
    dataset_path: Path | None = None,
    generated_at: str,
    institution_id: str = "INST_MEDIATRIX",
    origin_date: str | None = None,
    horizon_date: str | None = None,
) -> dict[str, Any]:
    """Create a one-day V4 bundle from aggregate requested-unit history.

    Incomplete history is a valid, explicit unavailable result. It is never
    represented by zero-valued forecast rows.
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
    if not institution_id.startswith("INST_"):
        raise ForecastingError("V4_INSTITUTION_INVALID", "institution_id is invalid")
    dataset_sha256 = (
        hashlib.sha256(dataset_path.read_bytes()).hexdigest()
        if dataset_path and dataset_path.is_file()
        else _sha256(V4_DATASET_VERSION)
    )

    try:
        normalized, input_hash = _validate_input(data)
    except ForecastingError as error:
        if error.code in {"V4_HISTORY_UNAVAILABLE", "V4_CATEGORY_UNSUPPORTED"}:
            return _unavailable_bundle(
                data=data,
                generated_at=generated_at,
                reason=error.code,
                dataset_sha256=dataset_sha256,
            )
        raise
    dates = sorted(normalized["business_date"].unique())
    if len(dates) < 7:
        return _unavailable_bundle(
            data=normalized,
            generated_at=generated_at,
            reason="V4_HISTORY_UNAVAILABLE",
            dataset_sha256=dataset_sha256,
        )
    prior_dates = dates[-7:]
    if any(
        prior_dates[index] - prior_dates[index - 1] != timedelta(days=1)
        for index in range(1, len(prior_dates))
    ):
        return _unavailable_bundle(
            data=normalized,
            generated_at=generated_at,
            reason="V4_HISTORY_UNAVAILABLE",
            dataset_sha256=dataset_sha256,
        )
    if prior_dates[-1] >= generated.date():
        return _unavailable_bundle(
            data=normalized,
            generated_at=generated_at,
            reason="V4_HISTORY_FUTURE_OBSERVATION",
            dataset_sha256=dataset_sha256,
        )
    expected = {(value, component) for value in V4_BLOOD_TYPES for component in V4_COMPONENTS}
    actual = {
        (str(row.blood_type), str(row.component))
        for row in normalized.itertuples()
        if row.business_date in prior_dates
    }
    if actual != expected or len(normalized[normalized["business_date"].isin(prior_dates)]) != 140:
        return _unavailable_bundle(
            data=normalized,
            generated_at=generated_at,
            reason="V4_HISTORY_UNAVAILABLE",
            dataset_sha256=dataset_sha256,
        )

    input_start = prior_dates[0].isoformat()
    input_end = prior_dates[-1].isoformat()
    horizon = (prior_dates[-1] + timedelta(days=1)).isoformat()
    if origin_date is not None and origin_date != input_end:
        raise ForecastingError(
            "V4_ORIGIN_INVALID", "origin_date must be the latest prior history date"
        )
    if horizon_date is not None:
        try:
            requested_horizon = date.fromisoformat(horizon_date)
        except ValueError as error:
            raise ForecastingError("V4_HORIZON_INVALID", "horizon_date must be YYYY-MM-DD") from error
        if requested_horizon.isoformat() != horizon:
            raise ForecastingError("V4_HORIZON_INVALID", "V4 supports exactly one day after origin_date")
    records: list[dict[str, Any]] = []
    for blood_type, component in V4_SERIES:
        series = normalized[
            (normalized["blood_type"] == blood_type) & (normalized["component"] == component)
        ].sort_values("business_date")
        values = [
            float(value)
            for value in series[series["business_date"].isin(prior_dates)][
                "requested_units"
            ].tolist()
        ]
        point = max(
            0.0,
            sum(weight * value for weight, value in zip(V4_WEIGHTS, values, strict=True))
            / V4_WEIGHT_DENOMINATOR,
        )
        identity = _sha256(
            {
                "bloodType": blood_type,
                "component": component,
                "horizon": horizon,
                "input": input_hash,
            }
        )
        records.append(
            {
                "forecastId": f"FC_{identity[:40].upper()}",
                "institutionId": institution_id,
                "bloodType": blood_type,
                "component": component,
                "asOfDate": input_end,
                "horizonDate": horizon,
                "pointForecast": point,
                "lowerForecast": None,
                "upperForecast": None,
                "uncertaintyStatus": V4_UNCERTAINTY_STATUS,
                "uncertaintyNote": V4_UNCERTAINTY_NOTE,
                "forecastStatus": "AVAILABLE",
                "staleAfter": horizon,
                "classification": V4_CLASSIFICATION,
                "recommendationEligibility": V4_RECOMMENDATION_ELIGIBILITY,
            }
        )
    lineage = {
        "datasetSha256": dataset_sha256,
        "codeSha256": V4_CODE_SHA256,
        "configurationSha256": V4_CONFIGURATION_SHA256,
        "modelSha256": V4_MODEL_SHA256,
        "inputSha256": input_hash,
    }
    identity = _sha256(
        {
            "dataset": V4_DATASET_VERSION,
            "institution": institution_id,
            "input": input_hash,
            "model": V4_MODEL_VERSION,
            "configuration": V4_CONFIGURATION_SHA256,
            "horizon": horizon,
        }
    )
    run = {
        "runId": f"RUN_{identity[:32].upper()}",
        "runKey": f"RUNKEY_{identity[:32].upper()}",
        "datasetVersion": V4_DATASET_VERSION,
        "modelVersion": V4_MODEL_VERSION,
        "modelName": V4_MODEL_NAME,
        "target": V4_TARGET,
        "inputStartDate": input_start,
        "inputEndDate": input_end,
        "originDate": input_end,
        "horizonDate": horizon,
        "generatedAt": generated_at,
        "classification": V4_CLASSIFICATION,
        "recommendationEligibility": V4_RECOMMENDATION_ELIGIBILITY,
        "runStatus": "COMPLETED",
        "lineage": lineage,
    }
    bundle = {"schemaVersion": V4_BUNDLE_SCHEMA, "run": run, "forecasts": records}
    lineage["payloadSha256"] = payload_sha256(bundle)
    return bundle
