"""Strict validation for the Sprint 3 synthetic dataset boundary."""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

import numpy as np
import pandas as pd

from .constants import (
    BLOOD_TYPES,
    CLASSIFICATION,
    COMPONENTS,
    DATA_COLUMNS,
    DATASET_VERSION,
    INSTITUTION_ID,
    PROHIBITED_FIELD_TERMS,
    QUANTITY_COLUMNS,
    SERIES_COLUMNS,
)
from .errors import ForecastingError


def sha256_file(path: Path) -> str:
    """Return the SHA-256 digest of a file without loading it all into memory."""

    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _normalized_field_name(value: object) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(value).strip().lower()).strip("_")


def validate_dataset(data: pd.DataFrame) -> pd.DataFrame:
    """Validate and return a normalized copy of the approved synthetic contract."""

    normalized_names = {_normalized_field_name(column): str(column) for column in data.columns}
    for term in PROHIBITED_FIELD_TERMS:
        if any(term in name for name in normalized_names):
            raise ForecastingError(
                "PROHIBITED_FIELD",
                "Dataset includes a prohibited personal or clinical field",
            )

    required = set(DATA_COLUMNS)
    actual = set(map(str, data.columns))
    missing = sorted(required - actual)
    unknown = sorted(actual - required)
    if missing:
        raise ForecastingError("DATASET_SCHEMA_MISSING", f"Missing required fields: {missing}")
    if unknown:
        raise ForecastingError("DATASET_SCHEMA_UNKNOWN", f"Unknown fields: {unknown}")
    if data.empty:
        raise ForecastingError("DATASET_EMPTY", "Dataset contains no rows")
    if data.isna().any().any():
        raise ForecastingError("DATASET_MISSING_VALUE", "Dataset contains missing values")

    result = data.loc[:, DATA_COLUMNS].copy()
    parsed_dates = pd.to_datetime(result["business_date"], errors="coerce")
    if parsed_dates.isna().any():
        raise ForecastingError("DATASET_DATE_INVALID", "business_date must be a valid date")
    result["business_date"] = parsed_dates.dt.normalize()

    for column in QUANTITY_COLUMNS:
        numeric = pd.to_numeric(result[column], errors="coerce")
        if numeric.isna().any() or not np.isfinite(numeric.to_numpy(dtype=float)).all():
            raise ForecastingError("DATASET_QUANTITY_INVALID", f"{column} must be finite")
        if (numeric < 0).any() or (numeric % 1 != 0).any():
            raise ForecastingError(
                "DATASET_QUANTITY_INVALID", f"{column} must be a non-negative integer"
            )
        result[column] = numeric.astype("int64")

    if set(result["institution_id"]) != {INSTITUTION_ID}:
        raise ForecastingError("DATASET_INSTITUTION_INVALID", "Unsupported institution_id")
    if set(result["blood_type"]) != set(BLOOD_TYPES):
        raise ForecastingError("DATASET_BLOOD_TYPE_INVALID", "Unsupported blood_type set")
    if set(result["component"]) != set(COMPONENTS):
        raise ForecastingError("DATASET_COMPONENT_INVALID", "Unsupported component set")
    if set(result["classification"]) != {CLASSIFICATION}:
        raise ForecastingError("DATASET_CLASSIFICATION_INVALID", "Invalid classification")
    if set(result["dataset_version"]) != {DATASET_VERSION}:
        raise ForecastingError("DATASET_VERSION_INVALID", "Invalid dataset_version")

    duplicate_columns = [*SERIES_COLUMNS, "business_date"]
    if result.duplicated(duplicate_columns).any():
        raise ForecastingError("DATASET_DUPLICATE", "Duplicate series date detected")

    expected_series = {
        (INSTITUTION_ID, blood_type, component)
        for blood_type in BLOOD_TYPES
        for component in COMPONENTS
    }
    actual_series = set(result.loc[:, SERIES_COLUMNS].itertuples(index=False, name=None))
    if actual_series != expected_series:
        raise ForecastingError("DATASET_SERIES_INVALID", "Dataset must contain four series")

    ordered = result.sort_values([*SERIES_COLUMNS, "business_date"], kind="stable")
    common_start = ordered["business_date"].min()
    common_end = ordered["business_date"].max()
    expected_dates = pd.DatetimeIndex(pd.date_range(common_start, common_end, freq="D"))
    for _, series in ordered.groupby(list(SERIES_COLUMNS), sort=False):
        actual_dates = pd.DatetimeIndex(series["business_date"])
        if not actual_dates.equals(expected_dates):
            raise ForecastingError("DATASET_DATE_GAP", "Every series must contain every day")
        prior_closing = series["closing_stock"].shift(1)
        comparable = prior_closing.notna()
        if not np.array_equal(
            series.loc[comparable, "opening_stock"].to_numpy(dtype="int64"),
            prior_closing.loc[comparable].to_numpy(dtype="int64"),
        ):
            raise ForecastingError(
                "DATASET_OPENING_MISMATCH", "opening_stock must equal prior closing_stock"
            )

    available = (
        result["opening_stock"]
        + result["received_units"]
        + result["adjustment_units"]
        - result["expired_units"]
    )
    if (available < 0).any():
        raise ForecastingError("DATASET_BALANCE_INVALID", "Available stock cannot be negative")
    if (result["issued_units"] > available).any():
        raise ForecastingError("DATASET_BALANCE_INVALID", "issued_units exceeds availability")
    if not (result["unmet_units"] == result["requested_units"] - result["issued_units"]).all():
        raise ForecastingError("DATASET_BALANCE_INVALID", "unmet_units identity failed")
    if not (result["closing_stock"] == available - result["issued_units"]).all():
        raise ForecastingError("DATASET_BALANCE_INVALID", "closing_stock identity failed")
    expected_stockout = (result["unmet_units"] > 0).astype("int64")
    if not (result["stockout_flag"] == expected_stockout).all():
        raise ForecastingError("DATASET_STOCKOUT_INVALID", "stockout_flag identity failed")

    return result.sort_values(["business_date", *SERIES_COLUMNS], kind="stable").reset_index(
        drop=True
    )


def load_and_validate_csv(path: Path) -> pd.DataFrame:
    """Load a CSV without implicit index/date behavior and validate its contract."""

    if not path.is_file():
        raise ForecastingError("DATASET_NOT_FOUND", "Dataset file does not exist")
    return validate_dataset(pd.read_csv(path, dtype={"business_date": "string"}))
