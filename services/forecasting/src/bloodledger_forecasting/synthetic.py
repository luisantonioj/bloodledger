"""Deterministic requested-demand and inventory simulation for Sprint 3."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from .constants import (
    BASE_DAILY_DEMAND,
    BLOOD_TYPES,
    CLASSIFICATION,
    COMPONENTS,
    DATA_COLUMNS,
    DATASET_VERSION,
    DEFAULT_END_DATE,
    DEFAULT_SEED,
    DEFAULT_START_DATE,
    INSTITUTION_ID,
)


@dataclass(frozen=True)
class SyntheticConfig:
    """Inputs that fully determine a synthetic dataset."""

    seed: int = DEFAULT_SEED
    start_date: str = DEFAULT_START_DATE
    end_date: str = DEFAULT_END_DATE


def generate_synthetic_data(config: SyntheticConfig | None = None) -> pd.DataFrame:
    """Generate four deterministic daily series with explicit inventory identities."""

    effective_config = config or SyntheticConfig()
    dates = pd.date_range(effective_config.start_date, effective_config.end_date, freq="D")
    if dates.empty or dates[0] > dates[-1]:
        raise ValueError("Synthetic date range must contain at least one day")

    random = np.random.default_rng(effective_config.seed)
    records: list[dict[str, object]] = []

    for blood_type in BLOOD_TYPES:
        for component in COMPONENTS:
            base_demand = BASE_DAILY_DEMAND[(blood_type, component)]
            target_stock = base_demand * 5
            opening_stock = target_stock

            for day_index, business_date in enumerate(dates):
                weekday_factor = 1.15 if business_date.weekday() < 5 else 0.85
                annual_factor = 1.0 + 0.15 * np.sin(
                    2.0 * np.pi * (business_date.dayofyear - 1) / 365.0
                )
                demand_rate = max(0.05, base_demand * weekday_factor * annual_factor)
                requested_units = int(random.poisson(demand_rate))

                replenishment_due = day_index % 7 == 0 or opening_stock < base_demand
                replenishment_missed = replenishment_due and random.random() < 0.12
                received_units = (
                    0
                    if not replenishment_due or replenishment_missed
                    else max(0, target_stock - opening_stock)
                )

                pre_expiry_stock = opening_stock + received_units
                expiry_event = pre_expiry_stock > 0 and random.random() < 0.025
                expired_units = min(pre_expiry_stock, 1) if expiry_event else 0
                adjustment_units = 0
                available_units = opening_stock + received_units + adjustment_units - expired_units
                issued_units = min(requested_units, available_units)
                unmet_units = requested_units - issued_units
                closing_stock = available_units - issued_units

                records.append(
                    {
                        "business_date": business_date,
                        "institution_id": INSTITUTION_ID,
                        "blood_type": blood_type,
                        "component": component,
                        "opening_stock": opening_stock,
                        "received_units": received_units,
                        "expired_units": expired_units,
                        "adjustment_units": adjustment_units,
                        "requested_units": requested_units,
                        "issued_units": issued_units,
                        "unmet_units": unmet_units,
                        "closing_stock": closing_stock,
                        "stockout_flag": int(unmet_units > 0),
                        "classification": CLASSIFICATION,
                        "dataset_version": DATASET_VERSION,
                    }
                )
                opening_stock = closing_stock

    result = pd.DataFrame.from_records(records, columns=DATA_COLUMNS)
    return result.sort_values(
        ["business_date", "institution_id", "blood_type", "component"],
        kind="stable",
    ).reset_index(drop=True)


def write_synthetic_csv(data: pd.DataFrame, destination: Path) -> None:
    """Write canonical CSV bytes so identical inputs produce an identical digest."""

    destination.parent.mkdir(parents=True, exist_ok=True)
    data.to_csv(
        destination,
        index=False,
        columns=DATA_COLUMNS,
        date_format="%Y-%m-%d",
        lineterminator="\n",
    )
