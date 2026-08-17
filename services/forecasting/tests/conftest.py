from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd
import pytest

from bloodledger_forecasting.modeling import train_model, write_model_artifact
from bloodledger_forecasting.synthetic import generate_synthetic_data, write_synthetic_csv


@pytest.fixture(scope="session")
def synthetic_data() -> pd.DataFrame:
    return generate_synthetic_data()


@pytest.fixture(scope="session")
def dataset_path(tmp_path_factory: pytest.TempPathFactory, synthetic_data: pd.DataFrame) -> Path:
    path = tmp_path_factory.mktemp("data") / "synthetic-forecast-v1.csv"
    write_synthetic_csv(synthetic_data, path)
    return path


@pytest.fixture(scope="session")
def trained_bundle(
    tmp_path_factory: pytest.TempPathFactory,
    synthetic_data: pd.DataFrame,
    dataset_path: Path,
) -> dict[str, Any]:
    root = Path(__file__).resolve().parents[1]
    artifact, manifest = train_model(
        synthetic_data,
        dataset_path=dataset_path,
        source_root=root / "src" / "bloodledger_forecasting",
    )
    artifact_path = tmp_path_factory.mktemp("model") / "model-v1.pkl"
    manifest["model_artifact_sha256"] = write_model_artifact(artifact, artifact_path)
    return {
        "artifact": artifact,
        "artifact_path": artifact_path,
        "manifest": manifest,
    }
