# BloodLedger Sprint 6 frontend review handoff for LAT

**Date:** 2026-09-17
**Recipient/frontend owner:** LAT
**Backend/integration owner:** JOPIA
**Research/model owner:** BUNO
**Issue:** `[S6 Handoff] Backend and inbound OCR changes for frontend and forecasting review #9`
**Disposition:** Required changes
**Classification:** `SIMULATION_ONLY`

## Purpose

This handoff records LAT's frontend review of the Sprint 6 backend, inbound OCR,
V2/V2.1, and ML V4 contract changes discussed in Issue #9. It identifies the
frontend work that follows the completed mockup visual migration.

This is a review and implementation handoff. It does not claim that the listed
frontend integrations, browser UAT, forecasting corrections, or end-to-end
verification are complete.

## Sources reviewed

- Issue #9 text supplied from the GitHub issue on 2026-09-17.
- `docs/SPRINT-06.md`.
- `docs/INBOUND-OCR-REGISTRATION.md`.
- `services/api/openapi-v2.json`.
- `contracts/inbound-ocr-v1.schema.json`.
- `contracts/source-surplus-evidence-v2.schema.json`.
- `apps/capture-pwa/src/`.
- `apps/web/src/` and the frontend-only Analytics preview.
- `BloodLedger_LAT_ML_V4_Frontend_Handoff_UPDATED.md`, supplied separately to
  LAT on 2026-09-17.

## Review result

Concrete frontend changes are required. The visual migration from the mockup is
a separate completed body of work; the changes below are contract integration,
workflow-state, and browser-validation work introduced by Sprint 6 and ML V4.

The current frontend still reflects earlier contracts in material places:

- Capture PWA submits to `POST /api/v1/scan-events` and polls the V1 scan-event
  resource.
- Capture PWA uses `SYNTHETIC_CAPTURE_V1`, `unitId`, two positive blood groups,
  and the legacy `RED_BLOOD_CELLS` component value.
- The main web API types and feature clients primarily consume V1 dashboard,
  inventory, transfer, alert, audit, and report responses.
- Analytics is intentionally a frontend-only unavailable-state preview and does
  not call the demand-forecast endpoint.

These observations establish frontend impact; they do not establish a backend,
forecasting, clinical, operational, regulatory, or production defect.

## Required frontend changes

### 1. Inbound OCR capture

- Replace V1 scan submission with the approved
  `POST /api/v2/inbound-captures` contract.
- Build the confirmed structured payload required by `InboundOcrCapture`,
  including issuer, Donation No., blood/component evidence, collection and
  printed-expiry times, event/correlation evidence, and field-level OCR
  confidence.
- Require explicit operator review and confirmation before submission.
- Keep raw images and unrestricted OCR text volatile. Do not include them in
  requests, IndexedDB, logs, screenshots, reports, or test fixtures.
- Derive receiving custody from the authenticated session; do not provide a UI
  control that can select or override it.
- Retain offline handling only for the minimum confirmed structured payload and
  preserve original event time during later synchronization.

### 2. Durable command lifecycle

- Treat mutation acceptance as asynchronous. A `202` response is not a ledger
  commitment.
- Follow the returned `statusUrl` and display `QUEUED`, `SUBMITTING`,
  `RETRY_WAIT`, `LEDGER_COMMITTED_PROJECTION_PENDING`, `COMMITTED`, `FAILED`,
  and `CONFLICT` accurately.
- Keep failed and conflicted intake separate from committed inventory counts.
- Preserve the same idempotency and correlation evidence during safe retries.
- Show only safe backend error codes or approved user-facing copy.

### 3. Inventory, component, and census reads

- Consume the corrected component envelope:
  `{ scope, components, classification }`.
- Present component-level inventory without displaying decrypted Donation No.,
  OCR text, patient data, or donor data.
- Keep intake-status counts distinct from census inventory. Census counts use
  committed `AVAILABLE + RESERVED` projection evidence; pending capture is not
  inventory.
- Preserve missing, held, conflicted, and unavailable states instead of
  converting them to zero or available stock.
- Send `X-BloodLedger-Contract-Version: V2.1` for approved V2.1 reads/actions
  involving `CRYOPRECIPITATE`; preserve default V2 compatibility elsewhere.

### 4. Transfers, local release, and reconciliation

- Move affected mutations to the V2 command envelope and command-status
  polling model.
- Use only canonical backend action names from the final merged contract.
- Add role-appropriate displays and controls for local release and
  reconciliation only after their final request/response contracts and role
  permissions are present in the integration baseline.
- Never represent an RPS, BROA, or forecast result as transfer submission,
  approval, or clinical authorization.

### 5. ML V4 Analytics integration

- Replace the Analytics unavailable-state preview with a contract-backed view
  when the approved ML V4 API baseline is available.
- Parse the forecast response as an envelope object containing `forecasts`.
- Use the active V4 dataset by default and never silently fall back to V1.
- Render only returned series from the supported 4-by-5 matrix, up to twenty
  positive blood-group/component series.
- Make `CURRENT`, `STALE`, and `UNAVAILABLE` visually distinct.
- Treat absent or unavailable values as unavailable, not zero. When forecast
  bounds are null, show uncertainty as unavailable and do not invent a band.
- Display dataset, model, as-of date, horizon date, classification, and disabled
  recommendation eligibility as provenance.

## Backend and forecasting dependencies

JOPIA owns the backend contracts, persistence, projections, command recovery,
inventory snapshots, privacy enforcement, and API evidence. BUNO owns the four
remaining forecasting corrections and research re-review:

1. Include institution and complete immutable run lineage in forecast identity.
2. Hash actual dataset evidence and reject nonexistent supplied paths.
3. Persist unavailable attempts for null observations without zero imputation.
4. Preserve the requested origin and horizon on unavailable results.

Producer-to-database-to-API verification remains blocked until those fixes are
available. LAT may build and test deterministic frontend states against the
approved contracts and synthetic fixtures, but final live integration evidence
must use the accepted merged baseline.

## Questions and blockers

1. Which commit or pull request is the integration baseline for the corrected
   V2/V2.1 envelope and ML V4 OpenAPI contracts?
2. Are the final local-release and reconciliation request bodies, status
   transitions, permissions, and safe error codes frozen for frontend use?
3. Which issuer institutions are enabled for the inbound OCR interface, and
   what safe display names may the frontend show?
4. Should the initial frontend implementation expose historical V1 forecast
   selection, or should it support active V4 only?
5. Final producer-to-database-to-API and real-Fabric evidence remains pending;
   this blocks final end-to-end acceptance but not contract-based UI work.

## Suggested implementation sequence

1. Preserve the completed mockup-parity work and create a separate frontend
   integration branch/issue.
2. Align shared frontend types and API clients with the accepted V2/V2.1 and ML
   V4 OpenAPI contracts.
3. Migrate Capture PWA inbound OCR submission and command polling.
4. Integrate component, intake-status, inventory, and census reads.
5. Integrate transfer, local-release, and reconciliation command workflows.
6. Connect Analytics to the ML V4 forecast envelope.
7. Run unit, accessibility, privacy, role-scope, offline/retry, and browser UAT
   against synthetic data.
8. Rerun end-to-end browser evidence after BUNO's fixes and the accepted backend
   integration baseline are available.

## Frontend acceptance checklist

- [ ] V2 inbound OCR requires explicit operator confirmation and sends no raw
  image or unrestricted OCR text.
- [ ] Receiving custody cannot be overridden by the client.
- [ ] Offline confirmed data synchronizes with original event and idempotency
  evidence intact.
- [ ] Every asynchronous command state is represented truthfully.
- [ ] Pending, failed, and conflicted intake never appears as committed stock.
- [ ] Component reads parse `{ scope, components, classification }`.
- [ ] Inventory and census views preserve institution/role scope and unavailable
  semantics.
- [ ] V2.1 is used where `CRYOPRECIPITATE` requires it.
- [ ] Transfer, local-release, and reconciliation controls match final roles and
  command contracts.
- [ ] Forecasts parse the ML V4 envelope and distinguish `CURRENT`, `STALE`, and
  `UNAVAILABLE`.
- [ ] Missing forecasts and null uncertainty never become zero values or
  invented confidence bands.
- [ ] Provenance and `SIMULATION_ONLY` limitations remain visible.
- [ ] No restricted values appear in UI, browser logs, screenshots, persisted
  browser storage, or synthetic fixtures.
- [ ] Automated checks and browser UAT pass against the accepted integration
  baseline.

## Ownership and limitations

LAT owns frontend implementation, visual behavior, accessibility, and browser
UAT for this handoff. This review does not approve forecasting methodology or
backend changes and does not close `RQ-07`, clinical, institutional,
operational, regulatory, real-Fabric, accuracy, or production-readiness gates.
