# Lat → Jopia: label extraction and verification contracts

2026-10-17 · **SIMULATION_ONLY** · user-approved recognition plan follow-up.
Delivered preview work and requested contract decisions; no policy acceptance,
deployment authorization or three-bank recognition claim.

## Delivered

Shared bank inbound/outbound and requester inbound preview, behind
`VITE_BLOODLEDGER_LABEL_EXTRACTION_PREVIEW` (default off): in-memory crop,
rotation, bounded straightening/contrast, heading/value association, bounded
field-region re-recognition with the local Tesseract worker, guided field
cropping and editable partial suggestions. Field evidence keeps original value,
engine score (not probability), precision, profile/version, review state and
inspectable crop separate from corrections. Recapturing one field preserves
the others and edits. Capture close/replacement clears volatile evidence.

Strict existing synthetic OCR is preserved. New extraction, corrected,
date-only, ambiguous and unsupported results never become verified capture.
Recognition itself never registers, dispatches or receives a unit. Existing
operator/PIN, idempotency, frozen attempts, polling and reservation controls
remain. No image or unrestricted OCR text goes to an API. No backend, schema,
migration, account or Fabric change is included.

Source: `apps/web/src/features/receipts/label-profiles.ts`,
`label-extraction.ts`, `field-regions.ts`, `receipt-ocr.ts`,
`unit-capture-workspace.tsx`. Prior backend gaps:
[LAT-TO-JOPIA-OCR-MANUAL-AND-REQUESTER-RECEIPT-2026-10-16.md](LAT-TO-JOPIA-OCR-MANUAL-AND-REQUESTER-RECEIPT-2026-10-16.md).

## Profiles

| Bank | Current status | Required before support claim |
| --- | --- | --- |
| Mediatrix | `MEDIATRIX_BAG_PREVIEW`, v1, `DRAFT_REFERENCE` | Accepted reference/semantics, completed held-out report |
| Medix | `MEDIX_REFERENCE_PENDING`, v1 | Authorized layout reference, concrete new profile version and evaluation |
| N.L. Villa | `NLVILLA_REFERENCE_PENDING`, v1 | Authorized layout reference, concrete new profile version and evaluation |

The supplied photo is a visual reference only, not accepted transcription or
training data. Manufacturer branding cannot identify the issuer. Receiving
facility cannot establish issuing facility. Missing component stays blank;
never infer it from bag color/volume or stock lookup. Existing inventory may
support only an explicitly authorized matching check.

## Publish decisions and fixtures for Lat

1. **Label semantics:** versioned issuer/layout anchors, operational Donation
   No. location/grammar, manufacturer lot/catalog/barcode exclusions, approved
   blood/component aliases and conflicting/unsupported outcomes for each bank.
2. **Dates:** formats, century resolution, timezone, precision, date-only
   meaning and authority to correct missing time. Current preview leaves short
   dates unresolved and date-only values unchanged; no midnight/end-of-day rule.
3. **Manual/corrected intake:** explicit method, provenance and operator
   authority, without loosening `INBOUND_OCR_V1`, ADR-035 or confidence rules.
   Current internal field metadata is candidate/original value, original score
   or null, `OCR_REGION`/`OPERATOR_REGION`, profile/version, precision and state
   recognized/needs review/missing/edited. This is not a new wire contract.
   Images/crops remain volatile; do not introduce unrestricted raw text payloads.
4. **Requester receipt:** destination-scoped ROLE-03 incoming-transfer label
   matching and authorized receipt, with no stock-registration permission.
   Requester confirmation remains disabled pending this contract.
5. **Outbound:** component matching when components share Donation No., scoped
   reservation/count/version checks, stale/mismatch safe errors without echoed
   labels. Current scanner reuses approved prepare/dispatch and readiness gate.
6. **Replay/history:** original-result replay, frozen attempts, expected
   versions, safe errors and history method vocabulary for new methods.
   Preserve FEFO/state checks and queued/committed distinction. Supply synthetic
   success, duplicate, stale, conflict, auth and lost-response fixtures.

Return each item as accepted contract/reference, policy decision required or
explicitly deferred, with owner and exact frontend follow-up. Coordinate schema,
permissions, paging, errors, compatibility and fixtures before Lat wires it.
`RQ-02`, `RQ-03` and `RQ-19` remain open where applicable.

Buno's separate corpus/model work:
[LAT-TO-BUNO-OCR-DATASET-AND-BENCHMARK-2026-10-17.md](LAT-TO-BUNO-OCR-DATASET-AND-BENCHMARK-2026-10-17.md).
Actual camera-device evidence, accepted profiles/contracts and per-bank reports
are required before activation. Retained-host deployments/flag changes and
live writes require separate scoped authorization; none were performed here.
