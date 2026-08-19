# Page Migration Register

| Feature | Mockup source | Official destination | Audience composition | API dependency | Status |
|---|---|---|---|---|---|
| Authentication | `pages/login.jsx` | `apps/web/src/features/auth/` | shared | session create/read/delete | Selected |
| Dashboard | `pages/dashboard.jsx` | `apps/web/src/features/dashboard/` | hospital and regulatory variants | dashboard summary/freshness | Selected |
| Inventory | `pages/inventory.jsx` | `apps/web/src/features/inventory/` | institution-scoped; regulatory aggregate where allowed | inventory and scan status | Selected |
| Transfers and requests | `pages/transfers.jsx` | `apps/web/src/features/transfers/` | operational/requestor variants | request and transfer transitions | Selected |
| Alerts | `pages/alerts.jsx` | `apps/web/src/features/alerts/` | scoped or aggregate read-only | alerts and acknowledgement | Selected |
| Consortium | `pages/consortium.jsx` | `apps/web/src/features/consortium/` | approved aggregate only | dashboard/report aggregates | Selected |
| Audit | `pages/audit.jsx` | `apps/web/src/features/audit/` | permission-scoped | redacted audit events | Selected |
| Reporting | `pages/reporting.jsx` | `apps/web/src/features/reporting/` | regulatory read-only | simulation JSON/CSV reports | Selected |
| Profile | `pages/profile.jsx` | `apps/web/src/features/profile/` | own safe principal/institution metadata | current session/profile | Selected |
| Accounts/onboarding | `pages/accounts.jsx` and login application flow | none in Sprint 5 | unavailable | BL-API-02 | Deferred |
| Scanner | `pages/scanner.jsx` | existing `apps/capture-pwa/` link | authorized capture users | Sprint 4 scan API | Rejected duplicate |

All selected runtime pages use typed official API services. Fixtures are limited
to tests and isolated component validation; there is no runtime mock fallback.
