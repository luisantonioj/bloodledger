"""Live-database probe for the stable run-key conflict contract."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from bloodledger_forecasting.errors import ForecastingError
from bloodledger_forecasting.persistence import (
    app_database_config_from_environment,
    connect_as_runtime,
    persist_forecast_bundle,
)


def main() -> int:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: postgres_conflict_probe.py FORECAST_BUNDLE")
    bundle = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    bundle["run"]["payload_sha256"] = "0" * 64
    connection = connect_as_runtime(app_database_config_from_environment())
    try:
        try:
            persist_forecast_bundle(connection, bundle)
        except ForecastingError as error:
            if error.code == "FORECAST_RUN_CONFLICT":
                print("Live PostgreSQL conflict behavior passed")
                return 0
            raise
    finally:
        connection.close()
    raise AssertionError("Changed payload unexpectedly reused an existing run key")


if __name__ == "__main__":
    raise SystemExit(main())
