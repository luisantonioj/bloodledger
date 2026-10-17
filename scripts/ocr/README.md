# Isolated synthetic label OCR experiment

Lat · 2026-10-17 · **SIMULATION_ONLY**. Experiment scaffolding and browser
preview, not an accepted hospital-label model. Forecasting datasets, models,
services and activation stay untouched. No cloud image upload is introduced.
The supplied photograph is a visual reference, not training data or verified
transcription. Use only fictional operational values, without personal or
clinical information.

## What exists

- 180 planning sheets: 60 per hospital, half printed/half handwritten. The
  handwritten sheets have blanks to fill by people, not simulated handwriting.
- Three photo tasks per label: clear, angled/curved, challenging lighting.
  **540 planned photographs; zero collected or reviewed photographs.**
- Each hospital has 36/12/12 labels in train/validation/test. Writers 01–03
  train, 04 validation, 05 test, disjoint across all banks. Every photo, crop
  and augmentation inherits its parent label's split. Add writers to only one
  split; report distinct writers/labels as well as photo counts.
- Mediatrix has a draft anchor profile. Medix and N.L. Villa references are
  pending; planning sheets do not impersonate their unknown label layouts.
- The frontend flag `VITE_BLOODLEDGER_LABEL_EXTRACTION_PREVIEW` defaults off.
  The isolated browser test enables it; the retained host was not activated.

## Private corpus collection

Commands run at the repository root; browser tooling uses Node 24.17.0.
Planning/scoring uses Python's standard library.

```bash
python3 scripts/ocr/experiment.py init --output build/ocr-private/my-pilot
python3 scripts/ocr/experiment.py validate --manifest build/ocr-private/my-pilot/manifest.json
python3 scripts/ocr/test_experiment.py
```

The initializer refuses an existing directory. Outputs are restricted to
ignored `build/` or `/tmp/`. The actual local planning package created for this
work is `build/ocr-private/pilot-20261017-v2/`. Keep photos, transcriptions, private
manifests and predictions outside Git, under directory mode 0700/file mode 0600.
Commit generators, permitted manifest schemas and aggregate results only.

Buno obtains authorized layout references, reproduces them with fictional
values, coordinates handwriting by assigned writers and takes the photographs.
Manufacturer branding does not establish the issuing bank. Freeze new profile
versions when Jopia accepts field semantics. Cover all eight groups and five
components across the corpus; add separate negative fixtures for missing
fields, conflicts, duplicate operational identifiers, manufacturer lot/barcodes,
unsupported layouts and inappropriate text.

For each photo fill relative `path`, SHA-256, `captured`, two opaque reviewer
IDs and field annotations. Fields record actual observed state
`present|absent|obscured|ambiguous|unreadable`, canonical value, date precision
and `[x0,y0,x1,y1]` region in source pixels. Date-only stays date-only; ambiguous
short dates have no invented timestamp. Two teammates independently review and
resolve disagreements in private review notes before marking the label
`groundTruthStatus: REVIEWED` and listing both reviewers. Do not replace actual
readability with planned/intended values. Keep writer identities private.

```bash
python3 scripts/ocr/experiment.py validate --manifest build/ocr-private/my-pilot/manifest.json --complete
```

The complete gate intentionally fails for the current uncollected plan. It
checks split leakage, hashes, duplicate images, path confinement, field boxes
and second-review evidence before allowing inference.

## Tesseract comparison

`run-browser.mjs` starts a disposable server on 4184 with its own ignored cache,
a blank benchmark page, blocked API requests and local OCR assets. It uses no
retained session and performs no writes. These prepared commands have **not**
been run on a collected corpus:

```bash
node scripts/ocr/run-browser.mjs --manifest build/ocr-private/my-pilot/manifest.json --mode baseline --split validation --candidate TESSERACT_BASELINE_V1 --output build/ocr-private/baseline-validation.jsonl
node scripts/ocr/run-browser.mjs --manifest build/ocr-private/my-pilot/manifest.json --mode regions --contrast original --split validation --candidate TESSERACT_REGIONS_ORIGINAL_V1 --output build/ocr-private/regions-validation.jsonl
node scripts/ocr/run-browser.mjs --manifest build/ocr-private/my-pilot/manifest.json --mode regions --contrast contrast --split validation --candidate TESSERACT_REGIONS_CONTRAST_V1 --output build/ocr-private/contrast-validation.jsonl
python3 scripts/ocr/experiment.py score --manifest build/ocr-private/my-pilot/manifest.json --predictions build/ocr-private/baseline-validation.jsonl --split validation --candidate TESSERACT_BASELINE_V1 --output build/ocr-private/baseline-report.json
```

Repeat scoring for each candidate. Reports separate bank, field and
printed/handwritten group, with exact match, identifier CER, complete-label
counts, unresolved detection, incorrect submission eligibility, latency,
label/writer counts and resource evidence. Missing predictions count as
failures. Profile selection in the region runner is an experimental oracle,
not evidence of verified issuing institution. Pending layouts produce no
automatic field suggestions.

Source hash/configuration accompany predictions. Also freeze the actual
profile and OCR assets, package-lock and browser/runtime versions. Latency
includes preparation and worker startup. Download bytes count unique OCR
assets. `peakMemoryBytes` remains null until a documented peak-memory probe
exists; a JS heap snapshot is not peak memory. No resource acceptance is claimed.

```bash
python3 scripts/ocr/experiment.py select --reports build/ocr-private/baseline-report.json build/ocr-private/regions-report.json build/ocr-private/contrast-report.json --output build/ocr-private/selection.json
```

Selection requires comparable end-to-end three-bank validation reports and
complete latency evidence. It maximizes macro complete-label exact match, then
minimizes identifier CER, then latency. Run the chosen browser candidate with
the identical code/assets/configuration and `--split test --selection
build/ocr-private/selection.json`. Score that output with the same `--selection`
and `--split test`. An exclusive held-out score lock prevents automatic
repetition. Preserve failed attempts; do not remove locks to improve results.
No score establishes clinical accuracy or production readiness.

## Offline handwriting adapter

`run-trocr.py` is prepared but **not installed, downloaded, executed or trained**.
It requires an isolated pinned environment and a separately prepared private
`microsoft/trocr-small-handwritten` snapshot. The local artifact lock contains:

```json
{
  "modelId": "microsoft/trocr-small-handwritten",
  "revision": "<immutable 40-character upstream SHA>",
  "packages": {"torch": "<exact>", "transformers": "<exact>", "Pillow": "<exact>"},
  "files": {"<every relative snapshot file>": "<SHA-256>"}
}
```

Replace placeholders with verified values. The adapter checks every file hash
and package version, forces offline loading, CPU deterministic inference and
seed 20261017. It recognizes annotated single-line crops, not whole bags. Its
raw text has boundary `GROUND_TRUTH_FIELD_CROPS_NOT_END_TO_END_EXTRACTION`,
which automatic end-to-end selection rejects.

```bash
python3 scripts/ocr/run-trocr.py --manifest build/ocr-private/my-pilot/manifest.json --model-dir build/ocr-private/trocr-snapshot --artifact-lock build/ocr-private/trocr-lock.json --split validation --output build/ocr-private/trocr-validation.jsonl
```

Buno must compare this with Tesseract on identical field crops, then evaluate
normalization separately. A full TrOCR extraction candidate needs the same
locator/normalizer and a new frozen candidate ID before participating in
end-to-end selection. Fine-tune only if measured baseline errors justify it;
train only on training, tune on validation, leave test untouched. Do not train
from scratch or automatically ingest users' corrections. A model outside
browser limits stays offline; a local inference service needs Jopia's separate
architecture decision. No forecasting changes or runtime activation follow
from this experiment.

Sources: [Tesseract quality guidance](https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html),
[Tesseract training guidance](https://tesseract-ocr.github.io/tessdoc/tess5/TrainingTesseract-5.html),
[TrOCR model card](https://huggingface.co/microsoft/trocr-small-handwritten).
