#!/usr/bin/env python3
"""Isolated synthetic OCR corpus planning and evaluation. No runtime or forecast access."""
import argparse
import collections
import datetime
import hashlib
import html
import json
import os
from pathlib import Path

FIELDS = ("donationNumber", "bloodType", "componentType", "collectedAt", "expiresAt")
BANKS = ("MEDIATRIX", "MEDIX", "NLVILLA")
TYPES = ("A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE", "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE")
PRODUCTS = ("WHOLE_BLOOD", "PACKED_RED_BLOOD_CELLS", "FRESH_FROZEN_PLASMA", "PLATELETS", "CRYOPRECIPITATE")

def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()

def write_new(path, value):
    path = Path(path)
    with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w", encoding="utf8") as stream:
        json.dump(value, stream, indent=2)
        stream.write("\n")
    os.chmod(path, 0o600)

def private_output(path):
    path = Path(path).resolve()
    root = Path(__file__).resolve().parents[2]
    if not (path.is_relative_to(root / "build") or path.is_relative_to(Path("/tmp"))):
        raise ValueError("Outputs must remain in ignored build/ or /tmp; no dataset photos/transcriptions in Git")
    return path

def create_plan(output):
    output = private_output(output)
    output.mkdir(parents=True, mode=0o700, exist_ok=False)
    labels, tasks = [], []
    for bank in BANKS:
        for index in range(60):
            style = "printed" if index < 30 else "handwritten"
            ordinal = index % 30
            split = "train" if ordinal < 18 else "validation" if ordinal < 24 else "test"
            writer = None if style == "printed" else f"WRITER_{ordinal // 6 + 1:02}"
            identifier = f"MM26-10-{7000+index}" if bank == "MEDIATRIX" else f"{'SYNMEDIX' if bank == 'MEDIX' else 'SYNNLVILLA'}-2026-{7000+index}"
            values = dict(zip(FIELDS, (identifier, TYPES[index % 8], PRODUCTS[index % 5], "2026-10-01T00:00:00.000Z", "2026-11-01T00:00:00.000Z")))
            label_id = f"SYN_{bank}_{index+1:03}"
            label = {"labelId": label_id, "bank": bank, "style": style, "writerId": writer, "split": split,
                     "profileId": "MEDIATRIX_BAG_PREVIEW" if bank == "MEDIATRIX" else f"{bank}_REFERENCE_PENDING",
                     "profileVersion": "1", "layoutReferenceAccepted": False, "values": values,
                     "groundTruthStatus": "PLANNED_NOT_OBSERVED", "reviewers": []}
            labels.append(label)
            for condition in ("clear", "angled_curved", "challenging_lighting"):
                tasks.append({"imageId": label_id + "_" + condition, "labelId": label_id, "condition": condition,
                              "path": None, "sha256": None, "captured": False, "reviewers": [],
                              "fields": {field: {"value": value, "state": "present", "precision": "INSTANT" if field.endswith("At") else "UNKNOWN", "bbox": None} for field, value in values.items()}})
            # Planning sheets deliberately do not impersonate unknown hospital label layouts.
            lines = ["SYNTHETIC PLANNING SHEET - NOT A VALIDATED HOSPITAL LAYOUT", label_id, bank, style]
            for field, value in values.items():
                lines.append(field + ": " + ("________________________" if style == "handwritten" else value))
            svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="650"><rect width="100%" height="100%" fill="white"/>'
            for row, text in enumerate(lines):
                svg += f'<text x="40" y="{55+row*58}" font-family="monospace" font-size="24">{html.escape(text)}</text>'
            svg += "</svg>"
            (output / (label_id + ".svg")).write_text(svg, encoding="utf8")
    manifest = {"schemaVersion": "SYNTHETIC_LABEL_CORPUS_V1", "classification": "SIMULATION_ONLY", "datasetVersion": "OCR_PILOT_PLAN_V2", "seed": 20261017,
                "status": "PLANNED_NOT_COLLECTED", "labels": labels, "images": tasks,
                "negativeCasesRequired": ["missing_field", "conflicting_dates", "duplicate_identifier", "manufacturer_barcode", "unknown_layout", "prohibited_personal_text"]}
    write_new(output / "manifest.json", manifest)
    return {"status": manifest["status"], "labels": len(labels), "plannedPhotographs": len(tasks), "collectedPhotographs": 0,
            "handwritingWriters": 5, "output": str(output)}

def validate_manifest(manifest, base, require_complete=False):
    if manifest.get("schemaVersion") != "SYNTHETIC_LABEL_CORPUS_V1" or manifest.get("classification") != "SIMULATION_ONLY":
        raise ValueError("Unsupported corpus")
    labels = {row["labelId"]: row for row in manifest["labels"]}
    if len(labels) != len(manifest["labels"]):
        raise ValueError("Duplicate labels")
    writers, images, hashes = {}, set(), set()
    for label in labels.values():
        if label["bank"] not in BANKS or label["split"] not in ("train", "validation", "test"):
            raise ValueError("Unknown bank/split")
        if label["style"] == "handwritten":
            writer = label.get("writerId")
            if not writer or (writer in writers and writers[writer] != label["split"]):
                raise ValueError("Writer leakage across splits")
            writers[writer] = label["split"]
    for image in manifest["images"]:
        if image["imageId"] in images or image["labelId"] not in labels:
            raise ValueError("Duplicate image or unknown label")
        images.add(image["imageId"])
        if image.get("captured"):
            path = (base / image["path"]).resolve()
            if not path.is_relative_to(base.resolve()) or not path.is_file():
                raise ValueError("Photo must exist inside private corpus")
            actual = hashlib.sha256(path.read_bytes()).hexdigest()
            if actual != image.get("sha256") or actual in hashes:
                raise ValueError("Image hash mismatch or duplicate source image")
            hashes.add(actual)
        if require_complete:
            if not image.get("captured") or len(set(image.get("reviewers", []))) < 2:
                raise ValueError("Uncollected or second-review-pending image; no benchmark completion claim")
            label = labels[image["labelId"]]
            if label.get("groundTruthStatus") != "REVIEWED" or len(set(label.get("reviewers", []))) < 2:
                raise ValueError("Label ground truth not independently reviewed")
            for field in FIELDS:
                evidence = image.get("fields", {}).get(field, {})
                if evidence.get("state") not in ("present", "absent", "obscured", "ambiguous", "unreadable"):
                    raise ValueError("Invalid ground-truth state")
                if evidence["state"] == "present" and (not evidence.get("value") or not valid_box(evidence.get("bbox"))):
                    raise ValueError("Visible ground truth needs value and region")
    return labels

def valid_box(box):
    return isinstance(box, list) and len(box) == 4 and all(isinstance(x, (float, int)) and x >= 0 for x in box) and box[2] > box[0] and box[3] > box[1]

def edit_distance(a, b):
    previous = list(range(len(b)+1))
    for i, char in enumerate(a, 1):
        current = [i]
        for j, other in enumerate(b, 1):
            current.append(min(current[-1]+1, previous[j]+1, previous[j-1]+(char != other)))
        previous = current
    return previous[-1]

def score(manifest, predictions, split, candidate, base):
    labels = validate_manifest(manifest, base, require_complete=True)
    selected = [row for row in manifest["images"] if labels[row["labelId"]]["split"] == split]
    by_id = {}
    boundaries = {row.get("candidateBoundary", "END_TO_END_EXTRACTION") for row in predictions} or {"END_TO_END_EXTRACTION"}
    if len(boundaries) != 1:
        raise ValueError("Predictions must use one declared evaluation boundary")
    boundary = next(iter(boundaries))
    signatures=[{key:row.get(key) for key in ("codeArtifactHash","engineAssetsHash","configuration")} for row in predictions]
    fingerprints={digest(row) for row in signatures if all(value is not None for value in row.values())}
    if len(fingerprints)>1:
        raise ValueError("Candidate code/assets/configuration changed within a run")
    fingerprint=next(iter(fingerprints)) if fingerprints and len(signatures)==sum(all(value is not None for value in row.values()) for row in signatures) else None
    for prediction in predictions:
        if prediction["imageId"] in by_id:
            raise ValueError("Duplicate prediction")
        if prediction.get("candidateId") != candidate:
            raise ValueError("Prediction candidate mismatch")
        by_id[prediction["imageId"]] = prediction
    if set(by_id) - {row["imageId"] for row in selected}:
        raise ValueError("Unknown/out-of-split predictions")
    groups = {}
    for bank in BANKS:
        for style in ("printed", "handwritten"):
            for field in FIELDS:
                groups[(bank, style, field)] = collections.Counter()
    whole = {bank: collections.Counter() for bank in BANKS}
    by_style = {bank+"/"+style: collections.Counter() for bank in BANKS for style in ("printed","handwritten")}
    latencies = []
    for image in selected:
        label = labels[image["labelId"]]
        prediction = by_id.get(image["imageId"], {})
        complete = True
        for field in FIELDS:
            truth = image["fields"][field]
            predicted = prediction.get("fields", {}).get(field, {})
            value = predicted.get("candidate")
            counter = groups[(label["bank"], label["style"], field)]
            if truth["state"] == "present":
                correct = value == truth["value"]
                counter["present"] += 1
                counter["exact"] += correct
                counter["characters"] += len(truth["value"])
                counter["edits"] += edit_distance(truth["value"], value or "")
                complete &= correct
            else:
                correct = value is None and predicted.get("reviewState") in ("missing", "needs review")
                counter["unresolved"] += 1
                counter["unresolvedDetected"] += correct
                complete = False
            if predicted.get("eligibleForSubmission") and (not correct or predicted.get("source") in ("MANUAL", "CORRECTED") or truth["state"] != "present" or truth.get("precision") in ("DATE_ONLY", "AMBIGUOUS")):
                counter["incorrectEligible"] += 1
        by_style[label["bank"]+"/"+label["style"]]["images"] += 1
        by_style[label["bank"]+"/"+label["style"]]["completeExact"] += complete
        whole[label["bank"]]["images"] += 1
        whole[label["bank"]]["completeExact"] += complete
        latency = prediction.get("latencyMs")
        if isinstance(latency, (int, float)) and latency >= 0:
            latencies.append(latency)
    metrics = []
    for (bank, style, field), values in groups.items():
        metrics.append({"bank": bank, "style": style, "field": field, **dict(values),
                        "exactMatch": values["exact"]/values["present"] if values["present"] else None,
                        "characterErrorRate": values["edits"]/values["characters"] if values["characters"] else None})
    rates = [values["completeExact"]/values["images"] for values in whole.values() if values["images"]]
    donation = [row for row in metrics if row["field"] == "donationNumber"]
    return {"classification": "SIMULATION_ONLY", "candidateBoundary": boundary, "candidateFingerprint": fingerprint, "datasetHash": digest(manifest), "datasetVersion": manifest["datasetVersion"], "candidateId": candidate, "split": split,
            "distinctLabels": len({row["labelId"] for row in selected}), "writers": len({labels[row["labelId"]].get("writerId") for row in selected if labels[row["labelId"]].get("writerId")}),
            "images": len(selected), "missingPredictions": len(selected)-len(by_id), "metrics": metrics,
            "perBank": {bank: dict(values) for bank, values in whole.items()}, "perBankStyle": {key: {**dict(value), "distinctLabels": len({image["labelId"] for image in selected if labels[image["labelId"]]["bank"]+"/"+labels[image["labelId"]]["style"]==key}), "writers": len({labels[image["labelId"]].get("writerId") for image in selected if labels[image["labelId"]]["bank"]+"/"+labels[image["labelId"]]["style"]==key and labels[image["labelId"]].get("writerId")})} for key,value in by_style.items()},
            "macroCompleteLabelExact": sum(rates)/len(rates) if len(rates) == len(BANKS) else None,
            "identifierCER": sum(row.get("edits", 0) for row in donation)/sum(row.get("characters", 0) for row in donation) if sum(row.get("characters", 0) for row in donation) else None,
            "meanLatencyMs": sum(latencies)/len(latencies) if latencies else None,
            "latencyCoverage": len(latencies), "downloadBytes": prediction_metric(predictions, "downloadBytes"), "peakMemoryBytes": prediction_metric(predictions, "peakMemoryBytes"),
            "heldOutEvaluated": split == "test", "realLabelValidated": False}

def prediction_metric(predictions, key):
    values = [row[key] for row in predictions if isinstance(row.get(key), (int, float)) and row[key] >= 0]
    return max(values) if values else None

def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    init = commands.add_parser("init"); init.add_argument("--output", required=True)
    validate = commands.add_parser("validate"); validate.add_argument("--manifest", required=True); validate.add_argument("--complete", action="store_true")
    evaluate = commands.add_parser("score"); evaluate.add_argument("--manifest", required=True); evaluate.add_argument("--predictions", required=True); evaluate.add_argument("--split", choices=("validation", "test"), required=True); evaluate.add_argument("--candidate", required=True); evaluate.add_argument("--selection"); evaluate.add_argument("--output", required=True)
    select = commands.add_parser("select"); select.add_argument("--reports", nargs="+", required=True); select.add_argument("--output", required=True)
    args = parser.parse_args()
    if args.command == "init":
        result = create_plan(args.output)
    elif args.command == "validate":
        path = Path(args.manifest); manifest = json.loads(path.read_text()); validate_manifest(manifest, path.parent, args.complete)
        result = {"valid": True, "completeEvidenceRequired": args.complete, "status": manifest["status"], "labels": len(manifest["labels"]), "photos": sum(bool(row.get("captured")) for row in manifest["images"])}
    elif args.command == "select":
        reports = [json.loads(Path(path).read_text()) for path in args.reports]
        if not reports or len({row["datasetHash"] for row in reports}) != 1 or any(row.get("identifierCER") is None or not row.get("candidateFingerprint") or row.get("candidateBoundary") != "END_TO_END_EXTRACTION" or row.get("missingPredictions") != 0 or row["split"] != "validation" or row["macroCompleteLabelExact"] is None or row["meanLatencyMs"] is None or row.get("latencyCoverage") != row["images"] for row in reports):
            raise ValueError("Selection needs comparable three-bank validation reports with complete latency evidence")
        ranked = sorted(reports, key=lambda row: (-row["macroCompleteLabelExact"], row["identifierCER"], row["meanLatencyMs"], row["candidateId"]))
        result = {"candidateId": ranked[0]["candidateId"], "candidateFingerprint": ranked[0]["candidateFingerprint"], "datasetHash": ranked[0]["datasetHash"], "selectionRule": "macro complete-label exact descending, identifier CER ascending, latency ascending, stable ID", "validationReports": [digest(row) for row in reports]}
        write_new(private_output(args.output), result)
    else:
        path = Path(args.manifest); manifest = json.loads(path.read_text()); predictions = [json.loads(line) for line in Path(args.predictions).read_text().splitlines() if line.strip()]
        output = private_output(args.output)
        if args.split == "test":
            if not args.selection:
                raise ValueError("Held-out evaluation requires frozen validation selection")
            selection = json.loads(Path(args.selection).read_text())
            if selection["candidateId"] != args.candidate or selection["datasetHash"] != digest(manifest):
                raise ValueError("Held-out candidate/dataset must match frozen selection")
            lock = path.parent / ("heldout-" + digest(selection)[:16] + ".json")
            write_new(lock, {"selectionHash": digest(selection), "startedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "status": "ATTEMPT_RECORDED_NO_AUTOMATIC_RETRY"})
        result = score(manifest, predictions, args.split, args.candidate, path.parent)
        if args.split == "test" and result.get("candidateFingerprint") != selection.get("candidateFingerprint"):
            raise ValueError("Held-out code/assets/configuration differ from validation selection")
        write_new(output, result)
    print(json.dumps(result if args.command != "score" else {key: result[key] for key in ("candidateId", "split", "images", "distinctLabels", "missingPredictions", "realLabelValidated")}))

if __name__ == "__main__":
    main()
