# Buno → Lat and Jopia: OCR V3 tooling

2026-10-17 · **SIMULATION_ONLY** · Buno technical self-validation.
This is corpus/benchmark tooling, not handwriting accuracy, UAT acceptance,
clinical validation, activation or deployment evidence.

## Delivered scope

Branch: `codex/buno-ocr-tooling-v3`, stacked on
`codex/lat-synthetic-label-profiles` at `9e4a907` (PR79, itself stacked on PR77).
Read PA-OCR-01 from Jopia's label-contract branch; no waiting for main and no
changes to application/backend, readiness flags, migrations, forecasting, V5,
models, inventory, census or retained services. Original dirty Testing-phase
work was preserved. The private laptop-context document is not in this patch.

- `scripts/ocr/experiment.py`, `reporting.py`: versioned scorer, condition and
  field-state confusion, missing/failed prediction accounting, separate negatives,
  all-three-photo success, cold/warm/unspecified p50/p95 and original versus
  policy-rounded confidence. Peak memory remains null. Scorer hashes freeze
  selection/evaluation; raw crop results remain excluded from end-to-end selection.
- `plan_v3.py`: deterministic PA-OCR-01 generator/validator. Frozen profile
  hashes, marker/caption/headings/placements and closed forms; date-only is DATE,
  not a fabricated instant. Handwriting blanks, empty observed annotations,
  local printable gallery and human collection instructions. Donation identities
  and relationships cannot cross splits. V2 generator stays unchanged/default.
- `field_crops.py`, `run-field-crops.mjs`, updated `run-trocr.py`: shared Pillow
  11.3.0 RGB pixel crops, source-bound checks, crop/file hashes and offline
  Tesseract 7.0.0 raw-line comparison. Raw reviewed text, not canonical enums,
  is the crop recognition target. These are prepared adapters, not corpus runs.
- `browser-baseline.ts`, `run-browser.mjs`: experiment-only raw line confidence
  evidence, explicit cold-start timing and frozen browser/Node lineage. Existing
  strict parser is reused. The whole-label worker restarts each image, so warm
  measurements are not invented. The crop worker is reused after its first image.
- `test_alignment.py`, `test_field_crops.py`: regression tests alongside the
  original `test_experiment.py`; README documents reproduction and limitations.

## New private planning package

`build/ocr-private/pilot-20261017-v3/`, dataset `OCR_PILOT_PLAN_V3`.
Manifest SHA-256:

```text
6cb42444456c5e39a938682b7b85715ff9bdaffaa6461786d1d8a62b842a839f
```

180 positive labels (60 per bank, 30 printed + 30 handwritten) / 540 photo tasks.
63 separately counted negatives / 189 photo tasks: seven classes × three banks ×
three splits. Total **243 plans, 729 photo tasks, zero collected photos/reviews**.
The seventh class is ambiguous short dates; no ambiguous short dates are positive
examples. Unknown-layout negatives have an explicitly unsupported profile ID/hash
and accepted=false. No fourth layout is approved. Existing six classes are retained.

Positive train/validation/test: 36/12/12 per bank, 18/6/6 per style. Writers 01–03
train, 04 validation, 05 test across banks. Human assignments are not participation
evidence. Date and expiry examples are fictional research values, not shelf-life
policy. Every frozen accepted profile matches the three SHA-256 values in README.

V2 reproduction test retains manifest
`d4df9d999aa8774eb5ad25cae8561c1140aadc2e2ac36364d4c1e8ce86cf72d4`.
No existing V2 package was overwritten. A V3 development draft was retained privately
under a different directory before freezing the final package; it is not the
version to collect. No private manifest, SVG, image or prediction is committed.

## Commands and results

Pinned Node 24.17.0/npm 11.13.0 from the Node container were extracted into an
isolated `/tmp` runtime. Lockfile dependencies installed only in this worktree.
Python stdlib tests ran with host Python 3.12.3. Commands below are from the repo
root (Node commands used `PATH=/tmp/buno-ocr-runtime/bin:$PATH`).

| Command/check | Result |
|---|---|
| `npm ci --ignore-scripts` | PASS; lockfile unchanged |
| `python3 scripts/ocr/test_experiment.py` | PASS 4 tests |
| `python3 scripts/ocr/test_alignment.py` | PASS 7 tests |
| `python scripts/ocr/test_field_crops.py` | PASS 2 tests in isolated Python/Pillow container |
| `python3 scripts/ocr/experiment.py init --version v3 --output build/ocr-private/pilot-20261017-v3` | PASS, counts above |
| `python3 scripts/ocr/experiment.py validate --manifest build/ocr-private/pilot-20261017-v3/manifest.json` | PASS |
| Same validate command with `--complete` | Expected rejection, exit 1; no photographs/independent reviews |
| `node --check scripts/ocr/run-browser.mjs` and `node --check scripts/ocr/run-field-crops.mjs` | PASS |
| Python AST parse of all scripts/ocr Python files | PASS |
| Vite bundle of experiment-only browser helper, write=false | PASS |
| `npm run scan:secrets` | PASS, history/index/candidate scans; no exclusions added |
| `git diff --check` | PASS |

Crop test environment/command (installs an image library only, no model weights):

```bash
docker run --rm -v "$PWD:/workspace" -w /workspace \
  python:3.13.11-slim@sha256:2b9c9803c6a287cafa0a8c917211dddd23dcd2016f049690ee5219f5d3f1636e \
  sh -c 'python -m pip install --disable-pip-version-check Pillow==11.3.0 && PYTHONDONTWRITEBYTECODE=1 python scripts/ocr/test_field_crops.py'
```

Browser helper check used the installed repository Vite (no output written):

```bash
node --input-type=module - <<'JS'
import {build} from 'vite';
import {resolve} from 'node:path';
await build({configFile:false,logLevel:'error',build:{write:false,lib:{entry:resolve('scripts/ocr/browser-baseline.ts'),formats:['es']},rolldownOptions:{external:['tesseract.js']}}});
JS
```

An initial helper-check command attempted to import esbuild, which this Vite 8
lockfile does not supply; it failed. Replaced the check with the repository's Vite
bundler above, which passed. No dependency or lockfile change was made to hide it.
The two pixel tests use generated software fixtures, not corpus photographs or
independent human reviews. Recognition runner syntax/bundling and unit tests do
not prove model inference or camera accuracy.

## Not run and next owners

**Not run:** physical printing/handwriting/photography, human transcription,
review reconciliation, a photographic recognition benchmark, TrOCR loading or
fine-tuning, held-out evaluation, actual device timing/peak-memory probe, live API
writes, deployment or any readiness/activation change. No language/model weights
were downloaded. Pillow was installed in a disposable OCR test environment only.

**People/Buno coordination:** use the private `print-sheets.html` and COLLECTION.txt
(or regenerate with the checksum above). Have assigned people fill handwriting
blanks, take all three conditions, then have two different people independently
annotate actual observed values/raw text/state/precision/pixel regions and resolve
disagreements privately. Never photograph issued units, real labels or the supplied
bag reference. Do not mark planned annotations reviewed just to pass validation.

**Lat:** review the experiment-only helper and runner metadata/crop adapter; keep
app integration and flags unchanged. No need to repeat layout freezing or transfer
the original package: regenerate V3 locally. Actual camera/browser resource evidence
comes after collection; do not present tooling tests as recognizer support.

**Jopia:** review PA-OCR-01 compliance and the tooling stack. The three frozen
fictional profiles are already accepted for corpus use under that assumption;
this does not request another real-reference approval. Backend field/precision,
manual/corrected and receipt/outbound contracts remain Jopia-owned and separate.
RQ-02, RQ-03 and RQ-19 remain open. Do not merge/activate application behavior from
this tooling PR. Coordinate the PR79 base before retargeting to main.

**Buno after collection:** validate reviewed evidence, freeze validation candidates,
compare raw crops fairly and full pipelines separately, preserve failed attempts,
then recommend fine-tuning only if measured baseline errors justify it. Freeze the
selected candidate before untouched held-out evaluation. No accuracy percentage
or model-change recommendation exists yet.

## PR80 review corrections — V4 collection plan

Jopia/Lat feedback was disclosed as Jopia reviewing both roles on one laptop;
it is not two independent corpus transcription reviews.

Fixed `reporting.py`: all-three-photo correctness now permits matching absent,
obscured, ambiguous and unreadable states. Missing/failed attempts still fail.
Added regressions for state mismatch, failed and missing predictions. Present-field
exact matching and submission safety checks remain unchanged.

`plan_v3.py` now accepts explicit V4 generation through `experiment.py init --version v4`.
V3's output hash remains byte-identical. V4 has one date-only positive per
bank/style/split (18 total; six test), varied collection dates/times and expiry
intervals, unchanged splits/writers/relationships, 180 positives, 63 negatives,
729 tasks and zero photographs/reviews. README explicitly lists Pillow 11.3.0.

New manifest SHA-256:
`4c01e74b6b125954d173e522066b12d6d375ba6d52d6a987cb30976eac66ed60`.

Self-validation commands/results for this correction:
- `python3 scripts/ocr/test_experiment.py`: PASS 4.
- `python3 scripts/ocr/test_alignment.py`: PASS 9 (including V3 hash preservation,
  V4 reproducibility/coverage/date validation and non-present-state regressions).
- `python3 scripts/ocr/experiment.py init --version v4 --output build/ocr-private/pilot-20261017-v4`: PASS.
- `python3 scripts/ocr/experiment.py validate --manifest build/ocr-private/pilot-20261017-v4/manifest.json`: PASS, zero photos.

Crop/browser runners were unchanged by this correction; earlier pixel/syntax/bundle
checks remain the disclosed evidence. No recognition benchmark or training ran.
Lat/Jopia: review these corrections before benchmarking. People should collect from
the new V4 package, retaining V3 privately as historical planning evidence. All prior
physical collection, independent review, privacy and SIMULATION_ONLY boundaries remain.
- Correction `git diff --check` and `npm run scan:secrets`: PASS.
