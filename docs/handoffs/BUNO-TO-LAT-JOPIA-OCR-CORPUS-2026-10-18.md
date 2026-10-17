# Buno → Lat and Jopia: V4 physical corpus status

2026-10-18 · SIMULATION_ONLY · Status: BLOCKED pending physical collection.

Source: PR80 commit `cec8ec1`. Approval for collection and Jopia’s independent regeneration are user-reported; one person reviewed both owner roles, disclosed as self-validation. Local checks below are Buno self-validation, not human transcription reviews.

The previous temporary checkout/package was unavailable. Regenerated the unchanged V4 plan from the approved commit; no existing photos or reviews were recovered. Kept a private copy under the persistent workspace `build/ocr-private/pilot-20261017-v4/`. Do not interpret this reconstruction as verification of any other host’s collected evidence.

## Manifest and validation

Planning manifest SHA-256: `4c01e74b6b125954d173e522066b12d6d375ba6d52d6a987cb30976eac66ed60`. This is not a final collected-corpus hash; that remains pending.

Commands:
```bash
python3 scripts/ocr/experiment.py init --version v4 --output build/ocr-private/pilot-20261017-v4
sha256sum build/ocr-private/pilot-20261017-v4/manifest.json
python3 scripts/ocr/experiment.py validate --manifest build/ocr-private/pilot-20261017-v4/manifest.json --complete
```

Generation and hash match: PASS. Complete validation: expected FAIL (exit 1), `Uncollected or second-review-pending image; no benchmark completion claim`.

243 planned labels: 180 positive and 63 negative; 729 planned photographs, zero collected. The table includes negative tasks (printed).

| Bank | Style | Split | Condition | Planned photos | Collected |
|---|---|---|---|---:|---:|
| MEDIATRIX | handwritten | test | angled_curved | 6 | 0 |
| MEDIATRIX | handwritten | test | challenging_lighting | 6 | 0 |
| MEDIATRIX | handwritten | test | clear | 6 | 0 |
| MEDIATRIX | handwritten | train | angled_curved | 18 | 0 |
| MEDIATRIX | handwritten | train | challenging_lighting | 18 | 0 |
| MEDIATRIX | handwritten | train | clear | 18 | 0 |
| MEDIATRIX | handwritten | validation | angled_curved | 6 | 0 |
| MEDIATRIX | handwritten | validation | challenging_lighting | 6 | 0 |
| MEDIATRIX | handwritten | validation | clear | 6 | 0 |
| MEDIATRIX | printed | test | angled_curved | 13 | 0 |
| MEDIATRIX | printed | test | challenging_lighting | 13 | 0 |
| MEDIATRIX | printed | test | clear | 13 | 0 |
| MEDIATRIX | printed | train | angled_curved | 25 | 0 |
| MEDIATRIX | printed | train | challenging_lighting | 25 | 0 |
| MEDIATRIX | printed | train | clear | 25 | 0 |
| MEDIATRIX | printed | validation | angled_curved | 13 | 0 |
| MEDIATRIX | printed | validation | challenging_lighting | 13 | 0 |
| MEDIATRIX | printed | validation | clear | 13 | 0 |
| MEDIX | handwritten | test | angled_curved | 6 | 0 |
| MEDIX | handwritten | test | challenging_lighting | 6 | 0 |
| MEDIX | handwritten | test | clear | 6 | 0 |
| MEDIX | handwritten | train | angled_curved | 18 | 0 |
| MEDIX | handwritten | train | challenging_lighting | 18 | 0 |
| MEDIX | handwritten | train | clear | 18 | 0 |
| MEDIX | handwritten | validation | angled_curved | 6 | 0 |
| MEDIX | handwritten | validation | challenging_lighting | 6 | 0 |
| MEDIX | handwritten | validation | clear | 6 | 0 |
| MEDIX | printed | test | angled_curved | 13 | 0 |
| MEDIX | printed | test | challenging_lighting | 13 | 0 |
| MEDIX | printed | test | clear | 13 | 0 |
| MEDIX | printed | train | angled_curved | 25 | 0 |
| MEDIX | printed | train | challenging_lighting | 25 | 0 |
| MEDIX | printed | train | clear | 25 | 0 |
| MEDIX | printed | validation | angled_curved | 13 | 0 |
| MEDIX | printed | validation | challenging_lighting | 13 | 0 |
| MEDIX | printed | validation | clear | 13 | 0 |
| NLVILLA | handwritten | test | angled_curved | 6 | 0 |
| NLVILLA | handwritten | test | challenging_lighting | 6 | 0 |
| NLVILLA | handwritten | test | clear | 6 | 0 |
| NLVILLA | handwritten | train | angled_curved | 18 | 0 |
| NLVILLA | handwritten | train | challenging_lighting | 18 | 0 |
| NLVILLA | handwritten | train | clear | 18 | 0 |
| NLVILLA | handwritten | validation | angled_curved | 6 | 0 |
| NLVILLA | handwritten | validation | challenging_lighting | 6 | 0 |
| NLVILLA | handwritten | validation | clear | 6 | 0 |
| NLVILLA | printed | test | angled_curved | 13 | 0 |
| NLVILLA | printed | test | challenging_lighting | 13 | 0 |
| NLVILLA | printed | test | clear | 13 | 0 |
| NLVILLA | printed | train | angled_curved | 25 | 0 |
| NLVILLA | printed | train | challenging_lighting | 25 | 0 |
| NLVILLA | printed | train | clear | 25 | 0 |
| NLVILLA | printed | validation | angled_curved | 13 | 0 |
| NLVILLA | printed | validation | challenging_lighting | 13 | 0 |
| NLVILLA | printed | validation | clear | 13 | 0 |

## Reviews and missing work

Completed independent reviews: 0. Reviewer disagreements: NOT ASSESSED, not zero measured disagreements. No resolutions exist. Two different people must annotate independently and privately record disagreements/resolutions; intended values are not observed truth.

Pending: local landscape printing, assigned writers (01–03 train, 04 validation, 05 test), all three physical photo conditions, image hashes/paths, two-person reviews and reconciliation, complete validation and final manifest hash. No benchmark, candidate freeze, inference, download or training ran.

Use the private print-sheets.html and COLLECTION.txt. Do not upload the package. Keep all photographs, transcriptions and manifests private. Preserve V2/V3 historical packages; this run does not claim to have recovered their missing temporary copies. Reproducible generators remain in the approved source.

Lat/Jopia/team: arrange printing, five writer codes and two different reviewers, then provide the private local location of collected evidence for Buno to validate. Benchmark evidence belongs in a later separate handoff. RQ-02, RQ-03 and RQ-19 remain open. Forecasting and application behavior are unchanged.
