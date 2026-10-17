"""Aggregate OCR research metrics; no image, runtime or forecasting access."""
import collections
import math

STATES = ("present", "absent", "obscured", "ambiguous", "unreadable")
CONDITIONS = ("clear", "angled_curved", "challenging_lighting")


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def latency_summary(values):
    values = sorted(values)
    def percentile(p):
        if not values:
            return None
        position = (len(values) - 1) * p
        low, high = math.floor(position), math.ceil(position)
        return values[low] + (values[high] - values[low]) * (position - low)
    return {"samples": len(values), "p50Ms": percentile(.5), "p95Ms": percentile(.95)}


def aligned_metrics(selected, labels, predictions, fields, raw_crops=False):
    groups = {}
    successes = collections.defaultdict(list)
    grouped_timings = {}
    timings = {key: [] for key in ("cold", "warm", "unspecified")}
    for image in selected:
        label = labels[image["labelId"]]
        prediction = predictions.get(image["imageId"])
        failed = prediction is None or bool(prediction.get("safeErrorCode"))
        supplied = {} if failed else prediction.get("fields", {})
        condition = image.get("condition", "unspecified")
        whole = not failed
        for field in fields:
            truth = image["fields"][field]
            actual = truth["state"]
            value = supplied.get(field, {})
            predicted_state = value.get("state", value.get("reviewState"))
            predicted_state = {"recognized": "present", "missing": "absent", "needs review": "ambiguous"}.get(predicted_state, predicted_state)
            if failed:
                predicted_state = "FAILED" if prediction else "MISSING_PREDICTION"
            elif predicted_state not in STATES:
                predicted_state = "UNKNOWN"
            key = (label["bank"], label["style"], condition, field)
            if key not in groups:
                groups[key] = {"images": 0, "present": 0, "exact": 0, "failedPredictions": 0,
                               "stateConfusion": {}, "confidenceSamples": 0, "originalConfidenceSum": 0,
                               "policyRoundedConfidenceSum": 0, "roundedCrosses90": 0}
            group = groups[key]
            group["images"] += 1
            group["failedPredictions"] += failed
            cell = group["stateConfusion"].setdefault(actual, {})
            cell[predicted_state] = cell.get(predicted_state, 0) + 1
            correct = not failed and actual == "present" and value.get("candidate") == truth.get("rawText" if raw_crops else "value")
            if actual == "present":
                group["present"] += 1
                group["exact"] += correct
            whole &= correct
            score = value.get("originalConfidence")
            if not failed and finite(score) and 0 <= score <= 100:
                # JS Math.round for nonnegative scores: existing INBOUND_OCR_V1 semantics.
                rounded = math.floor(score + .5)
                group["confidenceSamples"] += 1
                group["originalConfidenceSum"] += score
                group["policyRoundedConfidenceSum"] += rounded
                group["roundedCrosses90"] += score < 90 <= rounded
        successes[image["labelId"]].append((condition, whole))
        elapsed = prediction.get("latencyMs") if prediction else None
        if finite(elapsed) and elapsed >= 0:
            phase = prediction.get("latencyPhase", "unspecified")
            phase = phase if phase in timings else "unspecified"
            timings[phase].append(elapsed)
            grouped_timings.setdefault((label["bank"], label["style"], condition, phase), []).append(elapsed)
    rows = []
    for (bank, style, condition, field), group in sorted(groups.items()):
        n = group["confidenceSamples"]
        rows.append({"bank": bank, "style": style, "condition": condition, "field": field, **group,
                     "exactMatch": group["exact"] / group["present"] if group["present"] else None,
                     "originalConfidenceMean": group["originalConfidenceSum"] / n if n else None,
                     "policyRoundedConfidenceMean": group["policyRoundedConfidenceSum"] / n if n else None})
    label_groups = {}
    for label_id, results in successes.items():
        label = labels[label_id]
        key = label["bank"] + "/" + label["style"]
        group = label_groups.setdefault(key, {"labels": 0, "completeConditionSets": 0, "allThreeExact": 0})
        complete = len(results) == 3 and {r[0] for r in results} == set(CONDITIONS)
        group["labels"] += 1
        group["completeConditionSets"] += complete
        group["allThreeExact"] += complete and all(r[1] for r in results)
    for group in label_groups.values():
        group["allThreeExactRate"] = group["allThreeExact"] / group["labels"]
    return {"conditionFieldMetrics": rows, "allThreePhotosPerLabel": label_groups,
            "latencyByBankStyleCondition": [{"bank": key[0], "style": key[1], "condition": key[2], "phase": key[3], **latency_summary(values)} for key, values in sorted(grouped_timings.items())],
            "latencyByPhase": {key: latency_summary(values) for key, values in timings.items()},
            "latencyPercentileMethod": "linear interpolation at (n-1)*p; failed attempts with measured time included",
            "confidencePolicy": "INBOUND_OCR_V1 Math.round then >=90; engine scores are not correctness probabilities"}
