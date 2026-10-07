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
