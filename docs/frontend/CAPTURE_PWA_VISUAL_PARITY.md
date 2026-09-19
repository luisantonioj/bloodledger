# Capture PWA Visual Parity Extension

**Status:** Implemented visual adaptation with Sprint 6 V2 inbound OCR runtime
**Authorization:** Lat / 2026-08-27
**Official destination:** `apps/capture-pwa/`
**Visual source:** mockup `pages/scanner.jsx` and its scanner styles

## Purpose

This post-Sprint-05 extension adapts the old mockup scanner's appearance to the
official Capture PWA. Sprint 6 subsequently migrated its runtime to OCR-only V2
inbound registration and asynchronous command status. It does not move capture
into `apps/web` or adopt the mockup's fixture and transaction logic. The PWA
continues to own mobile capture at the same-origin `/capture/` path.

## Implemented visual mapping

| Mockup appearance | Official PWA presentation | Runtime truth |
|---|---|---|
| Mobile BloodLedger header | Branded mobile header with connection chip | Connection state follows browser online/offline events |
| Dark scanner viewport | Framed camera/photo chooser with alignment corners and status | The platform `capture="environment"` input remains the official capture boundary |
| OCR status presentation | OCR-primary chip, processing action, and local-processing notice | On-device Tesseract extracts the five approved inbound fields under `INBOUND_OCR_V1` |
| Confirmation sheet/card | Structured unit summary and five-field review card | Fields remain non-editable and require explicit human confirmation |
| Offline warning | Visible offline banner | V2 submission is disabled offline because exact Donation No. cannot be persisted; images, exact Donation No., and unrestricted OCR text remain volatile |
| Scan history | Privacy-safe command receipt history with truthful status chips | IndexedDB stores only safe command identifiers/status metadata; it does not store exact Donation No. or OCR material |
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

The former barcode/fallback-code path is not part of the accepted Sprint 6
inbound contract and is no longer offered by this workspace. Physical Android
OCR evidence remains deferred and is not established by this browser-tested
adaptation.

## Validation boundary

The existing `check:capture`, `test:capture`, and `test:capture:e2e` commands
remain authoritative. Browser tests additionally assert on-device OCR,
privacy-safe offline behavior, V2.1 selection, no command resubmission, command
completion, scanner identity, framing guidance, and the truthful offline banner.
Passing those checks does not establish clinical, regulatory, real-label,
physical-device, or production readiness.
