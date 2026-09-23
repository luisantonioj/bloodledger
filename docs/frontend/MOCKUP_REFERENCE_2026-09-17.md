# Latest Mockup Visual Delta Reference — 2026-09-17

**Status:** Selected visual delta; does not replace the immutable Sprint 05 reference
**Repository:** <https://github.com/luisantonioj/bloodledger-frontend>
**Commit:** `fd674e038868761c1cefb40168cd96119e4ed754`
**Compared against:** `MOCKUP_REFERENCE.md` / `MOCKUP_VISUAL_2026-08-20`

## Purpose

This record freezes the later mockup additions selected for visual adaptation in
the official BloodLedger frontend. It supplements, but does not rewrite, the
accepted Sprint 05 source snapshot. Official requirements, architecture,
authorization, API contracts, and `docs/DESIGN.md` remain authoritative when a
mockup interaction conflicts with the implementation baseline.

The local checkout reported modified files because LF content had been converted
to CRLF. A read-only diff with end-of-line whitespace ignored was empty for the
selected files. The hashes below are therefore calculated from the committed Git
blobs, not the working-tree byte representation.

## Selected committed blobs

| File | SHA-256 |
|---|---|
| `DESIGN.md` | `6fc62305b5e8cbfe47ef99809f609b29728bccd1ea77107d72c5ebbba5981b10` |
| `styles.css` | `56208f1b779eabb3c564a6d9cfe4ed8bde5114c573092644430284af670acab7` |
| `components.jsx` | `24c0340d39bb5f3b8d455d2f6cc549ac0ecac1d222f03108e1bee1b445a47bd2` |
| `app.jsx` | `fc1a4143e111cbec367ff28c3633f4fe563b20a1ae7508c16c44d42d46cb6137` |
| `pages/dashboard.jsx` | `bf543154593659ffd9809da000a5b769738c3e6b31378728d4a883db34d3d6f6` |
| `pages/accounts.jsx` | `30bb5e73f1770b1f70ccc52ccc1175edb9406d3400561aa4487b3fbbc5cb7415` |
| `pages/reporting.jsx` | `7918190bb325022f258d2a201eb1727458df8c0eed31a8892b8a80897d7ed3ff` |
| `pages/transfers.jsx` | `296d0396c17790023762cd5a0e31d8ecc01eb0b09897a29ebd65c93350f7e596` |

## Selected visual deltas

- Operational dashboard blood-type composition chart.
- Read-only Analytics layout for authorized blood-bank operational roles and
  PRC, with unavailable states when an official data contract is absent.
- Staff Directory and access-PIN administration presentation for hospital
  administrators and system administrators.
- Role-scoped fixed-layout PDF export controls for inventory, transfers,
  reporting, and Analytics.

## Official adaptations and conflicts

- `ROLE-02` remains **Hospital Administrator**. “Blood Bank Head” is retained
  only as mockup terminology in explanatory preview text; it is not a new role.
- Duty scheduling is excluded. The current mockup context explicitly places it
  outside the prototype, so an older conversational request does not authorize
  its implementation.
- Analytics remains a frontend-only unavailable-state preview because no
  approved Analytics API supplies historical demand or redistributability.
- The browser does not calculate shortage, surplus, or redistributability.
- Existing server-generated simulation CSV remains functional. PDF controls are
  disabled until an approved generator, endpoint, authorization rule, and test
  boundary exist.
- All preview rows are generic synthetic presentation data and are not staff,
  donor, patient, inventory, or institutional production records.

## Rejected implementation patterns

The mockup's fixture/session architecture, plaintext credentials, browser-side
PIN or password logic, fabricated hashes, real-person-like records, runtime
CDN/Babel loading, global `window.*` collections, duplicate source tree, OCR
vendor bundle, browser-generated authoritative calculations, and direct
persistence are not migrated.
