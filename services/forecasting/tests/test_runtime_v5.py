"""FR-14 / BR-ALG-07: frozen saved-mean V5 adapter boundary."""

import json
from pathlib import Path

import pytest

from bloodledger_forecasting.errors import ForecastingError
from bloodledger_forecasting.runtime_v5 import (
    COMPONENT_MAP,
    SERIES,
    V5_BINDING_VERSION,
    V5_MODEL_SHA256,
    create_v5_runtime_bundle,
    read_model,
)


def binding(tmp_path: Path, institution: str = "INST_SYNTHETIC") -> Path:
    path = tmp_path / "binding.json"
    path.write_text(
        json.dumps(
            {
                "schemaVersion": V5_BINDING_VERSION,
                "bindingId": "V5_BIND_TEST",
                "researchInstitutionId": "SIM_INSTITUTION_01",
                "institutionId": institution,
                "modelSha256": V5_MODEL_SHA256,
                "enabled": True,
            }
        )
    )
    return path


def produce(model_path: Path, binding_path: Path, **changes: str) -> dict:
    args = {
        "model_path": model_path,
        "binding_path": binding_path,
        "request_id": "V5_REQ_TEST",
        "origin_date": "2026-09-28",
        "generated_at": "2026-09-28T12:00:00.000Z",
        "institution_id": "INST_SYNTHETIC",
    }
    args.update(changes)
    return create_v5_runtime_bundle(**args)


def test_missing_model_is_unavailable_without_zero_fallback(tmp_path: Path) -> None:
    result = produce(tmp_path / "missing.json", binding(tmp_path))
    assert result["run"]["runStatus"] == "UNAVAILABLE"
    assert result["run"]["horizonDate"] == "2026-09-29"
    assert result["forecasts"] == []


def test_bad_binding_fails_closed(tmp_path: Path) -> None:
    path = binding(tmp_path)
    data = json.loads(path.read_text())
    data["enabled"] = False
    path.write_text(json.dumps(data))
    with pytest.raises(ForecastingError, match="V5_BINDING_INVALID"):
        produce(tmp_path / "missing.json", path)
    with pytest.raises(ForecastingError, match="V5_INSTITUTION_SCOPE_INVALID"):
        produce(tmp_path / "missing.json", binding(tmp_path), institution_id="INST_OTHER")


def test_invalid_origin_or_instant_fails(tmp_path: Path) -> None:
    path = binding(tmp_path)
    with pytest.raises(ForecastingError, match="V5_DATE_INVALID"):
        produce(tmp_path / "missing.json", path, origin_date="2026-02-30")
    with pytest.raises(ForecastingError, match="V5_FUTURE_ORIGIN_INVALID"):
        produce(tmp_path / "missing.json", path, origin_date="2026-09-30")
    with pytest.raises(ForecastingError, match="V5_INSTANT_INVALID"):
        produce(tmp_path / "missing.json", path, generated_at="2026-09-28T12:00:00Z")


def test_order_and_frozen_means_against_external_release(tmp_path: Path) -> None:
    import os

    release = os.environ.get("BLOODLEDGER_V5_MODEL_TEST_PATH")
    if not release:
        pytest.skip("External release model is not configured")
    model_path = Path(release)
    model, error = read_model(model_path)
    assert error is None and model is not None
    before = model_path.read_bytes()
    result = produce(model_path, binding(tmp_path))
    assert result["run"]["runStatus"] == "COMPLETED"
    assert len(result["forecasts"]) == 20
    for row, (_, component), mean in zip(result["forecasts"], SERIES, model["means"], strict=True):
        assert row["component"] == COMPONENT_MAP[component]
        assert row["pointForecast"] == mean
        assert row["lowerForecast"] is None
    assert model_path.read_bytes() == before
    replay = produce(model_path, binding(tmp_path), generated_at="2026-09-28T13:00:00.000Z")
    assert replay["run"]["runId"] == result["run"]["runId"]
    assert replay["run"]["lineage"]["payloadSha256"] == result["run"]["lineage"]["payloadSha256"]


def test_corrupted_release_is_unavailable(tmp_path: Path) -> None:
    path = tmp_path / "bad.json"
    path.write_text('{"name":"series_mean","means":[0]}')
    result = produce(path, binding(tmp_path))
    assert result["run"]["unavailableReason"] == "V5_MODEL_HASH_INVALID"
    assert result["forecasts"] == []
