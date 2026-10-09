# Lat → Jopia: populate Lat's retained operational inventory

**Status:** Requested coordination and execution-package review; no population
performed by this PR. **Owner:** Jopia (backend/ledger/target review), with
Buno (scenario/date lineage) and Lat (local execution/browser validation).
**Classification:** SIMULATION_ONLY. Selected context: TP-STOCK-01 / BL-TST-01,
FR-01–05/08–09/12–14 and the current Testing-phase boundaries.

## Problem and requested outcome

Lat's editable frontend on 5174 is correctly reading Lat's API on 3000. It
shows nine committed operational components because that backend has nine;
integrating implementation code did not copy Jopia's populated database or
Fabric ledger. This is a missing local population step, not evidence that
the frontend discarded 522 operational units.

Prepare a separately reviewed population package for **Lat's retained target**
so Lat can run the web application with the additional complete synthetic
operational units, including working TRANSFER and LOCAL_RELEASE relationships.
The preferred outcome is reproducible local data that remains available after
Lat restarts the laptop, without requiring Jopia's host to stay online.

Do not execute another population on Jopia's own target and call that a fix for
Lat. If direct access to Lat's machine is unavailable, supply private artifacts,
exact prerequisites, review hashes and runnable commands for Lat to execute.
Creating/merging this documentation PR does not approve an arbitrary execution
manifest, another target or expired scenario dates.

## Established evidence and exact integration

- [Buno source/scenario handoff, PR26](https://github.com/luisantonioj/bloodledger/pull/26).
- [Jopia population handoff, PR27](https://github.com/luisantonioj/bloodledger/pull/27#issuecomment-6071913481).
- [Implementation PR28](https://github.com/luisantonioj/bloodledger/pull/28), exact
  reviewed head `c4f99c9c420a380ae64b1a444fc353fff666bd2e`, verified ancestry
  `954f170b840fce1a346bb3bd393748a731be1913`.
- [Lat frontend navigation PR29](https://github.com/luisantonioj/bloodledger/pull/29),
  branch `codex/lat-operational-stock-navigation`, implementation
  `0ae4c7577fc01495537cae21a2803a4f3dffc6b4`, evidence/head
  `eb12ee2c28aa5f1810e325fdb1b074c4801eea27`.
- [Lat independent evidence and commands](https://github.com/luisantonioj/bloodledger/blob/eb12ee2c28aa5f1810e325fdb1b074c4801eea27/docs/frontend/LAT-OPERATIONAL-NAVIGATION-VALIDATION-2026-10-09.md)
  and [PR27 independent update](https://github.com/luisantonioj/bloodledger/pull/27#issuecomment-6074099373).

Use verified integration ancestry; do not assume `main` includes PR28/29.
This documentation-only handoff branches from `main` so its diff does not
repackage the implementation. Runtime work must use the reviewed integration
above or a separately verified successor with exact commits recorded.

| Evidence | Lat retained target | Jopia populated target |
| --- | --- | --- |
| Target fingerprint | `3ddfcfd9398fc720822ac25acd6524dff8098335513301728ca84520eda5f074` | `ee1fcef55cde4b8d698b45faa79a091009acd2e391f0619db1abfc693422afb8` |
| Operational components | 9 | 531, JOPIA_SELF_VALIDATION |
| Historical components | 522, separately stored | 522, separately stored |
| New operational-stock runs | 0 | Completed reviewed scenario |
| New scenario ledger evidence | None on Lat's target | 559 VALID commitments, JOPIA_SELF_VALIDATION |

Fresh Lat database inspection on October 9 confirms 9 operational / 522
historical / 0 population runs / 6 primary accounts / 12 operators /
31 applied migrations. Existing operational states are 6 AVAILABLE,
1 RESERVED, 1 IN_TRANSIT and 1 EXPIRED. There are four global PENDING requests
(three Mediatrix-scoped), two TRANSFER reservations (ACTIVE/IN_TRANSIT), and
19 COMMITTED commands, including unrelated retained validation work.

Lat database instance is `68aa41aa9ca6b92980a1cb126ac9f5a2`, database
`bloodledger_dev`, PostgreSQL volume `bloodledger_postgres-data`, internal port
5432; Fabric channel `bloodledger-dev`. Installed institution-account chaincode
is sequence 5. PR28 source includes the CRYO read correction that Jopia tested
at sequence 6; review any required local additive lifecycle upgrade explicitly.
Never redeploy a lower sequence or alter immutable policy to bypass a mismatch.

Lat already independently passed real-cookie navigation and isolation on
5174→3000, six-account login/401 clearing, and restart preservation. Local
LOCAL_RELEASE navigation and populated T0 acceptance remain untested because
the corresponding operational scenario does not exist here. Separate unit/UI
fixtures are not populated-target evidence.

## Jopia: prepare the target-specific execution handoff

1. Inspect the actual working tree, runtime, existing accounts/operators,
   applied migrations, ledger definitions and retained volumes. Preserve Lat's
   nine unrelated design/evidence changes. Inspect the target freshly and bind
   review to the actual fingerprint; a mismatch stops execution. Identify
   private source/artifact delivery and who will execute on Lat's host.
2. Coordinate a newly versioned scenario with Buno. The original V1 population
   window was `[2026-10-08T08:00:00Z, 2026-10-09T00:00:00Z)`; its submission
   deadline has passed. Unsubmitted work cannot use that elapsed population
   window, even if its later verification window has not yet ended. Do not
   backdate commands, silently refresh dates/hashes, or reuse Jopia's frozen
   execution manifest as approval for Lat.
3. Preserve original workbook/source lineage. The reviewed original V5 workbook
   SHA-256 is `5c5997bd4df26f6f0d52d7ea13dde0172706faaa15308ebc87f241f44c241ddb`.
   Buno supplies a separate reviewed operational scenario with explicit T0,
   collection/expiry dates, donation relationships, institution mapping,
   reservation scenarios, generation timestamp and new scenario/manifest hashes.
   This is a dated synthetic test scenario, not clinical shelf-life policy.
4. Produce the smallest required additive setup/upgrade plan. The stock-journal
   migration is already applied locally; inspect before migrating. Take and
   validate a new private PostgreSQL backup before further migrations or
   population. Establish account/domain/identity/volume preservation checkpoints
   and worker quiescence requirements. Preserve both PostgreSQL and Fabric.
5. Run the documented inspect/preview/preflight workflow from the versioned
   [population runbook at PR28](https://github.com/luisantonioj/bloodledger/blob/c4f99c9c420a380ae64b1a444fc353fff666bd2e/docs/OPERATIONAL-STOCK-POPULATION.md).
   Review collisions and global FEFO against the actual retained stock. If old
   units displace intended scenario members, stop for a reviewed revision;
   never consume, skip, relabel or re-date unrelated units to force the totals.
6. Return a concrete review package before submission: exact runtime commits,
   installed policy/version/hash and chaincode lifecycle requirements, source
   and scenario hashes, target fingerprint, backup validation, preview results,
   frozen execution hash, valid population/T0 windows, expected additions and
   preservation baseline, plus exact apply/resume/verify commands with private
   file placeholders. Identify the explicit target/manifest approval separately
   from code integration, V5 binding or Testing acceptance.
7. After target/scenario review, execution on Lat's machine must use the
   controlled existing intake path: genuine synthetic OCR, explicit confirmation,
   bound operator grants, official V2.1 commands and local Fabric verification.
   Do not substitute database fixtures, projection inserts, a workbook bulk
   loader, copied transaction receipts or Jopia's database/volume backups.
8. Verify PostgreSQL projection and authenticated inventory API, then deliver
   evidence to Lat for independent browser/replay/restart checks. If any command
   fails, report its safe state and journal entry; resume the same frozen
   manifest/idempotency/envelope rather than regenerate submitted work.

Keep credentials, PINs, cookies, keys, original workbooks, synthetic labels,
generated manifests, backups and detailed private execution reports outside
Git and GitHub comments. Do not ask users to paste credentials into this PR.

## Acceptance on Lat's host

The reviewed source distribution is 20 blood-type/component series, 522 new
units: 486 AVAILABLE plus 36 RESERVED at the declared scenario starting time.
The established scenario uses 24 ACTIVE reservations covering 18 TRANSFER and
18 LOCAL_RELEASE units. If the newly approved scenario changes any detail,
record its expected values and rationale before execution.

- Reconcile additions separately from the entire populated database. If the
  current nine remain unchanged, expected whole inventory is 531: 492 AVAILABLE,
  37 RESERVED, one IN_TRANSIT and one EXPIRED. Never manufacture those totals
  by changing existing rows or ignore unrelated retained work.
- Verify each new accepted operation against **Lat's own Fabric**: transaction
  ID, block, VALID status and actual commitment time. The existing 559-operation
  scenario is a reference expectation; derive and verify the actual approved
  command plan and local receipts. Jopia's transaction IDs are not local proof.
- Preserve all existing accounts/passwords/operators/roles, original stock,
  requests/reservations/commands/audit history, identity files and volumes.
  Preserve the historical 2026-10-07 snapshot and its 522 components separately;
  do not make those historical IDs usable stock or fill unknown dates/purpose.
- Capture and persist the approved operational T0 census: all 40 combinations,
  verified zeros, eligibility/reportable rules, source digest, original capture
  time and honest freshness. Exclude historical counts. Raw status totals can
  differ from date-dependent eligible totals; explain that reconciliation.
  Lat's existing October 8 census remains historical evidence, not new T0 proof.
- Real Mediatrix login at 5174→3000 must show the populated scoped inventory,
  all five types including CRYO, component dates/donation/issuer/custodian and
  version/state. Test component→reservation→TRANSFER request and LOCAL_RELEASE
  purpose/reference→member navigation using the existing API contracts. There
  is no separate local-release detail endpoint.
- Verify request state versus reservation lifecycle, command pending/error/
  conflict behavior where actual evidence exists, null/missing/denied resources,
  wrong-role/institution isolation and logout/401 clearing. Label absent live
  scenarios NOT_RUN; fixture tests cannot close a live acceptance criterion.
- Resume/replay the same execution without duplicate units, reservations,
  commands or replacement transactions. Restart ordinary services without
  deleting volumes, sign in again, and prove IDs/receipts/census/preservation
  remain unchanged. Port 5175 sample fixtures are not acceptance.

## Required response and boundaries

Reply on this handoff PR with **PASS / FAIL / BLOCKED / NOT_RUN**, exact
commits, actual target fingerprint, nonsecret prerequisites, newly reviewed
scenario and execution hashes/windows, private artifact delivery instructions,
reproducible commands, per-series/whole-database reconciliation, local ledger
evidence, census, replay/restart and account-preservation results. Distinguish
JOPIA_SELF_VALIDATION from LAT_LOCAL_VALIDATION and state who still needs to act.

If retained-target execution cannot yet proceed, report the precise missing
dependency. A reviewed secure route to Jopia's already-populated API may be
offered as a temporary demonstration alternative, with explicit target/scope
and session/CORS/proxy review; it does not complete local population or local
restart durability. Do not silently repoint Lat's frontend or expose a service.

Keep PR26/27/28/29 open where their integration/validation is unresolved; link
this handoff rather than closing them as if local population passed. V4 remains
default; V5 binding/job/persistence and activation require separate review.
Near-expiry stays disabled. This work does not close human UAT, physical OCR,
full NFR-06 latency, forecast accuracy, clinical/regulatory readiness,
deployment or Testing-phase exit.
