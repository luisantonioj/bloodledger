# Frontend-Only Parity Extension Register

**Status:** Implemented visual preview; backend and integrated behavior deferred
**Authorization:** Lat / 2026-08-26
**Baseline:** accepted Sprint 05 merge `7c87c67`, followed by formal Testing-phase planning commit `2ebc3ea`
**Visual reference:** `MOCKUP_VISUAL_2026-08-20`

## Purpose

This register records the post-acceptance frontend parity work authorized after
Sprint 05. The accepted Sprint 05 record is not rewritten: institutional
onboarding and account management were outside that accepted sprint. This
extension reproduces their mockup-derived appearance in the official React
application without representing the missing workflows as complete.

The visual preview is not an application dependency, a production workflow, or
evidence of clinical, regulatory, institutional, privacy, or security readiness.
Only synthetic information may be entered during review.

## Implemented visual surfaces

| Surface | Official destination | Visual behavior | Runtime truth |
|---|---|---|---|
| Access tabs | `features/auth/access-page.tsx` | Sign-in and Apply for access tabs | Sign-in keeps the existing official session API; application mode has no API |
| Application type | `features/auth/access-page.tsx` | Blood Bank and Requestor choices | Local visual state only |
| Four-step application | `features/auth/access-page.tsx` | Facility, qualification, primary account, documents | Values are not submitted or persisted |
| Document cards | `features/auth/access-page.tsx` | Mockup-derived upload areas | Controls are disabled; no files are read or stored |
| Completion state | `features/auth/access-page.tsx` | Reviewable end state | Explicitly says no application was submitted |
| Administration workspace | `features/accounts/accounts-preview.tsx` | Overview, applications, institutions, users, activity | Two synthetic display rows; all mutations disabled |
| Expanded profile | `features/profile/profile-preview.tsx` | Personal, facility, licensing, application, access, security sections | Safe session fields only; unavailable fields say so |
| Global search | application shell | Mockup-derived search field | Read-only and labeled preview-only |
| Navigation badge | application shell | Accounts Preview badge | Static visual label, not a count |
| Scanner | existing `apps/capture-pwa/` | No duplicate web scanner | Sprint 04 capture boundary remains authoritative |
| Runtime theme panel | none | Not reproduced | Still intentionally excluded |

The Accounts link is composed for `ROLE-05` and `ROLE-06` in the browser to
match the administrative mockup audience. That visibility rule is usability
only and is not backend authorization.

## Deferred dependency register

| Visual feature | Missing API | Missing persistence | Missing authorization and policy | Missing protection/handling | Missing tests before activation |
|---|---|---|---|---|---|
| Institutional application | Create/read application endpoints | Application, facility, contact, qualification, and status schema | Applicant eligibility, reviewer roles, lifecycle and decision authority; `RQ-14` | Duplicate application and replay protection | Contract, validation, duplicate, abuse, recovery, and end-to-end tests |
| Document submission | Upload/download/review endpoints | Encrypted metadata/object-storage references and retention state | Document type, access, retention, deletion, reviewer, consent, and correction policy | Malware/content limits, encryption, redaction, access logging, safe deletion | Upload boundary, access isolation, retention, malicious-file, failure, and audit tests |
| Application review | Review/approve/reject/request-correction endpoints | Review decision, reason, version, and event history | Separation of duties, reviewer scope, appeal/correction rules | Idempotency, stale-state conflict, notification privacy | Authorization, stale decision, retry, concurrency, audit, and notification tests |
| Institution management | Provision/activate/suspend/reactivate endpoints | Institution status and versioned scope | Activation authority and institutional verification policy | Duplicate institution and cross-scope isolation | Lifecycle, authorization, duplicate, stale, rollback, and audit tests |
| User management | Invite/provision/read/update/suspend/delete endpoints | User, invitation, role assignment, and status schema | Role assignment, least privilege, institution scope, revocation, account recovery | Invitation expiry, replay resistance, credential handling, rate limits | RBAC, cross-institution, invitation, revocation, abuse, and end-to-end tests |
| Profile details | Safe profile read/correction endpoints | Approved contact, facility, qualification, and provenance fields | Field visibility and correction authority | PII minimization, redaction, retention, access logs | Field authorization, privacy, correction, stale, and audit tests |
| Password recovery/change | Recovery and change endpoints | Revocable recovery challenge/session state | Identity proofing and recovery policy | Enumeration resistance, expiry, replay prevention, throttling, session revocation | Security, expiry, replay, throttling, revocation, and browser tests |
| Global search | Permission-scoped search endpoint | Search index or safe query contracts | Entity/field visibility per role and institution | Query limits, redaction, injection and enumeration protection | Scope isolation, redaction, performance, abuse, and accessibility tests |
| Navigation badges | Aggregate/count endpoints | Optional derived count projection | Same visibility rules as destination feature | Freshness, stale-state and information leakage controls | Scope, freshness, empty/error, and browser tests |
| Administration activity | Permission-scoped audit endpoint | Durable administration event projection | Auditor/reviewer scope and retention policy | Redaction and tamper-evident linkage | Scope, redaction, ordering, retention, and failure tests |

## Activation rule

A disabled or preview-only control may become functional only after its
authoritative requirement/backlog item is selected, `RQ-14` and related policy
questions are resolved, the machine-readable API and persistence contracts are
approved, backend authorization is enforced, privacy/security protections are
implemented, and the relevant tests pass.

Frontend presentation checks for this extension do not satisfy those activation
conditions. The open Testing-phase gate `TP-G06` therefore remains open.
