# Lat → Buno: blood-bank forecasting completion and expansion plan

Date: 2026-10-15 · Owner: Buno · Backend partner: Jopia · Frontend owner: Lat.
Classification: **SIMULATION_ONLY**. Selected scope: **complete and validate
current forecasting; prepare an expansion plan**. This does not authorize
implementing expanded coverage, publishing new retained forecasts or activating
a model. Blood-bank visual work is ready for integration review; functional,
institutional and clinical acceptance remain separate.

## 1. Read first and preserve the saved work

Act as Buno using the repository-local bloodledger-role skill. Read
[AGENTS.md](../../AGENTS.md), [Testing phase](../TESTING-PHASE.md) (especially
TP-05 / FR-14), [requirements](../REQUIREMENTS.md), the
[V5 integration contract](../ML-RUNTIME-INTEGRATION-V5.md), your
[V5 review](../ML-V5-BUNO-REVIEW.md) and
[Jopia's V5 validation](../ML-V5-JOPIA-VALIDATION.md). Historical evidence is
attributed to its executor and date; verify present runtime facts independently.
[OpenAPI V2](../../services/api/openapi-v2.json) and current model/evidence
schemas own the published contracts.

Saved frontend: `codex/lat-analytics-activity-layouts`, baseline
`3d56bdb554496766e8fe8f5eed12b8463107686e`. Main at this handoff is `b3bd63c`;
latest Analytics/Activity presentation edits remain on the saved branch.
PR #66 was closed without merging at Lat's request; the commits are preserved.
Coordinate integration with Jopia and do not overwrite these designs.

Lat continues **Requestor Hospital frontend work** and will consume approved
forecast/backend contracts. Keep your assignment focused on data, models,
calculations and validation; return display requirements to Lat rather than
redesigning blood-bank screens or restoring removed panels/captions.

The current Analytics view has Expected blood demand, Estimated excess stock,
component/date filters, recorded inventory evidence and separate actual request
history. Method/interpretation context lives in information hovers and evidence
details. Removed visible captions do not change the underlying data contract.

## 2. Established state and the coverage distinction

| Item | Baseline to retain | What needs verification |
|---|---|---|
| Current forecast coverage | A+, B+, AB+, O+ × Whole Blood, PRBC, FFP, Platelets, Cryoprecipitate = **20 series** | Exact enum/product mapping, complete unique rows, provenance and institution/date eligibility |
| Inventory coverage | Eight blood groups × five components = **40 combinations** | Inventory support does not establish trained forecast support; negative-group forecasts remain unsupported in the current twenty-series contract |
| V4 / V5 | V4 remains the default dataset; V5 is explicitly selected as preview by the saved bank Analytics | Unavailable V4 is legitimate; do not relabel it as CURRENT or silently activate V5 |
| V5 model | `bloodledger-v5-series-mean-1.0.0`; versioned means and existing lineage/no-refit contract | Reproducibility, origin/horizon, generated-at/training-cutoff separation and truthful uncertainty availability |
| Source surplus | Existing committed stock/census evidence + matching forecast + approved synthetic optimization formula | Eligibility, lineage, freshness, immutable evidence and correct missing/stale behavior |
| Dashboard stock bands | Accepted project-only `SYNTHETIC_STOCK_CLASSIFICATION_V1` | Separate display policy; do not replace it with surplus reserve/safety parameters or treat above-band stock as permission to transfer |
| Redistribution | Existing eligible product discovery and ranked destination recommendation; explicit human review/FEFO reservation | Forecast inputs and stock evidence must be coherent; no automatic clinical/transfer approval |
| PRC coordination | Completed five-write/one-replay live run; two persistent records and five PRC audit events | Off-chain coordination, not stock received, observed demand or a new forecast target |

[PRC results](../validation/lat-prc-supply-2026-10-15/README.md#lat-host-approved-live-results--2026-10-15)
record unchanged protected state, including 532 components and 595 commands on
Lat's host. Those are historical host-specific results, not counts to impose on
your database or authorization to rerun the flow. Activity V2 includes five PRC
events while V1 excludes them. Do not use these audit events as blood consumption.

## 3. Current forecasting work: complete and validate

### A. Data, model and scope audit

Produce a matrix per current supported institution/product series: data source,
target meaning, date coverage, missing-day handling, units, training/test cutoff,
artifact/model version and hashes, binding status, forecast availability and
remaining blocker. Record sparse data and explicit zeros separately from missing
observations. Do not reuse Mediatrix output for another bank or assume every
blood-bank account has an authorized model binding.

Reproduce the current approved calculation using existing versioned artifacts
and synthetic fixtures in isolated tests. Reconcile frontend/API names with the
model's product names, especially PRBC, FFP and Cryo. A forecast predicts the
approved requested-demand target; it is not automatically transfusion, issue,
receipt or clinical consumption. Preserve the no-refit/versioned model boundary;
propose a new immutable version if a model/data correction is needed.
Implement calculation, mapping or validation fixes within the current approved
scope in isolated code/tests, with reproducible before/after evidence. Coordinate
wire changes with Jopia and Lat; publishing corrected retained results or
activating an artifact remains a separately scoped operation.

### B. Horizon, freshness and numeric interpretation

Verify Manila business-date handling, origin versus next-day horizon, generation
time, training cutoff, target-day midnight boundaries and expiry. CURRENT means
eligible under the existing window, not newly trained on hospital observations.
Test valid CURRENT, STALE, missing/UNAVAILABLE, future-generated, corrupt latest
attempt and cross-institution/mismatched evidence. A failure must not revive an
older success, silently substitute V4/V5 or become zero demand.

Check saved precision against chart rounding and detailed values. Explain
fractional expected units and how any approved downstream integer quantity is
obtained. Do not add an undocumented rounding rule. Verify that missing
uncertainty remains explicitly unavailable; do not invent confidence intervals.
Check the complete twenty unique series where the current V5 contract requires
it. Report contract mismatches to Jopia and parser/display mismatches to Lat.

### C. Estimated excess and redistribution inputs

Return worked examples referencing existing policy/schema versions and exact
inputs: eligible committed stock, matching forecast, synthetic reserve/safety
values, numeric transformation, expected result, evidence IDs and freshness.
Read the implementation before selecting examples; this handoff introduces no
new formula, cutoffs or expected numeric outputs.

Cover: sufficient stock with positive excess; forecast/reserve consuming the
available stock; valid zero; missing forecast; stale or incomplete census;
expired/label-expired/reserved or otherwise ineligible stock; wrong institution,
product, date or run; and an estimate changing after eligible stock changes.
Verify the existing rule for each case and report disagreements rather than
making unavailable evidence look like zero or usable stock.

Keep three concepts distinct: dashboard demonstration bands, forecast-derived
source excess and human-authorized FEFO transfer allocation. Stock-band tooltip
counts are not an evaluated redistribution allowance. The existing reserve and
safety parameters are not Critical/Low/Adequate/Surplus thresholds. Source excess
alone does not create a blood request or authorize a transfer.

Review the forecast/evidence inputs used by BROA and any retained RPS service
within approved policy. Return eligibility, deterministic tie/failure behavior
and stale-input findings to Jopia. The standalone RPS frontend panel was removed;
restoring it or redesigning ranking UI is not part of this assignment.

### D. Observed request history

Audit what the existing returned transfer records actually establish: recorded
request time in Manila, requested units, status and supplying/requesting
institution. Identify capped/paged history, missing dates and missing department
metadata. Unrepresented months are not proven zero-demand months, and a hospital
name is not a department. Check with Jopia before claiming complete historical
aggregates or using these summaries as a training target.

Return the necessary dataset/aggregate fields and completeness semantics to
[Jopia](LAT-TO-JOPIA-BLOOD-BANK-BACKEND-COMPLETION-2026-10-15.md), and the exact
meaning/limitation text to Lat. Keep observed requests, forecast demand, actual
received units and PRC coordination separate.

## 4. Expansion proposal: all eight groups and more blood banks

Prepare a separate proposal, not an implicit expansion of the current model.

1. Inventory data availability for each institution × all eight groups × five
   components. Name supported, missing, sparse and unavailable combinations;
   identify de-identification/authorization and lineage requirements.
2. Specify target semantics, units and any aggregation/low-volume treatment.
   Never manufacture zeros, mirror positive groups into negative groups or
   duplicate another facility's forecasts to fill the chart.
3. Propose immutable dataset/model versions, artifact and training protocol,
   time-ordered validation, simple baselines, reproducible metrics, uncertainty
   handling and evidence required for sparsely observed combinations.
4. List needed backend contract/schema and institution-binding changes with
   Jopia, including row cardinality, unsupported combinations, timestamps,
   policy/version provenance and compatibility with existing twenty-series
   consumers. Lat updates strict parsers only after the contract is published.
5. List activation/acceptance decisions, owners, prerequisites, preservation and
   fallback behavior. Operational metrics/accuracy thresholds require RQ-07
   resolution; broader simulated coverage is not clinical validation.

Until separately implemented and accepted, leave unsupported combinations and
unbound institutions unavailable. Do not change retained forecasts, capture a
new census, retrain/publish on the retained runtime or activate a dataset under
this planning workstream.

## 5. Deliverables, acceptance and boundaries

Return a concise completion report with:

- Per-series current-state matrix and each finding classified as complete,
  calculation/data defect, backend dependency, frontend dependency, policy
  decision or deferred work; owner, evidence and next action for each.
- Reproducible commands, artifact/config identifiers, worked examples, expected
  versus actual results and PASS/FAIL/BLOCKED/NOT_RUN outcomes. Attribute earlier
  reviews and disclose your own self-validation.
- A backend dependency list for Jopia: scope, units, null/zero meaning, dates,
  freshness, history coverage, schemas, errors and compatibility needed.
- A frontend dependency list for Lat: returned values/units, labels, rounding,
  uncertainty, incomplete coverage and stale/unavailable behavior. Preserve the
  saved layout; no fabricated values to fill unavailable displays.
- A separately scoped expansion proposal with data/model/contract work and
  acceptance prerequisites; no claim that expansion is already approved or done.

Use synthetic isolated fixtures/tests for calculations, edge cases, reproducible
model output and failure behavior. Coordinate relevant forecasting/API/database
checks with Jopia; Lat runs affected web/parser/design-token and browser checks
(`--workers=1`) when wiring a changed interface. Current saved frontend evidence
is 362 unit tests and 40 affected browser cases; these are frontend checks, not
forecast-accuracy or institutional acceptance evidence.

Preserve current designs, data, accounts, identities, volumes and prior evidence.
No additional live command/PRC writes, census/forecast reruns, model activation,
resets, repopulation, credential/account changes or runtime deployment inherit
authority from this handoff. V4 remains default; V5 remains explicit preview.
RQ-02/RQ-03/RQ-07/RQ-16 and other applicable institutional decisions remain open;
full FR-04, formal UAT and operational forecasting acceptance are not established
by the blood-bank visual completion.

## Copyable message

> Buno — please use this handoff to validate and complete current blood-bank
> forecasting: the existing twenty series, model/data lineage, freshness,
> uncertainty and source-excess calculations, including redistribution inputs.
> Also prepare a separate plan for all eight blood groups and more blood banks;
> do not fabricate coverage or publish/activate expanded forecasts. Return
> reproducible evidence and separate Jopia/backend and Lat/frontend dependencies.
> Preserve the saved designs; Lat is continuing Requestor Hospital frontend work.
