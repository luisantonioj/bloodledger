# Persistent synthetic development data

Status: Accepted simulation implementation scope, authorized by Jopia on 2026-10-07.
Related: FR-01, FR-03–05, FR-08–09, FR-12–14; NFR-01–02, NFR-05, NFR-08–09; Testing-phase technical preparation. Jopia implements and self-validates; Lat validates his own retained environment; Buno owns model/source lineage. Human UAT and operational policy gates remain unchanged.

## Integration baseline

`codex/persistent-synthetic-development` starts at PR21 `0ebe88b6976d643713e4d0f658d688d37407dc6b` and merges historical implementation `be043b3`. Origin main `b028515` lacks these combined dependencies. Remote heads were checked before branching. The two append-only documentation conflicts retain both review and historical evidence. No shared history is rewritten.

## Dataset and evidence boundary

Operational development records use the accepted confirmed OCR command flow, encrypted donation evidence, organizational gateway, deterministic Fabric contract and durable projections. Forecasts, sessions and alert acknowledgements remain off-chain. A stored reference alone is not direct verification: seed verification checks the valid transaction and containing block before reporting success.

Historical stock is separate: re-import the reviewed 2026-10-07 workbook on **Lat's local Fabric and PostgreSQL**, preserving 522 deterministic component IDs (486 available, 36 reserved). Retain Lat's actual transaction IDs, block numbers and commitment times. Verify and reuse a matching existing import without duplicates; preserve accounts, unrelated records and Jopia's original import. Display historical data in DBeaver and a distinct Inventory view, excluding it from operational stock and census. Follow [the historical importer](HISTORICAL-SYNTHETIC-INVENTORY.md); never copy another host's transaction references as local proof.

The seed freezes an explicit date, local database target, scenarios and timestamps. Processing is confined to its command IDs. Missing credentials, actor mappings, encryption keys, schema or Fabric access stop the affected operation. Preview writes only a private manifest and performs no domain writes. Replay preserves original payloads and times. Signed envelopes are saved before submission; ambiguous outcomes require a ledger query before resubmitting the identical envelope. Committed operations retry projection only.

V2 near-expiry policy remains disabled (PA-S6-01). Labelled imminently expiring examples may be inspected, but cannot become policy-approved near-expiry alerts. Expiry alerts describe projected EXPIRED state; acknowledgements are explicitly off-chain. No clinical shelf-life inference is introduced.

V5 stays an explicit preview; V4 stays the default. A private, approved binding hash and separate retained target fingerprint gate persistence. Capture the independent 40-combination operational ML census including zeros; V5 contains 20 positive-blood-type series. Preserve request IDs and actual generation time on replay. Historical units never supply operational census evidence. DOH copy/report policy remains separately gated.

## Validation and handoff

Retained-environment acceptance must cover official cookie authentication, real API/UI on 5174 → 3000, safe replay, interruption/resume, ordinary restart, preservation, tenant/role denial and direct Fabric reconciliation. Disposable tests are supporting evidence only. Report Jopia-host results separately from Lat-host execution; do not claim Lat acceptance remotely.

The executable reproduction and remaining host prerequisites are maintained in
[Lat's runbook](PERSISTENT-DEVELOPMENT-RUNBOOK.md), with read interfaces in
[OpenAPI V2](../services/api/openapi-v2.json). The small operational scenario set
does not supply local release, receipt, compromise or autonomous algorithm
examples. Existing V1 history remains separately readable without being added
to V2 stock totals.

## Retained actor mapping decision — 2026-10-08

Status: Accepted for simulation implementation by Jopia in the current conversation.
Related: FR-12, NFR-02, ADR-031 and BR-INV-07. Source: Lat's retained-environment
handoff on PR #21, comment 6043857862; tested baseline e9a91d087819fab454bd3a033c7b22cdeaca1c71.

A new immutable `PERSISTENT_DEVELOPMENT_CORE_V1` policy derives from V2.1 and
adds only `USR_SYNTH_REVIEW_ROLE02` (ROLE-02 / INST_MEDIATRIX) and
`USR_SYNTH_REVIEW_ROLE03` (ROLE-03 / INST_SYNTH_SECONDARY_REVIEW).
The existing policy versions and existing principals remain unchanged. The
recipient retains its synthetic institution; it is not an alias for Divine Love.
This is an explicit development actor allowlist decision, not institutional
onboarding or permission to broaden either role.

Authenticated V2.1 commands select this policy only for the exact approved
user/role/institution tuples. Wrong tuples fail closed. New writes and reviewed
seed manifests record the policy version; saved commands preserve their policy
on replay. An additive, package-verified Fabric lifecycle upgrade retains all
contract namespaces, endorsement, channel state, identities and volumes. No
account changes, account reseed or database migration are selected.

Jopia validates the patch with self-validation disclosed; Lat validates the
retained host. Lat must separately inspect/review the actual target fingerprint,
seed manifest and V5 binding/job hashes. The initial operational preview uses an
explicit reviewed execution date; replay preserves it. Historical source date
stays 2026-10-07 and import stays blocked until Buno supplies the exact workbook.
V4 remains default; all research, UAT, operational activation and deployment gates
remain open. No populated integration pass is implied by this decision.
