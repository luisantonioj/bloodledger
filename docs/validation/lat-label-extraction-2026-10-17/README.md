# Lat: synthetic label extraction preview validation

2026-10-17 · **SIMULATION_ONLY** · local technical self-validation by Lat.
This is not teammate acceptance, physical-device evidence, clinical validation
or production readiness. Implementation and evidence are recorded together in the OCR preview commit.

## Implementation and scope

Shared browser scanner for bank inbound/outbound and requester inbound:
local image preparation, versioned draft profiles, full-label anchors plus
bounded region re-recognition, guided field crops, partial editable preview,
original-score/correction separation, ambiguity handling and account cleanup.
The feature flag defaults off and was enabled only on isolated test port 4185.
The retained port 5174/API/configuration was not restarted or activated.

The existing strict synthetic path and its PIN/idempotency/frozen retry/command
polling remain. Recognition causes no automatic mutation. Requester
registration is forbidden; manual/corrected/new-preview submissions remain
unavailable pending accepted contracts. Outbound uses existing approved
reservation actions and its separate readiness gate.

## Results

| Check | Result |
| --- | --- |
| `npm run check:web` | PASS: types and production build; existing chunk-size warning |
| `npm run test:web` | PASS: 434 tests, 49 files, including design tokens and canonical product mappings |
| `npx playwright test --config apps/web/playwright.label-extraction.config.ts --workers=1` | PASS: 3 tests, real local OCR on generated synthetic images; partial/date-only results, field recapture retaining corrections, mobile controls, authentication-context cleanup, zero domain writes |
| Affected normal Playwright specs, `--workers=1` | PASS: 20 tests (`blood-bank-pages`, `blood-unit-receipt`, `scanner-ocr-workflows`); unchanged strict OCR, bank frozen retry/PIN/queued-to-committed fixtures, requester/transfer scope and clearing |
| `npm run test:inbound-ocr` | PASS: API/contract/Fabric privacy boundary checks; no backend change |
| Capture TypeScript direct check | PASS: `npx tsc --project apps/capture-pwa/tsconfig.json --noEmit --incremental false` |
| Capture unit tests direct | PASS: 23 tests / 5 files, `npx vitest run --configLoader runner --no-cache` in `apps/capture-pwa` |
| Python tooling | PASS: 4 tests for counts/splits/product coverage/writer isolation, missing and incorrectly eligible predictions, duplicate predictions and refusing overwritten output |
| Runner syntax | PASS: Node syntax check and Python compilation; not a collected-corpus/model execution |
| Private planning manifest | PASS: 180 labels, 540 tasks, 0 captured photos; 36/12/12 per bank; all eight groups and five components in every split |
| Complete corpus gate | EXPECTED BLOCK: no collected photos/second reviews; no accuracy report produced |

Ignored local logs: `build/lat-public-rollout-private/label-extraction-*.txt`.
Initial isolated-test attempts failed on a root-owned Vite cache, then on the
local build-file deny rule and an overly broad fixture URL interceptor. Final
configuration uses a separate ignored dependency cache and targets only
`/api/v1/`/`/api/v2/` requests. Private build-file protections remain unchanged;
no ownership repair was performed.

`npm run check:capture` remains blocked by the pre-existing root-owned OCR asset
prepare step; `npm run test:capture`'s default config-bundling cache is also
root-owned. Those exact wrappers did not pass. The direct checks above avoid
regenerating assets or changing ownership and passed against the existing
capture source/policy. Existing local OCR assets were used by real browser OCR.
No disposable database/API integration or physical device test was run here.

## Corpus and experiment status

Active private plan: `build/ocr-private/pilot-20261017-v2/`, dataset version
`OCR_PILOT_PLAN_V2`. The earlier uncollected planning package is preserved;
V2 improves product coverage in each split and remains wholly uncollected.
This is a generator/annotation plan, not an authorized real-label dataset.
Source photos, transcriptions and predictions stay outside Git.

The browser baseline/region runner and offline TrOCR adapter are prepared.
TrOCR has not been installed, downloaded, trained or benchmarked. Actual peak
memory remains unmeasured. Crop-only raw-line results cannot be selected against
end-to-end extraction. Complete collection and independent review, then freeze
code/dependencies/profile/model/artifact hashes and validation choice before
one held-out evaluation. See [`scripts/ocr/README.md`](../../../scripts/ocr/README.md).

## Open release gates and owners

| Gate | Owner / follow-up |
| --- | --- |
| Mediatrix field semantics/issuer/date policy accepted | Jopia; current profile is `DRAFT_REFERENCE` |
| Medix and N.L. Villa actual layout references and concrete profile versions | Jopia coordinates, Buno/Lat integrate; currently `REFERENCE_PENDING` |
| Fictional handwritten labels, five split-isolated writers, 540 physical photographs, two-person reviewed ground truth and negative fixtures | Buno/team |
| Per-hospital printed/handwritten held-out metrics, fair Tesseract/TrOCR comparison and resource evidence | Buno |
| Manual/corrected intake, date precision, destination-scoped requester receipt and shared-donation component matching contracts | Jopia; RQ-02/RQ-03/RQ-19 remain applicable |
| Supported actual-camera-device evidence | Lat; desktop image fixtures do not establish this |
| Accepted versions, runtime prerequisites and retained-host feature deployment/live tests | Jopia authorization, then scoped Lat implementation |

No live intake, outbound verification, prepare, dispatch, receipt, migration,
account change, reset, population, model activation or census/forecast rerun
was performed. No additional live authorization is inherited from this document.

Handoffs:
[Jopia](../../handoffs/LAT-TO-JOPIA-LABEL-EXTRACTION-CONTRACTS-2026-10-17.md),
[Buno](../../handoffs/LAT-TO-BUNO-OCR-DATASET-AND-BENCHMARK-2026-10-17.md).
