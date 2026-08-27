# Mockup Reference — MOCKUP_VISUAL_2026-08-20

**Repository:** [`luisantonioj/bloodledger-frontend`](https://github.com/luisantonioj/bloodledger-frontend)
**Remote base commit:** `74a8385`
**Approved local visual state:** 2026-08-20 / Jopia
**Aggregate SHA-256:** `1e625671c6122c73a50cddae4d85ddc0602879ecd521bb72831e1c3df8a27b48`

The aggregate is SHA-256 over UTF-8 lines in the exact table order below,
formatted as `<path>\t<sha256>\n`.

| Visual source | SHA-256 |
|---|---|
| `DESIGN.md` | `afa249ff700a94ab8b1ea5894a58efa1462f72b233f3cb28d4e7a8a73799cc83` |
| `styles.css` | `809611b5731b4774c57e973ce12a1b137cc564f25200e9a5829563a3275ca9c5` |
| `components.jsx` | `8855f3ce4416177102c3ce7efcdf5c3c43050670cf2b8a22114f80397e27920f` |
| `index.html` | `814b109f1f842cb053aaf5db2a7c378574141dac4e8903ed7cc086049e3c5ea3` |
| `pages/login.jsx` | `ca573c8fa80b1f3f066a3b66938cc3cceb8221fa18ec593a0a3511f942bcdb17` |
| `pages/dashboard.jsx` | `06e3d0b4e8a5c4b82cbc2682db8f5a2d8726ee35cbec5427a6c08ca0ea545d51` |
| `pages/inventory.jsx` | `d90c07f0aece4ea4b1421d21efcd12b165ee0420e3a6987f9b9f05ff8b656e0e` |
| `pages/transfers.jsx` | `257ab399b122a66efd2aaa7a34d13273ad91c360550c30fc479fd60b6fe0bb4e` |
| `pages/alerts.jsx` | `2334f5b667b03a347c749eb6defd29295b51dc4d839fb1e9d4b9211047abfdc4` |
| `pages/consortium.jsx` | `643a24c822aa062820d092d7ad9ee07d4aa6422779be5983fecd25d1a0785bc1` |
| `pages/audit.jsx` | `ec5856743c09bc8c40880fdd82cd183a4ceeaafa04440ff03883ea2bce9a2aa2` |
| `pages/reporting.jsx` | `03e56e61f2c5e890d687b582c0f92d0e91bdf79200f32b9681a5d81fc4acfddd` |
| `pages/profile.jsx` | `00f8efa46f47d34c8d18247e4086c92af72f2e860d06f70dfbfd6e5430a91232` |

## Safety exclusions

The snapshot identifies appearance and interaction references only. It excludes:

- `data.js`, `api.js`, and `app.jsx` fixture/session content;
- plaintext demo passwords, emails, names, phone numbers, employee/license IDs,
  facility references, fabricated hashes, and synthetic topology claims;
- `pages/accounts.jsx` and onboarding/application behavior deferred from
  Sprint 5;
- `pages/scanner.jsx`, because the official capture PWA owns scanning;
- the nested duplicate `bloodledger-mock-frontend/` tree;
- OCR vendor assets, generated files, `desktop.ini`, and tweak-panel behavior.

Excluded content must not be reconstructed from the mockup during migration.
Use opaque test fixtures and official contracts.

## Historical boundary and later extension

The exclusions above remain the immutable Sprint 05 migration boundary. Lat
separately authorized a frontend-only visual parity extension on 2026-08-26 and
2026-08-27. Its implemented surfaces and deliberately missing dependencies are
recorded in `FRONTEND_ONLY_EXTENSION.md`. That later authorization does not
adopt the mockup's fixture/session architecture and does not change the Capture
PWA ownership boundary.

Lat later authorized a visual adaptation of the excluded scanner appearance on
2026-08-27. That decision is documented in `CAPTURE_PWA_VISUAL_PARITY.md` and
preserves the official PWA's OCR, fallback, confirmation, privacy, offline
queue, and synchronization contracts. It does not retroactively add scanner
behavior to the frozen Sprint 05 visual snapshot.
