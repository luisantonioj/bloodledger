"""Frozen V5 saved-mean application adapter; no workbook, fitting or inventory input."""

from __future__ import annotations

import hashlib
import json
import math
import re
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from .errors import ForecastingError

V5_BUNDLE_SCHEMA = "BLOODLEDGER_FORECAST_BUNDLE_V5_RUNTIME_V1"
V5_DATASET_VERSION = "SYNTHETIC_FORECAST_V5_RUNTIME_V1"
V5_MODEL_VERSION = "bloodledger-v5-series-mean-1.0.0"
V5_MODEL_NAME = "series_mean"
V5_MODEL_FILE_SHA256 = "1e0f0c240109e49e8f1a89a713021afae07c2f5fae5b0e2bc8e3904610fb9764"
V5_MODEL_SHA256 = "ceb0e74b2eb2f8af7fcafabb3619f2a23681c38eac65998816e7daf40b5afb86"
V5_WORKBOOK_SHA256 = "5c5997bd4df26f6f0d52d7ea13dde0172706faaa15308ebc87f241f44c241ddb"
V5_RESEARCH_CODE_SHA256 = "0acda319a60ab946e6172a047dad569668cf973889e1976d7e6c11d09d9d5d64"
V5_PROTOCOL_SHA256 = "e78e7c910119839ca8a06266a84bf475914016da04c885342de85c7ab7f4a08e"
V5_TRAINING_CUTOFF = "2025-06-30"
V5_BINDING_VERSION = "SYNTHETIC_V5_INSTITUTION_BINDING_V1"
V5_CLASSIFICATION = "SIMULATION_ONLY"
V5_ELIGIBILITY = "DISABLED_UNAPPROVED_POLICY"
V5_UNCERTAINTY_NOTE = "UNCERTAINTY_UNAVAILABLE_NOT_CALIBRATED"
BLOOD_TYPES = ("A+", "B+", "O+", "AB+")
COMPONENTS = ("WB", "PRBC", "FFP", "PC", "CRYO")
BLOOD_TYPE_MAP = {"A+": "A_POSITIVE", "B+": "B_POSITIVE", "O+": "O_POSITIVE", "AB+": "AB_POSITIVE"}
COMPONENT_MAP = {
    "WB": "WHOLE_BLOOD",
    "PRBC": "PACKED_RED_BLOOD_CELLS",
    "FFP": "FRESH_FROZEN_PLASMA",
    "PC": "PLATELETS",
    "CRYO": "CRYOPRECIPITATE",
}
SERIES = tuple((blood, component) for blood in BLOOD_TYPES for component in COMPONENTS)
CONFIGURATION = {
    "method": V5_MODEL_NAME,
    "horizonDays": 1,
    "timezone": "Asia/Manila",
    "trainingCutoffDate": V5_TRAINING_CUTOFF,
    "uncertainty": "unavailable",
    "modelSha256": V5_MODEL_SHA256,
    "series": [[blood, component] for blood, component in SERIES],
}


def canonical_hash(value: object) -> str:
    """The research runner's exact JSON canonicalization."""
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, allow_nan=False, separators=(",", ":")).encode()
    ).hexdigest()


def runtime_code_hash() -> str:
    return hashlib.sha256(Path(__file__).read_bytes()).hexdigest()


def _strict_date(value: str) -> date:
    try:
        parsed = date.fromisoformat(value)
    except (TypeError, ValueError) as error:
        raise ForecastingError("V5_DATE_INVALID", "Origin date must be YYYY-MM-DD") from error
    if parsed.isoformat() != value:
        raise ForecastingError("V5_DATE_INVALID", "Origin date must be YYYY-MM-DD")
    return parsed


def _strict_instant(value: str) -> str:
    try:
        parsed = datetime.fromisoformat(value)
    except (TypeError, ValueError) as error:
        raise ForecastingError("V5_INSTANT_INVALID", "Generated time must be UTC") from error
    if parsed.tzinfo is None or parsed.utcoffset() != timedelta(0):
        raise ForecastingError("V5_INSTANT_INVALID", "Generated time must be UTC")
    normalized = parsed.astimezone(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    if normalized != value:
        raise ForecastingError("V5_INSTANT_INVALID", "Generated time must be canonical UTC")
    return normalized


def read_binding(path: Path) -> dict[str, Any]:
    """External, explicitly enabled synthetic mapping; never infer from alias."""
    try:
        binding = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        raise ForecastingError("V5_BINDING_UNAVAILABLE", "Binding is unavailable") from error
    if not isinstance(binding, dict) or set(binding) != {
        "schemaVersion",
        "bindingId",
        "researchInstitutionId",
        "institutionId",
        "modelSha256",
        "enabled",
    }:
        raise ForecastingError("V5_BINDING_INVALID", "Binding shape is invalid")
    if (
        binding["schemaVersion"] != V5_BINDING_VERSION
        or not isinstance(binding["bindingId"], str)
        or not re.fullmatch(r"V5_BIND_[A-Z0-9_-]{1,48}", binding["bindingId"])
        or binding["researchInstitutionId"] != "SIM_INSTITUTION_01"
        or not isinstance(binding["institutionId"], str)
        or not re.fullmatch(r"INST_[A-Z0-9_-]{1,59}", binding["institutionId"])
        or binding["modelSha256"] != V5_MODEL_SHA256
        or binding["enabled"] is not True
    ):
        raise ForecastingError("V5_BINDING_INVALID", "Binding is not enabled for this model")
    return binding


def read_model(path: Path) -> tuple[dict[str, Any] | None, str | None]:
    """Return safe unavailability for missing/corrupt pinned parameters."""
    try:
        content = path.read_bytes()
    except OSError:
        return None, "V5_MODEL_UNAVAILABLE"
    if hashlib.sha256(content).hexdigest() != V5_MODEL_FILE_SHA256:
        return None, "V5_MODEL_HASH_INVALID"
    try:
        model = json.loads(content)
    except ValueError:
        return None, "V5_MODEL_INVALID"
    if not isinstance(model, dict) or set(model) != {"name", "version", "means"}:
        return None, "V5_MODEL_INVALID"
    means = model["means"]
    if (
        model["name"] != V5_MODEL_NAME
        or model["version"] != V5_MODEL_VERSION
        or not isinstance(means, list)
        or len(means) != len(SERIES)
        or any(
            isinstance(value, bool)
            or not isinstance(value, (int, float))
            or not math.isfinite(float(value))
            or float(value) < 0
            for value in means
        )
        or canonical_hash(model) != V5_MODEL_SHA256
    ):
        return None, "V5_MODEL_INVALID"
    return model, None


def payload_hash(bundle: dict[str, Any]) -> str:
    run = dict(bundle["run"])
    run.pop("generatedAt", None)
    run["lineage"] = {key: value for key, value in run["lineage"].items() if key != "payloadSha256"}
    return canonical_hash(
        {"schemaVersion": bundle["schemaVersion"], "run": run, "forecasts": bundle["forecasts"]}
    )


def create_v5_runtime_bundle(
    *,
    model_path: Path,
    binding_path: Path,
    request_id: str,
    origin_date: str,
    generated_at: str,
    institution_id: str,
) -> dict[str, Any]:
    """Forecast from frozen means only; inventory is never an input or output."""
    binding = read_binding(binding_path)
    if institution_id != binding["institutionId"]:
        raise ForecastingError("V5_INSTITUTION_SCOPE_INVALID", "Request institution is not bound")
    if not re.fullmatch(r"V5_REQ_[A-Z0-9_-]{1,48}", request_id):
        raise ForecastingError("V5_REQUEST_ID_INVALID", "Request ID is invalid")
    origin = _strict_date(origin_date)
    instant = _strict_instant(generated_at)
    horizon = origin + timedelta(days=1)
    if (
        datetime.fromisoformat(instant.replace("Z", "+00:00"))
        .astimezone(ZoneInfo("Asia/Manila"))
        .date()
        < origin
    ):
        raise ForecastingError("V5_FUTURE_ORIGIN_INVALID", "Origin is after generation date")
    model, unavailable = read_model(model_path)
    run_digest = canonical_hash({"requestId": request_id, "institutionId": institution_id})
    run_id = f"RUN_{run_digest[:32].upper()}"
    lineage = {
        "datasetSha256": V5_WORKBOOK_SHA256,
        "researchCodeSha256": V5_RESEARCH_CODE_SHA256,
        "protocolSha256": V5_PROTOCOL_SHA256,
        "runtimeCodeSha256": runtime_code_hash(),
        "modelFileSha256": V5_MODEL_FILE_SHA256,
        "modelSha256": V5_MODEL_SHA256,
        "bindingSha256": canonical_hash(binding),
        "configurationSha256": canonical_hash(CONFIGURATION),
        "inputSha256": canonical_hash(
            {
                "requestId": request_id,
                "institutionId": institution_id,
                "originDate": origin_date,
                "horizonDate": horizon.isoformat(),
            }
        ),
        "trainingCutoffDate": V5_TRAINING_CUTOFF,
    }
    run: dict[str, Any] = {
        "runId": run_id,
        "runKey": f"RUNKEY_{run_digest[:32].upper()}",
        "requestId": request_id,
        "institutionId": institution_id,
        "originDate": origin_date,
        "horizonDate": horizon.isoformat(),
        "generatedAt": instant,
        "datasetVersion": V5_DATASET_VERSION,
        "modelVersion": V5_MODEL_VERSION,
        "modelName": V5_MODEL_NAME,
        "target": "requested_units",
        "runStatus": "UNAVAILABLE" if unavailable else "COMPLETED",
        "unavailableReason": unavailable,
        "classification": V5_CLASSIFICATION,
        "recommendationEligibility": V5_ELIGIBILITY,
        "lineage": lineage,
    }
    forecasts = []
    if model is not None:
        for (blood, component), value in zip(SERIES, model["means"], strict=True):
            blood_type = BLOOD_TYPE_MAP[blood]
            component_type = COMPONENT_MAP[component]
            forecast_digest = canonical_hash(
                {"runId": run_id, "bloodType": blood_type, "component": component_type}
            )
            forecasts.append(
                {
                    "forecastId": f"FC_{forecast_digest[:40].upper()}",
                    "institutionId": institution_id,
                    "bloodType": blood_type,
                    "component": component_type,
                    "asOfDate": origin_date,
                    "horizonDate": horizon.isoformat(),
                    "pointForecast": float(value),
                    "lowerForecast": None,
                    "upperForecast": None,
                    "uncertaintyStatus": "UNCERTAINTY_UNAVAILABLE",
                    "uncertaintyNote": V5_UNCERTAINTY_NOTE,
                    "forecastStatus": "AVAILABLE",
                    "staleAfter": horizon.isoformat(),
                    "classification": V5_CLASSIFICATION,
                    "recommendationEligibility": V5_ELIGIBILITY,
                }
            )
    bundle = {"schemaVersion": V5_BUNDLE_SCHEMA, "run": run, "forecasts": forecasts}
    lineage["payloadSha256"] = payload_hash(bundle)
    return bundle
