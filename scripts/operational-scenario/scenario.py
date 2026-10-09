"""PR30/31 successor fixture; external-only and never submits inventory commands."""

import argparse
import hashlib
import json
import re
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import UTC, datetime, timedelta
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile

VERSION = "SYNTHETIC_OPERATIONAL_STOCK_522_V2"
SCHEMA = "OPERATIONAL_SCENARIO_V1"
SOURCE_SHA = "5c5997bd4df26f6f0d52d7ea13dde0172706faaa15308ebc87f241f44c241ddb"
BASELINE = "a66528934432ebbb35eb1f45617909ca59374824"
BLOOD = dict(
    zip(
        ["A+", "B+", "O+", "AB+"],
        ["A_POSITIVE", "B_POSITIVE", "O_POSITIVE", "AB_POSITIVE"],
        strict=True,
    )
)
COMPONENT = dict(
    zip(
        ["WB", "PRBC", "FFP", "PC", "CRYO"],
        [
            "WHOLE_BLOOD",
            "PACKED_RED_BLOOD_CELLS",
            "FRESH_FROZEN_PLASMA",
            "PLATELETS",
            "CRYOPRECIPITATE",
        ],
        strict=True,
    )
)
# Deliberately technical intervals, not clinical shelf lives. Relative to T0.
HOURS = dict(zip(COMPONENT.values(), [120, 144, 168, 96, 192], strict=True))
T0 = "2026-10-11T00:00:00Z"
NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def require(ok, reason):
    if not ok:
        raise ValueError(reason)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()


def digest(value):
    return hashlib.sha256(canonical(value)).hexdigest()


def file_sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def instant(value):
    require(
        isinstance(value, str) and re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ", value),
        "UTC timestamp required",
    )
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def iso(value):
    return value.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def extract(path):
    """Read only pinned synthetic sheet. No observed/clinical sheets are opened."""
    source_bytes = Path(path).read_bytes()
    require(hashlib.sha256(source_bytes).hexdigest() == SOURCE_SHA, "workbook byte hash mismatch")
    # XML below is restricted to these exact SHA-256-pinned bytes, not arbitrary input.
    with ZipFile(BytesIO(source_bytes)) as z:
        workbook = ET.fromstring(z.read("xl/workbook.xml"))  # noqa: S314
        sheet = next(
            s for s in workbook.find("s:sheets", NS) if s.attrib["name"] == "Synthetic_Daily_Stocks"
        )
        rid = sheet.attrib[
            "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
        ]
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))  # noqa: S314
        target = next(r.attrib["Target"] for r in rels if r.attrib["Id"] == rid)
        sheet_xml = ET.fromstring(z.read(target.lstrip("/")))  # noqa: S314
        rows = sheet_xml.findall("s:sheetData/s:row", NS)

        def cells(row):
            result = {}
            for c in row:
                require(c.find("s:f", NS) is None, "formula in pinned synthetic source")
                result[re.sub(r"\d", "", c.attrib["r"])] = "".join(c.itertext())
            return result

        headers = cells(rows[0])
        counts = []
        day = (datetime(2026, 10, 7) - datetime(1899, 12, 30)).days
        for row in rows[1:]:
            values = {headers[k]: v for k, v in cells(row).items()}
            if values["date"] != str(day):
                continue
            require(
                values["institution_id"] == "SIM_INSTITUTION_01"
                and values["classification"] == "SYNTHETIC",
                "source scope mismatch",
            )
            counts.append(
                {
                    "bloodType": BLOOD[values["blood_type"]],
                    "componentType": COMPONENT[values["component"]],
                    "available": int(values["available_close_units"]),
                    "reserved": int(values["reserved_close_units"]),
                    "closing": int(values["closing_units"]),
                }
            )
    counts.sort(
        key=lambda r: (
            list(BLOOD.values()).index(r["bloodType"]),
            list(COMPONENT.values()).index(r["componentType"]),
        )
    )
    check_counts(counts)
    return counts


def check_counts(counts):
    require(
        len(counts) == 20
        and {(r["bloodType"], r["componentType"]) for r in counts}
        == {(b, c) for b in BLOOD.values() for c in COMPONENT.values()},
        "twenty unique series required",
    )
    for r in counts:
        require(
            all(type(r[k]) is int and r[k] >= 0 for k in ["available", "reserved", "closing"]),
            "nonnegative integer counts required",
        )
        require(r["available"] + r["reserved"] == r["closing"], "series balance")
    require(
        [sum(r[k] for r in counts) for k in ["available", "reserved", "closing"]] == [486, 36, 522],
        "aggregate balance",
    )


def build(counts, revision, generated_at):
    check_counts(counts)
    require(re.fullmatch("[0-9a-f]{40}", revision), "exact generator commit required")
    instant(generated_at)
    t0 = instant(T0)
    units, donations, reservations = [], [], []
    sequence = 0
    for row in counts:
        b, c = row["bloodType"], row["componentType"]
        # Global alternating assignments yield exactly 18 units for each purpose.
        buckets = {"TRANSFER": [], "LOCAL_RELEASE": []}
        for index in range(row["closing"]):
            sequence += 1
            key = f"{VERSION}_U{sequence:04d}"
            donation = f"{VERSION}_D{sequence:04d}"
            state = "RESERVED" if index < row["reserved"] else "AVAILABLE"
            reserved_index = sum(len(r["unitKeys"]) for r in reservations) + index
            purpose = (
                ("TRANSFER" if reserved_index % 2 == 0 else "LOCAL_RELEASE")
                if state == "RESERVED"
                else None
            )
            if purpose:
                buckets[purpose].append(key)
            hours = (48 if purpose == "TRANSFER" else 49) if purpose else HOURS[c]
            units.append(
                {
                    "unitKey": key,
                    "donationKey": donation,
                    "bloodType": b,
                    "componentType": c,
                    "collectedAt": iso(t0 - timedelta(hours=24)),
                    "expiresAt": iso(t0 + timedelta(hours=hours)),
                    "issuerInstitutionId": "INST_MEDIATRIX",
                    "custodyInstitutionId": "INST_MEDIATRIX",
                    "intendedStateAtT0": state,
                    "reservationKey": None,
                }
            )
            donations.append(
                {
                    "donationKey": donation,
                    "issuerInstitutionId": "INST_MEDIATRIX",
                    "bloodType": b,
                    "collectedAt": units[-1]["collectedAt"],
                    "unitKeys": [key],
                }
            )
        for purpose, members in buckets.items():
            if not members:
                continue
            key = f"{VERSION}_R{len(reservations) + 1:03d}"
            for unit in units:
                if unit["unitKey"] in members:
                    unit["reservationKey"] = key
            reservations.append(
                {
                    "reservationKey": key,
                    "purpose": purpose,
                    "sourceInstitutionId": "INST_MEDIATRIX",
                    "destinationInstitutionId": "INST_SYNTH_MEDIX"
                    if purpose == "TRANSFER"
                    else None,
                    "bloodType": b,
                    "componentType": c,
                    "quantity": len(members),
                    "unitKeys": members,
                    "workflowKey": key
                    + ("_REQUEST" if purpose == "TRANSFER" else "_LOCAL_RELEASE"),
                    "desiredStateAtT0": "ACTIVE",
                    "laterCompletion": "NOT_IN_522_TARGET",
                }
            )
    result = {
        "schemaVersion": SCHEMA,
        "scenarioVersion": VERSION,
        "classification": "SIMULATION_ONLY",
        "purpose": "NEW_OPERATIONAL_TECHNICAL_TEST_FIXTURE",
        "approvalStatus": "PROPOSED_NOT_POPULATION_AUTHORIZATION",
        "generator": {
            "revision": revision,
            "fileSha256": file_sha(__file__),
            "seed": 522,
            "algorithm": "ordered expansion; no random sampling",
        },
        "source": {
            "workbookSha256": SOURCE_SHA,
            "sheet": "Synthetic_Daily_Stocks",
            "businessDate": "2026-10-07",
            "institutionAlias": "SIM_INSTITUTION_01",
            "use": "COUNT_DISTRIBUTION_ONLY",
            "countsSha256": digest(counts),
        },
        "baselineCommit": BASELINE,
        "generatedAt": generated_at,
        "t0": T0,
        "displayTimezone": "Asia/Manila",
        "populationNotBefore": iso(t0 - timedelta(hours=16)),
        "verificationWindowEndExclusive": iso(t0 + timedelta(hours=8)),
        "binding": {
            "status": "PROPOSED_JOPIA_REVIEW_REQUIRED",
            "alias": "SIM_INSTITUTION_01",
            "institutionId": "INST_MEDIATRIX",
            "scope": "THIS_SCENARIO_ONLY",
            "rationale": (
                "Explicit development fixture custody; "
                "not source institutional provenance or forecast activation"
            ),
        },
        "datePolicy": {
            "version": "SYNTHETIC_522_DATES_V2",
            "clinicalPolicy": False,
            "collectionHoursBeforeT0": 24,
            "availableExpiryHoursAfterT0": HOURS,
            "transferExpiryHoursAfterT0": 48,
            "localReleaseExpiryHoursAfterT0": 49,
            "nearExpiryEnabled": False,
        },
        "donationPolicy": "SINGLETON_COMPONENT_PER_SYNTHETIC_DONATION_NO_BIOLOGICAL_YIELD_CLAIM",
        "negativeRhCoverage": "NOT_PROVIDED_UNKNOWN_NOT_ZERO",
        "counts": counts,
        "donations": donations,
        "units": units,
        "reservations": reservations,
    }
    validate(result)
    return result


def validate(data):
    require(
        data["schemaVersion"] == SCHEMA
        and data["scenarioVersion"] == VERSION
        and data["classification"] == "SIMULATION_ONLY",
        "scenario identity",
    )
    require(
        data["approvalStatus"] == "PROPOSED_NOT_POPULATION_AUTHORIZATION", "approval not granted"
    )
    require(
        data["source"]["workbookSha256"] == SOURCE_SHA
        and data["source"]["businessDate"] == "2026-10-07"
        and data["source"]["sheet"] == "Synthetic_Daily_Stocks",
        "source identity",
    )
    require(data["source"]["countsSha256"] == digest(data["counts"]), "source counts digest")
    check_counts(data["counts"])
    require(
        data["binding"]["institutionId"] == "INST_MEDIATRIX"
        and data["binding"]["alias"] == "SIM_INSTITUTION_01"
        and data["binding"]["status"] == "PROPOSED_JOPIA_REVIEW_REQUIRED",
        "institution binding",
    )
    require(data["negativeRhCoverage"] == "NOT_PROVIDED_UNKNOWN_NOT_ZERO", "negative coverage")
    require(data["t0"] == T0 and data["baselineCommit"] == BASELINE, "frozen execution identity")
    t0 = instant(data["t0"])
    instant(data["generatedAt"])
    require(
        instant(data["populationNotBefore"]) == t0 - timedelta(hours=16)
        and instant(data["verificationWindowEndExclusive"]) == t0 + timedelta(hours=8),
        "execution window",
    )
    require(
        data["datePolicy"]
        == {
            "version": "SYNTHETIC_522_DATES_V2",
            "clinicalPolicy": False,
            "collectionHoursBeforeT0": 24,
            "availableExpiryHoursAfterT0": HOURS,
            "transferExpiryHoursAfterT0": 48,
            "localReleaseExpiryHoursAfterT0": 49,
            "nearExpiryEnabled": False,
        },
        "date policy",
    )
    require(
        data["donationPolicy"]
        == "SINGLETON_COMPONENT_PER_SYNTHETIC_DONATION_NO_BIOLOGICAL_YIELD_CLAIM",
        "donation policy",
    )
    for rows, fields in [
        (
            data["units"],
            (
                "unitKey donationKey bloodType componentType collectedAt expiresAt "
                "issuerInstitutionId custodyInstitutionId intendedStateAtT0 reservationKey"
            ),
        ),
        (data["donations"], "donationKey issuerInstitutionId bloodType collectedAt unitKeys"),
        (
            data["reservations"],
            (
                "reservationKey purpose sourceInstitutionId destinationInstitutionId "
                "bloodType componentType quantity unitKeys workflowKey "
                "desiredStateAtT0 laterCompletion"
            ),
        ),
    ]:
        require(all(set(row) == set(fields.split()) for row in rows), "unexpected record field")
    units = {u["unitKey"]: u for u in data["units"]}
    donations = {d["donationKey"]: d for d in data["donations"]}
    reservations = {r["reservationKey"]: r for r in data["reservations"]}
    require(
        len(units) == len(data["units"]) == len(donations) == len(data["donations"]) == 522,
        "duplicate unit or donation",
    )
    require(len(reservations) == len(data["reservations"]), "duplicate reservation")
    require(
        len({r["workflowKey"] for r in reservations.values()}) == len(reservations),
        "duplicate workflow",
    )
    memberships = []
    purposes = Counter()
    for r in reservations.values():
        require(
            r["purpose"] in ["TRANSFER", "LOCAL_RELEASE"] and r["desiredStateAtT0"] == "ACTIVE",
            "reservation purpose/state",
        )
        require(
            r["sourceInstitutionId"] == "INST_MEDIATRIX"
            and r["destinationInstitutionId"]
            == ("INST_SYNTH_MEDIX" if r["purpose"] == "TRANSFER" else None),
            "reservation institution",
        )
        require(
            type(r["quantity"]) is int and r["quantity"] == len(r["unitKeys"]) > 0,
            "reservation quantity",
        )
        for key in r["unitKeys"]:
            require(key in units, "unknown member")
            u = units[key]
            require(
                u["reservationKey"] == r["reservationKey"]
                and u["intendedStateAtT0"] == "RESERVED"
                and (u["bloodType"], u["componentType"]) == (r["bloodType"], r["componentType"]),
                "reservation relationship",
            )
        memberships.extend(r["unitKeys"])
        purposes[r["purpose"]] += r["quantity"]
    require(
        len(memberships) == len(set(memberships)) == 36
        and purposes == {"TRANSFER": 18, "LOCAL_RELEASE": 18},
        "overlap or purpose totals",
    )
    actual = Counter()
    for key, u in units.items():
        require(
            u["bloodType"] in BLOOD.values() and u["componentType"] in COMPONENT.values(),
            "unsupported series",
        )
        require(
            u["issuerInstitutionId"] == u["custodyInstitutionId"] == "INST_MEDIATRIX",
            "unit institution",
        )
        require(u["intendedStateAtT0"] in ["AVAILABLE", "RESERVED"], "unit state")
        require(u["donationKey"] in donations, "unknown donation")
        d = donations[u["donationKey"]]
        require(
            d
            == {
                "donationKey": u["donationKey"],
                "issuerInstitutionId": u["issuerInstitutionId"],
                "bloodType": u["bloodType"],
                "collectedAt": u["collectedAt"],
                "unitKeys": [key],
            },
            "singleton donation relationship",
        )
        require(instant(u["collectedAt"]) == t0 - timedelta(hours=24), "collection policy")
        require(
            instant(u["collectedAt"]) <= t0 < instant(u["expiresAt"]), "date ordering/eligibility"
        )
        if u["intendedStateAtT0"] == "AVAILABLE":
            require(
                u["reservationKey"] is None and key not in memberships,
                "available reservation conflict",
            )
            hours = HOURS[u["componentType"]]
        else:
            require(
                u["reservationKey"] in reservations and key in memberships, "unlinked reserved unit"
            )
            hours = 48 if reservations[u["reservationKey"]]["purpose"] == "TRANSFER" else 49
        require(instant(u["expiresAt"]) == t0 + timedelta(hours=hours), "expiry policy")
        actual[(u["bloodType"], u["componentType"], u["intendedStateAtT0"])] += 1
    for r in data["counts"]:
        for field, state in [("available", "AVAILABLE"), ("reserved", "RESERVED")]:
            require(
                actual[(r["bloodType"], r["componentType"], state)] == r[field],
                "unit series balance",
            )
    return {
        "classification": "SIMULATION_ONLY",
        "units": len(units),
        "available": 486,
        "reserved": len(memberships),
        "donations": len(donations),
        "reservations": len(reservations),
        "reservedByPurpose": dict(purposes),
        "series": 20,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workbook", type=Path, required=True)
    parser.add_argument("--revision", required=True)
    parser.add_argument("--generated-at", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    require(
        not args.output.resolve().is_relative_to(root), "artifact must remain outside Git checkout"
    )
    require(not args.output.exists(), "immutable artifact already exists; do not overwrite")
    data = build(extract(args.workbook), args.revision, args.generated_at)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(canonical(data) + b"\n")
    print(
        json.dumps(
            {**validate(data), "canonicalSha256": digest(data), "fileSha256": file_sha(args.output)}
        )
    )


if __name__ == "__main__":
    main()
