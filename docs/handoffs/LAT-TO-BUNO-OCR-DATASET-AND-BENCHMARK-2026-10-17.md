# Lat → Buno: synthetic label corpus and handwriting benchmark

2026-10-17 · **SIMULATION_ONLY**. This is a separate OCR experiment. Do not
modify forecasting datasets, models, services, census, V5 or activation.
Jopia owns field semantics/contracts; Lat owns scanner/extraction integration.

## Prepared, not collected or trained

Exact commands and tools: [`scripts/ocr/README.md`](../../scripts/ocr/README.md).
Private local package `build/ocr-private/pilot-20261017-v2/` contains 180 fictional
planning sheets and a manifest for 540 photographs. Each hospital has 30 printed
and 30 handwritten labels, each with three photo conditions. **Zero photos
collected, no reviewed transcription, no trained model or accuracy report.**
The sheets are planning aids, not validated hospital layouts. No actual bag
photo or unrestricted OCR text was copied into Git or used to train a model.

Mediatrix has a draft anchor profile. Medix and N.L. Villa references remain
pending. Obtain authorized references and coordinate concrete immutable profile
versions with Jopia before reproducing layouts. Manufacturer branding cannot
identify a bank. Each bank needs its own held-out report before claiming support.

## Collect and independently review

- Per bank: 60 labels split 36/12/12 train/validation/test. Keep all label
  photos/crops/augmentations together. Writers 01–03 train, 04 validation,
  05 test; additional writers also belong to one split across all banks.
- Photograph clear, angled/curved and challenging lighting. Use fictional
  identifiers and all eight groups/five components across the corpus. Rendered
  cursive is not a substitute for human handwriting.
- Annotate each observed value, pixel region, field state
  present/absent/obscured/ambiguous/unreadable, date precision and profile
  version. Preserve image hashes and lineage privately.
- Two teammates independently review, resolve disagreements explicitly and
  mark ground truth reviewed. Planned values do not prove readability.
- Add separate negatives: missing/conflicting dates, duplicate operational IDs,
  manufacturer lot/barcode, unknown layout and inappropriate text.
- Keep photos/transcriptions/private manifests/predictions outside Git with
  private permissions. Use opaque writer/reviewer codes. Commit only tooling,
  permitted manifests/schemas and aggregate reports.

The validator checks writer leakage, duplicate images, hashes, confined paths,
visible-field boxes and independent-review records. The current incomplete
package correctly fails its complete-evidence gate.

## Compare before training

Run current Tesseract versus profile/region extraction and fixed preprocessing
variants on the same data. The local browser runner blocks API access, uses
local engine assets and activates no retained feature. Freeze code, profile,
assets, package-lock, configuration, browser/runtime and dataset hashes.

The offline TrOCR adapter checks a locally prepared, hash-pinned
`microsoft/trocr-small-handwritten` snapshot and exact package versions. It is
**not installed, downloaded, executed or trained here**. It recognizes annotated
single-line field crops, not a bag layout. Raw cropped-line output cannot fairly
compete with normalized end-to-end extraction. Add a Tesseract baseline on the
same field crops, measure raw recognition, then integrate the same locator and
normalizer under a new frozen candidate ID if justified. The selection tool
rejects crop-only reports.

Fine-tune only if measured baseline errors justify it. Train on training, tune
on validation, pin weights/dependencies/seed, and run the selected candidate
once on untouched test. Do not train from scratch or automatically ingest
operators' corrections. Models beyond browser limits stay offline; an inference
server needs Jopia's separate architecture decision. No cloud image upload.

## Report back

Per bank, field and printed/handwritten group: exact match, identifier CER,
complete-label exact match, missing/ambiguous detection, incorrect submission
eligibility, processing time, actual download size and measured peak memory.
Count labels and writers separately from photographs. Peak memory currently
remains null; a JS heap snapshot does not establish it. Selection maximizes
three-bank macro complete-label exact match, then minimizes identifier CER and
latency. Preserve failures; no percentage establishes clinical acceptance.

Return versions/hashes, reproducible commands, per-bank failures and limits,
resource evidence and a supported recommendation (including no model change).
Separate Jopia policy/backend dependencies from Lat UI/extraction changes.
Unsupported combinations remain unavailable. Actual-camera evidence and
real-label requirements are separate gates. New preview results never become
verified submissions solely because a recognizer returned a value.
