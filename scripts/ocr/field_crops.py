"""Shared RGB pixel crops for offline TrOCR and Tesseract. No downloads."""
import argparse
import hashlib
import json
from pathlib import Path
from experiment import private_output, validate_manifest, write_new

PILLOW_VERSION = "11.3.0"
BOUNDARY = "GROUND_TRUTH_FIELD_CROPS_NOT_END_TO_END_EXTRACTION"


def crop_field(photo, evidence):
    from PIL import __version__
    if __version__ != PILLOW_VERSION:
        raise ValueError("Shared crop preparation requires Pillow " + PILLOW_VERSION)
    if photo.width * photo.height > 40_000_000:
        raise ValueError("Photo exceeds experiment bounds")
    box = evidence["bbox"]
    if box[2] > photo.width or box[3] > photo.height:
        raise ValueError("Field crop exceeds source image bounds")
    # Both engines use the same Pillow rounding, RGB conversion and no EXIF rotation.
    return photo.crop(box).convert("RGB")


def export_crops(manifest_path, output, split):
    manifest_path = Path(manifest_path).resolve()
    manifest = json.loads(manifest_path.read_text())
    labels = validate_manifest(manifest, manifest_path.parent, True)
    output = private_output(output)
    output.mkdir(mode=0o700, parents=True, exist_ok=False)
    from PIL import Image
    rows = []
    for image in manifest["images"]:
        if labels[image["labelId"]]["split"] != split:
            continue
        crops = {}
        with Image.open(manifest_path.parent / image["path"]) as photo:
            for field, evidence in image["fields"].items():
                if evidence["state"] != "present":
                    continue
                if not evidence.get("rawText"):
                    raise ValueError("Reviewed rawText required for field-crop comparison")
                crop = crop_field(photo, evidence)
                name = f"crop-{len(rows):06}-{len(crops)}.png"
                path = output / name
                crop.save(path)
                path.chmod(0o600)
                crops[field] = {"path": name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                                "pixelSha256": hashlib.sha256(crop.tobytes()).hexdigest(), "bbox": evidence["bbox"]}
        rows.append({"imageId": image["imageId"], "crops": crops})
    result = {"candidateBoundary": BOUNDARY, "pillowVersion": PILLOW_VERSION,
              "manifestSha256": hashlib.sha256(manifest_path.read_bytes()).hexdigest(), "split": split, "images": rows}
    write_new(output / "crops.json", result)
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--split", choices=("train", "validation"), default="validation")
    args = parser.parse_args()
    result = export_crops(args.manifest, args.output, args.split)
    print(json.dumps({"images": len(result["images"]), "candidateBoundary": BOUNDARY}))
