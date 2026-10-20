# Requester form decisions (GAP-01 to GAP-05): proposed

Status: **Proposed. Jopia and Lat have not accepted it.** Classification: `SIMULATION_ONLY`.
Drafted 2026-10-20 for the Lat morning UI handoff (`6856c28`). Proposed policy
version: `SYNTHETIC_REQUEST_DETAIL_V1`.

This document records proposals only. Until each `PA-REQ-*` item below is marked
Accepted, [BACKEND_API_GAPS.md](BACKEND_API_GAPS.md) GAP-01 to GAP-05 stay
disabled. Accepted items move into `docs/REQUIREMENTS.md` and
`docs/ARCHITECTURE.md`; after that, this file only links to them. Nothing here
authorizes collecting real personal or clinical data, or submitting requests on a
live retained host. These are prototype assumptions, not Mediatrix or clinical
policy.

## Shared rules (apply to every item)

- Synthetic values only. Fixtures use obvious placeholders such as
  `SYN-STAFF-0001` and `Synthetic Requester A`. They contain no real names,
  employee IDs, patient identifiers, diagnoses or treatments.
- Request details live **off-chain** in PostgreSQL, in new migrations, linked to
  the request ID. The ledger payload stays as it is now (source, destination,
  product, quantity, urgency, time), plus at most a SHA-256 digest of the detail
  record. No detail text goes on-chain.
- Reads are permission-scoped. Users at the requesting institution and at the
  resolved supplier institution can read details. PRC/DOH aggregate views never
  include them. Logs record IDs and error codes, never field values.
- Submission keeps the existing idempotency key. A retry with the same key and
  the same detail digest returns the original request. The same key with a
  different digest fails with `IDEMPOTENCY_CONFLICT`.
- The UI keeps the queued, ledger-committed and bank-approved states separate.
  Submitting does not mean approval.
- Validation failures return stable codes such as `REQUEST_DETAIL_INVALID`,
  `REQUEST_DOCUMENT_REJECTED` and `ROUTING_UNAVAILABLE`, plus the name of the
  failing field.

## PA-REQ-05: supplier routing (GAP-05). Decide this first; it unblocks submission.

**Proposal:** the requester picks the supplying bank from an eligible list the
server returns. Fully automatic routing is not proposed.

- New read: eligible suppliers for a product and quantity. "Eligible" means an
  active blood-bank institution with a non-zero available count for that product.
  The response includes the count band, not unit IDs.
- The list is ordered deterministically (most available first, then institution
  ID). The UI preselects the first entry. The requester must confirm or change it
  before operator verification.
- The request records the chosen `sourceInstitutionId`, and the existing V2
  command stays unchanged. The supplier bank still approves or rejects as it
  does today. Routing never auto-approves anything (AGENTS.md §6).
- Availability alone does not prove transfer eligibility. The supplier's
  decision governs.
- **Alternative:** server-side automatic assignment with no requester choice.
  This is deferred because it needs an eligibility/priority rule, which would
  become a new `RQ-20`.
- UI: replace "Assign automatically" with "Supplying blood bank": a select
  showing the resolved or preselected bank, then remove the GAP-05 submission
  guard.

## PA-REQ-01: requester and clinical details (GAP-01)

| Field | Proposal | Rule |
|---|---|---|
| Requesting person | **Enable** | Required; 2–80 characters; free text. |
| Staff ID | **Enable**, synthetic format only | Optional; must match `^SYN-STAFF-\d{4}$`. Real-format IDs are rejected. |
| Attending physician | **Enable** | Optional; 2–80 characters. |
| Required date and time | **Enable** | Required; future UTC instant; shown in Asia/Manila. |
| Patient / case reference | **Keep disabled** | Blocked by new `RQ-20` (patient-reference scope). A case reference could identify a patient, so the UI shows "Unavailable: RQ-20". |

Editing: allowed only by the requesting institution, and only while the request
is pending supplier decision. Each edit is versioned with a `version` check, and
a stale version returns `STALE_STATE`.

## PA-REQ-02: authorized pickup (GAP-02)

- Fields: representative name (2–80 characters) and authorization reference,
  which must match `^SYN-AUTH-[A-Z0-9]{6}$`. Both are optional at submission.
  Both are required before the supplier can mark the request ready for pickup.
- Authority: only requesting-institution users with the requester role can set
  or edit these fields. The supplier can read them but not edit them.
- These fields are a stated reference, **not** verified pickup authority. The UI
  must say so. Real identity verification stays out of scope (see `RQ-09`).

## PA-REQ-03: supporting documents (GAP-03)

- Upload: real file selection plus an authenticated multipart upload to the API.
  Files are stored on the API host's project-owned volume
  (`.local/request-documents/`, git-ignored) under a random ID. They are never
  stored in the ledger or as base64 in the database.
- Accepted types: PDF, PNG and JPEG, checked by magic bytes as well as
  extension. Limits: 5 MB per file and 3 files per request. Original filenames
  are stored only as sanitized display names.
- Access: the same scope as details. Downloads stream through the API after an
  authorization check. There are no public URLs.
- Deletion: the uploader can delete a file while the request is pending.
- Retention: synthetic data is purged by the existing development reset. Real
  retention stays **blocked by `RQ-14`**.
- Demo/UAT: a synthetic-file-only notice is required. Uploading real institution
  or patient documents is prohibited.

## PA-REQ-04: notes (GAP-04)

- One requester note per request: plain text, up to 500 characters, with control
  characters stripped. It is rendered as text, never as HTML.
- The same edit window and version check as PA-REQ-01 apply. The supplier can
  read the note.
- Supplier reply notes are out of scope. They need the `RQ-18` decision workflow.

## Proposed new open question

- **RQ-20:** May a requester record a patient/case reference? If so, in what
  format, who may access it, and how long is it retained? Until this is
  answered, the field stays disabled.

## Implementation order after acceptance (Jopia: backend + wiring; Lat: layout review)

1. PA-REQ-05: eligible-suppliers read, form select, guard removed.
2. PA-REQ-01, PA-REQ-02 and PA-REQ-04: one detail table, OpenAPI schema,
   detail read, editable controls.
3. PA-REQ-03: document storage, upload/read/delete endpoints, attachment cards.
4. GAP-09: expanded detail panel for both requester and supplier.

Each step adds synthetic tests for: values persisting and reappearing in an
authorized read, invalid input rejected, cross-institution read/edit denied,
duplicate retry, stale edit, and oversized or wrong-type files. Saved layouts
are preserved.

## Acceptance

| Item | Jopia | Lat | Date |
|---|---|---|---|
| PA-REQ-01 | | | |
| PA-REQ-02 | | | |
| PA-REQ-03 | | | |
| PA-REQ-04 | | | |
| PA-REQ-05 | | | |
| RQ-20 opened | | | |
