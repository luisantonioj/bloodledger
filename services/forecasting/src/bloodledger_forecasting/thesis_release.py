"""Verify the frozen v4 release and assemble external thesis evidence without refitting."""

from __future__ import annotations

import argparse
import csv
import json
import statistics
import sys
from datetime import UTC, datetime
from pathlib import Path
from shutil import copyfile
from typing import Any

from .errors import ForecastingError
from .validation import sha256_file

WORKBOOK_SHA256 = "76a188830467d290af26c2d01459e5b3ef470f8b552568cdbe89fe3118002dbd"
MANIFEST_SHA256 = "1f927e1c26966f50ed3cb0df88be392e6f110b7e368d2b87bb286925be9156ec"
SUPPORTED = {("A+", "PRBC"), ("O+", "PRBC"), ("A+", "PC"), ("O+", "PC")}


def verify_manifest(root: Path, expected_hash: str) -> int:
    """Check every frozen artifact; never deserialize the model pickle."""
    manifest = root / "artifact-manifest.json"
    if sha256_file(manifest) != expected_hash:
        raise ForecastingError("RELEASE_HASH_MISMATCH", "Unexpected release manifest")
    entries = json.loads(manifest.read_text(encoding="utf-8"))
    if not isinstance(entries, dict) or not entries:
        raise ForecastingError("RELEASE_INVALID", "Empty or invalid release manifest")
    for name, digest in entries.items():
        path = (root / name).resolve()
        if not path.is_relative_to(root.resolve()) or not path.is_file():
            raise ForecastingError("RELEASE_PATH_INVALID", "Artifact missing or outside release")
        if sha256_file(path) != digest:
            raise ForecastingError("RELEASE_HASH_MISMATCH", "An artifact changed")
    return len(entries)


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def assemble(workbook: Path, release: Path, output: Path) -> dict[str, Any]:
    if sha256_file(workbook) != WORKBOOK_SHA256:
        raise ForecastingError("WORKBOOK_HASH_MISMATCH", "Expected frozen workbook v4")
    count = verify_manifest(release, MANIFEST_SHA256)
    repository = next((p for p in Path(__file__).resolve().parents if (p / ".git").exists()), None)
    if repository is not None and output.resolve().is_relative_to(repository):
        raise ForecastingError("OUTPUT_UNSAFE", "Thesis evidence must remain outside Git")
    if output.exists():
        raise ForecastingError("OUTPUT_EXISTS", "Choose a new directory")
    results = json.loads((release / "results.json").read_text(encoding="utf-8"))
    protocol = json.loads((release / "protocol.json").read_text(encoding="utf-8"))
    metrics: list[dict[str, Any]] = []
    summaries: list[dict[str, Any]] = []
    for result in results:
        partitions = [("validation", k, v) for k, v in result["validation"].items()]
        partitions.append(("test", result["selected_model"], result["test_selected"]))
        for partition, model, values in partitions:
            for group, scores in {"POOLED": values["pooled"], **values["series"]}.items():
                metrics.append(
                    {
                        "scenario": result["scenario"],
                        "seed": result["seed"],
                        "partition": partition,
                        "model": model,
                        "series": group,
                        **scores,
                        "classification": "SIMULATION_ONLY",
                    }
                )
    for scenario in ("ordinary", "sparse", "shift"):
        subset = [r["test_selected"]["pooled"] for r in results if r["scenario"] == scenario]
        summaries.append(
            {
                "scenario": scenario,
                "runs": len(subset),
                "mean_mae": statistics.mean(r["mae"] for r in subset),
                "seed_sd_mae": statistics.stdev(r["mae"] for r in subset),
                "mean_rmse": statistics.mean(r["rmse"] for r in subset),
            }
        )
    # Historical scored replay: do not change target dates to make stale data look current.
    with (release / "ordinary-11" / "demo-forecast.csv").open(newline="") as stream:
        demo = list(csv.DictReader(stream))
    for row in demo:
        row["runtime_category_supported"] = (row["blood_type"], row["component"]) in SUPPORTED
        row["runtime_import_allowed"] = False
        row["status"] = "HISTORICAL_SCORED_REPLAY"
        row["uncertainty"] = "NOT_CALIBRATED"
    evidence = {
        "release": "WORKBOOK_V4_HANDOFF_V1",
        "workbook_sha256": WORKBOOK_SHA256,
        "manifest_sha256": MANIFEST_SHA256,
        "verified_artifacts": count,
        "frozen_code_sha256": protocol["code_sha256"],
        "runs": len(results),
        "metric_rows": len(metrics),
        "classification": "SIMULATION_ONLY",
        "assembled_at": datetime.now(UTC).isoformat(),
        "refit_performed": False,
        "runtime_replaced": False,
        "real_accuracy": "UNAVAILABLE_UNKNOWN_COVERAGE",
    }
    output.mkdir(parents=True)
    for name in (
        "coverage.json",
        "observed-by-month.csv",
        "observed-by-blood_type.csv",
        "observed-by-component.csv",
        "observed-monthly.svg",
        "protocol.json",
    ):
        copyfile(release / name, output / name)
    copyfile(release / "ordinary-11" / "demand.svg", output / "synthetic-ordinary11.svg")
    write_csv(output / "all-metrics.csv", metrics)
    write_csv(output / "scenario-summary.csv", summaries)
    write_csv(output / "historical-replay.csv", demo)
    (output / "release-verification.json").write_text(json.dumps(evidence, indent=2) + "\n")
    lines = [
        "# BloodLedger v4 — thesis results and model card",
        "",
        "SIMULATION_ONLY. This package verifies an existing study; no refitting was performed.",
        "",
        "## Data and methodology",
        "Workbook v4 contains 19 sheets. Frozen calibration: 2,107 accepted entries, "
        "955 aggregates and 3,984 requested units. Revised descriptive scope: 2,108 entries "
        "and 3,987 units. These overlapping scopes must not be added together.",
        "The sample covers 229 recorded dates in January 1–September 7, 2026. "
        "The other 21 dates are unknown, not zero. No daily stock history is available.",
        "The study uses 15 independent scenarios: three settings × five seeds; each has "
        "21,920 generated rows across 20 series and 1,096 dates in 2023–2025. "
        "The total of 328,800 rows is simulated, not collected hospital history.",
        "Each run has 14,060 training, 3,620 validation and 3,680 test feature rows. "
        "Training ends December 2024; validation ends June 2025; testing ends December 2025. "
        "The first 28 days provide feature warmup. Testing is rolling next-day prediction, "
        "using earlier simulated observations without test-period model refitting.",
        "",
        "## Model decision and measured results",
        "Weighted average 7 was selected in all 15 runs. Predictions weight the seven "
        "previous observed days from 1 (oldest) to 7 (newest), divided by 28. "
        "The random forest did not meet every validation promotion guard. "
        "This does not establish universal superiority.",
        "",
        "| Scenario | Runs | Mean test MAE | Seed SD of MAE | Mean test RMSE |",
        "|---|---:|---:|---:|---:|",
    ]
    for s in summaries:
        lines.append(
            f"| {s['scenario']} | {s['runs']} | {s['mean_mae']:.4f} | "
            f"{s['seed_sd_mae']:.4f} | {s['mean_rmse']:.4f} |"
        )
    lines += [
        "",
        "All 1,260 pooled/per-series model comparisons are in all-metrics.csv. "
        "Blank WAPE means undefined because the actual total is zero. Units differ by "
        "component; pooled errors must be read with the per-series results.",
        "",
        "## Intended use and limitations",
        "Intended use: thesis simulation and software demonstration. Forecasts cannot "
        "approve transfers. Recommendation eligibility stays DISABLED_UNAPPROVED_POLICY.",
        "The 2023–2025 dates are invented and their scales use incomplete 2026 samples. "
        "Imposed calendar effects, shocks and shifts are assumptions. Seed variability "
        "is not a prediction interval; no calibrated uncertainty bounds are available. "
        "Real hospital accuracy, expiry reduction and stockout reduction are not established. "
        "Diagnosis is excluded from this implementation and no clinical-use patterns are inferred.",
        "",
        "## Application compatibility",
        "The accepted runtime remains SYNTHETIC_FORECAST_V1 with A+/O+ and PRBC/PC. "
        "Its dataset schema, lineage and required residual bounds differ from the v4 study. "
        "Neither the workbook nor exploration pickle can be imported as an accepted runtime model. "
        "The replay CSV exposes all 20 study series and flags the four shared categories; "
        "this flag does not authorize persistence. Dates remain historical. "
        "Application tests demonstrate the separately versioned accepted runtime.",
        "",
        "## Review status",
        "Prepared for manuscript insertion; this file does not modify the actual thesis. "
        "Accountable review, PR publication and main merge are separate pending actions. "
        "No clinical, operational or production readiness is asserted.",
        "",
        f"Workbook SHA-256: `{WORKBOOK_SHA256}`.",
        f"Frozen artifact manifest SHA-256: `{MANIFEST_SHA256}`.",
    ]
    (output / "thesis-results-model-card.md").write_text("\n".join(lines) + "\n")
    generated = {p.name: sha256_file(p) for p in sorted(output.iterdir()) if p.is_file()}
    (output / "handoff-manifest.json").write_text(json.dumps(generated, indent=2) + "\n")
    return evidence


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workbook", type=Path, required=True)
    parser.add_argument("--release", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        print(json.dumps(assemble(args.workbook, args.release, args.output)))
        return 0
    except ForecastingError as exc:
        print(json.dumps({"status": "FAILED", "code": exc.code}), file=sys.stderr)
    except (OSError, ValueError, TypeError, KeyError):
        print(json.dumps({"status": "FAILED", "code": "RELEASE_INVALID"}), file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
