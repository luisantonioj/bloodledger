"""BL-ML-05 release integrity and no silent workbook substitution."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from bloodledger_forecasting.errors import ForecastingError
from bloodledger_forecasting.thesis_release import assemble, main, verify_manifest
from bloodledger_forecasting.validation import sha256_file


def manifest(root: Path, entries: dict[str, str]) -> str:
    path = root / "artifact-manifest.json"
    path.write_text(json.dumps(entries))
    return sha256_file(path)


def test_release_verifies_bytes_and_rejects_changed_artifact(tmp_path: Path) -> None:
    artifact = tmp_path / "result.json"
    artifact.write_text("{}")
    digest = manifest(tmp_path, {"result.json": sha256_file(artifact)})
    assert verify_manifest(tmp_path, digest) == 1
    artifact.write_text('{"changed":true}')
    with pytest.raises(ForecastingError, match="An artifact changed"):
        verify_manifest(tmp_path, digest)


def test_manifest_substitution_and_path_escape_fail(tmp_path: Path) -> None:
    outside = tmp_path / "outside.json"
    outside.write_text("{}")
    release = tmp_path / "release"
    release.mkdir()
    digest = manifest(release, {"../outside.json": sha256_file(outside)})
    with pytest.raises(ForecastingError, match="outside release"):
        verify_manifest(release, digest)
    with pytest.raises(ForecastingError, match="Unexpected release manifest"):
        verify_manifest(release, "0" * 64)


def test_workbook_substitution_creates_no_output(tmp_path: Path) -> None:
    workbook = tmp_path / "unapproved.xlsx"
    workbook.write_bytes(b"not the frozen workbook")
    output = tmp_path / "output"
    with pytest.raises(ForecastingError, match="Expected frozen workbook v4"):
        assemble(workbook, tmp_path, output)
    assert not output.exists()


def test_missing_file_cli_has_safe_error(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    code = main(
        [
            "--workbook",
            str(tmp_path / "private.xlsx"),
            "--release",
            str(tmp_path),
            "--output",
            str(tmp_path / "output"),
        ]
    )
    assert code == 2
    assert "private.xlsx" not in capsys.readouterr().err
