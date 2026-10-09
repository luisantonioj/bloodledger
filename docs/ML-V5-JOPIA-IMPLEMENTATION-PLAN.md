# ML V5 — Jopia implementation plan

Status: Inactive backend merged in PR #20 on 2026-09-30 after Buno formal approval; Lat’s PR #21 resulting frontend review, concrete binding and activation remain pending. The authorized PR #21 follow-up is recorded in [Jopia review validation](ML-V5-PR21-JOPIA-VALIDATION.md). Validation is recorded in [Jopia's evidence](ML-V5-JOPIA-VALIDATION.md).
Active perspective and integration owner: Jopia. Research owner/reviewer: Buno.
Frontend owner: Lat. Classification: SIMULATION_ONLY.
The original proposals below precede Buno’s [formal inactive-backend approval](https://github.com/luisantonioj/bloodledger/pull/20#pullrequestreview-5367073735). They do not authorize activation or a concrete institution binding.

## Source and branch decision

The user requested an implementation plan and then authorized its Jopia backend
implementation, a reply to Buno for review, a new branch and grouped commits.
Attached handoff instructions are reference proposals, not
independent authority to publish messages, merge, activate, or record acceptance.

GitHub PR [#19](https://github.com/luisantonioj/bloodledger/pull/19) was checked on
2026-09-30: open, unmerged, non-draft, head `e2eccf4baf0dd632e5e1c18597bcfa08fa7c0316`,
base `main` at `40b8c649c2ff48177274b37b98afb5acf16ac87a` in the PR response.
No PR comments were returned. Its body and handoff still say draft; use actual
GitHub state when describing publication status. No acceptance is inferred.

Planning branch: `codex/ml-v5-jopia-integration-plan`.
Base branch: `codex/ml-v5-exploration` at the exact PR head above. This includes
research implementation `82d9feb` and publication update `e2eccf4`, without copying
ZIP code over GitHub code. The previous local branch
`codex/s6-fabric-compromise-validation` is preserved. A network fetch failed with
connection reset; existing local PR objects match the head verified through the
GitHub connector. Do not claim a successful fetch or assume other branches current.

Implementation branch: `codex/ml-v5-jopia-runtime`, created from planning commit `ebaaf2a`.
While #19 is unmerged, target its research branch for a stacked integration PR.
After #19 merges, inspect the new main and retarget/reconcile before merging.
Recheck remote heads and conflicting V4/frontend changes at implementation start.

The ZIP handoff matches the PR handoff byte-for-byte; the standalone supplied MD
predates its publication update. All nine manifest-listed ZIP artifacts matched
their SHA-256 values. ZIP research source also matches the PR source exactly.
Keep the ZIP, DOCX files, workbook and row-level predictions outside Git.
The manifest does not list hashes for its code files; source comparison is separate.

## Authority and scope

Follow [FR-14 and BR-ALG-07](REQUIREMENTS.md),
[forecast architecture and ADR-005/010/031](ARCHITECTURE.md),
[BL-ML-05](BACKLOG.md#bl-ml-05--existing-data-thesis-exploration),
[Testing phase](TESTING-PHASE.md), and the separate forecasting boundary in
[Sprint 6](SPRINT-06.md). This is a proposed additive integration follow-up to
BL-ML-05; it does not mark that item's accountable review or testing gates complete.

The accepted [V4 runtime](ML-RUNTIME-INTEGRATION-V4.md) stays the active default.
The frozen [V5 research protocol](ML-V5-EXPLORATION.md), research preview and
aggregate evaluation remain unchanged. Do not edit their hashed evidence to make
new runtime code appear evaluated. The application adapter gets its own version,
code hash, configuration hash and evidence. RQ-07 remains unresolved.

## Decisions for Buno and Jopia

These are concrete proposals for review, not recorded joint agreement.

| Decision | Proposed Jopia response and acceptance condition |
| --- | --- |
| Frozen model | Accept the supplied `bloodledger-v5-series-mean-1.0.0`; no automatic retraining or refitting. Missing or invalid artifacts produce unavailable attempts. Later refits require a new version, evaluation and explicit activation decision. |
| No unused inference history | A separate saved-mean adapter accepts validated model and request context without workbook/history input. The existing 28-day research comparison and preview gate remains unchanged. |
| Series binding | Bind the ordered 20 means to the research order: A+, B+, O+, AB+; within each, WB, PRBC, FFP, PC, CRYO. Never zip against V4's different ordering. Use explicit descriptive runtime code mappings and validate exact coverage, finite nonnegative numbers, name and version. |
| Institution | No automatic mapping from `SIM_INSTITUTION_01` to `INST_MEDIATRIX`. Require a versioned, explicitly approved synthetic deployment binding with model hash, research alias and authorized application institution. Missing binding blocks application publication; another institution cannot reuse it. |
| Forecast freshness | Proposed simulation rule: origin is an Asia/Manila business date, target is exactly origin + 1 day. A result is CURRENT only for its target business date and expires at the following Manila midnight. Store UTC instants. Historical requests preserve their original dates; future results are not selected early. Generation/reload time never extends the target or expiry. |
| Frozen evidence age | Keep training cutoff (2025-06-30), evaluation interval, artifact identity and inference generation time distinct. CURRENT means target-window validity only, never fresh training or operational validity. No model-age threshold is invented. |
| Inventory | Forecast availability and inventory availability are independent. Use trusted committed census/projection evidence with original timestamps and digests. Unknown stock is null/unavailable, not zero. Stale/unavailable inventory disables stock-dependent surplus, even when demand is numeric. No workbook-stock promotion. |
| Activation | Add explicit V5 reads first. Preserve V4 default and history until producer/database/API/browser checks and owner review support a separate activation commit. Roll back by selecting V4, retaining V5 records. |

Model file SHA-256:
`1e0f0c240109e49e8f1a89a713021afae07c2f5fae5b0e2bc8e3904610fb9764`.
Canonical model parameter SHA-256 from the evaluation:
`ceb0e74b2eb2f8af7fcafabb3619f2a23681c38eac65998816e7daf40b5afb86`.
Validate both representations with the research canonical serialization; do not
confuse file formatting with parameter identity. An artifact is trusted through
the reviewed release manifest, not through a caller-supplied replacement hash.

## Implementation groups and affected files

Each group is a coherent commit, with requirement/phase/owner/classification in
its body. The contract remains a candidate until owner review. The list below
records the implementation sequence; [validation](ML-V5-JOPIA-VALIDATION.md)
identifies what ran and which gates remain open.

1. `docs(ml): define V5 runtime integration contract` — record candidate decisions in
   a new `docs/ML-RUNTIME-INTEGRATION-V5.md`; link it from the phase/backlog and
   handoff without changing research protocol/results. Add an additive
   `contracts/forecast-bundle-v5-runtime-v1.schema.json` and a versioned synthetic
   mapping/configuration artifact. Define safe error codes, unavailable run shape,
   supported series, origin/horizon, expiry, null uncertainty and lineage.
2. `feat(forecasting): add frozen V5 saved-mean inference` — new
   `services/forecasting/src/bloodledger_forecasting/runtime_v5.py`, explicit CLI
   entry and focused tests. Load external selected model; verify trusted hashes,
   ordered series and deployment scope. Emit a distinct V5 runtime bundle, never
   a research preview relabeled V4. No fit/train call or history requirement.
   Hash request, binding, model, dataset, source/research code, runtime code,
   protocol/configuration and payload. Stable identities bind institution,
   original origin/horizon and model/config/input evidence, including unavailable
   attempts. Replays preserve original timestamps and payload.
3. `feat(database): persist scoped V5 forecast runs` — new forward migration and
   V5-specific persistence dispatch in `services/forecasting/.../persistence.py`.
   Inspect existing checks before extending allowed versions. Bind every row to
   its run and institution with composite constraints; persist complete runs or
   explicit unavailable attempts atomically. Runtime remains SELECT/INSERT only.
   Identical replay is a no-op; different payload under the same key conflicts.
   Preserve nullable uncertainty and V1/V4 records; do not route V5 through
   `persist_v4_runtime_bundle`. Record schema behavior in `database/README.md`.
4. `feat(api): expose explicit V5 forecast reads` — update
   `services/api/src/config.ts`, `database.ts`, `app.ts`, types, API tests and
   `services/api/openapi.json`. Extend version allowlisting while retaining V4
   default. Scope reads from authenticated principal, never a caller institution
   alias. Preserve unavailable latest attempts; do not select older success as a
   fallback. Test date/expiry boundaries and stable safe validation errors.
5. `feat(coordination): validate versioned forecast evidence` — review
   `source-surplus-store.ts`, coordination `surplus-v21.ts`, `broa-v21.ts`,
   `v2-contracts.ts` and `contracts/source-surplus-evidence-v2-1.schema.json`.
   Introduce a separately versioned evidence contract where existing consumers
   cannot safely accept V5. No cast or label-only widening of V4 evidence. Bind
   model/run, scope, inventory snapshot and projection digest. Preserve existing
   synthetic policy unless explicitly superseded; fail closed when stock is
   unknown/stale or forecast is not current. No autonomous transfer action.
6. `feat(web): display versioned demand and independent inventory` — Lat-owned
   consumer work in `apps/web/src/services/api/forecast.ts` and Analytics, with
   API parser and browser tests. Remove hardcoded V4 assumptions only alongside
   version-aware parsing. Display next-day requested demand, frozen model/training
   provenance, null uncertainty, and separately timestamped inventory. Test all
   forecast/inventory state combinations. Follow `docs/DESIGN.md` before editing.
7. `test(ml): verify V5 producer database API and browser flow` — new isolated
   V5 integration probe under `tests/forecasting/`, reuse safe V4 probe patterns.
   Record exact commit, runtime, input/artifact/config hashes, commands and results
   in a V5 evidence document. Disclose Jopia self-validation and distinguish Buno
   calculation review, Lat presentation review and human UAT.
8. `feat(ml): activate reviewed V5 simulation runtime` — separate gated commit
   changing defaults consistently across API, web and coordination only after
   evidence passes and activation is explicitly recorded. Test V4 rollback and
   explicit historical reads. This plan does not authorize deployment.

## Acceptance and verification matrix

| Gate | Required proof |
| --- | --- |
| Model and ordering | All 20 outputs equal supplied means under explicit mappings; changed hash, missing/extra means, NaN/infinity, negatives and unsupported series fail safely. File and canonical hashes independently verified. |
| No history/refit | Valid inference succeeds with no 28-day input; artifact unchanged before/after repeated runs; research preview behavior remains unchanged. |
| Time and lineage | Preserve original origin and next-day target even for unavailable attempts; reject malformed windows; deterministic replay; no refreshed evidence on reload; target/expiry checks around Manila midnight and future/history queries. |
| Scope/security | Unauthenticated and disallowed roles rejected; institution A cannot read/write B; absent/unapproved alias mapping blocked; DB composite constraints reject cross-institution rows. |
| Inventory independence | Valid numeric forecast plus null/stale stock yields no surplus; verified zero remains distinguishable from unknown; inventory timestamp/digest mismatch rejected. |
| Persistence | Empty isolated database applies forward migrations; existing V4 data survives upgrade; runtime has no DDL/UPDATE/DELETE grants; atomic failure, duplicate and conflicting replay tested. |
| Selection | Explicit V5 reads work; V4 remains default before activation; unavailable V5 never falls back to V4/older success; all API/web/coordination consumers agree on version. |
| Integration/presentation | Actual producer output passes DB and authenticated API, then browser; null intervals, unavailable attempts and separate inventory state survive every boundary. |
| Claim boundary | SIMULATION_ONLY and DISABLED_UNAPPROVED_POLICY preserved; no 100-minus-WAPE accuracy or 85.27% quantity-accuracy label; no UAT, clinical or production claim. |

Validation checks: `npm run check:forecasting`,
`npm run test:forecasting`, `npm run check:database`, relevant isolated V5 DB probe,
`npm run check:api`, `npm run test:api`, `npm run check:coordination`,
`npm run test:coordination`, `npm run check:web`, `npm run test:web`,
`npm run test:web:e2e`, `npm run scan:secrets`, and `git diff --check`.
Use the pinned supported environment and existing safe isolated-database rules;
never reset the shared development database to obtain evidence. Executed commands
and results are recorded in [Jopia's validation](ML-V5-JOPIA-VALIDATION.md).

## Review and remaining decisions

Buno should confirm ordered parameter interpretation, frozen artifact identity,
no-history inference and the proposed target-window freshness wording. Jopia must
record the synthetic institution binding and technical contract disposition.
Lat should review the consumer contract and independent inventory presentation.
No response from another owner is recorded here. The posted Jopia review request is
[ML-V5-JOPIA-REPLY.md](ML-V5-JOPIA-REPLY.md).

The user clarified that essential Jopia-owned backend work should proceed.
Implement groups 1–5 and backend verification as an inactive candidate; activation remains gated on Buno calculation review, Lat frontend/browser validation, a recorded binding decision, and an explicit activation record.
V5 coordination evidence is included in this inactive backend candidate; Lat owns
frontend integration and browser validation before activation.
Freshness and binding are explicit candidate contracts for review, not joint acceptance. Existing research
checks are Buno's reported evidence, not newly rerun validation. The institution
binding and agreed freshness contract are unresolved integration decisions;
operational policy remains blocked by RQ-07 and related existing gates.
