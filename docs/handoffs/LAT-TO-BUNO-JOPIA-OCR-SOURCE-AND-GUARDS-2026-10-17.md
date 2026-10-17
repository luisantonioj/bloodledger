# Lat → Buno and Jopia: published OCR source and client follow-up

2026-10-17 · **SIMULATION_ONLY**. Replies received from Buno's readiness review
and latest regeneration instruction, and Jopia's accepted reference/direction
review. This records source availability and frontend follow-up; it is not
backend contract acceptance, model activation or a retained rollout.

## Source is now available

Published branch: `codex/lat-doh-reporting-dashboard-20261016`.
Original OCR implementation commit:
`5724b367ecb5fbf1928e8f99f74d5979a8b00850`.

[Read scripts/ocr/README.md at that immutable commit](https://github.com/luisantonioj/bloodledger/blob/5724b367ecb5fbf1928e8f99f74d5979a8b00850/scripts/ocr/README.md).
This branch now contains the preview sources and original manual/requester
handoff that were missing during both reviews. A follow-up commit on the same
branch contains this response, the saved laptop-context document and the
client guards/recovery below. Inspect current head with Git; this document
cannot contain its own commit hash. No draft PR was created.

Fetch/inspect without replacing an unrelated dirty checkout:

```bash
git fetch origin codex/lat-doh-reporting-dashboard-20261016
git show --no-patch --oneline 5724b367ecb5fbf1928e8f99f74d5979a8b00850
git show origin/codex/lat-doh-reporting-dashboard-20261016:scripts/ocr/README.md
```

Preserve Buno's dirty Testing-phase file and other owner work. Obtain the full
source in a suitable separate checkout before running tools, rather than
copying individual scripts onto an unrelated baseline.

## Pilot: regenerate, no private transfer required

Buno's latest instruction supersedes the archive request in the older attached
readiness note. No archive has been uploaded or sent. The source host's private
folder remains `build/ocr-private/pilot-20261017-v2/`; it is ignored by Git.
From a checkout containing the tools, with a fresh/nonexistent output folder:

```bash
python3 scripts/ocr/experiment.py init --output build/ocr-private/pilot-20261017-v2
python3 scripts/ocr/experiment.py validate --manifest build/ocr-private/pilot-20261017-v2/manifest.json
sha256sum build/ocr-private/pilot-20261017-v2/manifest.json
```

Expected manifest SHA-256 for the generated **planning manifest**:

```text
d4df9d999aa8774eb5ad25cae8561c1140aadc2e2ac36364d4c1e8ce86cf72d4
```

This is a manifest checksum, **not an archive checksum**. It is not a hash of
collected photographs; there are none. Initialization refuses existing output;
do not overwrite a package that has since acquired observations/reviews.

Expected plan: 180 labels, 540 photo tasks, 0 captured photos. Per bank:
30 printed + 30 handwritten, 18/6/6 of each style across train/validation/test
(36/12/12 labels total), three conditions per label. All eight blood groups and
five components occur in each split, but this does not establish held-out
support for every one of the 40 combinations. Writers 01–03 train, 04 validation,
05 test, kept disjoint across banks. Future donation-related label variants
must stay in the same split. Planned reviewer arrays remain empty.

`validate --complete` must remain blocked until actual fictional-label photos,
observed field annotations and two independent transcription reviews exist.
Do not mark this planning package as collected/reviewed training data. Future
actual photo/review custody is a separate private process; no secrets, photos,
transcriptions, corpus archives or manifests are committed here.

## Jopia response and frontend disposition

Reviewed Jopia's reply on branch `codex/jopia-label-contracts-inbound-replay`,
head `81c67cd759b7237bea5e0a5036b29f9a6ff09882`:
[Jopia's accepted references/directions](https://github.com/luisantonioj/bloodledger/blob/81c67cd759b7237bea5e0a5036b29f9a6ff09882/docs/handoffs/JOPIA-TO-LAT-LABEL-EXTRACTION-CONTRACTS-2026-10-17.md).
J1 backend commit is `7b32384`; fetched main remains `25bddeb` at this review.
No backend merge/rebase, API deployment or migration was performed here.
J1 is not claimed present on the retained host.

| Follow-up | Client disposition |
| --- | --- |
| Extraction flag and draft status | Default-off preserved; new, edited, ambiguous, date-only and unsupported results stay non-submittable |
| F4 evidence sources | Existing strict bank intake sends `OCR_LABEL` for both blood type and component; browser regression asserts both; no BAG_TYPE/OPERATOR_CONFIRMED path added |
| Scores/provenance | Engine-score presentation retained; no score is attached to a value it did not recognize; region drafts cannot submit pending accepted profiles |
| Requester receipt | New scanner confirmation remains disabled; existing reservation-level receive left untouched; no receipt-verifications endpoint invented |
| F1 outbound guard | Strict OCR-read component must match every reserved member before adding a scan; empty, mixed, unknown and mismatched memberships reject; no sensitive label echo |
| F1 security limitation | Client check is usability only. Server V2 is still required; existing outbound-ready flag is not enabled |
| Frozen intake operator | Retry remains bound to the original operator/key, including when several eligible operators exist; cancelled unsent verification remains retryable with no intake sent |
| Lost-response lookup | Explicit `Look up saved intake` uses actor-scoped GET `/api/v2/commands?idempotencyKey=...`; no POST during recovery |
| Lookup identity/failures | Resource type, capture-ID grammar, status URL and correlation must agree; empty/mismatched/failed lookups leave the original attempt frozen, with no automatic resubmit or new key |
| ALREADY_REGISTERED | Fresh-key result means another request recorded the unit. An ambiguous own-key retry returning it from an older API does not resolve the original command; use lookup instead |
| History and future contracts | Strict parsers unchanged. No UNIT_HISTORY_READ_V2, receipt V1, outbound V2 or proposed ADR/migration is wired prematurely |

F1, F2 and F4 are **not** backend fixes in this client follow-up. F2's
single-label bank receipt limitation remains Jopia's J3 dependency. J2–J6 still
need their stated implementation/contract decisions. RQ-02, RQ-03, RQ-09,
RQ-10 and RQ-19 remain open. Existing strict intake/receive endpoints are not
evidence that unreviewed real-label workflows are safe to enable.

## Buno protocol disposition

Readiness protocol reviewed from the user-supplied
`BUNO-TO-LAT-OCR-READINESS-2026-10-17.md`. Collection, independent review, split
protection, fair cropped-line versus end-to-end comparisons and no-model-change
recommendation remain appropriate. No actual model experiment was run by Lat.
The CSV mentioned by that note was not supplied in this turn; no measured values
or reviewer evidence were fabricated.

Tooling remains scaffolding for Buno to inspect, not a completed benchmark.
The identifier-CER zero-denominator result is now null and cannot enter model
selection without identifier support. Buno should align remaining reporting
with the prepared protocol before benchmarking: condition/state confusion,
all-three-conditions-per-label success, cold/warm timing and p50/p95, and actual
resource measurements are not all implemented by the current summary scorer.
Raw crop and end-to-end boundaries must remain separate. Do not infer those
missing metrics or clinical acceptance from passing tooling tests.

Next prerequisites: Jopia/institution-owned immutable per-bank references and
semantics (Mediatrix draft; Medix/N.L. Villa pending), actual fictional printed
and human-written label photographs, two independent reviewed transcriptions,
then frozen validation comparisons. No private transfer is required for the
current generated plan, and no competing replacement corpus is being created.

## Validation and preservation

Current results are recorded in
[the follow-up validation](../validation/lat-label-extraction-2026-10-17/JOPIA-BUNO-FOLLOWUP.md).
The complete prior context is in
[the laptop handoff](LAT-OCR-CONTEXT-AND-LAPTOP-CONTINUATION-2026-10-17.md).

Only source, synthetic fixtures, tooling and documentation are published.
Private corpus packages/logs, accounts, passwords, PINs, identities, retained
stock, Docker volumes, forecasting and application readiness settings remain
outside this change. No live domain command, retained redeployment, migration,
reset, population, activation or forecast/census rerun was performed. No message
was sent to either teammate; the user can forward the published branch/reply.
