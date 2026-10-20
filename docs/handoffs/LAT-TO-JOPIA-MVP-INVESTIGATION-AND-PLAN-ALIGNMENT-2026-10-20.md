# Lat → Jopia: MVP investigation, completed repairs and alignment with your plan

Date: 2026-10-20, Asia/Manila. Classification: **SIMULATION_ONLY**.

## Why Lat is sending this

Lat was figuring out which issues were preventing BloodLedger from working
and what final steps remained before demonstrating the core MVP. The user
wanted understandable explanations and working connections, rather than more
technical terminology or an unsupported claim that the whole system was done.

**Jopia: please review this handoff against your existing plan before choosing
the next work.** The user says you already have a plan and has asked Lat to
pause the forecasting/redistribution work for now. This document records what
happened on Lat’s laptop so your plan can account for those changes without
repeating them or losing the UI work.

Conversation coverage: the user requested the discussion from **7:23 p.m. up
to this handoff request**. Individual message timestamps are not exposed in
the chat context available to the agent, so that exact starting message cannot
be independently identified. To preserve the relevant context, this handoff
includes the MVP audit, the user’s clarifications, the authorized repairs and
the subsequent questions through the latest remaining-work summary. It is a
detailed conversation summary, not a verbatim transcript or independently
timestamped log. No exact minute has been invented for individual events.

## Quick summary for Jopia

- The user asked Lat to identify what was stopping the core MVP from working.
- The old stock is largely expired. The user said **Jopia will prepare fresh
  synthetic units across all three blood banks later**; Lat must not do that
  population as part of these repairs.
- Lat repaired the running API/ledger mismatch, enabled the existing outbound
  verification UI and deployed the waiting-request ranking correction.
- Outbound now uses inbound-style capture controls and compact styling, but
  still follows the approved reservation → verification → prepare → dispatch
  workflow. A specifically named **Confirm outbound transaction** button has
  been discussed, but **has not been implemented**.
- The repair work passed automated checks and read-only checks on Lat’s host.
  A new complete live request-to-receipt shipment was **not** performed.
- Forecasting/current stock evidence and automatic expiry are still unresolved
  on this host. The explanation and proposed work below are **not evidence of
  activation or execution**.
- The user then said Jopia has a plan and asked to skip forecasting and
  redistribution work for now. Clarify whether automatic expiry is also part
  of that plan; it remains off and deferred on Lat’s host.
- **Publication follow-up:** the repair source and tests are now committed and
  pushed to `origin/lat-sync-20261020` as **`9ec32c6`**
  (`9ec32c63745898bcb3c618a4c268a26a59996eab`). This supersedes the original
  handoff’s local-only warning. The handoff and validation report are included
  in the accompanying documentation commit. No new PR is created.

## Published source and integration note

The user explicitly requested committing/pushing the repairs and updating this
handoff after its original creation. Source baseline was `c6a46b7`; the repair
commit is `9ec32c6`. Retrieve and inspect the published changes with:

```bash
git fetch origin lat-sync-20261020
git show --stat 9ec32c6
```

Review your own branch and uncommitted work before integrating. If your branch
already contains the earlier Lat delivery, the new repair commit can be reviewed
on its own; agree whether merging or cherry-picking fits your existing plan.
The accompanying docs commit carries this updated handoff and the validation
report. This publication creates no new deployment on either host and does not
apply a runtime flag, migration or chaincode upgrade to Jopia’s laptop.

Lat’s already-completed host repair remains recorded below. Inspect your host
before considering any equivalent rollout; do not repeat the ledger upgrade or
copy Lat’s private configuration blindly.

## Updated short summary for forwarding

**BloodLedger MVP investigation and published repairs**

- Investigated the issues preventing a complete MVP demonstration.
- Fixed the API/ledger version mismatch on Lat’s host.
- Enabled outbound verification and matched scanner styling to inbound.
- Excluded already-reserved requests from the waiting-request ranking.
- Passed the recorded automated and read-only host checks while preserving data.
- Committed and pushed the repair source/tests as `9ec32c6` on `lat-sync-20261020`.
- Updated this conversation handoff and the MVP validation report for Jopia.

**Remaining:** fresh units from Jopia; the clearer outbound dispatch button;
one complete live shipment rehearsal; forecasting/redistribution according to
Jopia’s plan; and the decision/validation for automatic expiry. No fresh units,
forecast reruns or expiry activation were performed in this publication step.

## Conversation and decisions, in order

### 1. Lat asked for an MVP readiness investigation

The initial request was to examine whether BloodLedger’s existing screens and
backend connections really worked, including whether a request would appear
at the selected supplying hospital. The user initially asked for findings
without code changes.

The audit identified six main concerns:

1. The running API expected newer ledger behavior than the deployed chaincode
   supported. That could prevent later transfer operations from succeeding.
2. Only three units were currently requestable because much of the retained
   synthetic inventory had expired.
3. Outbound label verification was disabled on Lat’s laptop.
4. Current-date forecasting, estimated excess and redistribution suggestions
   did not have current results/evidence.
5. The automatic expiry evaluator was off.
6. Request ranking included some requests that already had reservations,
   because their underlying request status remained PENDING.

This was an integration/readiness investigation, not a declaration that every
requirement or policy-dependent feature was complete.

### 2. The user clarified the stock situation and priorities

The user explained that Jopia would later add fresh blood units across all
three blood-bank facilities. Therefore the small requestable stock count was
removed from the software-defect list and retained as a demonstration-data
prerequisite. No old records were deleted or refreshed.

The user asked to keep the API/ledger mismatch as critical, restore outbound,
keep forecasting and expiry noted for discussion, and fix/deploy the ranking
problem. The user also explained that the discussion had become too technical.

Lat’s response was to handle the authorized technical work while reporting
outcomes in plain language, preserving accounts, designs and retained data.

### 3. Repairs performed on Lat’s laptop

**Backend compatibility:** the existing `bloodledger-inventory` definition was
upgraded from `institution-accounts-v2`, sequence 6, to
`tc-remediation-v1`, sequence 7. The existing channel, endorsement policy and
identities were preserved. This was the already-supplied remediation code,
not a new transfer policy.

**Outbound:** enabled `VITE_BLOODLEDGER_OUTBOUND_VERIFICATION_READY` after
confirming the required migrations were already applied and the compatible
API/ledger was running. Reused inbound’s camera component, separate side-by-side
Take photo / Choose image buttons and automatic OCR. Applied the compact
preview spacing and consistent field/card/button styling to outbound.

**Ranking:** changed the pending-request reader to include only PENDING requests
with no linked reservation. All reservation states exclude a request from the
waiting-for-decision ranking; cancelling or completing a reservation does not
silently reopen that request. Existing scope, product filters and scoring
weights were preserved. The shared reader also affects redistribution’s demand
inputs, but that does not make the currently unavailable redistribution output
ready.

The rebuilt API was deployed as a new immutable local build snapshot. The web
runs the local source on **http://localhost:5174/**. The guarded UAT worker and
the existing stock-checkpoint service were restored; the general sync worker
remained stopped. Forecasting was not rerun and expiry remained off.

### 4. The user asked why outbound has no matching confirmation button

The user noticed inbound has **Confirm inbound transaction**, while outbound
has no equivalently named button below its preview.

Lat explained:

- Inbound registers the reviewed blood unit through its intake flow.
- Outbound was implemented as part of an approved transfer’s lifecycle.
- The scanner identifies the reserved units; verification provides preparation
  evidence; dispatch is the action that records them leaving.
- The existing actions are under **Outgoing transfer**, rather than one
  standalone confirmation action below the preview.

Lat acknowledged that the missing clear scanner-level wording is a **UI gap**.
The proposal was to present **Confirm outbound transaction** at the final
**dispatch** step while keeping verification, preparation, PIN and current-state
checks. It must not turn a scan into an unrelated stock removal, combine queued
with committed, or imply that verifying labels dispatches a shipment.

**Important:** the conversation described this follow-up; no code implementing
that new button was written. Agree its placement with Jopia’s plan before the
next change. Do not claim that this button already exists.

### 5. The user asked for the updated MVP checklist

Lat distinguished repaired connections from the remaining proof of a complete
shipment. Request submission is connected and covered by automated tests, but
the following new live demonstration had not been completed:

**Requester submits → chosen bank sees it → bank approves → outbound scans
match the reserved units → prepare → dispatch → transit → destination receipt.**

It is essential to test that sequence with fresh eligible synthetic units,
not the old expired reservations. Test fixtures and read-only screens do not
prove a newly committed live shipment.

### 6. The user asked what forecasting and stock evidence mean

The user asked whether Lat could handle this technical work, what decisions
were left, and who was responsible. Lat explained:

| Term | Meaning for this discussion |
| --- | --- |
| Forecasting | An estimate of future facility demand from the model’s supported historical inputs. It is not an actual request or actual receipt. |
| Stock evidence | A dated snapshot of eligible inventory already recorded in BloodLedger, used as the calculation’s stock input. It is not permission to invent counts or treat queued intake as committed. |
| Estimated excess | A calculation using the matching forecast and stock evidence under the existing accepted synthetic formula. It is separate from dashboard stock bands. |
| Redistribution suggestion | A recommendation combining source excess and destination need. A human still approves any transfer. |

The current-date forecasts were absent, older Mediatrix forecasts were stale,
and the required current analytics inventory evidence was unavailable. Simply
adding new bags does not generate those results. The 09:00/16:00 compliance
checkpoint records and the analytics inventory evidence are separate stores;
one must not be substituted for the other without a published contract.

The previously reviewed forecasting scope was twenty series: four positive
blood groups across five components. Expansion to other blood groups or
facilities is a separate dependency, not something Lat should fill with invented
forecasts. Unsupported combinations must remain unavailable.

Lat said the technical integration could be handled using accepted existing
models and contracts. This did **not** transfer model ownership, approve a new
model or authorize data generation/model activation by itself.

The proposed work, **not executed**, was:

1. Check the accepted model and supported facility/product bindings.
2. Provide the appropriate current committed-stock evidence.
3. Generate and validate the intended current-date results.
4. Verify matching identities/dates and eligible quantities in redistribution.
5. Preserve unavailable states for unsupported or missing inputs.

Buno owns forecasting/model evaluation; Jopia owns backend/contracts and
runtime decisions; Lat owns presentation and contract integration. The user
should not need to make mathematical/model choices without a concrete owner
recommendation.

### 7. The user asked what remains for automatic expiry

Lat explained that the existing background service checks exact recorded
expiry dates and submits the appropriate expiry changes through the accepted
workflow. This differs from merely showing a warning based on a label date.

On this laptop the evaluator remains **off**. The ledger compatibility blocker
has now been repaired, but that alone does not activate or validate the service.

The proposed follow-up, **not executed**, was to confirm the existing service’s
configuration/authority, enable it under a bounded rollout, test inventory and
alert outcomes, and verify restart behavior. Existing reservation rules must be
respected; it must not silently cancel reservations or move stock. Ambiguous
label-date and near-expiry policy questions are not resolved by switching it on.

Fresh stock delays the next expiry; it does not make the evaluator run.

### 8. The user deferred work because Jopia already has a plan

The user said Jopia told them to skip that part for now because he has a plan.
Lat then supplied a list containing only remaining issues:

- Fresh synthetic inventory: Jopia’s separate task.
- Clear outbound confirmation wording/button: frontend follow-up.
- Complete live shipment rehearsal: not yet proven.
- Forecasting and redistribution: deferred to Jopia’s plan.
- Automatic expiry: still off/deferred; confirm how it fits the same plan.

No forecast/census rerun, model activation, expiry activation or new live blood
transaction followed that discussion. This handoff is now requested so Jopia
can reconcile it with his plan.

## Evidence and exact local state

Detailed validation is recorded in:
[Lat MVP readiness report](../validation/lat-mvp-readiness-2026-10-20/README.md).
Treat those as results of the repair session, not a newly repeated full-system
audit at the time this handoff was written.

- Branch: `lat-sync-20261020`; earlier base `c6a46b7`; published repair source/tests
  **`9ec32c6`**. Documentation follows in the accompanying commit on that branch.
- Ledger: `tc-remediation-v1`, sequence 7; gateway metadata evaluation found
  the expected preparation, dispatch, receipt, delay/resume and expiry methods.
  An existing retained component was readable through the existing gateway.
- Database: 41 applied migrations, 0 pending; no migrations applied by this
  repair session.
- API health READY; web returned 200 on port 5174.
- Six ordinary account logins passed. Live A+ PRBC waiting-request rankings
  matched database membership: Mediatrix 5, Medix 0, N.L. Villa 1.
- Live read-only scanner checks passed for all three banks. Medix and N.L. Villa
  had no existing source reservations in this dataset, so their empty outgoing
  states were expected. Mediatrix showed enabled verification controls.
- Automated results: 481 web tests, 244 API tests, 46 chaincode tests; 60 focused
  browser tests plus 3 outbound-enabled browser tests. Web/API/chaincode checks
  passed; design-token tests passed. Browser tests used the pinned Playwright
  image and one worker. This is simulated camera evidence, not physical-phone
  validation.
- Secret scan passed for history (564 commits), index and candidate files.
- Private database and stopped-ledger-volume backups were taken and checked
  before the upgrade. Their locations/hashes remain private and ignored.
- Protected counts and domain/identity fingerprints matched before and after:
  9 institutions, 23 application users, 1 onboarding application, 9 account audit
  records, 535 components, 27 reservations, 598 commands and 0 census snapshots.
- No live capture, request, verification, preparation, dispatch, transit,
  receipt or expiry command was submitted during the repairs. The authorized
  ledger lifecycle approval/commit did occur and must not be described as
  “no Fabric changes.”

Published repair and documentation files Jopia should review:

- `apps/web/src/features/transfers/outbound-verification.tsx`
- `apps/web/src/features/receipts/unit-capture-workspace.tsx`
- `apps/web/src/styles/global.css`
- `apps/web/e2e/outbound-verification-enabled.spec.ts`
- `services/api/src/coordination-views.ts`
- `services/api/test/rps-awaiting-decision-database-probe.mjs`
- `docs/validation/lat-mvp-readiness-2026-10-20/README.md`
- This handoff.

Private backups, credentials, configuration, screenshots and runtime build
snapshots remain outside Git. This user-authorized follow-up publishes source,
tests and Markdown documentation only. No new PR is created, no private artifact
is uploaded, and no message is sent to a teammate.

## Questions for Jopia — align with your plan before further work

Please answer in terms of your existing plan rather than treating the earlier
Lat recommendations as instructions to start a competing rollout.

1. **Which plan should Lat follow?** Please identify its document/branch/commit
   or provide a short ordered checklist. Which parts are already complete on
   your laptop, and which still need to happen on Lat’s laptop?
2. **What exactly should remain paused?** The user deferred forecasting and
   redistribution to your plan. Does that also include automatic expiry? What
   event or evidence should allow Lat to resume each part?
3. **Fresh stock first:** what synthetic stock preparation do you plan for each
   of the three banks, and when should Lat consider it ready? Preserve old
   history. Please distinguish adding fresh units from clearing old reservations.
4. **Forecast coverage and timing:** which facilities/products should the defense
   actually support, and which should remain unavailable? What dataset/model
   versions and business date does your plan use? Please ask Buno to confirm
   the model/evaluation dependencies rather than inventing missing series.
5. **Stock evidence:** which existing producer/contract supplies the analytics
   snapshot, who runs it, and at what point after fresh intake is committed?
   How will its identity and freshness match the forecast? Do not substitute
   the compliance checkpoint store automatically.
6. **Redistribution acceptance:** what concrete scenario demonstrates a valid
   source excess and destination need under your plan? What should the user
   see when evidence is stale/missing or no destination qualifies? Human approval
   and FEFO remain required; dashboard bands do not approve redistribution.
7. **Expiry rollout:** should the existing evaluator be enabled on this host
   for the defense, or intentionally remain off? If enabling it is in your plan,
   specify service configuration, actor/readiness checks, reservation handling,
   an isolated test and the bounded retained-host verification to run. Preserve
   the unresolved date/near-expiry policy boundaries.
8. **Outbound button:** do you agree that “Confirm outbound transaction” should
   label the final dispatch action in the mobile scanner, after verification
   and preparation? Should Lat implement that presentation now or wait for your
   workflow changes? The button is not yet implemented.
9. **One complete rehearsal:** after fresh stock, what exact source/destination,
   product, quantity and sequence should be used? Who executes it and records
   the committed result at each step? Please bound live writes explicitly and
   verify both the requesting and supplying account views.
10. **Source synchronization:** the repair commit `9ec32c6` is now pushed to
    `origin/lat-sync-20261020`, with the handoff/evidence in the following docs
    commit. How should it be integrated with your current branch while
    preserving both laptops’ work? Fetch and review it before deciding whether
    any rollout is needed. Other hosts may already have compatible runtime code;
    do not repeat the ledger upgrade automatically.

A useful reply format is: **step → owner → prerequisite → target host →
expected result → evidence → what Lat should do next**. Clearly identify
any requested deployment/live-write scope; this document does not authorize
new runtime changes merely by describing them.

## Copyable note to Jopia

Jopia, I was investigating what was stopping BloodLedger’s core MVP from
working and what last steps remained. Lat’s host now has the API/ledger mismatch
repaired, outbound verification enabled with matching scanner styling, and the
waiting-request ranking fix deployed. The source/tests are now committed and
pushed as `9ec32c6` on `lat-sync-20261020`; this updated handoff and validation
report accompany them in the following docs commit. Fresh units remain your
task; the complete live shipment rehearsal
is still pending. The clearer “Confirm outbound transaction” button was discussed
but has not been added.

You told us you have a plan, so we paused forecasting/redistribution instead of
starting a separate approach. Please review this handoff against that plan and
send the intended order, owners, host prerequisites and expected evidence.
Please also clarify whether automatic expiry should stay paused, which forecast
combinations the defense will support, how current stock evidence will be
prepared, and when Lat should do the outbound button and full-flow rehearsal.
No new stock, forecasts or expiry actions were run as part of this discussion.

## Boundaries and honest completion statement

This remains the existing SIMULATION_ONLY prototype. Keep designs, identities,
accounts, data, evidence and unresolved policy decisions intact. No fresh-stock
population, forecast/census rerun, model activation, expiry activation, reset,
account change or additional live transaction is authorized by this handoff.

The repairs improved the implemented core path. They do not establish that the
whole system or every requirement is complete. A freshly executed request-to-
receipt demonstration, current forecasting/redistribution inputs where supported,
and the decision on expiry remain to be reconciled with Jopia’s plan.
