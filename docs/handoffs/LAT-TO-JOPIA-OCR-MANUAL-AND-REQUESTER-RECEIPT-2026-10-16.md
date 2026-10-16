# Lat → Jopia: editable OCR/manual review and requester receipt contracts

Classification: **SIMULATION_ONLY**. User requested blood-bank inbound registration,
blood-bank outbound transfer dispatch, and requester inbound receipt, each with camera
OCR or manual input and editable review. User selected **UI plus handoff**, with
outbound explicitly meaning **approved transfer dispatch**, not local issue/use.

## Frontend delivered and preserved

The bank/requester scanners now share on-device OCR, camera/file selection, explicit
Run OCR, five-field editable review, and Manual mode. Existing back-arrow header and
zero vertical header padding are preserved. No raw image/OCR text or label value is
persisted in browser storage, URLs, logs or fixtures containing real data.

Original recognition/confidence remains immutable and separate from the edited draft.
Missing fields stay blank; low-confidence fields remain reviewable, not verified.
Corrections clear confirmation. Only strict, unchanged, five-field recognition can
use the existing `INBOUND_OCR_V1` bank mutation. Restoring an original value may restore
eligibility only when the original capture itself passed the strict policy.

- Bank inbound: existing `POST /api/v2/inbound-captures`, `inventory:capture` operator
  verification, V2.1, idempotency/correlation and explicit confirmation. A lost-response
  attempt freezes payload/key/time until explicit retry. Accepted commands are polled;
  queued is not ledger-committed. Already registered does not imply new stock.
- Bank outbound: choose a scoped outgoing TRANSFER reservation; reuse existing
  preparation/outbound verification and custody actions, including expected versions,
  PIN, evidence, FEFO/state checks and polling. Valid unedited OCR can seed preparation
  review; each reserved label still needs explicit confirmation and server matching.
  Existing preparation-verification readiness flag is preserved, not enabled here.
  Scanner fields are not authorization to dispatch a unit or remove arbitrary stock.
- Requester inbound: OCR and editable/manual review work locally. Actual label-matched
  receipt remains disabled pending the ROLE-03 contract below. A requester never uses
  bank registration as a workaround and does not gain an outbound option.
- Manual and corrected-draft mutations remain unavailable. No confidence or
  `captureMethod: OCR` evidence is fabricated from a manual entry.

No live intake, verification, prepare, dispatch or receipt was performed in this task.
No migration, account/operator change, reset, repopulation, census/forecast run, API
redeploy or readiness-flag activation is authorized by this handoff.

## Exact gaps and requested decisions

### 1. Manual intake and corrected OCR (RQ-19 / ADR-035)

Existing requirements explicitly prohibit manual-only intake and manual repair of OCR.
Please publish the accepted simulation policy/ADR and versioned backend contract before
Lat enables those buttons. User approval of this UI is not an invented wire contract.

Decide and document:

1. Which workflows accept manual-only input or corrected OCR, and which operator
   capabilities and re-verification apply? Are some fields immutable or recapture-only?
2. How are original OCR confidence, field correction provenance and manual-entry
   method represented? A correction must not be labelled original 90%+ OCR evidence.
3. Required fields, issuer/Donation No. rules, UTC/Manila handling, component vocabulary
   including Cryo, date validation, expiry behavior and duplicate identity resolution.
4. Response types, original-result replay and frozen attempts, rejection/unknown-outcome
   recovery, errors and operator binding. Decide who retains audit correction history,
   with no raw image, unrestricted text or personal/clinical information.
5. Which methods appear in unit/activity history, how old clients behave, and any
   contract-version/capability flags and migration/deployment prerequisites.

Frontend currently reviews five fields: Donation No./Unit ID, blood type, component,
collection time and expiration time. Do not infer patient, donor, source facility or
transport evidence from OCR; any additional required field needs a published contract.

### 2. Requester label-matched receipt (ROLE-03)

At the inspected merged source, `services/api/src/v2-routes.ts` restricts
`POST /api/v2/inbound-captures` to ROLE-01/02. Its existing label-to-IN_TRANSIT receipt
branch is therefore not a ROLE-03 route. Reservation `receive` exists for ROLE-03, but
that alone is not a published scanned-label matching contract.

Please provide a server-side, destination-scoped receipt match/confirm interface that:

- Resolves supported Donation No. + issuer + component against an authorized incoming
  reservation, without exposing source inventory, label-query URLs or foreign units.
- Verifies destination, IN_TRANSIT state, exact membership and expected version; defines
  one-unit vs whole-reservation confirmation, duplicate scans, partial receipts,
  already-received replay, stale versions and wrong-label cases.
- Binds authorized ROLE-03 operator confirmation, evidence and idempotency; returns the
  actual command/ledger status and safe reconciliation errors.
- Describes RECEIVED custody accurately. It must not silently create new inventory or
  represent RECEIVED stock as usable stock while RQ-10 remains unresolved.
- Specifies OCR/manual/correction eligibility consistently with decision 1.

Prefer a dedicated destination receipt contract or explicitly version the existing
endpoint; do not merely open ROLE-03 bank registration permissions.

### 3. Outbound verification/readiness

Migration was applied in the previously accepted staged rollout, but the frontend
`VITE_BLOODLEDGER_OUTBOUND_VERIFICATION_READY` gate remains off. Confirm the intended
host-readiness decision and publish any further bounded live test separately. This UI
change does not enable the flag or authorize a live transaction.

Please also resolve the existing verification input limitation: `scannedLabels` contains
unique Donation No. strings, while several components may share a donation identity.
Define unambiguous product/unit matching for reservations containing such components;
Lat must not fabricate distinct identifiers or silently split an all-unit verification.

## Return package for Lat

Provide the merged OpenAPI schemas/routes, policy and ADR references, capabilities,
strict request/response/error examples, pagination and compatibility rules, synthetic
fixtures, replay/conflict tests and explicit host prerequisites. Identify separately
which frontend buttons can be enabled, which remain blocked and who authorizes any
bounded live validation. Existing saved layouts, retained data and evidence must stay
intact. No clinical, regulatory, production or ISBT 128 acceptance is established.
