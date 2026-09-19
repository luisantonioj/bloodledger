# Page Migration Register

| Feature | Mockup source | Official destination | Audience composition | API dependency | Status |
|---|---|---|---|---|---|
| Authentication | `pages/login.jsx` | `apps/web/src/features/auth/` | shared | session create/read/delete | Implemented; automated validation passed |
| Dashboard | `pages/dashboard.jsx` | `apps/web/src/features/dashboard/` | hospital and regulatory variants | dashboard summary/freshness | Implemented; automated validation passed |
| Inventory | `pages/inventory.jsx` | `apps/web/src/features/inventory/` | institution-scoped | V2 components and inbound-intake status | Connected V2 view implemented; automated validation passed; census remains blocked by missing snapshot index |
| Transfers and requests | `pages/transfers.jsx` | `apps/web/src/features/transfers/` | operational/requestor variants | V1 reads plus canonical V2 request/local-release commands | V2 request and local release implemented; reservation actions and reconciliation remain disabled pending read/policy inputs |
| Alerts | `pages/alerts.jsx` | `apps/web/src/features/alerts/` | scoped or aggregate read-only | alerts and acknowledgement | Implemented; automated validation passed |
| Consortium | `pages/consortium.jsx` | `apps/web/src/features/consortium/` | approved aggregate only | dashboard/report aggregates | Implemented; automated validation passed |
| Audit | `pages/audit.jsx` | `apps/web/src/features/audit/` | permission-scoped | redacted audit events | Implemented; automated validation passed |
| Reporting | `pages/reporting.jsx` | `apps/web/src/features/reporting/` | regulatory read-only | simulation JSON/CSV reports | Implemented; automated validation passed |
| Profile | `pages/profile.jsx` | `apps/web/src/features/profile/` | own safe principal/institution metadata | current session/profile | Implemented; automated validation passed |
| Accounts/onboarding | `pages/accounts.jsx` and login application flow | `features/auth/access-page.tsx` and `features/accounts/accounts-parity-preview.tsx` | frontend-only preview for applicants and administrative compositions | BL-API-02 | Visual parity extension implemented after Sprint 5; all submission, persistence, review, authorization, and mutation behavior deferred |
| Scanner | `pages/scanner.jsx` | `apps/capture-pwa/` | ROLE-01 and ROLE-02 | V2 inbound OCR and command status | Mockup-derived appearance retained; OCR-only V2 integration and automated validation passed; offline replay and physical Android evidence deferred |
| Analytics | `pages/reporting.jsx` | `apps/web/src/features/analytics/` | blood-bank operational roles and PRC only | active ML V4 forecast envelope | Active V4 client/rendering implemented; live authentication alignment, historical demand, redistribution assessment, calculations, and exports remain deferred |
| Staff Directory | `pages/accounts.jsx` | `apps/web/src/features/profile/profile-parity-preview.tsx` | hospital and system administrators | staff-directory and access-PIN contracts not approved | Latest-mockup visual preview implemented; mutation, credentials, persistence, and scheduling deferred |

All selected runtime pages use typed official API services. Fixtures are limited
to tests and isolated component validation; there is no runtime mock fallback.
The post-Sprint-05 visual-only boundary and every missing activation dependency
are recorded in [`FRONTEND_ONLY_EXTENSION.md`](./FRONTEND_ONLY_EXTENSION.md),
while scanner-specific differences are recorded in
[`CAPTURE_PWA_VISUAL_PARITY.md`](./CAPTURE_PWA_VISUAL_PARITY.md).
