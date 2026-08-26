# Page Migration Register

| Feature | Mockup source | Official destination | Audience composition | API dependency | Status |
|---|---|---|---|---|---|
| Authentication | `pages/login.jsx` | `apps/web/src/features/auth/` | shared | session create/read/delete | Implemented; automated validation passed |
| Dashboard | `pages/dashboard.jsx` | `apps/web/src/features/dashboard/` | hospital and regulatory variants | dashboard summary/freshness | Implemented; automated validation passed |
| Inventory | `pages/inventory.jsx` | `apps/web/src/features/inventory/` | institution-scoped; regulatory aggregate where allowed | inventory and scan status | Implemented; automated validation passed |
| Transfers and requests | `pages/transfers.jsx` | `apps/web/src/features/transfers/` | operational/requestor variants | request and transfer transitions | Implemented; automated validation passed |
| Alerts | `pages/alerts.jsx` | `apps/web/src/features/alerts/` | scoped or aggregate read-only | alerts and acknowledgement | Implemented; automated validation passed |
| Consortium | `pages/consortium.jsx` | `apps/web/src/features/consortium/` | approved aggregate only | dashboard/report aggregates | Implemented; automated validation passed |
| Audit | `pages/audit.jsx` | `apps/web/src/features/audit/` | permission-scoped | redacted audit events | Implemented; automated validation passed |
| Reporting | `pages/reporting.jsx` | `apps/web/src/features/reporting/` | regulatory read-only | simulation JSON/CSV reports | Implemented; automated validation passed |
| Profile | `pages/profile.jsx` | `apps/web/src/features/profile/` | own safe principal/institution metadata | current session/profile | Implemented; automated validation passed |
| Accounts/onboarding | `pages/accounts.jsx` and login application flow | `features/auth/access-page.tsx` and `features/accounts/accounts-preview.tsx` | frontend-only preview for applicants and administrative compositions | BL-API-02 | Visual parity extension implemented after Sprint 5; all submission, persistence, review, authorization, and mutation behavior deferred |
| Scanner | `pages/scanner.jsx` | existing `apps/capture-pwa/` link | authorized capture users | Sprint 4 scan API | Rejected duplicate |

All selected runtime pages use typed official API services. Fixtures are limited

The post-Sprint-05 visual-only boundary and every missing activation dependency
are recorded in [`FRONTEND_ONLY_EXTENSION.md`](./FRONTEND_ONLY_EXTENSION.md).
to tests and isolated component validation; there is no runtime mock fallback.
