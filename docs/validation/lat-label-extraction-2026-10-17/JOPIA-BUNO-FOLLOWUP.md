# Lat: Buno/Jopia OCR follow-up

2026-10-17 · **SIMULATION_ONLY** · technical self-validation; no owner/backend
acceptance, clinical claim or live authorization inferred.

## Source and review references

Original OCR commit: `5724b367ecb5fbf1928e8f99f74d5979a8b00850`, now pushed on
`codex/lat-doh-reporting-dashboard-20261016`. The follow-up commit containing
this record adds client guards/recovery and publishes the saved laptop context.
No PR was created, and no teammate message was sent.

Jopia reply inspected from
`origin/codex/jopia-label-contracts-inbound-replay`,
`81c67cd759b7237bea5e0a5036b29f9a6ff09882`; J1 implementation is `7b32384`.
Fetched main remains `25bddeb`; neither J1 nor that branch was merged/deployed
by Lat. Buno's readiness attachment was read; its older private-archive request
is superseded by the user's latest Buno instruction to regenerate the plan.

## Client changes

- Strict OCR component must match every reservation member before a scan can
  enter outbound V1 evidence. Sibling component, empty membership, mixed or
  unknown product rejects. No raw Donation No. is shown in the mismatch.
- This is a **usability guard only**. Server F1 still needs J2/V2; F2/J3 and
  F4/J5 remain backend/policy dependencies. No new endpoint/schema was wired.
- Strict intake retains `OCR_LABEL` sources for blood/component and original
  engine confidence. Corrected/profile-region drafts remain non-submittable.
- Inbound retry is bound to its original operator/key. Cancelling a first,
  unsent verification releases that unsent attempt; cancelling a verification
  for an already ambiguous retry preserves the original frozen attempt.
- Explicit lookup calls actor-scoped GET `/api/v2/commands?idempotencyKey=...`.
  It performs no POST. Empty, unavailable or identity-mismatched responses keep
  the original attempt frozen. Valid lookup checks capture resource type/ID,
  status URL and correlation, then uses existing command polling/presentation.
- Older API ALREADY_REGISTERED during an own-key ambiguous retry does not
  resolve original command status. A fresh-key duplicate remains distinct.
- Identifier CER without any reviewed identifier characters now returns null;
  candidate selection rejects absent identifier support. No benchmark was run.

## Results

| Check | Result |
| --- | --- |
| `npm run check:web` | PASS: types/build, existing chunk warning |
| `npm run test:web` | PASS: 437 tests / 50 files, includes design-token checks and 3 new component-guard tests |
| Normal affected Playwright suite, one worker | PASS: 24 tests covering bank pages, requester receipts and the first four recovery scenarios |
| Final focused scanner/recovery suite, one worker | PASS: 7 tests after the cancellation fix, including preservation when retry PIN verification is cancelled |
| Enabled outbound fixture suite, one worker | PASS: 2 tests, matching component/frozen evidence replay and sibling-component rejection without a POST |
| Extraction-preview fixture suite, one worker | PASS: 3 tests; requester/experimental draft restrictions preserved |
| `npm run test:inbound-ocr` | PASS: API/contract/Fabric privacy boundary |
| `python3 scripts/ocr/test_experiment.py` | PASS: 4 tests, includes null identifier CER and frozen candidate metadata |
| `bash scripts/scan-secrets.sh` | PASS: Git history, staged index and candidate files; redacted scan, no leaks |
| Browser-runner syntax and Python compilation | PASS; not corpus/model execution |

Browser tests used generated synthetic images and real local Tesseract with
mocked API responses. No actual intake, verification, preparation, dispatch or
receipt was sent. Recovery tests assert GET identity/key, no additional POST,
original operator binding with multiple eligible operators, immutable retry
body/key and frozen state on empty/wrong identity/legacy duplicate responses.

Ignored logs: `build/lat-public-rollout-private/ocr-jopia-followup-*.txt`.

## Pilot and preservation

Private source planning manifest SHA-256:
`d4df9d999aa8774eb5ad25cae8561c1140aadc2e2ac36364d4c1e8ce86cf72d4`.
A fresh temporary regeneration produced a byte-identical manifest with this hash. No archive transfer or photo collection occurred. The reproducible plan is 180
fictional labels / 540 photo tasks / 0 collected photos, with empty review
records. Complete-evidence validation remains blocked. Private files remain
ignored; only source, synthetic fixtures and docs are published.

The source publication and regeneration instructions are in
[the teammate reply](../../handoffs/LAT-TO-BUNO-JOPIA-OCR-SOURCE-AND-GUARDS-2026-10-17.md).
Buno still needs approved concrete profiles, actual photography and independent
review before corpus benchmarking/model decisions. Protocol reporting extensions
are listed as work to align before benchmarking; no missing metric is fabricated.

Both extraction/outbound readiness defaults remain off. Requester scanner
confirmation remains disabled; existing reservation-level receive is untouched.
No API deploy, migration, account/password/operator change, Fabric change,
reset/population, forecasting change, census/forecast rerun or model activation
was performed. The unrelated progress-report file remains outside this commit.
