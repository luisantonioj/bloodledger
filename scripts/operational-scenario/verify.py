"""Verify successor manifest bytes, source lineage and exact deterministic replay."""

import argparse
import json
from pathlib import Path

import scenario as s


def verify(workbook, manifest, expected_sha):
    s.require(s.file_sha(manifest) == expected_sha, "manifest byte hash mismatch")
    data = json.loads(manifest.read_bytes())
    s.require(data["scenarioVersion"] == s.VERSION, "scenario version mismatch")
    s.require(
        data["generator"]["fileSha256"] == s.file_sha(s.__file__),
        "generator file mismatch; use recorded revision",
    )
    expected = s.build(s.extract(workbook), data["generator"]["revision"], data["generatedAt"])
    s.require(s.canonical(data) == s.canonical(expected), "exact scenario replay mismatch")
    return {
        **s.validate(data),
        "canonicalSha256": s.digest(data),
        "fileSha256": s.file_sha(manifest),
    }


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--workbook", required=True, type=Path)
    p.add_argument("--manifest", required=True, type=Path)
    p.add_argument("--sha256", required=True)
    a = p.parse_args()
    print(json.dumps(verify(a.workbook, a.manifest, a.sha256), sort_keys=True))


if __name__ == "__main__":
    main()
