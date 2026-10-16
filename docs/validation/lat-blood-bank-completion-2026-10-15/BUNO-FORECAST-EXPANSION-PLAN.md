# Forecast coverage expansion — proposed, not implemented

Owner: Buno, with Jopia for contracts/integration and Lat for UI/browser evidence.
Classification: SIMULATION_ONLY. Status: Proposed. Preserve the V5 workbook,
frozen model, original evaluation and historical records unchanged.

## Target and data

Target 8 ABO/Rh groups × 5 components = 40 series per approved facility.
Inventory support does not establish demand coverage. Define an explicit approved
facility list before selecting the total cardinality (40 × N); PRC coordination
records are not evidence of hospital consumption or inventory.

Create a separately versioned dataset, generator, manifest and coverage matrix.
Keep original observations and synthetic scenarios separate, with source row/image
references and transcription uncertainty. Do not turn sample pages into claims
of complete hospital history. Maintain request date, requested product/units,
inpatient/outpatient channel, fulfillment separately, institution, coverage status
and synthetic provenance. Link releases to requests only with evidence to prevent
double counting. A release is not an additional request. No identifiers, diagnoses,
patient names or raw private material enter Git or the forecast runtime.

Daily stock snapshots require institution, UTC capture instant/Manila date,
component, ABO/Rh, AVAILABLE/RESERVED and unexpired eligible counts, completeness
and projection identity. Movements explain stock changes; changes in stock alone
cannot reconstruct demand. Missing observations remain unknown. Verified zero
means complete collection with no requests. Generated continuous days must be
labeled generated, not repaired observed history.

Generate negative-group and facility scenarios only with separately documented
assumptions, scenario IDs and seeds. Never mirror positive means or reuse one
hospital's series as another's actual demand. Sample evidence can guide schema;
it cannot establish rare-group rates or inter-hospital differences. Where evidence
or credible scenario coverage is absent, return UNAVAILABLE with a reason. No
extra years are required merely to inflate record counts.

## Modeling and evaluation

1. Freeze scope, input/target units, observation coverage, generator versions and
   data hashes before training. Validate 40 unique cells per complete facility/day
   and stock-flow consistency without converting unknowns to zero.
2. Establish date-ordered train/validation/test windows shared across facilities.
   Fit preprocessing only on training data; purge overlapping target windows if
   horizons expand. Keep observed evaluation separate from simulated evaluation.
3. Compare per-series mean, last-day, weekly seasonal, weighted/rolling baselines
   and suitable intermittent-demand candidates. Sparse series may be unavailable;
   any pooling needs explicit methodology and must not silently alias facilities.
4. Select on a declared validation metric, freeze hyperparameters, refit only on
   permitted train+validation data and evaluate once on the held-out test period.
   Report MAE/RMSE and appropriate scaled errors by facility/group/component,
   macro/micro summaries, support and zero-demand baselines. WAPE is undefined
   for all-zero actual totals; do not mask sparse poor performance in pooled totals.
5. Any-demand confusion matrices use an explicit threshold and answer a separate
   classification question. The historical 85.27% figure is not numeric forecast
   accuracy and cannot be carried forward as this model's score.
6. Calibrate uncertainty on held-out chronological data if support permits; report
   coverage and width. Otherwise preserve null uncertainty and an explicit reason.
7. Publish immutable model file and canonical parameter hashes, ordered series
   map, training cutoff, code/protocol/data hashes and an evaluation report.
   Retain the existing V5 results as a comparison, not expanded-model evidence.

## Contract and integration sequence

Buno supplies the new artifact/schema proposal and mapping audit. Jopia reviews
new dataset/model/series-manifest versions, facility-scoped bindings and immutable
run identities. Define partial coverage explicitly: unsupported series cannot be
filled from another model, bank or positive blood group. Current V5's all-or-none
20-series contract stays valid for old consumers; the expansion needs a new
version with declared expected/available counts and missing reasons.

Keep API selection explicit and preserve V4 default and V5 preview. Add migrations
only if necessary; do not overwrite old rows or applied migrations. Producer,
database, API and UI tests must cover all 40 mapped series per facility, cross-bank
authorization, duplicate/missing series, stale/future/latest-failed runs, null
uncertainty, evidence hashes and backward compatibility. Inventory freshness and
demand freshness remain independent. Synthetic stock bands, FEFO, RPS and surplus
policies are not learned clinical rules and remain separately governed.

Lat adds explicit unavailable coverage and facility/model/target/cutoff labels,
then runs browser tests against the reviewed API. Jopia runs isolated persistent
integration and independent mapping/freshness checks. Buno reviews exact SHA
calculations and wording. Decide future retraining cadence from evidence and
owner approval; daily inference does not imply daily retraining.

## Gates and deliverables

Before implementation: approved scope/facility list and synthetic assumptions,
versioned data/model/read-contract design and cross-owner review. Before any
preview persistence: verified artifact and explicit target/job/binding approvals.
Before activation: separate Jopia decision plus integrated owner/frontend evidence.
RQ-07, RQ-16, research authorization, UAT and deployment remain separate gates.
No new artifact or institutional binding is approved by this proposal.

Deliver a versioned workbook/generator/manifest, per-facility coverage matrix,
reproducible experiment and metrics, frozen model, migration/API adapter if
needed, browser evidence and owner handoff. Keep private artifacts outside Git.
