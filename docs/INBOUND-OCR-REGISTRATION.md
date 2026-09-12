# Sprint 6 follow-up — OCR-only inbound registration

**Status:** Implemented on `codex/inbound-ocr-registration-v2` (simulation-only)
**Decision date:** 2026-09-12
**Owner:** Jopia

## Decision

Mediatrix does not have an inventory system that can be imported. Every inbound
component is therefore captured from its printed label through the OCR path at
the receiving blood bank. A capture is accepted only after the Donation No.,
blood type, collection time, and printed expiry are read with at least 90%
field confidence and explicitly confirmed by an authorized operator.

The API derives the receiving custody institution from the authenticated
session. The issuer remains a separate field so Red Cross/PRC or an explicitly
enabled bank can be represented without changing the exact Donation No. The
backend generates opaque donation and component IDs. Raw OCR text, images, and
the exact Donation No. never enter commands, Fabric, logs, reports, or audit
events; the encrypted value and keyed lookup evidence remain off-chain.

## Contract and policy

`contracts/inbound-ocr-v1.schema.json` and
`services/api/src/inbound-ocr-policy.ts` are authoritative for the additive V2
endpoint `POST /api/v2/inbound-captures`. The former component mutation path is
retained only to return `V2_OCR_REQUIRED`. Mediatrix numbers use
`MMYY-MM-NNNN` (for example `MM26-08-4046`). External issuers use a bounded
opaque value and require an explicitly enabled issuer policy. Printed expiry is
authoritative; only `expiresAt > collectedAt` is validated. No 35/5/365-day
shelf-life rule or near-expiry alert is enabled.

## Workflow boundaries

- New captures enter the durable V2 command queue before Fabric submission.
- A matching in-transit component can be resolved by the receiving custody
  workflow; a match held by another institution is a conflict; a match already
  held by the same institution is idempotent.
- New components enter `AVAILABLE` at the receiving institution and are
  eligible for the existing atomic FEFO reservation ordering by label expiry
  then opaque component ID.
- Census totals remain `AVAILABLE + RESERVED`; queued, failed, and conflicted
  captures appear only in the separate intake-status report.
- RPS/BROA consume committed projection evidence only, retain their existing
  simulation weights, and never approve or initiate a transfer.

## Deferred decisions

External issuer IDs/patterns beyond the configured allowlist, clinically
approved thresholds, operational RPS/BROA approval, receipt verification and
received-to-available rules, and real location policy remain gated by the
applicable `RQ-*` decisions. Frontend work remains with LAT; forecasting and
`SourceSurplusEvidenceV2` production integration remain with BUNO. This branch
does not modify either workstream.

## Validation disclosure

Jopia is the accountable owner and performed the available self-validation on
the supported host. Node/npm execution was unavailable in the WSL1 shell during
this implementation; reproducible checks should be rerun in the supported WSL2
environment before merge. Passing static checks must not be interpreted as
clinical, regulatory, or production readiness evidence.
