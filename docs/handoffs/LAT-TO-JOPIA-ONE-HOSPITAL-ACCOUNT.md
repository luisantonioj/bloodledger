# Lat → Jopia: integrate one account per hospital

Prepared: 2026-10-08. Classification: SIMULATION_ONLY.
Requested by Lat; backend implementation and technical decision owner: Jopia.
Lat owns frontend integration and independent retained-host validation.

**Product direction confirmed by Lat:** each hospital should have one primary
BloodLedger login account. Separate technologist, hospital-administrator and
institution-account-administrator logins for the same hospital do not match
the intended design. Integrate the existing six synthetic review accounts into
that model, with a documented migration and preserved data.

This is a new implementation handoff, not evidence that the account migration
has run. Keep role capabilities and hospital login count as separate concepts.
One hospital login does not by itself authorize every hospital action.

## 1. Start from the validated integration

Use the published branch `codex/lat-retained-validation-followup`, evidence head
`daf4ada29b5a0346a804815817fde64f4893a390`, with executable constraint fix
`d5d9ad1526c372143224d6f78b920c67566a83b4`. This incorporates your actor-mapping
delivery `6e26606b6e5bdb56f8c772758790eb226646dc11`.

- [Lat's retained-host validation](https://github.com/luisantonioj/bloodledger/blob/daf4ada29b5a0346a804815817fde64f4893a390/docs/frontend/LAT-RETAINED-ACTOR-VALIDATION-2026-10-08.md)
- [Corrected persistent-development runbook](https://github.com/luisantonioj/bloodledger/blob/daf4ada29b5a0346a804815817fde64f4893a390/docs/PERSISTENT-DEVELOPMENT-RUNBOOK.md)
- [Completed local evidence on PR #21](https://github.com/luisantonioj/bloodledger/pull/21#issuecomment-6051362252)

This handoff PR is documentation-only and based on main for a clean review.
Main must not be assumed to contain the retained integration. Jopia's
implementation branch must start from the verified integration above or a
documented successor containing it. Inspect the working tree first, preserve
unrelated work, and use a dedicated `codex/` branch with grouped commits.

Lat's working frontend also contains uncommitted, authorized dashboard/shell
design edits. Do not overwrite that workspace or substitute the old mockup's
fixture authentication for the real API.

## 2. Existing accounts and requested target

These are synthetic fixtures, not real hospital staff or actual PRC chapters.
Current institution IDs and historical actors must remain traceable.

| Existing username | Existing user ID | Role | Institution |
| --- | --- | --- | --- |
| `synth_review_role01` | `USR_SYNTH_REVIEW_ROLE01` | ROLE-01 Medical Technologist | `INST_MEDIATRIX` |
| `synth_review_role02` | `USR_SYNTH_REVIEW_ROLE02` | ROLE-02 Hospital Administrator | `INST_MEDIATRIX` |
| `synth_review_role03` | `USR_SYNTH_REVIEW_ROLE03` | ROLE-03 Secondary Hospital User | `INST_SYNTH_SECONDARY_REVIEW` |
| `synth_review_role04` | `USR_SYNTH_REVIEW_ROLE04` | ROLE-04 DOH/PRC Regulatory Viewer | `INST_SYNTH_REGULATOR_REVIEW` |
| `synth_review_role05` | `USR_SYNTH_REVIEW_ROLE05` | ROLE-05 System Administrator | `INST_SYNTH_SYSTEM_REVIEW` |
| `synth_review_role06` | `USR_SYNTH_REVIEW_ROLE06` | ROLE-06 Institution Account Administrator | `INST_SYNTH_SECONDARY_REVIEW` |

Requested fixture result:

| Account scope | Target interactive logins | Migration direction |
| --- | --- | --- |
| Mediatrix hospital | One | Consolidate the ROLE-01/ROLE-02 login experience; retain actor history and explicitly authorized action boundaries |
| Synthetic secondary hospital | One | Consolidate the ROLE-03/ROLE-06 login experience; recipient and administration capabilities must remain explicit |
| Regulatory office | One, unchanged | Remains separate from hospitals; retain regulatory scope |
| System scope | One, unchanged | Remains separate from hospitals; retain non-clinical system scope |

For these fixtures, the expected result is **four primary interactive logins**,
not six hospital accounts and not six fabricated hospitals. Six historical
principal records may remain for audit/provenance; preserving those records
must not leave a second active hospital login available through an old endpoint.
Do not infer a universal one-account rule for all regulator/system organizations
from this hospital-specific request.

Reusing existing ROLE-02 and ROLE-03 credentials as the two hospital entry
accounts is a candidate that minimizes seed disruption, not a mandated
implementation. Return the exact primary-account and retired-login mapping
before applying it to Lat's retained environment. Do not rename, delete,
overwrite passwords or change institution IDs as an undocumented shortcut.

## 3. Resolve the account/permission model before implementing it

The current accepted baseline distinguishes six roles in REQUIREMENTS §2,
ADR-013/ADR-030 and `services/api/src/web-access.ts`. Staff/PIN administration
is currently a frontend preview, not a working authentication mechanism.
Lat has authorized the one-hospital-login product direction; the secure actor
and permission implementation remains Jopia's decision to document.

1. Define a hospital account separately from action permissions and the actor
   recorded for each mutation. Explain whether existing roles remain internal
   capability profiles or use another explicitly reviewed representation.
2. Define operator identification for privileged actions if needed to preserve
   attribution and different technologist/administrator authority. A staff PIN
   is an optional design candidate; this handoff does not assume a working PIN
   system, approved staff-data collection or a chosen PIN format.
3. If role boundaries must change, publish the exact synthetic capability matrix
   and obtain disposition of that material change before affected behavior.
   Do not silently union ROLE-01/02 or ROLE-03/06 privileges or grant clinical
   authority to the system/regulatory accounts.
4. Preserve stable role/requirement IDs. Update the authoritative requirements
   and architecture decision first, then affected API contracts, backlog/test
   references and frontend documentation. Record which earlier account model
   is superseded. Link FR-01, FR-03–09, FR-12, BR-SEC-03–05, NFR-01 and
   BL-WEB-01; include FR-16/BL-WEB-06 only where institution administration
   is actually selected. Do not declare full onboarding implemented or close
   RQ-14 merely by consolidating existing synthetic accounts.

The user wants the updated hospital account design integrated into the real
system. Please return a concrete implementation, migration and reproducible
validation once the above account/permission decision is settled, rather than
only relabeling the six role logins in the UI.

## 4. Backend and frontend contract work

- Enforce one primary interactive account per hospital in the database and
  every applicable creation/activation path. Specify account lifecycle and
  what happens to disabled/retired accounts. Prove that concurrent creation,
  legacy provisioners and retries cannot leave two active hospital logins.
- Make the official login/session API return the hospital identity, stable
  principal/actor context and approved capabilities needed by both the web
  frontend and Capture PWA. Retain official cookies, origin checks and safe
  logout/401 behavior. Revoke affected old sessions during migration.
- Enforce actor, role/capability and institution authorization at the server
  and Fabric boundary. A frontend-selected role/user ID is not authorization.
  Record an attributable actor for accepted mutations without putting
  passwords, PINs, sessions or prohibited identifying data on-chain.
- Document any versioned Fabric policy update and additive contract deployment.
  Preserve existing actor IDs, saved envelopes, transaction references and
  deterministic replay. Never rewrite accepted ledger history to replace an
  old actor with the new primary account.
- Supply API shapes and error codes for the single hospital login, account
  scope, capabilities, any operator/action verification, inactive account and
  revoked session. Lat will use them to update login, navigation, profile,
  Accounts, web inventory/transfers and Capture PWA presentation.
- Retain supported scan, inventory, transfer/request, reservation, expiry,
  history and Analytics workflows under their documented authorization.
  The system/regulatory accounts must not inherit hospital capabilities.

Use only synthetic operator references during development. Do not introduce
real employee names/IDs, patient/donor data or shared plaintext credential/PIN
fixtures. Keep configuration and credential delivery outside Git and PR text.

## 5. Retained-data migration and rollback

Lat's verified retained baseline contains:

- Nine operational components across five types; six AVAILABLE, one RESERVED,
  one IN_TRANSIT and one EXPIRED; 18 VALID Fabric operations.
- Three PENDING requests and ACTIVE / IN_TRANSIT reservations.
- The fixed 2026-10-07 historical snapshot: 20 combinations, 486 AVAILABLE,
  36 RESERVED, 522 components and 524 VALID local ledger operations.
- An independent 40-combination census: six available/eligible operational
  units and 34 verified zeros. Historical counts are separate.
- A persistent off-chain expiry acknowledgement and scoped audit evidence.
- PostgreSQL migrations through the additive retained-policy fix; unchanged
  model/image, V4 default and no persisted V5 run on Lat's target yet.

Back up PostgreSQL before additive migrations and privately record account,
assignment, session and relevant row/receipt fingerprints. Include a dry-run
mapping, exact migration commands, partial-migration resume procedure and a
rollback procedure that does not delete accepted domain or ledger evidence.
Do not alter applied migrations, reset databases, remove volumes, reenroll
identities or assign existing users to invented institutions.

Retire redundant interactive logins only through the explicit reviewed
migration. Preserve their historical IDs/references and credential records
where required for the reviewed rollback; revoke their interactive access and
sessions so old cookies/API routes cannot bypass the new model. Specify how
saved or pending commands retain original ownership and authorized recovery.
Update private seed-account selection and development wrappers as necessary;
do not regenerate the operational/historical manifests to accommodate accounts.

This migration is separate from the pending V5 retained-target binding/job
approval requested on PR #21. Reinspect any changed target/principal context;
do not reuse an approval for different binding/job hashes. No model resend,
retraining or V5 activation is requested.

## 6. Required validation and handoff back to Lat

Return exact branch/commits, the accepted account/capability decision, old-to-new
mapping, additive migrations/policy upgrades and private setup prerequisites.
Separate documentation, implementation and validation commits when useful.

Prove on retained or representative synthetic data:

1. One primary hospital login for each of the two existing hospital institutions;
   regulator/system accounts stay separate. Duplicate/concurrent creation and
   old login endpoints cannot defeat that rule.
2. Ordinary browser login with official cookies and no interception; correct
   hospital identity, navigation and supported web/Capture capabilities.
3. Cross-hospital, wrong-capability/role and unauthorized actor selection fail;
   administrative/regulatory scope does not permit clinical/custody actions.
4. Retired accounts and pre-migration cookies fail protected access; logout,
   account switching and 401 clear protected frontend/offline state.
5. The same operational/historical IDs, counts, requests, reservations,
   acknowledgements, commands and local receipt references survive migration,
   exact replay and ordinary service restart. Unrelated rows remain intact.
6. Failed/partial migrations and retries recover safely without duplicate
   accounts, duplicate ledger submission, reassigned saved actors or lost data.
7. Applicable API, database, chaincode, session/security and browser tests pass;
   tests identify the changed requirements/decision. Report disclosed Jopia
   self-validation separately from Lat's later local rerun.

Please reply in this PR with the decision and delivery revision. Lat will
integrate the official frontend contract and rerun against the retained local
environment. Keep credentials and generated manifests in the private artifact
channel. All outputs remain SIMULATION_ONLY; research/UAT, physical OCR, full
latency, reporting policy, operational activation and deployment gates remain.
