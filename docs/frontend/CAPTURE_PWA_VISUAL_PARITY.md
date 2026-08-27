# Capture PWA Visual Parity Extension

**Status:** Implemented visual adaptation; Sprint 04 capture behavior preserved
**Authorization:** Lat / 2026-08-27
**Official destination:** `apps/capture-pwa/`
**Visual source:** mockup `pages/scanner.jsx` and its scanner styles

## Purpose

This post-Sprint-05 extension adapts the old mockup scanner's appearance to the
official Capture PWA. It does not move scanning into `apps/web`, replace the
Sprint 04 architecture, or adopt the mockup's runtime fixture and transaction
logic. The PWA continues to own mobile capture at the same-origin `/capture/`
path.

## Implemented visual mapping

| Mockup appearance | Official PWA presentation | Runtime truth |
|---|---|---|
| Mobile BloodLedger header | Branded mobile header with connection chip | Connection state follows browser online/offline events |
| Dark scanner viewport | Framed camera/photo chooser with alignment corners and status | The platform `capture="environment"` input remains the official capture boundary |
| OCR status presentation | OCR-primary chip, processing action, and local-processing notice | Existing on-device recognition module and confidence policy are unchanged |
| Confirmation sheet/card | Structured unit summary and five-field review card | Fields remain non-editable and require explicit human confirmation |
| Offline warning | Visible offline banner | Only structured confirmed data is queued; images and unrestricted OCR text remain volatile |
| Scan history | Recent-capture device queue with truthful status chips | Values come from the existing IndexedDB queue and API reconciliation states |
| Mobile responsive layout | Full-width cards and tall scanner viewport on narrow screens | Installable PWA behavior and same-origin packaging are unchanged |

## Intentional differences from the mockup

The old scanner contained behaviors that conflict with the official capture
contract and therefore remain excluded:

- no mock inbound/outbound inventory transaction selector;
- no arbitrary manual blood-unit field entry or editable OCR repair;
- no fake blockchain identifiers, transaction history, inventory mutation, or
  browser-global audit records;
- no mock facility catalog, user session, or plaintext credential fixtures;
- no raw-image or unrestricted OCR-text persistence or upload; and
- no claim of real-label or complete ISBT 128 compatibility while `RQ-02`
  remains unresolved.

The fallback-code action remains because it is part of the accepted Sprint 04
capture policy, not because the mockup implemented a manual-entry workflow.
Physical Android OCR evidence remains deferred and is not established by this
visual adaptation.

## Validation boundary

The existing `check:capture`, `test:capture`, and `test:capture:e2e` commands
remain authoritative. Browser tests additionally assert the mobile scanner
identity, framing guidance, privacy statement, and truthful offline banner.
Passing those checks does not establish clinical, regulatory, real-label,
physical-device, or production readiness.
