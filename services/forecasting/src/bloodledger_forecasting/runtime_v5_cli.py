"""Explicit V5 application command; research preview remains independent."""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

from .errors import ForecastingError
from .runtime_v5 import create_v5_runtime_bundle


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Frozen V5 simulation-only runtime")
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--binding", required=True, type=Path)
    parser.add_argument("--institution-id", required=True)
    parser.add_argument("--request-id", required=True)
    parser.add_argument("--origin-date", required=True)
    parser.add_argument("--generated-at")
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--persist", action="store_true")
    args = parser.parse_args(argv)
    generated_at = args.generated_at or datetime.now(UTC).isoformat(
        timespec="milliseconds"
    ).replace("+00:00", "Z")
    try:
        bundle = create_v5_runtime_bundle(
            model_path=args.model,
            binding_path=args.binding,
            request_id=args.request_id,
            origin_date=args.origin_date,
            generated_at=generated_at,
            institution_id=args.institution_id,
            approved_binding_sha256=os.environ.get("BLOODLEDGER_V5_APPROVED_BINDING_SHA256", ""),
        )
        if args.persist:
            from .persistence import app_database_config_from_environment, connect_as_runtime
            from .persistence_v5 import persist_v5_runtime_bundle

            with connect_as_runtime(app_database_config_from_environment()) as connection:
                persistence = persist_v5_runtime_bundle(
                    connection,
                    bundle,
                    args.model,
                    args.binding,
                    os.environ.get("BLOODLEDGER_V5_APPROVED_BINDING_SHA256", ""),
                )
        else:
            persistence = None
        args.output.write_text(
            json.dumps(bundle, indent=2, sort_keys=True, allow_nan=False) + "\n", encoding="utf-8"
        )
    except ForecastingError as error:
        print(json.dumps({"status": "FAILED", "error_code": error.code}), file=sys.stderr)
        return 2
    print(
        json.dumps(
            {
                "status": bundle["run"]["runStatus"],
                "run_id": bundle["run"]["runId"],
                "forecast_count": len(bundle["forecasts"]),
                "persistence": persistence,
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
