# Component Migration Register

| Mockup reference | Official destination | Requirement | Status | Acceptance evidence |
|---|---|---|---|---|
| CSS root tokens and typography | `apps/web/src/styles/tokens.css` | `docs/DESIGN.md` | Selected | DESIGN.md lint, contrast tests, visual review |
| Reset and base styles | `apps/web/src/styles/global.css` | NFR-02, NFR-03 | Selected | build, browser accessibility review |
| Sidebar, top bar, page head | `apps/web/src/components/layout/` | BL-WEB-01 | Selected | role navigation and keyboard tests |
| Button, chip, blood type | `apps/web/src/components/ui/` | FR-12 | Selected | variants, focus, disabled and permission tests |
| Card and statistic | `apps/web/src/components/ui/` | BL-WEB-02 | Selected | loading/freshness/state tests |
| Table and matrix patterns | feature components plus shared UI | FR-03, FR-04 | Selected | scoped data, empty/stale/unauthorized tests |
| Modal and confirmation | `apps/web/src/components/ui/` | NFR-02 | Selected | focus trap, Escape and recovery tests |
| Toast/status feedback | `apps/web/src/components/ui/` | NFR-06 | Selected | outcome text and reduced-motion tests |
| Tweaks panel and runtime themes | none | Sprint 5 exclusion | Deferred | not shipped |
| Global `window.*` collections | none | official architecture | Rejected | prohibited-pattern scan |
| Runtime CDN/Babel scripts | none | official packaging | Rejected | production build and network inspection |

Implement components as TypeScript ES modules. Visual similarity does not
override official authorization, privacy, state, or accessibility behavior.
