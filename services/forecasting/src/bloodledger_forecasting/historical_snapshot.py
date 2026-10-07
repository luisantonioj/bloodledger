"""Read-only extraction of one V5 synthetic stock day; emits no observed rows."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from .v5_experiment import SHEETS, read_synthetic, require, validate

BLOOD = {"A+": "A_POSITIVE", "B+": "B_POSITIVE", "O+": "O_POSITIVE", "AB+": "AB_POSITIVE"}
COMPONENT = {"WB": "WHOLE_BLOOD", "PRBC": "PACKED_RED_BLOOD_CELLS", "FFP": "FRESH_FROZEN_PLASMA", "PC": "PLATELETS", "CRYO": "CRYOPRECIPITATE"}


def extract(workbook: Path, expected_sha256: str, business_date: str) -> dict[str, object]:
    """Check file identity and the existing full V5 balance/coverage contract."""
    require(workbook.is_file(), "HISTORICAL_WORKBOOK_MISSING")
    actual = hashlib.sha256(workbook.read_bytes()).hexdigest()
    require(actual == expected_sha256, "HISTORICAL_WORKBOOK_HASH_MISMATCH")
    tables = read_synthetic(workbook)
    validate(tables)
    stock = tables[SHEETS[2]]
    rows = stock[stock.date.dt.strftime("%Y-%m-%d") == business_date]
    require(len(rows) == 20, "HISTORICAL_DATE_MISSING")
    return {
        "workbookSha256": actual,
        "businessDate": business_date,
        "counts": [
            {"bloodType": BLOOD[row.blood_type], "componentType": COMPONENT[row.component],
             "available": int(row.available_close_units), "reserved": int(row.reserved_close_units),
             "closing": int(row.closing_units)}
            for row in rows.itertuples()
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workbook", type=Path, required=True)
    parser.add_argument("--sha256", required=True)
    parser.add_argument("--business-date", required=True)
    args = parser.parse_args()
    print(json.dumps(extract(args.workbook, args.sha256, args.business_date), sort_keys=True))


if __name__ == "__main__":
    main()
