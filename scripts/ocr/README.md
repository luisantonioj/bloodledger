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
- Since 2026-10-17, the corpus uses the three fictional layouts frozen under
  `PA-OCR-01` (`SYNTHETIC_LABEL_LAYOUT_V1`) in
  [`contracts/synthetic-label-layout-v1.json`](../../contracts/synthetic-label-layout-v1.json).
  They copy no real hospital label. A profile's SHA-256 is computed over
  `JSON.stringify({schemaVersion, marker, timeCaption, timeZoneOffset,
  dateFormats, bloodTypeForms, componentForms, profile})` (UTF-8, file key
  order); record its ID, version and hash with every label made from it.

  | Profile | Version | SHA-256 |
  | --- | --- | --- |
  | `SYN_MEDIATRIX_LAYOUT` | 1 | `d2f7e32f34b30a9f9c6ce4135c1aff046f8bff2238ce6ccae4d0ff29f857a8e4` |
  | `SYN_MEDIX_LAYOUT` | 1 | `a16303ec3cc23127b7755787bcef46afb6b011320e9fb79a2937dfd04fc1d502` |
  | `SYN_NLVILLA_LAYOUT` | 1 | `6946fcc1e2e635eb99af6db15a4a8071aa2d928925dd3a970ad51e9afcd3ed4f` |

  Any change is a new version with a new hash; the web test pins these values.
  The existing V2 planning sheets still reference the earlier draft and pending
  profile IDs; regenerating the plan against these layouts is Buno's step.
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

## Buno V3 tooling — 2026-10-17

V2 stays byte-identical and remains the default `init` version for reproducibility.
For the separate PA-OCR-01 package, use a **new** directory:

```bash
python3 scripts/ocr/experiment.py init --version v3 --output build/ocr-private/pilot-20261017-v3
python3 scripts/ocr/experiment.py validate --manifest build/ocr-private/pilot-20261017-v3/manifest.json
python3 scripts/ocr/test_experiment.py
python3 scripts/ocr/test_alignment.py
```

V3 manifest SHA-256:
`6cb42444456c5e39a938682b7b85715ff9bdaffaa6461786d1d8a62b842a839f`.
It contains **180 positive labels / 540 photo tasks**, plus **63 negative labels /
189 photo tasks** (one per class/bank/split; seven classes including ambiguous short
dates). Total: 243 label plans, 729 photo tasks, **zero photographs or reviews**.
The fixed enumeration uses seed identifier 20261017; no randomness depends on the
clock or host. Positive splits/writers are preserved. Same-donation negatives
reference a donation in their own split; both relationship and identifier leakage
are rejected. Profile stamps use the frozen rule above. Unknown-layout negatives
have their own version/hash and `layoutReferenceAccepted:false`; they are not an
accepted fourth layout. Their hashes document the deliberately unsupported design.

SVGs print the marker, bank line, UTC+08:00 caption and frozen heading positions.
Closed printed forms and intended canonical values are separate. Handwritten
values are blank; `print-sheets.html` supports local landscape printing.
`COLLECTION.txt` explains the human steps. Observed annotations start null, never
as planned truth. The seven negative classes are marked separately in the manifest.
`validate --complete` intentionally fails until collection and two real independent
reviews are recorded. Do not invent reviewer identities or photograph issued units.

### Aligned scoring

Reports are versioned `OCR_SCORE_V2`, pin the scorer bytes, and preserve the
candidate, dataset, code/assets/configuration boundaries. Selection requires the
same scorer version/hash; held-out scoring checks it again. Existing selection
artifacts must not silently acquire the changed scoring protocol.

- Positive condition/field reports are grouped by bank, style and condition.
  State confusion records all observed ground-truth states against predicted
  states, plus FAILED, MISSING_PREDICTION and UNKNOWN. `recognized`, `missing`
  and `needs review` map explicitly to present, absent and ambiguous; the current
  recognizer does not distinguish every unreadability state.
- Complete-label counts remain photo-level; `allThreePhotosPerLabel` separately
  requires exactly one clear, angled/curved and challenging-lighting photo, with
  every field exact in all three. Missing/failed predictions stay failures.
- Negatives are excluded from positive selection accuracy and reported separately,
  including incorrect eligibility. Date precision DATE remains non-submittable.
- Latency has cold/warm/unspecified sample counts and p50/p95 (linear interpolation
  at `(n-1)*p`), also by bank/style/condition. Measured failed attempts count toward
  time; absent times stay absent. The whole-label browser path starts a new worker
  for every image, so all those times are cold and warm remains empty. The shared
  crop baseline reuses a worker: first photo cold, subsequent photos warm.
- Raw original confidence and the existing policy's nonnegative `Math.round`
  score are separate, with sample counts and the number crossing 90 on rounding.
  Original scores are not reconstructed from rounded values. Scores remain engine
  evidence, not correctness probabilities; preview policy is unchanged.
- `peakMemoryBytes` is always null until a reviewed peak-memory probe is added.
  Supplied heap or unproven memory values do not become a peak-memory result.

The experiment-only `browser-baseline.ts` uses the same strict parser and local
engine settings but retains raw line confidence privately. No application file or
readiness flag changes. The browser runner freezes its own code, helper, layout
contract, package lock, extraction sources, engine assets, Node and browser version.

### Matching raw field crops (prepared, not a corpus benchmark)

Use Python with **Pillow 11.3.0** in a separate OCR environment, Node 24.17.0 and
lockfile Tesseract.js 7.0.0. No model download is part of these commands. The local
English asset must already exist and match its pinned hash. Do not run recognition
before reviewed photographs exist.

```bash
python3 scripts/ocr/field_crops.py --manifest build/ocr-private/pilot-20261017-v3/manifest.json --split validation --output build/ocr-private/v3-validation-crops
node scripts/ocr/run-field-crops.mjs --crops build/ocr-private/v3-validation-crops/crops.json --lang-path apps/capture-pwa/public/ocr-assets/lang --output build/ocr-private/tesseract-crops-validation.jsonl
python3 scripts/ocr/experiment.py score --manifest build/ocr-private/pilot-20261017-v3/manifest.json --predictions build/ocr-private/tesseract-crops-validation.jsonl --split validation --candidate TESSERACT_SHARED_FIELD_CROPS_V1 --output build/ocr-private/tesseract-crops-report.json
python3 scripts/ocr/test_field_crops.py
```

Both engines now use `field_crops.crop_field`: identical Pillow cropping/rounding,
RGB conversion, source coordinates and no implicit EXIF rotation. Exported crop
files and pixels have hashes; boxes outside the source are rejected. Reviewers
must provide actual `rawText` for present fields. Raw crop scoring compares that
text, not a normalized enum or UTC value. The TrOCR lock must also pin Pillow
11.3.0. Crop reports retain `GROUND_TRUTH_FIELD_CROPS_NOT_END_TO_END_EXTRACTION`
and cannot enter end-to-end selection. Region localization is oracle evidence;
this does not demonstrate whole-label recognition or missing-field detection.

Crop adapters load local assets: network download bytes are zero and local
asset/model bytes are separately reported. Original Tesseract confidence is
recorded; TrOCR does not manufacture a comparable confidence score. TrOCR weights
were not downloaded, loaded or trained. The generated-pixel crop tests are software
checks only. Actual camera/handwriting/resource evidence remains pending.
