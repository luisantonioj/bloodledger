# Buno ML V5 independent technical review — 2026-09-30

## Scope and decision

Reviewed PR #19 at `e2eccf4baf0dd632e5e1c18597bcfa08fa7c0316` and PR #20 at
`9f6cc35dfe7af651e84762ac243a5d470155eca5`. Jopia's [proposal](https://github.com/luisantonioj/bloodledger/pull/19#issuecomment-5903749515)
was evaluated independently; it was not treated as prior Buno agreement.
This records a technical review, not human browser UAT, activation approval,
clinical validation, or authorization of an institutional binding.

| Contract point | Decision | Basis / required follow-up |
|---|---|---|
| Frozen selected artifact; no automatic refit | Agree | Both hashes and all 20 saved means verified. Any refit requires a new version and evaluation. |
| No 28-day runtime inference requirement | Agree | Saved-mean adapter needs parameters, scope and dates, not lag features. Research training, evaluation and preview keep their existing 28-day eligibility gate. |
| 20 series; nullable uncertainty | Agree | All mappings and outputs match independently reconstructed means; no invented confidence bounds. |
| Manila next-day target and expiry at following midnight | Agree to proposed window; request implementation change | CURRENT describes target-window eligibility, not newly collected data. API must also reject generation timestamps later than its trusted evaluation instant; see finding below. |
| Versioned synthetic alias binding | Agree to mechanism; defer concrete binding approval | Explicit model hash, version and institution authorization required. SIM_INSTITUTION_01 identifies synthetic research series; it proves neither Mediatrix representativeness nor institutional permission. No enabled binding approved here. |
| Independent inventory and forecast validity | Agree to design | Saved means use no stock input. Unknown/stale stock blocks stock-dependent conclusions without converting unknown to zero or invalidating an otherwise calculable forecast. |
| V5 activation | Defer | Fix/reverify freshness, obtain concrete binding approval, Lat frontend/browser evidence and explicit Jopia activation record. V4 remains default. RQ-07 remains unresolved. |

## Artifact and numerical verification

File SHA-256: `1e0f0c240109e49e8f1a89a713021afae07c2f5fae5b0e2bc8e3904610fb9764`.
Canonical model parameter SHA-256: `ceb0e74b2eb2f8af7fcafabb3619f2a23681c38eac65998816e7daf40b5afb86`.
Canonical serialization is Python `json.dumps(model, sort_keys=True, allow_nan=False,
separators=(',', ':')).encode()` for the delivered model object (name, version, means).
Model: `bloodledger-v5-series-mean-1.0.0`. The delivered ZIP contains identical model bytes.

Independently read Synthetic_Daily_Requests from the external V5 workbook, selected
2023-01-29 through 2025-06-30 target dates (TRAIN + VALIDATION only), and reconstructed
each arithmetic mean from 884 daily totals. No test or 2026 demonstration targets
were included. Hardcoded research-to-application mappings independently of the adapter.
Each reconstructed value equals the corresponding artifact value and runtime output.

| Index | Research series | Application series | Mean | Result |
|---|---|---|---:|---|
| 0 | A+ / WB | A_POSITIVE / WHOLE_BLOOD | 0.032805429864253395 | PASS (884 rows) |
| 1 | A+ / PRBC | A_POSITIVE / PACKED_RED_BLOOD_CELLS | 3.0825791855203621 | PASS (884 rows) |
| 2 | A+ / FFP | A_POSITIVE / FRESH_FROZEN_PLASMA | 0.1165158371040724 | PASS (884 rows) |
| 3 | A+ / PC | A_POSITIVE / PLATELETS | 1.5226244343891402 | PASS (884 rows) |
| 4 | A+ / CRYO | A_POSITIVE / CRYOPRECIPITATE | 0.036199095022624438 | PASS (884 rows) |
| 5 | B+ / WB | B_POSITIVE / WHOLE_BLOOD | 0.045248868778280542 | PASS (884 rows) |
| 6 | B+ / PRBC | B_POSITIVE / PACKED_RED_BLOOD_CELLS | 3.8766968325791855 | PASS (884 rows) |
| 7 | B+ / FFP | B_POSITIVE / FRESH_FROZEN_PLASMA | 0.38348416289592763 | PASS (884 rows) |
| 8 | B+ / PC | B_POSITIVE / PLATELETS | 3.5180995475113122 | PASS (884 rows) |
| 9 | B+ / CRYO | B_POSITIVE / CRYOPRECIPITATE | 0.042986425339366516 | PASS (884 rows) |
| 10 | O+ / WB | O_POSITIVE / WHOLE_BLOOD | 0.041855203619909499 | PASS (884 rows) |
| 11 | O+ / PRBC | O_POSITIVE / PACKED_RED_BLOOD_CELLS | 4.5904977375565608 | PASS (884 rows) |
| 12 | O+ / FFP | O_POSITIVE / FRESH_FROZEN_PLASMA | 0.14479638009049775 | PASS (884 rows) |
| 13 | O+ / PC | O_POSITIVE / PLATELETS | 2.1595022624434388 | PASS (884 rows) |
| 14 | O+ / CRYO | O_POSITIVE / CRYOPRECIPITATE | 0.55429864253393668 | PASS (884 rows) |
| 15 | AB+ / WB | AB_POSITIVE / WHOLE_BLOOD | 0.027149321266968326 | PASS (884 rows) |
| 16 | AB+ / PRBC | AB_POSITIVE / PACKED_RED_BLOOD_CELLS | 0.54977375565610864 | PASS (884 rows) |
| 17 | AB+ / FFP | AB_POSITIVE / FRESH_FROZEN_PLASMA | 0.044117647058823532 | PASS (884 rows) |
| 18 | AB+ / PC | AB_POSITIVE / PLATELETS | 0.13461538461538461 | PASS (884 rows) |
| 19 | AB+ / CRYO | AB_POSITIVE / CRYOPRECIPITATE | 0.031674208144796379 | PASS (884 rows) |

Artifact bytes were unchanged after inference. Adapter inspection found no fitting,
workbook loading, rolling update, or stock input. Missing/corrupt artifacts produce
UNAVAILABLE with no zero forecasts and preserve requested dates. Nullable uncertainty
and replay identity were checked. Research code/protocol differences between the
reviewed heads are empty; this review does not revise the evaluated protocol.

## Actionable finding: API accepts future-generated forecasts

P2 — `services/api/src/database.ts:171-197`, with the caller in `app.ts`.
The reader receives an evaluation date but no evaluation instant. It can return
CURRENT for a target-day row whose generated_at is still in the future. Coordination
already rejects generatedAt later than its evaluation instant, so the boundaries disagree.

Reproduction: origin 2026-09-29, target 2026-09-30, generated_at
2026-09-30T15:00:00.000Z (23:00 Manila), evaluation 2026-09-30T04:00:00.000Z
(12:00 Manila). A valid adapter bundle supplied as repository query rows returns
CURRENT and 20 forecasts, eleven hours before generation. The SQL has no timestamp
predicate; its fourth argument is only the Manila date.

Requested correction on PR #20: carry the trusted UTC evaluation instant from the
API clock into forecast selection/status validation; future-generated evidence must
not be CURRENT. Preserve unavailable-attempt precedence rather than silently reviving
an older success. Add before/at-generation and Manila-midnight regression cases and
verify alignment with coordination. This is a mocked SQL-row repository-method repro,
not a PostgreSQL or authenticated HTTP test.

## Reproduction and results

External review directory (R):
`C:/Users/Mikayla/.codex/visualizations/2026/09/15/01a0a585-1b6c-7c30-a1b3-8ab57b5bfbd4/ml-v5-independent-review`.
Sibling release directory (D): `ml-v5-implementation`; workbook directory (W): `ml-v5`.
Paths below use R/D/W as shell variables for those absolute Windows paths.
The snapshot was created using:

```sh
git archive 9f6cc35dfe7af651e84762ac243a5d470155eca5 | tar -x -C "$R/pr20"
git diff e2eccf4 9f6cc35 -- docs/ML-V5-EXPLORATION.md services/forecasting/src/bloodledger_forecasting/v5_experiment.py
```

For git archive under WSL, R was the corresponding `/mnt/c/...` path.
Independent model reconstruction and complete forecasting suite:

```sh
docker.exe run --rm --entrypoint sh --mount "type=bind,source=$R,target=/review" --mount "type=bind,source=$D,target=/release,readonly" --mount "type=bind,source=$W,target=/input,readonly" -w /review/pr20/services/forecasting bloodledger-forecasting -c 'python /review/verify_model.py && BLOODLEDGER_V5_MODEL_TEST_PATH=/release/results/selected_model.json PYTHONPATH=src pytest -p no:cacheprovider tests -q'
docker.exe run --rm --entrypoint node --mount "type=bind,source=$R,target=/review" node:24.17.0-bookworm-slim /review/probe_freshness.mjs
```

Results: all 20 values/mappings PASS; 117 forecasting tests PASS (external-model case
executed); freshness finding reproduced. Python image ID:
`sha256:d539c784667d763b48947971260fe88fb7c436d48eeea7c4eccf2c7369bf0c19`.
Python 3.13.11, NumPy 2.4.3, pandas 3.0.5, scikit-learn 1.9.0.

API/coordination preparation and validation:

```sh
docker.exe run --rm --entrypoint sh --mount "type=bind,source=$R,target=/review" -w /review/pr20 node:24.17.0-bookworm-slim -c 'npm ci --ignore-scripts --workspace @bloodledger/api --workspace @bloodledger/coordination --include-workspace-root --no-audit --no-fund && npm run build --workspace @bloodledger/api && npm run build --workspace @bloodledger/coordination'
docker.exe run --rm --entrypoint sh --mount "type=bind,source=$R,target=/review" -w /review/pr20 node:24.17.0-bookworm-slim -c 'npm test --workspace @bloodledger/api && npm test --workspace @bloodledger/coordination'
```

Both TypeScript builds PASS; API 98/98 and coordination 19/19 tests PASS.
The passing suite does not cover the reproduced future-generation API case.
External evidence files and their SHA-256 values:

- `verify_model.py`: `983a4f8ec08b76ecddbc23884746deea082d4ee372c1cc9ac80a92c366ca3195`.
- `model_review.json`: `5a39f4297d52f139fc31129243e17c45ef65699e7965dafe47658d5375b75435`.
- `probe_freshness.mjs`: `2838383bfa96d848dd2b3b3fbdd8036da00070454842fe3916316cf95498b74b`.
- `freshness_review.json`: `e454e35cba5ffaa204d2369c709f8c5383057033ac042810d4192ea8f84c16da`.

## Limitations and effect on PR #20

No independent disposable-database migration probe, full producer→database→HTTP
flow, browser UAT, deployment, or real-world accuracy assessment was performed in
this review. Jopia's database evidence remains his reported evidence. External
workbook, binding, row data and model artifacts remain outside Git.

85.27% is the secondary any-demand classification result, NOT numerical forecast
accuracy. Held-out synthetic numeric errors remain MAE 0.664509 units/series-day,
RMSE 1.265116 and WAPE 68.671480%. These do not establish operational performance.

This documentation-only correction leaves the frozen protocol, model, evaluation,
research executable and provenance unchanged. PR #20 needs the freshness correction
and follow-up evidence; it can incorporate this handoff update without refitting or
regenerating model parameters. No activation or merge is approved.
