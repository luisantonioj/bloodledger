# Component Migration Register

| Mockup reference | Official destination | Requirement | Status | Acceptance evidence |
|---|---|---|---|---|
| CSS root tokens and typography | `apps/web/src/styles/tokens.css` | `docs/DESIGN.md` | Implemented; automated validation passed | build and token tests; owner visual review approved 2026-08-24 |
| Reset and base styles | `apps/web/src/styles/global.css` | NFR-02, NFR-03 | Implemented; automated validation passed | build and browser accessibility assertions; owner visual review approved 2026-08-24 |
| Sidebar, top bar, page head | `apps/web/src/components/layout/` | BL-WEB-01 | Implemented; automated validation passed | role navigation and keyboard tests |
| Button, chip, blood type | `apps/web/src/components/ui/` | FR-12 | Implemented; automated validation passed | focus, disabled, and permission tests |
| Card and statistic | `apps/web/src/components/ui/` | BL-WEB-02 | Implemented; automated validation passed | loading, freshness, and state tests |
| Table and matrix patterns | feature components plus shared UI | FR-03, FR-04 | Implemented; automated validation passed | scoped data, empty, stale, and unauthorized tests |
| Modal and confirmation | `apps/web/src/components/ui/` | NFR-02 | Implemented; automated validation passed | keyboard and non-destructive recovery tests |
| Toast/status feedback | `apps/web/src/components/ui/` | NFR-06 | Implemented; automated validation passed | outcome text and reduced-motion styles |
| Global search, notifications, pending count, and navigation badge | application shell | post-Sprint-05 visual parity extension | Local visual previews implemented; APIs deferred | local-only popovers and explicit Preview labels |
| Onboarding, administration, and expanded-profile layouts | feature components | post-Sprint-05 visual parity extension | Visual preview implemented; activation dependencies deferred | `FRONTEND_ONLY_EXTENSION.md` |
| Design preview panel | `apps/web/src/components/layout/design-preview-panel.tsx` | post-Sprint-05 visual parity extension | Local-only visual preview implemented; host protocol and persistence rejected | browser assertions and `FRONTEND_ONLY_EXTENSION.md` |
| Operational inventory composition chart | `apps/web/src/features/dashboard/` | latest-mockup visual delta | Implemented from official committed inventory aggregates; no shortage or surplus inference | unit tests, web build, and `MOCKUP_REFERENCE_2026-09-17.md` |
| Analytics cards, filters, and forecast table | `apps/web/src/features/analytics/` | latest-mockup visual delta plus Sprint 6 ML V4 handoff | Active V4 envelope rendering implemented; historical demand, redistribution assessment, decision use, exports, and live authentication alignment remain deferred | parser tests, role/browser tests, web build, and explicit simulation disclosure |
| Staff Directory and access-PIN dialogs | `apps/web/src/features/profile/profile-parity-preview.tsx` | latest-mockup visual delta | Generic synthetic visual preview; persistence, credentials, and scheduling excluded | web build and `FRONTEND_ONLY_EXTENSION.md` |
| Role-scoped PDF export controls | inventory, transfers, reporting, and Analytics feature components | latest-mockup visual delta | Disabled presentation only; existing report CSV remains functional | web build and explicit unavailable labels |
| Global `window.*` collections | none | official architecture | Rejected | prohibited-pattern scan |
| Runtime CDN/Babel scripts | none | official packaging | Rejected | production build and network inspection |

Implement components as TypeScript ES modules. Visual similarity does not
override official authorization, privacy, state, or accessibility behavior.
