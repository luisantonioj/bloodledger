"""Issue #9 producer identity regression against an isolated real database."""

from __future__ import annotations

import json
import sys
from copy import deepcopy
from pathlib import Path

import pandas as pd

from bloodledger_forecasting.errors import ForecastingError
from bloodledger_forecasting.persistence import (
    app_database_config_from_environment,
    connect_as_runtime,
    persist_v4_runtime_bundle,
)
from bloodledger_forecasting.runtime_v4 import create_v4_runtime_bundle, payload_sha256


def main() -> None:
    path = Path(sys.argv[1])
    data = pd.read_csv(path)
    first = create_v4_runtime_bundle(data, dataset_path=path, generated_at="2026-01-08T00:00:00Z")
    other = create_v4_runtime_bundle(
        data,
        dataset_path=path,
        generated_at="2026-01-08T00:00:00Z",
        institution_id="INST_SYNTHETIC_DESTINATION",
    )
    variant = path.with_name("v4-variant.csv")
    variant.write_bytes(path.read_bytes().replace(b"\r\n", b"\n") + b"\n")
    revised = create_v4_runtime_bundle(
        data, dataset_path=variant, generated_at="2026-01-08T01:00:00Z"
    )
    connection = connect_as_runtime(app_database_config_from_environment())
    try:
        assert persist_v4_runtime_bundle(connection, first) == "EXISTING"
        assert persist_v4_runtime_bundle(connection, other) == "INSERTED"
        assert persist_v4_runtime_bundle(connection, revised) == "INSERTED"
        assert persist_v4_runtime_bundle(connection, revised) == "EXISTING"
        for run in (first, other, revised):
            stored = connection.execute(
                "SELECT count(*) FROM app.demand_forecasts WHERE run_id=%s", (run["run"]["runId"],)
            ).fetchone()
            assert stored is not None and stored[0] == 20
        conflicting = deepcopy(revised)
        conflicting["forecasts"][0]["pointForecast"] += 1
        conflicting["run"]["lineage"]["payloadSha256"] = payload_sha256(conflicting)
        try:
            persist_v4_runtime_bundle(connection, conflicting)
        except ForecastingError as error:
            assert error.code == "FORECAST_RUN_CONFLICT"
        else:
            raise AssertionError("Changed forecast accepted under existing run identity")
        crossed = deepcopy(revised)
        crossed["forecasts"][0]["institutionId"] = "INST_SYNTHETIC_DESTINATION"
        crossed["run"]["lineage"]["payloadSha256"] = payload_sha256(crossed)
        try:
            persist_v4_runtime_bundle(connection, crossed)
        except ForecastingError as error:
            assert error.code == "FORECAST_BUNDLE_INVALID"
        else:
            raise AssertionError("Cross-institution row accepted")
    finally:
        connection.close()
    missing = data.astype({"requested_units": "object"})
    missing.loc[0, "requested_units"] = None
    missing.to_csv(path.with_name("v4-null.csv"), index=False)
    data.loc[data.business_date <= "2026-01-03"].to_csv(path.with_name("v4-short.csv"), index=False)
    path.with_name("producer-check.json").write_text(
        json.dumps(
            {
                "status": "PASS",
                "checks": ["institution", "file-lineage", "replay", "conflict", "scope"],
            }
        )
    )
    print(
        "V4 producer: cross-institution and file-lineage persistence, "
        "replay, conflict and scope passed"
    )


if __name__ == "__main__":
    main()
