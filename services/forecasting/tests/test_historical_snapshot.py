"""FR-14 historical extraction validates source identity and only returns synthetic counts."""

import hashlib
from pathlib import Path

import pandas as pd
import pytest

from bloodledger_forecasting import historical_snapshot as module
from bloodledger_forecasting.errors import ForecastingError
from bloodledger_forecasting.v5_experiment import SERIES, SHEETS


def test_explicit_day_and_hash_are_required(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    workbook = tmp_path / "synthetic.xlsx"
    workbook.write_bytes(b"FABRICATED_TEST_WORKBOOK")
    digest = hashlib.sha256(workbook.read_bytes()).hexdigest()
    with pytest.raises(ForecastingError):
        module.extract(workbook, "wrong", "2026-01-02")
    rows = pd.DataFrame(
        [
            {
                "date": pd.Timestamp("2026-01-02"),
                "blood_type": b,
                "component": c,
                "available_close_units": 1,
                "reserved_close_units": 2,
                "closing_units": 3,
            }
            for b, c in SERIES
        ]
    )
    calls: list[str] = []
    monkeypatch.setattr(module, "read_synthetic", lambda _: {SHEETS[2]: rows})
    monkeypatch.setattr(module, "validate", lambda _: calls.append("full-v5-validator"))
    result = module.extract(workbook, digest, "2026-01-02")
    assert calls == ["full-v5-validator"]
    assert result["workbookSha256"] == digest
    assert len(result["counts"]) == 20
    assert {row["componentType"] for row in result["counts"]} == set(module.COMPONENT.values())
    with pytest.raises(ForecastingError):
        module.extract(workbook, digest, "2026-01-03")


def test_existing_validator_failure_prevents_extraction(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    workbook = tmp_path / "synthetic.xlsx"
    workbook.write_bytes(b"FABRICATED_TEST_WORKBOOK")
    monkeypatch.setattr(module, "read_synthetic", lambda _: {})

    def reject(_: object) -> None:
        raise ForecastingError("V5_CLASSIFICATION", "synthetic fixture failure")

    monkeypatch.setattr(module, "validate", reject)
    with pytest.raises(ForecastingError, match="synthetic fixture failure"):
        module.extract(workbook, hashlib.sha256(workbook.read_bytes()).hexdigest(), "2026-01-02")
