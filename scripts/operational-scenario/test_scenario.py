"""PR26 / FR01-02 / BR-INV-03: deterministic external scenario contract tests."""

import copy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import scenario as s
import verify as v


def fixture_counts():
    rows = [
        {"bloodType": b, "componentType": c, "available": 0, "reserved": 0, "closing": 0}
        for b in s.BLOOD.values()
        for c in s.COMPONENT.values()
    ]
    rows[0].update(available=450, reserved=35, closing=485)
    rows[6].update(available=36, reserved=1, closing=37)
    return rows


class ScenarioTests(unittest.TestCase):
    def setUp(self):
        self.data = s.build(fixture_counts(), "a" * 40, "2026-10-08T06:46:27Z")

    def reject(self, mutate):
        other = copy.deepcopy(self.data)
        mutate(other)
        with self.assertRaises(ValueError):
            s.validate(other)

    def test_success_and_zero_series(self):
        result = s.validate(self.data)
        self.assertEqual(self.data["scenarioVersion"], "SYNTHETIC_OPERATIONAL_STOCK_522_V2")
        self.assertEqual(self.data["datePolicy"]["version"], "SYNTHETIC_522_DATES_V2")
        self.assertEqual((result["units"], result["donations"], result["series"]), (522, 522, 20))
        self.assertEqual(result["reservedByPurpose"], {"TRANSFER": 18, "LOCAL_RELEASE": 18})
        self.assertEqual(sum(r["closing"] == 0 for r in self.data["counts"]), 18)

    def test_replay_identical(self):
        self.assertEqual(
            s.canonical(self.data),
            s.canonical(s.build(fixture_counts(), "a" * 40, "2026-10-08T06:46:27Z")),
        )

    def test_verified_replay_and_metadata_tamper(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "scenario.json"
            p.write_bytes(s.canonical(self.data) + b"\n")
            with patch("scenario.extract", return_value=fixture_counts()):
                self.assertEqual(v.verify(None, p, s.file_sha(p))["units"], 522)
                self.data["binding"]["scope"] = "UNAPPROVED_GLOBAL"
                p.write_bytes(s.canonical(self.data) + b"\n")
                with self.assertRaisesRegex(ValueError, "replay"):
                    v.verify(None, p, s.file_sha(p))

    def test_manifest_byte_tamper(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "scenario.json"
            p.write_bytes(s.canonical(self.data))
            with self.assertRaisesRegex(ValueError, "byte hash"):
                v.verify(None, p, "0" * 64)

    def test_duplicate_unit(self):
        self.reject(lambda d: d["units"].__setitem__(1, d["units"][0]))

    def test_duplicate_donation(self):
        self.reject(lambda d: d["donations"].__setitem__(1, d["donations"][0]))

    def test_duplicate_reservation(self):
        self.reject(lambda d: d["reservations"].append(d["reservations"][0]))

    def test_expiry_equal_t0(self):
        self.reject(lambda d: d["units"][0].update(expiresAt=s.T0))

    def test_expiry_before_collection(self):
        self.reject(lambda d: d["units"][0].update(expiresAt="2026-10-07T00:00:00Z"))

    def test_collection_after_t0(self):
        self.reject(lambda d: d["units"][0].update(collectedAt="2026-10-12T00:00:00Z"))

    def test_expired_v1_identity_is_rejected(self):
        self.reject(
            lambda d: d.update(scenarioVersion="SYNTHETIC_OPERATIONAL_STOCK_522_V1")
        )

    def test_wrong_date_policy(self):
        self.reject(lambda d: d["datePolicy"].update(nearExpiryEnabled=True))

    def test_unsupported_component(self):
        self.reject(lambda d: d["units"][0].update(componentType="MWB"))

    def test_unsupported_blood(self):
        self.reject(lambda d: d["units"][0].update(bloodType="A_NEGATIVE"))

    def test_cross_institution_member(self):
        self.reject(lambda d: d["units"][0].update(custodyInstitutionId="INST_SYNTH_NLVILLA"))

    def test_wrong_destination(self):
        self.reject(
            lambda d: d["reservations"][0].update(destinationInstitutionId="INST_SYNTH_NLVILLA")
        )

    def test_local_release_no_destination(self):
        self.reject(
            lambda d: d["reservations"][1].update(destinationInstitutionId="INST_SYNTH_MEDIX")
        )

    def test_overlapping_members(self):
        self.reject(
            lambda d: d["reservations"][0]["unitKeys"].__setitem__(
                1, d["reservations"][0]["unitKeys"][0]
            )
        )

    def test_donation_group_mismatch(self):
        self.reject(lambda d: d["donations"][0]["unitKeys"].append(d["units"][1]["unitKey"]))

    def test_wrong_donation_blood(self):
        self.reject(lambda d: d["donations"][0].update(bloodType="B_POSITIVE"))

    def test_count_mismatch(self):
        self.reject(lambda d: d["counts"][0].update(available=451))

    def test_unknown_reserved_member(self):
        self.reject(lambda d: d["reservations"][0]["unitKeys"].__setitem__(0, "MISSING"))

    def test_unlinked_reserved(self):
        self.reject(lambda d: d["units"][0].update(reservationKey=None))

    def test_unexpected_record_fields(self):
        self.reject(lambda d: d["units"][0].update(unapprovedField="not allowed"))

    def test_scope_change(self):
        self.reject(lambda d: d.update(classification="OPERATIONAL"))

    def test_unknown_negative_not_zero(self):
        self.reject(lambda d: d.update(negativeRhCoverage="ZERO"))

    def test_frozen_t0(self):
        self.reject(lambda d: d.update(t0="2026-10-10T00:00:00Z"))

    def test_ties_and_reserved_before_available(self):
        group = [
            u
            for u in self.data["units"]
            if u["bloodType"] == "A_POSITIVE" and u["componentType"] == "WHOLE_BLOOD"
        ]
        reserved = [u for u in group if u["intendedStateAtT0"] == "RESERVED"]
        available = [u for u in group if u["intendedStateAtT0"] == "AVAILABLE"]
        self.assertLess(
            max(u["expiresAt"] for u in reserved), min(u["expiresAt"] for u in available)
        )
        self.assertLess(len(set(u["expiresAt"] for u in reserved)), len(reserved))
        # Tie resolution must use backend component IDs, not these unit keys.

    def test_nonexistent_source(self):
        with self.assertRaises(FileNotFoundError):
            s.extract(Path("/nonexistent/bloodledger-v5.xlsx"))

    def test_wrong_source_hash(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "wrong.xlsx"
            p.write_bytes(b"not workbook")
            with self.assertRaisesRegex(ValueError, "byte hash"):
                s.extract(p)

    def test_output_refuses_checkout(self):
        with patch(
            "sys.argv",
            [
                "scenario.py",
                "--workbook",
                "unused.xlsx",
                "--revision",
                "a" * 40,
                "--generated-at",
                "2026-10-08T06:46:27Z",
                "--output",
                str(Path(s.__file__).parent / "forbidden.json"),
            ],
        ):
            with self.assertRaisesRegex(ValueError, "outside Git"):
                s.main()

    def test_output_refuses_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "scenario.json"
            p.write_bytes(b"existing")
            with patch(
                "sys.argv",
                [
                    "scenario.py",
                    "--workbook",
                    "unused.xlsx",
                    "--revision",
                    "a" * 40,
                    "--generated-at",
                    "2026-10-08T06:46:27Z",
                    "--output",
                    str(p),
                ],
            ):
                with self.assertRaisesRegex(ValueError, "overwrite"):
                    s.main()
            self.assertEqual(p.read_bytes(), b"existing")


if __name__ == "__main__":
    unittest.main()
