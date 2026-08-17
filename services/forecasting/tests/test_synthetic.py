from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from bloodledger_forecasting.constants import DATA_COLUMNS
from bloodledger_forecasting.errors import ForecastingError
from bloodledger_forecasting.synthetic import generate_synthetic_data, write_synthetic_csv
from bloodledger_forecasting.validation import sha256_file, validate_dataset


def test_generator_is_deterministic_and_complete(tmp_path: Path) -> None:
    first = generate_synthetic_data()
    second = generate_synthetic_data()
    pd.testing.assert_frame_equal(first, second)
    assert tuple(first.columns) == DATA_COLUMNS
    assert len(first) == 365 * 4
    assert first["business_date"].min().date().isoformat() == "2025-01-01"
    assert first["business_date"].max().date().isoformat() == "2025-12-31"
    assert first["stockout_flag"].sum() > 0

    first_path = tmp_path / "first.csv"
    second_path = tmp_path / "second.csv"
    write_synthetic_csv(first, first_path)
    write_synthetic_csv(second, second_path)
    assert sha256_file(first_path) == sha256_file(second_path)


def test_inventory_identities_and_requested_demand(synthetic_data: pd.DataFrame) -> None:
    validated = validate_dataset(synthetic_data)
    available = (
        validated["opening_stock"]
        + validated["received_units"]
        + validated["adjustment_units"]
        - validated["expired_units"]
    )
    assert (validated["issued_units"] <= available).all()
    assert (
        validated["unmet_units"] == validated["requested_units"] - validated["issued_units"]
    ).all()
    assert (validated["closing_stock"] == available - validated["issued_units"]).all()
    assert (validated["stockout_flag"] == (validated["unmet_units"] > 0).astype("int64")).all()
    assert (validated.loc[validated["stockout_flag"] == 1, "requested_units"] > 0).all()


@pytest.mark.parametrize(
    ("mutation", "error_code"),
    [
        (lambda data: data.drop(columns=["requested_units"]), "DATASET_SCHEMA_MISSING"),
        (lambda data: data.assign(unknown_value=1), "DATASET_SCHEMA_UNKNOWN"),
        (lambda data: data.assign(patient_name="PROHIBITED"), "PROHIBITED_FIELD"),
        (
            lambda data: pd.concat([data, data.iloc[[0]]], ignore_index=True),
            "DATASET_DUPLICATE",
        ),
        (lambda data: data.drop(index=data.index[0]), "DATASET_DATE_GAP"),
        (
            lambda data: data.assign(
                blood_type=data["blood_type"].mask(data.index == 0, "B_NEGATIVE")
            ),
            "DATASET_BLOOD_TYPE_INVALID",
        ),
        (
            lambda data: data.assign(
                requested_units=data["requested_units"].mask(data.index == 0, -1)
            ),
            "DATASET_QUANTITY_INVALID",
        ),
        (
            lambda data: data.assign(
                unmet_units=data["unmet_units"].mask(
                    data.index == 0, data.loc[data.index[0], "unmet_units"] + 1
                )
            ),
            "DATASET_BALANCE_INVALID",
        ),
        (
            lambda data: data.assign(
                stockout_flag=data["stockout_flag"].mask(
                    data.index == 0, 1 - data.loc[data.index[0], "stockout_flag"]
                )
            ),
            "DATASET_STOCKOUT_INVALID",
        ),
    ],
)
def test_validator_rejects_invalid_data(
    synthetic_data: pd.DataFrame,
    mutation: object,
    error_code: str,
) -> None:
    mutated = mutation(synthetic_data.copy())  # type: ignore[operator]
    with pytest.raises(ForecastingError) as captured:
        validate_dataset(mutated)
    assert captured.value.code == error_code
