#!/usr/bin/env python3
"""Offline candidate adapter. Requires externally prepared, hash-pinned local model and environment."""
import argparse
import hashlib
import importlib.metadata
import json
import os
import re
from pathlib import Path
from experiment import validate_manifest, private_output

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    for argument in ("manifest","model-dir","artifact-lock","output"):
        parser.add_argument("--"+argument,required=True)
    parser.add_argument("--split",choices=("train","validation"),default="validation")
    args=parser.parse_args();os.umask(0o077)
    os.environ.update(HF_HUB_OFFLINE="1",TRANSFORMERS_OFFLINE="1",HF_HUB_DISABLE_TELEMETRY="1")
    manifest_path=Path(args.manifest).resolve();manifest=json.loads(manifest_path.read_text());labels=validate_manifest(manifest,manifest_path.parent,True)
    lock=json.loads(Path(args.artifact_lock).read_text());model_dir=Path(args.model_dir).resolve()
    if lock.get("modelId")!="microsoft/trocr-small-handwritten" or not re.fullmatch(r"[a-f0-9]{40}",lock.get("revision", "")) or not lock.get("files") or not lock.get("packages"):
        raise ValueError("Model lock must record model ID, immutable revision, file hashes and exact package versions")
    for package in ("torch","transformers","Pillow"):
        if importlib.metadata.version(package)!=lock["packages"].get(package):raise ValueError("Environment does not match pinned model experiment")
    for filename,expected in lock["files"].items():
        path=(model_dir/filename).resolve()
        if not path.is_relative_to(model_dir) or hashlib.sha256(path.read_bytes()).hexdigest()!=expected:raise ValueError("Model artifact hash mismatch")
    actual_files={str(path.relative_to(model_dir)) for path in model_dir.rglob("*") if path.is_file()}
    if actual_files != set(lock["files"]):
        raise ValueError("Every local model file must be recorded in the artifact lock")
    # Third-party imports occur only after explicit local prerequisites; no downloads.
    import time
    import random
    import torch
    from PIL import Image
    from transformers import TrOCRProcessor, VisionEncoderDecoderModel
    random.seed(20261017);torch.manual_seed(20261017);torch.use_deterministic_algorithms(True)
    processor=TrOCRProcessor.from_pretrained(str(model_dir),local_files_only=True,trust_remote_code=False)
    model=VisionEncoderDecoderModel.from_pretrained(str(model_dir),local_files_only=True,trust_remote_code=False).eval()
    rows=[]
    for image in manifest["images"]:
        if labels[image["labelId"]]["split"]!=args.split:continue
        fields={};start=time.perf_counter()
        with Image.open(manifest_path.parent/image["path"]) as photo:
            if photo.width*photo.height>40_000_000:raise ValueError("Photo exceeds experiment bounds")
            for field,evidence in image["fields"].items():
                candidate=None
                if evidence["state"]=="present":
                    crop=photo.crop(evidence["bbox"]).convert("RGB")
                    pixels=processor(images=crop,return_tensors="pt").pixel_values
                    with torch.inference_mode():ids=model.generate(pixels,max_new_tokens=128,do_sample=False)
                    candidate=processor.batch_decode(ids,skip_special_tokens=True)[0].strip() or None
                fields[field]={"candidate":candidate,"reviewState":"needs review" if candidate else "missing","source":"OCR","eligibleForSubmission":False}
        rows.append({"imageId":image["imageId"],"candidateId":"TROCR_SMALL_HANDWRITTEN_V1","fields":fields,"latencyMs":(time.perf_counter()-start)*1000,"downloadBytes":sum((model_dir/name).stat().st_size for name in lock["files"]),"peakMemoryBytes":None,"modelRevision":lock["revision"],"candidateBoundary":"GROUND_TRUTH_FIELD_CROPS_NOT_END_TO_END_EXTRACTION"})
    output=private_output(args.output)
    with output.open("x") as stream:
        for row in rows:stream.write(json.dumps(row)+"\n")
    print(json.dumps({"images":len(rows),"runtimeActivated":False,"networkDownloads":False}))

if __name__=="__main__":main()
