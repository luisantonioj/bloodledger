# Application-to-profile field map

Reviewed 2026-10-10 against the supplied `bloodledger-full-mockup.html` Access application steps and ProfilePage; official `SyntheticApplication`, onboarding services and institution account administration. This is a frontend reference audit, not approval of new licensing requirements or collection of personal data. The initial audit did not change registration or backend implementation; the frontend implementation amendment below records the subsequent UI work.

## Both application categories

Mockup Facility information: facility name, registered legal name, ownership, facility classification, complete address, city/municipality, province, official phone, official facility email, hospital/health-facility LTO number and expiration. Step validation requires name/legal name/address/city/province/phone/email/LTO/expiration; ownership and classification have selected defaults.

Mockup Facility Account applicant: full name, official position, employee ID, facility account email, password and confirmation. Blood-bank position must be Blood Bank Head; requester position must be Facility Administrator. Passwords match and are at least eight characters in the mockup. The official application service requires 12–128 characters instead. These mockup defaults/rules do not change official policy.

Both declare capability, personnel/equipment/continuity readiness, agreement to record verification, and final accuracy/verification attestation.

## Category-specific qualification and attachments

| Area | Blood bank mockup | Requester mockup |
|---|---|---|
| Qualification | BSF category; DOH BSF LTO and expiry; head of blood-service facility and physician PRC license; medical technologist-in-charge and PRC license | Blood Station ATO/authorization and expiry; medical technologist-in-charge and PRC license; referral blood bank/supplying BSF |
| Capability declaration | Storage, processing, compatibility testing, issuance, transport procedures | Storage, compatibility testing, transfusion, hemovigilance procedures |
| Required attachments | Hospital/health-facility LTO; DOH BSF LTO; BSF assessment/personnel/equipment documents | Hospital/health-facility LTO; Blood Station ATO or transfusion-service authorization |
| Optional attachment | None in this mockup list | Referral agreement or facility capability documents |

Mockup attachments retain file metadata only; this does not establish a supported secure upload service or verified document status.

## Official flow and read limitations

The supported official application payload for BLOOD_BANK and REQUESTOR contains: invitation secret, category, synthetic institution name, locality, generic institution email, license reference, application reason, applicant password and attestation. It does not currently store the expanded mockup facility/applicant/qualification/document shape.

The own institution profile read returns institution ID, display name, account category, status, version and operator ID/role/capability/status/version records. Extended institution fields, login email and linked application details are not exposed there. PRC application reads already include application ID, category, status, institution linkage, generic detail, created/closed timestamps; the applicant-status read supplies ID/status/version. Neither is an approved replacement for an activated institution’s own detailed application read.

## Intended Profile sections

- Facility Account: institution account name/type, institution ID, login email when available and account status.
- Facility Information: approved facility/registration/contact values above.
- Licensing & Qualification: category-specific authority, expiration, category/referral and permitted responsible-person qualification fields; supporting document references only when available and authorized.
- Credentials & Access: assigned account role, status, institution ID, scope; last sign-in only from an actual supported read.
- Application Record: application ID/type, submitted and approved dates, approved-by reference and decision status only from an authorized linked read.
- Security: credential policy and supported change/reset controls, without showing passwords or PINs.

Staff/operator enrollment, roles, status, PIN reset and revocation stay in Accounts / Staff; profile should not duplicate operator administration.

## Password distinction

Official application password authenticates the applicant-status session. Activation separately requires PRC to provide institution login email/password and initial administrator PIN. The current provisioner therefore knows what they enter during activation; stored passwords/PINs cannot be read back from the Profile API. Passwords use salted scrypt verifiers. This current prototype flow is not a completed applicant-controlled activation/delivery/recovery flow. A self-service credential change/reset or secure invitation-based password setup needs a verified supported workflow before exposing it as functional.

## Remaining work

GAP-20 covers expanded facility/profile fields; GAP-21 covers extended staff metadata. GAP-22 covers expanded category-specific onboarding, attestation/document contracts and linked application/profile reads. GAP-23 covers credential setup/handoff and self-service security controls. Future frontend placeholders may use this map, but must not collect unsupported personal identifiers, upload documents, claim verified licensing or fabricate approval dates.

## Frontend implementation — 2026-10-10

Apply for Access now uses separate Blood Bank and Requester category cards and four mockup-based steps: Facility, Qualification, Primary Account, and Documents. The existing invitation-based basic application submission and applicant-status/withdrawal flow remain connected. The official 12–128-character password rule is preserved, confirmation must match, and retries preserve the payload and idempotency identifiers.

Expanded legal/contact/personnel/qualification fields, declarations and document attachment controls are visible but disabled. They are excluded from submission; no unsupported personal details or files are collected. The success message explicitly identifies a basic application submission and states that extended fields/documents were not sent.

Profile now includes Facility Information, Official Contact, Facility Account, category-specific Licensing & Qualification, Credentials & Access, Application Record, and Security. Supported identity/status/session values remain real; missing data says Not available. View documents and Change password stay disabled pending supported services. Accounts / Staff retains actual operator statistics, filters and existing administrator/PIN/revocation actions.


## Published public-application contract wiring — 2026-10-16

The earlier October 10 basic-payload limitations above are historical. The
PA-ACCOUNT-03 / ADR-048 backend branch now publishes strict nested
PUBLIC_APPLICATION_V1 fields, synthetic fixture references, server-owned sample
eligibility and application/profile linkage. Lat connected those reads/actions
without changing the approved form layout. One synthetic applicant reference
replaces Full name and Employee ID; role-holder references replace real names.
Passwords/confirmation are generated locally, and all declarations stay manual.

See [Lat validation](../validation/lat-public-applications-2026-10-16/README.md)
and [rollout/consistency follow-up](../handoffs/LAT-TO-JOPIA-PUBLIC-APPLICATIONS-WIRING-AND-ROLLOUT-2026-10-16.md).
The real retained API passed contract readiness at recovery target 1124d6a;
API/web are running after both bank/requestor live Fill Up browser flows passed. Extended profile reads
use facilityProfile only when returned; policy-defined/null/purged profiles,
approver identity, last sign-in and security self-service remain unavailable.
The web readiness flag was configured after step 6 passed; both live Fill Up
flows subsequently passed under explicit continuation approval. Synthetic fixtures do not implement arbitrary uploads.


## PR #68 integration and staged rollout — 2026-10-16

Merged `d83509b` resolves the earlier contract questions: approval/rejection
closes the application; activation after retained detail purge returns
ONB_APPLICATION_DETAIL_PURGED (reapply, no retry). Capability declarations
are excluded from the durable facility profile. Lat maps the error and retains
declarations only in scoped application detail.

Both authorized retained-host migrations applied in order with unchanged
protected counts (34 applied / 0 pending). Authorized Option B repaired ownership
(18 to 0), and the API built at 1124d6a and passed read-only step 6. The enabled
web built from saved frontend 55f997b. The browser harness stopped on an ambiguous
password selector on its first attempt. After explicit user authorization, both
browser flows passed with the corrected selector; API/web and guarded UAT
worker are running. The general sync-worker stays stopped.
No live application, activation or deregistration occurred. See the [rollout evidence](../validation/lat-public-applications-2026-10-16/README.md).
