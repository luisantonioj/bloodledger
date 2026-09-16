"""Command-line entry point for the isolated ML exploration."""

from __future__ import annotations

import argparse
from pathlib import Path

from .experiment import build_exploration_report, canonical_json_bytes


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repository-root", type=Path, required=True)
    parser.add_argument("--workbook", type=Path, required=True)
    parser.add_argument("--notebook", type=Path, required=True)
    parser.add_argument("--manuscript", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    arguments = parser.parse_args()
    report = build_exploration_report(
        repository_root=arguments.repository_root,
        output_directory=arguments.output.parent,
        workbook_path=arguments.workbook,
        notebook_path=arguments.notebook,
        manuscript_path=arguments.manuscript,
    )
    arguments.output.write_bytes(canonical_json_bytes(report) + b"\n")
    print(f"Wrote sanitized exploration report: {arguments.output.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
