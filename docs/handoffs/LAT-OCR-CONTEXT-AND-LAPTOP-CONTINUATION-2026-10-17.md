# BloodLedger OCR: full context and laptop continuation handoff

**Prepared:** 2026-10-17, Asia/Manila
**Current role:** Lat — frontend/scanner integration
**Classification:** SIMULATION_ONLY
**Purpose:** Continue the OCR work on another local laptop without losing the
implementation, decisions, limitations or teammate responsibilities.

## Publication and teammate-review update — 2026-10-17

The original OCR commit **5724b367ecb5fbf1928e8f99f74d5979a8b00850** has now
been pushed to `origin/codex/lat-doh-reporting-dashboard-20261016`. The earlier
local-only statements below describe the original handoff snapshot and are
superseded for current source availability. This context file is included in
the follow-up publication. No PR is being created.

Latest response and validation:
[LAT-TO-BUNO-JOPIA-OCR-SOURCE-AND-GUARDS-2026-10-17.md](LAT-TO-BUNO-JOPIA-OCR-SOURCE-AND-GUARDS-2026-10-17.md).
Buno's latest instruction supersedes the earlier private-archive request:
regenerate the same planning package after fetching the tools. No corpus photos
or private files are transferred through Git.

Jopia accepted directions, not new wire contracts. His J1 replay fix is on
`origin/codex/jopia-label-contracts-inbound-replay`; main remains `25bddeb` at
this review. It has not been merged into this frontend branch or deployed here.
The frontend follow-up adds a V1 outbound component usability guard, binds
inbound retries to the original operator and offers explicit actor-scoped
command lookup after a lost response. Requester scanner confirmation and both
readiness flags remain disabled. J2–J6 stay gated; server F1/F2/F4 are not
claimed fixed by client code. All photography, review, model and device gates
below remain open.

## 1. Read this first

The editable scanner and experimental extraction pipeline have been implemented
and committed. **A reliable three-hospital handwriting recognizer has not yet
been trained, evaluated or activated.** Do not interpret the completed frontend
work as completed recognition research or authorization for new transaction
methods.

The next agent should act as **Lat**, use the repository-local
[`bloodledger-role` skill](../../.agents/skills/bloodledger-role/SKILL.md), and
read [AGENTS.md](../../AGENTS.md) and the current
[Testing-phase plan](../TESTING-PHASE.md) before changing anything. Preserve
existing frontend layouts and unrelated edits. Inspect actual state first.

Suggested opening message for the new laptop:

> $bloodledger-role Lat
>
> Continue BloodLedger OCR from
> docs/handoffs/LAT-OCR-CONTEXT-AND-LAPTOP-CONTINUATION-2026-10-17.md.
> Verify commit 5724b367ecb5fbf1928e8f99f74d5979a8b00850 is present and inspect
> the checkout before changing anything. Preserve the existing layouts and
> strict verified OCR path. Review the Jopia/Buno dependencies and the saved
> validation. Do not claim all three label families or handwriting are supported
> yet. Do not run live commands, migrations, retained deployment, account
> changes, training-data upload or forecast/census reruns from this handoff.

## 2. Exact source baseline and what was saved

| Item | State when this handoff was written |
| --- | --- |
| Repository | `luisantonioj/bloodledger` |
| Origin | `https://github.com/luisantonioj/bloodledger.git` |
| Original local checkout | `/home/yuri/projects/bloodledger-current` |
| Branch | `codex/lat-doh-reporting-dashboard-20261016` |
| OCR commit | `5724b367ecb5fbf1928e8f99f74d5979a8b00850` (`5724b36`) |
| Commit title | `feat(web): add editable OCR label extraction preview` |
| Immediate parent | `df656f27087a20f72cf990ca6818d52e2e58d29e` — saved DOH dashboard work |
| Commit scope | 39 files: shared scanner, extraction preview, tests, experiment tools, gap notes and teammate handoffs |
| Publication | Local commit made; no push or PR was performed for this OCR work |
| Remote availability | Not verified against the live remote; no cached remote-tracking branch contained the OCR commit at inspection |
| This document | Created after `5724b36`; copy it separately unless subsequently committed |

The branch name predates the OCR work; it does not mean the OCR changes are
missing. The OCR commit sits on top of the saved frontend history. Do not
replace this branch with an older main or cherry-pick the OCR commit onto an
arbitrary old base and assume all earlier frontend work is present.

An unrelated, pre-existing untracked file remains on the original host:
`docs/handoffs/BLOODLEDGER-COMPLETE-PROGRESS-REPORT-2026-10-16.md`.
It was intentionally excluded from the OCR commit. Do not delete or silently
include it in a different change.

## 3. Why this work started

The user wanted functional camera OCR and manual review in:

1. Blood-bank facilities: **Inbound**, to register supported blood units.
2. Blood-bank facilities: **Outbound**, meaning approved transfer
   preparation/dispatch, not arbitrary local stock removal.
3. Requestor hospitals: **Inbound only**, to receive units from incoming
   transfers, without gaining blood-bank registration permissions.

The UI needed to read a photo, populate the existing preview, and let an
operator correct misread fields before an authorized confirmation. Existing
compact scanner styling was retained: icon-only back arrow at the left,
centered Inbound/Outbound Blood Unit Input title, zero vertical header padding,
and no native scrollbar arrows.

A supplied bag photograph did not produce the expected result. The observed
layout contains a manufacturer bag/branding, multiple identifiers/barcodes and
a separate operational sticker with handwritten entries. It is a **visual
reference only**, not authorized training data or a verified transcription.
The original filename was `d07bd025-2eb0-4b99-80de-99dbe1e6f621.jpg`; its old
Windows Downloads path is not portable to another laptop. No copy was added
to this repository or the synthetic corpus. Do not reconstruct its identifiers
from chat or treat it as a labeled training example.

The failure was not demonstrated to be only a model-training issue:

- The old parser expects five exact, same-line headings and strict synthetic
  values; actual stickers can put handwritten values below printed headings.
- Printed heading recognition and handwritten value recognition are different
  problems; handwriting accuracy has not been measured on a reviewed corpus.
- Manufacturer lot/catalog/barcode values are not operational Donation No.
- Short dates do not establish a century, time or expiry policy automatically.
- Component may be absent; it cannot be inferred from bag appearance/volume.

The approved approach is **crop/location/extraction improvements first,
measured handwriting comparison second, conditional fine-tuning third**.

## 4. Agreed goal, scope and team ownership

Target label families: **Mediatrix, Medix and N.L. Villa**. Use fictional labels,
including real paper handwriting by several writers. Do not advertise support
for all three until each has a concrete accepted profile and its own held-out
report.

| Owner | Responsibility |
| --- | --- |
| Jopia | Label/identifier/date policy, backend authorization and schemas, manual/correction provenance, requester receipt matching, outbound identity rules and integration acceptance |
| Buno | Separate OCR corpus, annotation/review, printed/handwritten benchmarks, error analysis, pinned model experiments and evidence-based recommendation |
| Lat | Shared camera workflow, local preprocessing, field extraction, editable previews, integration against published contracts, browser and actual-device evidence |

Buno's OCR work is **separate from forecasting**. Do not modify forecasting
models, training datasets, services, V5 activation or census/forecast records.
No new cloud image upload or inference service is part of this implementation.
A model that cannot meet browser limits stays offline unless Jopia accepts a
separate architecture decision.

## 5. What the current frontend does

### Shared workflow

Bank and requester scanners now reuse `UnitCaptureWorkspace`. Scan mode offers
camera/file selection and an explicit **Run OCR** button. Manual mode offers
an editable draft. Five supported fields appear in the existing preview:

- Donation No. / Unit ID.
- Blood type, using the V2 vocabulary.
- Component, including cryoprecipitate.
- Collection date/time.
- Expiration date/time.

Only JPG/PNG files up to 10 MB are accepted by the scanner. OCR runs through
**Tesseract.js 7.0.0**, using existing local English engine assets. This is not
a newly trained blood-bag-specific model and is not TrOCR running in the app.

Images, crops and recognition evidence are volatile. They are not saved to
browser storage, URLs, the backend or the ledger by recognition. Confirmation
is cleared whenever a field changes. Closing/replacing a capture clears its
state; the application also remounts account-scoped content when authentication
changes. No scanner result automatically registers, dispatches or receives stock.

### Existing strict synthetic path

The strict five-field recognition policy remains authoritative for existing
verified intake. An unchanged original recognition can use the current bank
intake API after explicit review and operator verification. Edited/manual/new
extraction results cannot manufacture that original OCR authority.

Bank intake preserves PIN verification, capability `inventory:capture`,
idempotency/correlation, V2.1 vocabulary and command polling. A lost-response
attempt freezes its body, key and event time for explicit retry. A 202 is queued,
not ledger committed. Duplicate registration does not imply a new inventory
unit. Existing mutation error handling refreshes time-window-rejected attempts.

### Workflow availability

| Workflow | Current behavior | Still blocked/pending |
| --- | --- | --- |
| Bank inbound, strict unchanged synthetic OCR | Existing `/api/v2/inbound-captures` path with confirmation/PIN, frozen retries and polling | Actual live execution was not performed here |
| Bank inbound, manual/corrected/new profile extraction | Editable draft and original recognition provenance | New accepted method/policy/API; do not send it as verified OCR |
| Bank outbound | Select a scoped outgoing TRANSFER reservation; reuse existing prepare/verification/dispatch actions; valid strict OCR may seed verification | Existing outbound readiness flag and host prerequisites; new label/component matching decisions |
| Requester inbound | Same local OCR and editable preview; no outbound choice | Destination-scoped label-matched receipt contract; confirm remains disabled |

A reservation receive capability alone is not permission to expose bank
registration to ROLE-03. Never work around that gap by opening the bank endpoint
to requesters or marking unrelated stock received.

## 6. New extraction preview: feature flag and behavior

`VITE_BLOODLEDGER_LABEL_EXTRACTION_PREVIEW=true` enables the experimental
extraction UI/pipeline. **Default is off; it was not enabled on the retained
host.** The existing scanner and strict OCR work are present independently of
this new extraction flag. Vite reads its flags at startup/build time; editing
a flag requires restarting/rebuilding the relevant isolated instance.

With the extraction preview enabled:

```text
Capture → crop/rotate → identify draft profile → locate field regions
        → recognize values → normalize → validate → editable preview
```

Implemented controls and safeguards:

- 90-degree rotation, percent-based crop, straightening from -10 to +10 degrees,
  original color or grayscale/contrast variant; processed image preview.
- Local processing bounded to 2,400 pixels on the longest side, with an image
  dimension rejection above 40 million pixels in the preparation path.
- Printed anchors with values beside/on the same line or below, using OCR
  coordinates; up to five bounded field windows are re-read with the worker.
- Guided single-field crops for unsupported layouts, without inventing a bank
  profile or verified issuing institution.
- Partial results populate immediately. Missing fields stay missing; conflicting
  candidates stay unresolved instead of taking the first number.
- Short ambiguous dates retain their original evidence but no inferred value;
  ISO date-only values remain date-only, not fabricated timestamps.
- Missing component stays blank. Manufacturer branding cannot establish issuer.
- Per-field original value, original engine score or null, precision,
  profile/version, source, state and inspectable crop remain separate from edits.
- The UI derives Edited state by comparing the draft with original evidence.
  Editing does not raise or fabricate confidence. Engine scores are not
  probabilities of correctness.
- Guided recapture replaces only that field and retains other suggestions and
  operator edits, with each field's original volatile crop evidence.

All new extraction results are **preview-only/unverified**, even when every
field has a candidate. The unchanged legacy strict path may retain its existing
verification only under its own checks. Do not broaden `INBOUND_OCR_V1` or
ADR-035 to make an experimental preview submittable.

### Profile registry at the committed baseline

| Bank | Profile/version | Status |
| --- | --- | --- |
| Mediatrix | `MEDIATRIX_BAG_PREVIEW`, v1 | `DRAFT_REFERENCE`; reference-derived anchors, not accepted institutional policy |
| Medix | `MEDIX_REFERENCE_PENDING`, v1 | No concrete layout anchors/reference yet |
| N.L. Villa | `NLVILLA_REFERENCE_PENDING`, v1 | No concrete layout anchors/reference yet |

The preview alias list is an experimental normalization aid, not a newly
approved wire/policy contract. Unknown layouts and the two pending profiles
must not be described as fully supported. Guided drafts are still possible.

## 7. Source map for the next agent

Paths below are relative to the new repository root, not the old laptop.

| File/area | Purpose |
| --- | --- |
| `apps/web/src/features/receipts/unit-capture-workspace.tsx` | Shared input/review state, local OCR, confirmation, strict bank intake and frozen attempts |
| `.../receipt-ocr.ts` | Local Tesseract worker, line/box evidence, strict recognizer and preview extraction integration |
| `.../scan-review-data.ts` | Five-field draft, strict parser reuse, immutable original verification check |
| `.../label-review-fields.tsx` | Editable fields and evidence display |
| `.../label-profiles.ts` | Draft/reference-pending profiles and default-off flag |
| `.../label-extraction.ts` | Anchor/value association, normalization, ambiguity, metadata and guided field merge |
| `.../field-regions.ts` | Bounded printed-heading field windows |
| `.../label-image-preparation.ts` | In-memory resize/crop/rotation/contrast |
| `.../label-image-controls.tsx` | Image/profile/field controls |
| `.../field-extraction-evidence.tsx` | Original reading, score, derived edit state and inspectable crop |
| `.../scanner-transfer-actions.tsx` | Source-scoped reservation list/detail, V2.1, existing authorized actions |
| `.../receipt-scanner.tsx` | Requester inbound-only wrapper |
| `apps/web/src/features/transactions/bank-unit-scanner.tsx` | Bank modal/direction selection and compact back navigation |
| `.../blood-unit-transactions-page.tsx` | Opens bank scanner; refreshes history on close |
| `apps/web/src/features/transfers/outbound-verification.tsx` | Existing verified outbound flow, optional strict OCR seed |
| `.../reservation-actions.tsx` | Existing reservation action lifecycle reused by scanner |
| `apps/web/src/hooks/use-live-data.ts`, `use-validated-read.ts`, `use-paged-read.ts` | Existing safe read hooks, extended with optional V2.1 headers |
| `apps/web/src/styles/global.css` | Preserved scanner header/scroll styling, review/preparation styles and PIN dialog stacking |
| `apps/capture-pwa/src/capture-policy.ts` | Existing strict parser and capture policy; not relaxed by this work |
| `contracts/inbound-ocr-v1.schema.json`, `services/api/openapi-v2.json` | Existing authoritative contracts; do not invent request shapes |
| `scripts/ocr/` | Isolated dataset planning/validation/scoring and recognition adapters |

In the table, `.../` continues the immediately preceding feature directory.

## 8. Dataset and recognition experiments: exact current status

**No handwriting dataset has been collected, no model downloaded/fine-tuned,
and no hospital held-out accuracy report produced.** The tooling is prepared;
syntax/unit tests are not a corpus benchmark.

The active private planning package on the original laptop is:

```text
build/ocr-private/pilot-20261017-v2/
datasetVersion: OCR_PILOT_PLAN_V2
180 distinct fictional labels
540 planned photographs
0 collected photographs
```

Per bank: 30 printed and 30 handwritten labels, three photos per label (clear,
angled/curved, challenging lighting). Label split is 36 train / 12 validation /
12 test, with all eight groups and five components represented in each split.
Writers 01–03 are training-only, 04 validation-only, 05 test-only, disjoint
across banks. Every crop/photo/augmentation stays with its parent label.
The earlier V1 uncollected plan is retained; V2 improves per-split coverage.

These are planning SVGs and annotation tasks, not 540 existing photographs.
Handwritten sheets have blanks for people to write; a computer handwriting font
is not actual handwriting evidence. Layout references for pending banks must
be obtained before creating representative reproductions.

Ground truth needs source-pixel regions, canonical observed values or
absent/obscured/ambiguous/unreadable states, date precision, profile version,
image hashes, two independent reviewers and resolved disagreements. Intended
values alone are not readable ground truth. Keep photos/transcriptions,
writer identities and predictions private, outside Git. Use opaque codes.

Tooling:

- `experiment.py`: private plan generation, validation, writer/hash/path checks,
  grouped metrics, validation-only selection and guarded held-out scoring.
- `run-browser.mjs`: isolated Tesseract baseline/profile-region comparison on
  port 4184, API requests blocked, local OCR assets and blank benchmark page.
- `run-trocr.py`: unexecuted offline single-line handwriting adapter requiring
  a local hash-pinned `microsoft/trocr-small-handwritten` snapshot and exact
  environment. It is not installed in the application.
- `test_experiment.py`: four tooling tests, not recognition-accuracy results.

The browser runner records code/engine asset/configuration lineage. Validation
and held-out evaluation must use the same frozen candidate. The selector
maximizes three-bank macro complete-label exact match, then minimizes identifier
CER, then latency. Failed/missing predictions count as failures. Keep held-out
attempt records; do not remove them to improve a result.

TrOCR currently produces raw text from annotated ground-truth field crops,
with a different evaluation boundary. It cannot fairly be ranked against
end-to-end extraction; the selector rejects that boundary. Buno must add a
matching cropped-line Tesseract comparison and, if justified, integrate a model
with the same locator/normalizer before full-pipeline selection. Fine-tune only
after measured baseline errors justify it, training on training only and tuning
on validation. Do not train from scratch or automatically ingest user edits.

Peak memory remains unmeasured/null. A JS heap snapshot is not peak memory.
No browser resource acceptance or real-label accuracy is established.
Detailed commands: [OCR experiment README](../../scripts/ocr/README.md).

## 9. Required backend/policy work — Jopia

See the existing concrete handoffs rather than changing backend policy silently:

- [Original manual/corrected intake and requester receipt gaps](LAT-TO-JOPIA-OCR-MANUAL-AND-REQUESTER-RECEIPT-2026-10-16.md).
- [Label semantics, dates and extraction contracts](LAT-TO-JOPIA-LABEL-EXTRACTION-CONTRACTS-2026-10-17.md).

Required decisions/contracts include:

1. Accepted versioned profiles per bank: issuer evidence, operational Donation
   No., manufacturer exclusions, approved group/component aliases and conflicts.
2. Short/date-only interpretation, century, timezone and precision. No default
   midnight/end-of-day or inference of missing component/issuer is authorized.
3. Verified manual entry and corrected OCR method/provenance/operator authority
   through an explicit accepted contract, not fabricated confidence.
4. Destination-scoped ROLE-03 label matching against incoming transfer units,
   without unrelated registration or source inventory access.
5. Outbound component identity where multiple components share a Donation No.,
   reservation membership/count/version checks and safe errors without labels.
6. Original-result replay, expected versions, capability mapping, command/history
   vocabulary, compatibility, synthetic fixtures and runtime prerequisites.

`RQ-02`, `RQ-03` and `RQ-19` remain applicable. Requirements/ADRs/OpenAPI are
controlling. This handoff does not itself resolve them.

## 10. Buno and Lat follow-up

Buno's full assignment is saved in
[LAT-TO-BUNO-OCR-DATASET-AND-BENCHMARK-2026-10-17.md](LAT-TO-BUNO-OCR-DATASET-AND-BENCHMARK-2026-10-17.md).
Buno returns per-hospital/field/printed-handwritten exact match, identifier CER,
complete-label exact match, unresolved detection, unsafe eligibility, latency,
download size, memory, distinct labels/writers, lineage and limitations.
Separate backend dependencies for Jopia from extraction/UI dependencies for Lat.

Lat integrates only the published interfaces, retains PIN/idempotency/frozen
retry/expected version/FEFO/state and queued-versus-committed semantics, and
records actual camera-device evidence separately from desktop generated-image
tests. Do not change the user's unrelated tables, dashboards or layouts.

Release sequence:

| Milestone | Current disposition |
| --- | --- |
| Extraction/preview foundation | Implemented and tested; one draft profile, two reference-pending profiles |
| Three representative synthetic families and reviewed physical corpus | Not complete; references, collection and independent review needed |
| Handwriting comparison/conditional fine-tuning/held-out reports | Not run; tooling prepared |
| Accepted manual/correction/receipt/identity/date contracts | Jopia dependency |
| Browser resource and physical-device acceptance | Pending |
| Accepted profile/model activation and retained live workflows | Not authorized/performed by this OCR work |

## 11. Moving the actual source to another laptop

**An MD file supplies context, not the source commit.** Do not assume a fresh
clone of main includes `5724b36`. No OCR push was performed. This document was
also created after that commit, so transfer it separately unless saved in a
later commit. Never copy `node_modules`, runtime credentials or Docker volumes
as a substitute for obtaining the source correctly.

First inspect both checkouts and preserve unrelated changes. Verify source:

```bash
git status --short
git show --no-patch --format=fuller 5724b367ecb5fbf1928e8f99f74d5979a8b00850
```

Choose the appropriate source-transfer path; these are instructions, not
operations performed while creating this handoff:

**If the branch is subsequently pushed by the user:** fetch it normally on the
new laptop and verify the exact commit, rather than assuming main contains it.

**Offline Git bundle option:** from the original repository, export the branch
and its reachable history to a new file outside the checkout:

```bash
git bundle create /tmp/bloodledger-ocr-5724b36.bundle codex/lat-doh-reporting-dashboard-20261016
git bundle verify /tmp/bloodledger-ocr-5724b36.bundle
```

Transfer that bundle and this MD privately. In an existing repository on the
new laptop, after confirming the working tree is safe to switch:

```bash
git bundle verify /path/to/bloodledger-ocr-5724b36.bundle
git fetch /path/to/bloodledger-ocr-5724b36.bundle refs/heads/codex/lat-doh-reporting-dashboard-20261016:refs/remotes/ocr-handoff/lat-ocr
git show --no-patch --oneline 5724b367ecb5fbf1928e8f99f74d5979a8b00850
git switch -c codex/lat-ocr-laptop-continuation 5724b367ecb5fbf1928e8f99f74d5979a8b00850
```

Use the actual bundle path and an unused branch name. A new repository may
instead be cloned from the bundle, then its origin configured to the normal
repository if needed. Do not reset an existing checkout or force-push/rebase
away saved frontend history. Integrating later main changes requires reviewing
them against this baseline, not treating this older handoff as current truth.

Git does not carry the private corpus, logs, credentials, identities, local
volumes, language assets or the retained database. The pilot is currently only
a plan, so it can be regenerated privately. Any future actual research photos
or retained-state move needs separately agreed custody/transfer procedures.
Do not move secrets through chat, Git, PR text or this document.

## 12. New-laptop prerequisites and safe first checks

Use the repository's canonical Windows/WSL2 Linux-filesystem workflow and
[local development documentation](../LOCAL-DEVELOPMENT.md). The old absolute
path is historical, not mandatory. Inspected versions: Node **24.17.0**, npm
**11.13.0** in project engines; Python **3.12.3** on the original host.
Planning/scoring uses the Python standard library. TrOCR has separate pinned
prerequisites and should not be installed into forecasting's environment.

In a fresh, user-owned checkout, install dependencies from the lockfile:

```bash
node --version
npm --version
npm ci --ignore-scripts
npx playwright install chromium
npm run prepare:ocr --workspace @bloodledger/capture-pwa
```

These new-laptop installation commands have not been executed on that laptop.
Resolve its normal browser/OS prerequisites without assuming the original
machine's installation or ownership. Do not run builds as root against a
mounted checkout.

`prepare:ocr` regenerates only the capture workspace's ignored OCR assets. It
may download the pinned English language asset and validates its hash; it does
not upload images. The script replaces its generated asset directory, so do
not run it against an unknown/shared retained mount as a casual repair.
On the original host this step hit an existing root-ownership problem; do not
carry forward an old authorization to chown paths or reset data.

The worker expects locally served paths:

```text
/capture/ocr-assets/worker.min.js
/capture/ocr-assets/core/...
/capture/ocr-assets/lang/eng.traineddata.gz
```

The isolated OCR browser fixtures serve these assets directly from the local
capture workspace. They do **not** require a running API, real credentials,
Docker, database, Fabric or new accounts. This is the recommended first proof
on the new laptop:

```bash
npm run check:web
npm run test:web
npx playwright test --config apps/web/playwright.label-extraction.config.ts --workers=1
npm run test:inbound-ocr
python3 scripts/ocr/test_experiment.py
```

For the 20 affected normal browser tests, from `apps/web`:

```bash
npx playwright test --config playwright.config.ts blood-bank-pages.spec.ts blood-unit-receipt.spec.ts scanner-ocr-workflows.spec.ts --workers=1
```

Capture policy checks used on the original laptop:

```bash
npx tsc --project apps/capture-pwa/tsconfig.json --noEmit --incremental false
```

Then, from `apps/capture-pwa`:

```bash
npx vitest run --configLoader runner --no-cache
```

If you need a new private planning package, from the repository root:

```bash
python3 scripts/ocr/experiment.py init --output build/ocr-private/laptop-pilot
python3 scripts/ocr/experiment.py validate --manifest build/ocr-private/laptop-pilot/manifest.json
```

Do not run inference as though this generated manifest contains photographs.
`validate --complete` should fail until the corpus has actual photos and
independent reviews. Preserve the original plan if present; init refuses
existing output. Benchmark commands and pinned-model requirements are in the
experiment README.

### Ports and flags

| Item | Meaning |
| --- | --- |
| `5174` | Existing main web review port; do not assume the old host's services/configuration exist on the new laptop |
| `3000` | Existing API proxy target, not needed for fixture browser tests |
| `4174` | Normal affected Playwright production-preview server |
| `4185` | Isolated extraction-preview Playwright server; sets extraction flag true |
| `4184` | Isolated corpus benchmark runner, when invoked |
| `VITE_BLOODLEDGER_LABEL_EXTRACTION_PREVIEW` | New extraction UI/pipeline flag; default off |
| `VITE_BLOODLEDGER_OUTBOUND_VERIFICATION_READY` | Existing separate outbound readiness gate; do not enable by inference |
| `BLOODLEDGER_VITE_CACHE_DIR` | Override for a generated dependency cache; use an ignored `node_modules` subdirectory |
| `BLOODLEDGER_LOCAL_ACCOUNT_SWITCHER` | Existing temporary local-only convenience, requires separate private host configuration; not necessary for fixture tests |

Do not turn on unrelated public-application/readiness flags or copy an old
private `.env` just to get the scanner tests running. A normal interactive
signed-in UI needs that laptop's separately configured API and authorized
ordinary login. This handoff contains no passwords or PINs and grants no
account creation permission.

## 13. Validation already completed on the original laptop

Full evidence and limitations:
[lat-label-extraction-2026-10-17/README.md](../validation/lat-label-extraction-2026-10-17/README.md).
These are historical results; rerun appropriate checks after changes on the new
laptop, and record its own outcomes.

| Check | Recorded result |
| --- | --- |
| Web types/production build | PASS; existing chunk-size warning |
| Web unit/design-token suite | 434 passed, 49 files |
| Extraction-preview browser suite | 3 passed, one worker |
| Affected normal browser suites | 20 passed, one worker |
| Capture TypeScript direct check | PASS |
| Capture unit tests via direct config runner | 23 passed, 5 files |
| Inbound OCR contract/API/Fabric privacy boundary check | PASS |
| Experiment-tooling unit tests | 4 passed |
| Browser runner syntax/Python compilation | PASS; not actual model evaluation |
| Private plan structural validation | PASS: 180 labels / 540 tasks / 0 collected |
| Complete corpus validation | EXPECTED BLOCK: no photos/second reviews |

Browser tests used actual local Tesseract on generated synthetic images plus
mocked API fixtures. They exercised partial/date-only results, crop/mobile
controls, retaining edits through recapture, authentication-context loss,
requester restrictions, scoped outgoing selection, PIN cancellation, frozen
retries and queued-to-committed responses. They are not real-label or physical
camera evidence. No disposable API/database integration or live domain command
was run in this OCR work.

Local logs are ignored under
`build/lat-public-rollout-private/label-extraction-*.txt`; they are not in Git.

## 14. Known setup issues and what not to repeat

1. **Root-owned generated assets/cache on the old host.** Standard
   `npm run check:capture` failed in its OCR asset preparation hook;
   `npm run test:capture` failed while bundling its config in a root-owned Vite
   temp cache. The direct capture checks above passed. No root ownership
   repair or retained redeployment was performed for OCR. A clean user-owned
   new checkout may not have these issues; do not call the wrappers passing
   unless they actually pass there.
2. **Private `build/` cannot be a served Vite dependency cache.** Existing
   local security middleware denies `/build/` paths. An initial isolated test
   cache there produced 403 module loads. Use the committed isolated cache
   location under ignored `apps/web/node_modules/`; do not weaken the deny rule.
3. **Overbroad API fixtures can intercept source modules.** In Vite dev mode,
   `**/api/**` also matches `/src/services/api/client.ts`. New extraction tests
   correctly intercept only `/api/v1/` and `/api/v2/`. Avoid reintroducing a
   blank-page fixture bug.
4. **Run OCR disabled is not automatically a training defect.** Check selected
   valid image, processing/locked transaction state, asset availability and
   worker errors first. Camera access also needs a supported browser/secure
   context and actual device testing. Desktop localhost does not establish
   camera behavior on a physical phone.
5. **Flags are separate from recognition acceptance.** Enabling the preview
   shows drafts; it does not authorize corrected/manual submission, establish
   issuer policy or satisfy outbound migration/readiness gates.
6. **Do not rerun a held-out set to improve results.** Preserve failed attempts,
   match frozen code/assets/configuration and distinguish technical failures
   from recognition errors. Crop-only models and end-to-end pipelines require
   comparable evaluation boundaries.

## 15. Immediate continuation checklist

1. Obtain and verify `5724b36` and its parent history; inspect working tree and
   read the repository instructions plus this handoff.
2. Reproduce fixture-only web/OCR tests on the new laptop. No retained database
   or account copying is required for that step.
3. Check for new Jopia/Buno replies or published contracts; do not assume this
   handoff includes work they may have done later.
4. Coordinate the missing label references and accepted profile semantics.
5. Continue the reviewed synthetic physical corpus and fixed-ground-truth
   experiments; keep actual research artifacts private.
6. Integrate accepted contracts without changing existing layout or treating
   drafts as verified OCR. Test all three workflow scopes and failure cases.
7. Record actual device/resource evidence and per-hospital held-out results.
8. Seek a separately scoped activation/deployment/live-test decision only when
   those prerequisites exist. Keep feature-flag rollback available.

Do not repeat completed layout work or describe the entire OCR project as
finished. The next technical work is evidence/contract-driven, not guessing
missing dates, components, issuing facilities or confidence.

## 16. Preservation and authorization boundaries

Preserve saved designs, accounts/operators, identities, retained data, backups,
Docker volumes and existing evidence. This document grants no new live intake,
outbound verification, prepare, dispatch, receipt, migration, reset, population,
account/password/operator change, Fabric operation or forecast/census rerun.
No model activation, image cloud upload or inference server rollout is implied.

Published contracts and project requirements govern mutations; institutional
real-label/privacy/clinical requirements remain unresolved where documented.
This work is a measured synthetic research prototype, not clinical, regulatory,
production or ISBT 128 validation.
