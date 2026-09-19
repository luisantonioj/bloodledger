# Sprint 6 — Interview-Aligned Core V2

**Status:** Authorized 2026-09-12 by Jopia
**Accountable owner:** Jopia
**Technical implementation and validation:** Jopia (self-validation disclosed)
**Frontend owner:** Lat, separate branch and schedule
**Forecasting owner:** Buno, separate branch and schedule
**Base:** `main` at `4af7cac`
**Implementation branch:** `codex/mediatrix-interview-core-v2`
**Classification:** `SIMULATION_ONLY`

**Authorization evidence:** Jopia authorized this branch on 2026-09-12 after
MMMC ethics and quality-management approval. Approval documents and identifiers
are intentionally not stored in Git; this is a sanitized scope record.

## 1. Purpose

Align the core BloodLedger prototype with the sanitized findings from the
recent Mediatrix blood-bank staff interview while preserving the research,
privacy, and non-clinical boundaries in `AGENTS.md`, `docs/PROJECT.md`,
`docs/REQUIREMENTS.md`, and `docs/TESTING-PHASE.md`.

This sprint covers backend, API, PostgreSQL, Fabric/chaincode, FEFO, RPS/BROA
coordination, local-release evidence, reconciliation, reporting, and
technical validation. It does not implement frontend, OCR, mobile-device, or
forecasting changes.

Raw interview transcripts, recordings, consent forms, approval documents,
participant identifiers, donor/patient information, and institutional
operational records are not repository artifacts.

## 2. Locked implementation decisions

- The hospital Donation No. remains the shared donation/reference value.
- A donation may be represented as Whole Blood or as separated components, but
  not both in the same active component registry.
- Each component receives a separate opaque internal `componentId`.
- Current duplicate detection is scoped to issuer, Donation No., and component
  type. A future approved label structure may add an explicit sequence.
- V2 supports all eight ABO/Rh groups and these descriptive component codes:
  `WHOLE_BLOOD`, `PACKED_RED_BLOOD_CELLS`, `FRESH_FROZEN_PLASMA`, and
  `PLATELETS`.
- The exact Donation No. is encrypted off-chain and equality-checked with a
  keyed lookup value. Fabric stores only issuer and keyed reference evidence.
- The printed label expiry is authoritative input. Clinical shelf-life and
  near-expiry thresholds remain configuration gates and are disabled until
  approved.
- FEFO remains a hard selection rule with no operator override.
- `RESERVED` represents stock prepared for a transfer or local release. A
  separate safe preparation attestation is required before dispatch or local
  completion.
- ROLE-03 submits recipient requests; ROLE-02 approves source transfers; both
  ROLE-01 and ROLE-02 may operate local release and reconciliation workflows.
- Local release stores only opaque workflow evidence and ends in `RELEASED`;
  patient, donor, crossmatch, transfusion, and diagnosis data remain out of
  scope.
- Census counts include `AVAILABLE + RESERVED`; unresolved reconciliation
  holds are excluded.
- RPS retains 70/30 urgency/wait scoring. BROA uses source predicted surplus as
  an eligibility gate and records partner/donation-drive context without
  scoring it. Outputs remain disabled for operational recommendation.
- V2 mutations are durable asynchronous commands. V1 reads remain available;
  V1 writes become read-only when V2 write mode is explicitly enabled.
- Census snapshots are scheduled for 09:00 and 16:00 Asia/Manila, with
  idempotent authorized manual catch-up. DOH copy output is disabled until an
  approved versioned blood-type column order is supplied.

## 3. Decision gates

### Gate A — contract and data protection

Before contract/data commits are finalized, confirm approved donation issuers,
Donation No. validation rules, one-per-type applicability, safe reason codes,
encryption-key custody, key rotation, and recovery procedures.

### Gate B — policy activation

Before enabling near-expiry alerts, BROA triggers, or DOH copy mode, confirm
the approved threshold table, DOH report policy/order, and the 09:00/16:00
schedule. Missing decisions leave those behaviors disabled.

### Gate C — acceptance

Before Sprint 6 is marked complete, Jopia reviews test evidence, migration and
recovery results, open `RQ-*` decisions, deferred Lat/Buno work, security
limitations, and the self-validation disclosure.

### Recorded gate outcomes

- Sprint authorization was answered by Jopia on 2026-09-12; Jopia is the
  acceptance authority and accountable implementer.
- Contract choices were answered. Exact issuer character/length rules, key
  custody/rotation/recovery, local-release/reconciliation code lists, and the
  official report column order remain external inputs; dependent behavior stays
  disabled.
- Policy activation was not approved. Near-expiry alerts, operational RPS/BROA
  eligibility, and DOH copy mode remain disabled pending approved thresholds,
  report policy, and institutional scoring approval.

## 4. Commit groups

1. `docs(sprint-6): authorize interview-aligned core v2`
2. `fix(chaincode): enforce transfer compromise actor scope`
3. `feat(contracts): define v2 donation component and command contracts`
4. `feat(data): add encrypted donation component and command schema`
5. `feat(chaincode): add v2 component custody and fefo contracts`
6. `feat(api): queue and reconcile v2 ledger commands`
7. `feat(api): add component transfer local-release and reconciliation workflows`
8. `feat(coordination): add interview-derived rps and broa v2`
9. `feat(reporting): add versioned doh census snapshots`
10. `feat(observability): add redacted correlation logging`
11. `test(sprint-6): verify integrated v2 safety and recovery`
12. `docs(sprint-6): record validation acceptance and handoffs`

Each commit must pass the relevant focused checks and must not modify
`apps/web`, `apps/capture-pwa`, or `services/forecasting`.

## 5. Handoffs

LAT receives `services/api/openapi-v2.json`, including the command envelope,
role-scoped component reads, transfer actions, local-release and reconciliation
routes, and versioned census TSV behavior. Frontend work is outside this branch.
The separate LAT implementation is recorded in
`docs/LAT-S6-FRONTEND-HANDOFF.md` and
`docs/LAT-S6-FRONTEND-IMPLEMENTATION-ISSUE.md`; unresolved frontend integration
gates there do not change this sprint's backend acceptance boundary.

Buno receives `contracts/source-surplus-evidence-v2.schema.json` and the
simulation-only freshness/classification gate in `services/coordination`.
Forecasting code and model training remain outside this branch.

The accountable owner performed the validation recorded here; additional-host
and stakeholder validation remain optional or separately gated evidence.

## 6. Acceptance boundary

Sprint 6 does not establish clinical validity, real ISBT compatibility,
operational forecast accuracy, regulatory filing status, production readiness,
or a deployed multi-organization Fabric consortium. Those claims remain gated
by approved evidence and unresolved requirements in the authoritative project
documents.
