"""Frozen PA-OCR-01 fictional plan. Never changes or overwrites the V2 corpus."""
import datetime
import hashlib
import html
import json
import os
import re
from pathlib import Path

CONTRACT = Path(__file__).resolve().parents[2] / "contracts/synthetic-label-layout-v1.json"
PINNED = {
    "SYN_MEDIATRIX_LAYOUT": "d2f7e32f34b30a9f9c6ce4135c1aff046f8bff2238ce6ccae4d0ff29f857a8e4",
    "SYN_MEDIX_LAYOUT": "a16303ec3cc23127b7755787bcef46afb6b011320e9fb79a2937dfd04fc1d502",
    "SYN_NLVILLA_LAYOUT": "6946fcc1e2e635eb99af6db15a4a8071aa2d928925dd3a970ad51e9afcd3ed4f",
}
CONDITIONS = ("clear", "angled_curved", "challenging_lighting")
NEGATIVES = ("missing_field", "conflicting_dates", "duplicate_identifier", "manufacturer_barcode", "unknown_layout", "prohibited_personal_text", "ambiguous_short_date")


def profile_hash(contract, profile):
    # Matches JSON.stringify UTF-8, insertion/file key order, no whitespace.
    material = {key: contract[key] for key in ("schemaVersion", "marker", "timeCaption", "timeZoneOffset", "dateFormats", "bloodTypeForms", "componentForms")}
    material["profile"] = profile
    return hashlib.sha256(json.dumps(material, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


def frozen_contract():
    contract = json.loads(CONTRACT.read_text())
    for profile in contract["profiles"]:
        if profile_hash(contract, profile) != PINNED.get(profile["id"]):
            raise ValueError("Frozen PA-OCR-01 profile hash changed; new version required")
    return contract


def unknown_profile(profile):
    return {**profile, "id": "UNSUPPORTED_SYNTHETIC_NEGATIVE", "bankLine": "BANK CODE: UNKNOWN SYNTHETIC", "fields": [{"field": f, "heading": f"UNKNOWN FIELD {n}", "placement": "BELOW"} for n, f in enumerate(("donationNumber", "bloodType", "componentType", "collectedAt", "expiresAt"))]}


def validate_profiles(manifest):
    contract = frozen_contract()
    profiles = {p["id"]: p for p in contract["profiles"]}
    labels = manifest["labels"]
    if len(labels) != 243 or sum(not label.get("negativeClass") for label in labels) != 180 or len(manifest["images"]) != 729:
        raise ValueError("V3 planned positive/negative counts changed; version a new plan")
    tasks = {}
    for image in manifest["images"]:
        tasks.setdefault(image["labelId"], []).append(image["condition"])
    if any(sorted(tasks.get(label["labelId"], [])) != sorted(CONDITIONS) for label in labels):
        raise ValueError("V3 requires exactly three distinct conditions per label")
    for label in manifest["labels"]:
        profile = profiles.get(label.get("profileId"))
        unknown = label.get("negativeClass") == "unknown_layout"
        if unknown:
            source = next(p for p in profiles.values() if p["bankCode"] == label["bank"])
            if label.get("layoutReferenceAccepted") is not False or label.get("profileId") != "UNSUPPORTED_SYNTHETIC_NEGATIVE" or label.get("profileVersion") != "1" or label.get("profileSha256") != profile_hash(contract, unknown_profile(source)):
                raise ValueError("Unknown layout must not claim accepted profile")
            continue
        if not profile or label.get("profileVersion") != profile["version"] or label.get("profileSha256") != PINNED[profile["id"]] or label.get("assumptionId") != "PA-OCR-01" or label.get("layoutReferenceAccepted") is not True or label["bank"] != profile["bankCode"]:
            raise ValueError("Invalid frozen profile stamp")
        if not label.get("negativeClass"):
            forms = label["printedValues"]
            values = label["values"]
            if not re.fullmatch(profile["donationNumberPattern"], forms["donationNumber"]) or forms["donationNumber"] != values["donationNumber"]:
                raise ValueError("Invalid planned synthetic donation grammar")
            if contract["bloodTypeForms"].get(forms["bloodType"]) != values["bloodType"] or contract["componentForms"].get(forms["componentType"]) != values["componentType"]:
                raise ValueError("Planned values outside closed forms")
            dates = []
            for field in ("collectedAt", "expiresAt"):
                form = forms[field]
                if label["datePrecision"] == "DATE":
                    parsed = datetime.date.fromisoformat(form)
                    canonical = parsed.isoformat()
                elif label["datePrecision"] == "INSTANT":
                    parsed = datetime.datetime.strptime(form, "%Y-%m-%d %H:%M").replace(tzinfo=datetime.timezone(datetime.timedelta(hours=8)))
                    canonical = parsed.astimezone(datetime.timezone.utc).isoformat(timespec="milliseconds").replace('+00:00', 'Z')
                else:
                    raise ValueError("Invalid planned date precision")
                if canonical != values[field]:
                    raise ValueError("Planned date does not match caption/precision")
                dates.append(parsed)
            if dates[1] <= dates[0]:
                raise ValueError("Positive plan expiry must follow collection")


def render(contract, profile, label):
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1300" viewBox="0 0 1800 1300">', '<rect width="100%" height="100%" fill="white"/>']
    def text(value, x, y, size=30):
        parts.append(f'<text x="{x}" y="{y}" font-family="DejaVu Sans Mono, monospace" font-size="{size}" fill="black">{html.escape(value)}</text>')
    text(contract["marker"], 50, 60, 34)
    text(profile["bankLine"], 50, 115)
    text(contract["timeCaption"], 50, 170)
    y = 250
    for item in profile["fields"]:
        name = item["field"]
        form = label["printedValues"][name]
        if label["style"] == "handwritten":
            form = "____________________________"
        if label.get("negativeClass") == "missing_field" and name == "componentType":
            form = ""
        text(item["heading"] + ":", 50, y)
        if item["placement"] == "BESIDE":
            text(form, 550, y)
            y += 130
        else:
            text(form, 100, y + 50)
            y += 155
    for distractor in label.get("distractors", []):
        text(distractor, 50, 1160, 24)
    parts.append('</svg>')
    return ''.join(parts)


def create_plan_v3(output, private_output, write_new):
    contract = frozen_contract()
    output = private_output(output)
    output.mkdir(parents=True, mode=0o700, exist_ok=False)
    os.chmod(output, 0o700)
    labels, images = [], []
    bloods = list(contract["bloodTypeForms"])
    products = ["WB", "PRBC", "FFP", "PLT", "CRYO"]
    def add(profile, index, negative=None, split_override=None):
        bank = profile["bankCode"]
        ordinal = index % 30
        split = split_override or ("train" if ordinal < 18 else "validation" if ordinal < 24 else "test")
        style = "printed" if negative or index < 30 else "handwritten"
        code = f"MM26-10-{8000+index}" if bank == "MEDIATRIX" else f"{'SYNMEDIX' if bank == 'MEDIX' else 'SYNNLVILLA'}-2026-{8000+index}"
        label_id = f"SYN_V3_{bank}_{index+1:03}" if not negative else f"SYN_V3_{bank}_NEG_{split}_{negative}"
        date_only = index % 10 == 0 and not negative
        forms = {"donationNumber": code, "bloodType": bloods[index % 8], "componentType": products[index % 5],
                 "collectedAt": "2026-10-01" + ("" if date_only else " 08:00"), "expiresAt": "2026-11-01" + ("" if date_only else " 08:00")}
        values = {**forms, "bloodType": contract["bloodTypeForms"][forms["bloodType"]], "componentType": contract["componentForms"][forms["componentType"]]}
        if not date_only:
            for field in ("collectedAt", "expiresAt"):
                local = datetime.datetime.strptime(forms[field], "%Y-%m-%d %H:%M").replace(tzinfo=datetime.timezone(datetime.timedelta(hours=8)))
                values[field] = local.astimezone(datetime.timezone.utc).isoformat(timespec="milliseconds").replace('+00:00', 'Z')
        relationship = f"REL_{bank}_{index:03}"
        label = {"labelId": label_id, "bank": bank, "style": style, "split": split,
                 "writerId": None if style == "printed" else f"WRITER_{ordinal // 6 + 1:02}",
                 "donationRelationshipId": relationship, "profileId": profile["id"], "profileVersion": profile["version"],
                 "profileSha256": PINNED[profile["id"]], "assumptionId": "PA-OCR-01", "layoutReferenceAccepted": True,
                 "values": values, "printedValues": forms, "datePrecision": "DATE" if date_only else "INSTANT",
                 "groundTruthStatus": "PLANNED_NOT_OBSERVED", "reviewers": [], "negativeClass": negative}
        if negative == "missing_field":
            forms["componentType"] = ""; values["componentType"] = None
        elif negative == "conflicting_dates":
            forms["expiresAt"] = "2026-09-01 08:00"; values["expiresAt"] = "2026-09-01T00:00:00.000Z"
        elif negative == "ambiguous_short_date":
            forms["expiresAt"] = "01/02/26"; values["expiresAt"] = None
        elif negative == "manufacturer_barcode":
            label["distractors"] = ["LOT: SYNTHETIC-LOT-001  CATALOG: SYNTHETIC-CAT-001  BARCODE: 00000000"]
        elif negative == "prohibited_personal_text":
            label["distractors"] = ["PATIENT: TEST"]
        elif negative == "unknown_layout":
            label.update(profileId="UNSUPPORTED_SYNTHETIC_NEGATIVE", profileVersion="1", profileSha256=profile_hash(contract, unknown_profile(profile)), layoutReferenceAccepted=False)
        labels.append(label)
        for condition in CONDITIONS:
            # No intended value or state is presented as an observed annotation.
            images.append({"imageId": label_id + '_' + condition, "labelId": label_id, "condition": condition,
                           "path": None, "sha256": None, "captured": False, "reviewers": [],
                           "fields": {field: {"value": None, "rawText": None, "state": None, "precision": None, "bbox": None} for field in values}})
        rendering = profile
        if negative == "unknown_layout":
            rendering = unknown_profile(profile)
        svg = render(contract, rendering, label)
        path = output / (label_id + '.svg')
        with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as stream:
            stream.write(svg)
        label["planningSheetSha256"] = hashlib.sha256(svg.encode()).hexdigest()
    for profile in contract["profiles"]:
        for index in range(60):
            add(profile, index)
        # One case per class/bank/split. Duplicate case uses an existing same-split donation.
        for split, index in (("train", 0), ("validation", 18), ("test", 24)):
            for n, negative in enumerate(NEGATIVES):
                add(profile, index if negative == "duplicate_identifier" else {"train": 100, "validation": 200, "test": 300}[split] + n, negative, split)
    manifest = {"schemaVersion": "SYNTHETIC_LABEL_CORPUS_V1", "classification": "SIMULATION_ONLY", "datasetVersion": "OCR_PILOT_PLAN_V3",
                "seed": 20261017, "status": "PLANNED_NOT_COLLECTED", "assumptionId": "PA-OCR-01",
                "positiveLabels": 180, "negativeLabels": 63, "positivePhotoTasks": 540, "negativePhotoTasks": 189,
                "negativeCasesRequired": list(NEGATIVES), "labels": labels, "images": images}
    validate_profiles(manifest)
    gallery = '<!doctype html><meta charset="utf-8"><title>SIMULATION_ONLY fictional corpus print sheets</title><style>@page{size:A4 landscape;margin:10mm}section{break-after:page}img{width:100%;height:auto}</style>'
    gallery += ''.join('<section><img alt="SIMULATION_ONLY fictional sheet" src="' + label["labelId"] + '.svg"></section>' for label in labels)
    with os.fdopen(os.open(output / 'print-sheets.html', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as stream:
        stream.write(gallery)
    instructions = """SIMULATION_ONLY — print only these fictional sheets, never a real unit/label.
180 positive sheets and 63 separately counted negatives. Print in landscape.
Use print-sheets.html locally. Do not upload this package or handwriting images.
Handwritten sheets have blank values: use printedValues in the private manifest
as intended prompts, with WRITER_01–03 train, 04 validation, 05 test. Do not mix
writers or donation-related labels across splits. Printed intentions are not truth.
Take clear, angled/curved and challenging-lighting photographs of each sheet.
Two DIFFERENT PEOPLE independently annotate observed values, rawText, states,
precision and source-pixel boxes. Record opaque reviewer codes, disagreements
and resolution privately. Never mark unreadable writing as its intended value.
No reviewer, writer, photograph or approval is supplied by this generator.
Unknown-layout, short-date and other negatives are not supported intake formats.
Keep observed data and people identities outside Git. Run validate --complete
only after actual collection/review; it must fail on this uncollected package.
"""
    with os.fdopen(os.open(output / 'COLLECTION.txt', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as stream:
        stream.write(instructions)
    write_new(output / 'manifest.json', manifest)
    return {"status": manifest["status"], "positiveLabels": 180, "negativeLabels": 63, "plannedPhotographs": len(images), "collectedPhotographs": 0}
