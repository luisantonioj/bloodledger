"""Immutable Sprint 3 synthetic forecasting constants."""

from __future__ import annotations

from typing import Final

DATASET_VERSION: Final = "SYNTHETIC_FORECAST_V1"
GENERATOR_VERSION: Final = "bloodledger-synthetic-demand-1.0.0"
MODEL_VERSION: Final = "bloodledger-demand-forecast-1.0.0"
CLASSIFICATION: Final = "SYNTHETIC_DATA"
EVALUATION_CLASSIFICATION: Final = "SIMULATION_ONLY"
RECOMMENDATION_ELIGIBILITY: Final = "DISABLED_UNAPPROVED_POLICY"
INSTITUTION_ID: Final = "INST_MEDIATRIX"
DEFAULT_SEED: Final = 42
DEFAULT_START_DATE: Final = "2025-01-01"
DEFAULT_END_DATE: Final = "2025-12-31"
DEFAULT_HORIZON_DATE: Final = "2026-01-01"

BLOOD_TYPES: Final = ("A_POSITIVE", "O_POSITIVE")
COMPONENTS: Final = ("RED_BLOOD_CELLS", "PLATELETS")

BASE_DAILY_DEMAND: Final = {
    ("A_POSITIVE", "RED_BLOOD_CELLS"): 3,
    ("A_POSITIVE", "PLATELETS"): 1,
    ("O_POSITIVE", "RED_BLOOD_CELLS"): 5,
    ("O_POSITIVE", "PLATELETS"): 2,
}

DATA_COLUMNS: Final = (
    "business_date",
    "institution_id",
    "blood_type",
    "component",
    "opening_stock",
    "received_units",
    "expired_units",
    "adjustment_units",
    "requested_units",
    "issued_units",
    "unmet_units",
    "closing_stock",
    "stockout_flag",
    "classification",
    "dataset_version",
)

QUANTITY_COLUMNS: Final = (
    "opening_stock",
    "received_units",
    "expired_units",
    "adjustment_units",
    "requested_units",
    "issued_units",
    "unmet_units",
    "closing_stock",
    "stockout_flag",
)

SERIES_COLUMNS: Final = ("institution_id", "blood_type", "component")

PROHIBITED_FIELD_TERMS: Final = (
    "patient",
    "donor",
    "diagnosis",
    "treatment",
    "employee",
    "person_name",
    "first_name",
    "last_name",
    "birth",
    "address",
    "phone",
    "email",
    "medical_record",
)
