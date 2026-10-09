# Lat → Jopia: persist complete synthetic operational test stock

Prepared 2026-10-08. Classification: SIMULATION_ONLY.
Owner: Jopia for scope/policy/API/database/Fabric and controlled population;
Buno for scenario design/source lineage; Lat for frontend integration and
independent retained-host/browser validation.

## Goal and dependency

Implement a controlled, versioned development population path for Buno's
reviewed per-unit scenario, then demonstrate genuine local Fabric commitments,
PostgreSQL projections and authenticated API reconciliation. The proposed new
scenario targets 522 components at its declared starting time: 486 AVAILABLE
and 36 RESERVED, using the separate historical distribution as a count target.
Generating a workbook or directly inserting projection rows is insufficient.

Buno's scenario handoff is [PR #26](https://github.com/luisantonioj/bloodledger/pull/26);
follow its source/date/unit
specification. You may inspect/design the loader boundary independently, but
do not apply an unreviewed/missing manifest or invent collection dates,
donation relationships, institution mappings or clinical rules to unblock it.
This documentation PR requests the implementation plan and reviewed technical
test path. It does not claim a loader exists, a manifest is approved, stock is
populated, or participant UAT is authorized.

## Verified baseline

Start from `codex/lat-institution-account-integration` published head
`954f170b840fce1a346bb3bd393748a731be1913`, tested implementation
`639d600a53db4867ca943caa8afae36452ad348b`, incorporating your PR #25
`8b2df89a1f2ddf78d91f1557f8f5bac33a76dfa8` and the grouped gateway/seed fix
`6c72c6e4d9570936ffc265fa70d66e7eed531e13`.

- [Independent Lat retained-host evidence and startup](https://github.com/luisantonioj/bloodledger/blob/954f170b840fce1a346bb3bd393748a731be1913/docs/frontend/LAT-INSTITUTION-ACCOUNT-VALIDATION-2026-10-08.md).
- Account/API contract: `docs/INSTITUTION-ACCOUNTS.md`, OpenAPI V2 and
  `services/api/policy/institution-accounts-v1.json`.
- Intake rule: ADR-035 in `docs/ARCHITECTURE.md`; persistent development and
  historical separation: `docs/PERSISTENT-SYNTHETIC-DEVELOPMENT.md` and
  `docs/HISTORICAL-SYNTHETIC-INVENTORY.md`.
- Related FR-01–05, FR-08–09, FR-12–14; BR-INV-01–07; NFR-01–02/05/08–09;
  current Testing phase. No gate is marked complete by this handoff.

This handoff PR is one documentation file on main for a small review. Main
must not be assumed to include the retained integration. Inspect and preserve
your working tree; use a dedicated `codex/` implementation branch with grouped
commits. Preserve Lat's separate uncommitted dashboard/design edits.

Current retained target fingerprint:
`3ddfcfd9398fc720822ac25acd6524dff8098335513301728ca84520eda5f074`.
PostgreSQL `bloodledger_dev` / retained `bloodledger_postgres-data`, internal
5432; thirty applied migrations. Fabric channel `bloodledger-dev`, sole
Mediatrix peer/gateway, institution chaincode sequence 5. Reinspect the actual
target; a written fingerprint is not approval for new population.

Current data: nine operational components (six AVAILABLE, one RESERVED, one
IN_TRANSIT, one EXPIRED), two TRANSFER reservations (ACTIVE/IN_TRANSIT),
original three PENDING requests and 18 VALID operational seed operations.
Lat's separate Medix → source N.L. Villa request adds one PENDING request and
one committed command: four total requests/19 operational commands, without
inventory changes. Exact old seed replay and restart passed.

The original 2026-10-07 historical snapshot remains 522 components, 486/36,
twenty combinations, source `SIM_INSTITUTION_01`; original workbook SHA-256
`5c5997bd4df26f6f0d52d7ea13dde0172706faaa15308ebc87f241f44c241ddb`.
Its separate 524 locally VALID transactions are not operational inventory.

## Correct data-gap interpretation and actual API

Existing operational `GET /api/v2/components` (V2.1) and detail reads already
return `componentId`, `donationId`, collection/expiry, issuer/custodian,
`inventoryStatus`, reservation ID and current versions. Preserve those actual
names. `V2ComponentView` has different field names from the live projection;
reconcile types/OpenAPI/implementation explicitly rather than inventing a
breaking rename in Lat's client.

Historical reads already return generated `component_id`, `snapshot_status`,
series/allocation IDs and ledger references. `collected_at`, `expires_at` and
`original_reservation_purpose` are null; leave them unknown. Historical
allocation groups must never be rewritten as operational reservations.

Reservation reads expose purpose, request/local-release reference and members
separately. Define the stable row→detail→reservation→request/release navigation
contract for Lat, including absent/denied/missing states. Purpose is not
currently included directly in a component projection. Do not expose exact
Donation No. secrets or unauthorized institution details merely to add links.

## Population mechanism and architecture boundary

Operational intake is currently confirmed OCR-only, not a workbook bulk-import
API. A larger controlled runner can render Buno's synthetic labels, run
genuine OCR/confirmation, and submit the official authenticated command path
with the primary account and individual operator verification. Prefer reuse
of that approved boundary where feasible.

If you propose a distinct workbook/manifest bulk-load boundary, first record a
Proposed, development-only decision and selected Testing task for owner review
against ADR-035. Update the authoritative scope/decision and required contracts
before implementing an exception. A new handoff or historical approval does
not silently supersede OCR-only intake. Never fabricate OCR confidence,
confirmation or receipts, impersonate a retired actor, or write accepted stock
directly to PostgreSQL while calling it Fabric-backed.

Require private runtime credentials/keys, exact target fingerprint, approved
scenario hash/policy mapping, explicit preview/review/apply, and separate
scenario provenance. Reject remote/production targets and unknown actors,
institutions, component/date rules or policies. Preserve all six primary
accounts/passwords, original actors, identities, envelopes and volumes. Back up
PostgreSQL before additive migrations/apply; never edit an applied migration,
reset stores, reenroll identities or overwrite passwords to make tests pass.

## Persistence, workflows and evidence

1. Treat Buno's unit/donation/workflow keys as stable scenario inputs. Derive or
   validate backend component/donation/reservation/request/release IDs,
   idempotency/correlation, current versions and canonical payload digests.
   New IDs must be disjoint from historical IDs and unrelated baseline rows.
2. Map issuer and current custodian separately through reviewed synthetic
   bindings. `SIM_INSTITUTION_01` is not automatically Mediatrix; neither a
   Mediatrix gateway nor PRC account authorizes invented custody. Reuse the
   exact approved primary/operator capabilities; do not alter account roles.
3. Register accepted components through deterministic Fabric authorization and
   normal durable synchronization. Show QUEUED, submitting, projection-pending,
   committed, failure/conflict distinctly. For every accepted operation retain
   its own local VALID transaction, block and commitment time.
4. Create the reserved 36 through real TRANSFER/LOCAL_RELEASE workflows, with
   persistent links and membership. A transfer request alone does not reserve
   units; reservation and custody lifecycle are separate. Use canonical
   reservation actions, not disabled legacy aliases or direct status updates.
5. Validate actual FEFO among eligible scoped inventory, including existing
   stock. No non-FEFO ID selection to make the manifest fit; any scenario-only
   eligibility isolation needs an explicitly reviewed policy. Do not hold,
   consume or relabel unrelated baseline units without explicit scope.
6. Freeze T0/event times, payloads and request IDs for exact replay. Resume
   interrupted/ambiguous submissions by querying saved ledger evidence and
   recovering the original envelope; retry committed projections only. No
   duplicate units, reservations or replacement transaction evidence.
7. Reconcile scenario additions separately from whole-database totals and
   fingerprints of unrelated rows. If the nine remain unchanged, totals are
   531 operational components: 492 available, 37 reserved, one in transit and
   one expired. This is conditional arithmetic, not permission to reset to
   522. Recompute actual expiry/eligibility at the declared starting time.
8. Capture the independent forty-combination operational census and verified
   zeros using accepted data. Exclude all historical rows. Test institution
   isolation, current versions, invalid/stale/duplicate/conflict/retry,
   expiry/FEFO boundaries, partial resume and restart durability.
9. Provide actual `GET /api/v2/components`, component details, reservations,
   requests/local release, alerts, audit and census reconciliation. Include
   per-series counts, scenario-to-backend ID map, purpose memberships, actual
   ledger refs and baseline preservation. Lat verifies ordinary-cookie browser
   reads/actions on 5174 → 3000 without interception; 5175 fixtures do not count.

Collection/expiry examples do not enable the currently disabled near-expiry
alert policy. Expired evidence, local release, receipt, preparation and manual
approval stay within their separate accepted rules; forecasts cannot approve
clinical use or transfers.

## Related maintenance and forecast follow-up

The completed account migration retires old interactive ROLE-02/03 logins.
`run.sh inspect`/`census` and `forecast.sh` still expect those credentials.
Provide an approved new primary/operator-aware maintenance configuration and
update the runbook; do not broaden the existing narrow accepted-seed
verify/resume fallback into permission to create new commands as retired users.

Keep the frozen model/image unchanged, V4 default, and V5 explicit preview.
Retained persistence requires separately reviewed binding/job hashes with
yesterday's Manila origin and actual generation time at execution. Approval
of stock population is not V5 binding or activation approval. The new stock
scenario does not retrain, reconstruct or establish forecast accuracy.

## Return handoff

Return exact implementation branch/commits and baseline; proposed/accepted
decision references; Buno source/scenario hash and explicit mapping; private
prerequisites and reviewed target; backup/apply/resume/verify commands;
scenario/per-series/whole-database totals; actual local Fabric reconciliation;
unrelated row/account preservation; forty-combination census; replay/restart
proof; API contracts and unsupported actions; and Lat browser acceptance
instructions. Report Jopia-host self-validation separately from Lat-host
evidence. Keep raw workbooks/manifests, credentials and keys outside Git/PRs.

Human UAT, research consent/instrument/custody, RQ-07/RQ-14, physical OCR,
full end-to-end latency, reporting policy, V5 activation, clinical readiness
and deployment remain separate and open. Do not mark them complete.
