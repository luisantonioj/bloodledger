# BUNO and Issue 9 response drafts

These drafts are prepared for owner review. They are not posted automatically.

## PR 11 reply to BUNO

Thanks, Buno. I acknowledge the four forecasting findings in your review of
`f732fcb8504abe0198180b0ecaeebb72f1b724a5` and will keep them open for your
forecasting implementation and re-review. I am handling the backend side on
`codex/ml-v4-verification`: projection and synchronization replay, immutable
institution-scoped snapshots, provenance and privacy boundaries, API/schema
compatibility, and BROA/RPS integration evidence. LAT retains frontend and
browser UAT.

The backend verification is recorded in
`docs/ML-V4-INDEPENDENT-VERIFICATION.md`. I will rerun the producer-to-database-
to-API scenarios after your four fixes. Earlier passing tests and technical
self-validation do not close your research findings, `RQ-07`, or operational
use.

## Issue 9 reply

The September 13 Issue 9 handoff was rechecked against the current
`ml-v4-verification` backend. Projection lifecycle coverage, durable
commit/projection retry, immutable snapshots, provenance checks, the corrected
V2 component response shape, and the privacy read boundary are implemented and
covered by the current evidence. One backend boundary is being hardened: an
internal ML snapshot must account for pending commands that can affect either
side of a cross-institution transfer, not only the command actor's institution.

Buno's four forecasting findings remain open with Buno as owner: complete run
identity and forecast IDs, truthful dataset evidence digests, durable
unavailable attempts for null observations, and requested-horizon preservation
for unavailable results. Producer-dependent integration reruns are blocked
until those changes are available. All outputs remain simulation-only; no
clinical, operational, regulatory, production, or autonomous-transfer claim is
made.
