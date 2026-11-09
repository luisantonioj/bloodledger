# Jopia verification of Buno's post-defense forecasting revision (2026-11-03)

SIMULATION_ONLY. Verifier: Jopia role, on the Jopia laptop. Buno authored the work;
the verifier is a different person, so this is an independent check of the code
and evidence, not of the research decisions. Panel item: Franze #1.

Branch `codex/buno-post-defense-forecasting` @ `46f79d754bc98e8bfa33d3ce36370be135d6278a`
(3 commits on `5a624d9`). No PR exists yet; opening one is Buno's decision.

| Check | Result |
|---|---|
| `pytest services/forecasting/tests/test_post_defense.py services/forecasting/tests/test_v5_experiment.py` (Python 3.13.5 container, pinned `scripts/forecasting-research/requirements.txt`, `OMP_NUM_THREADS=1`) | **34 passed** |
| `ruff check` / `ruff format --check` on the three changed Python files | passed / 3 files already formatted |
| Gitleaks 8.30.1 (Docker, repository `.gitleaks.toml`, `--redact`) on Buno's 3 commits and the branch file tree | **no leaks found** |
| Standard `bash scripts/scan-secrets.sh` (all local refs) | 1 finding, **outside Buno's work**: `generic-api-key` on Lat's commit `67ff03e`, `docs/validation/lat-institution-staff-2026-10-21/README.md:137`, which is a 64-hex build-tree SHA-256 (false positive). The standard scan fails on any branch while that ref is present; an allowlist entry needs Lat's or the owner's decision. |
| Not rerun | The private-workbook evaluation and replay (the workbook is not on this host). `mypy` was not rerun. |

## Manuscript finding

Buno's change log (`docs/research/POST-DEFENSE-MANUSCRIPT-CHANGES.md`) records 18
replacements and a new Table 10a in "the existing Google Docs paper". On 2026-11-03
neither the final IMRAD manuscript (`1--PKwbC…`, last modified 2026-11-02 00:21 UTC)
nor the older revised manuscript (`1KAgg…`) contains Table 10a, the 60.85% WAPE,
the 76.77% occurrence recall or the Teunter et al. (2011) reference. The final IMRAD
still has the 8-candidate Table 10 and the Discussion sentence that a simple mean
"outperformed more complex candidates". **Franze #1 is not yet reflected in the final
manuscript**; Buno should confirm which document was edited and carry the changes into
the final IMRAD.

## Update 2026-11-09: manuscript suggestions verified

Buno added her edits to the final IMRAD (`1--PKwbC…`) on 2026-11-05 as **22 open suggestions**, alongside Jopia's
20 suggestions from 2026-11-04. The verifier read all 22 suggestions in full and checked them against the
branch's evidence (`POST-DEFENSE-FORECASTING-RESULTS.md`, `-DATA-AUDIT.md`, `-PROTOCOL.md` at `46f79d7`).

| Check | Result |
|---|---|
| Table 10a (22 candidates × 5 values) | All 22 rows, all values and the order match the results table exactly |
| Results text: WAPE 68.67% → 60.85% (−7.82 pp), MAE 0.5889, RMSE 1.2924, bias +0.0791 → −0.1677, underpredicted 1077.13 → 1392 (+29.23%), 14/20 zero medians, PRBC 56.66% / PC 60.67%, confusion 2288/152/288/952, 88.04 / 86.23 / 76.77 / 81.23 / 85.27, original recall 87.50% | All match the evidence |
| Data audit (955 rows, 229 / 21 dates, 14 release rows, 400 stock observations, 20% outpatient anchor, V4 Scenario_Rates) | Match `POST-DEFENSE-DATA-AUDIT.md` |
| Boosting settings (100 iterations, learning rate .05, minimum 30 per leaf, L2 = 1, seed 20261101), folds, 7,300 series-days, refit through 2025-06-30 | Match the protocol and results |
| "Original V5" relabelling of Tables 10–12 and their paragraphs; Teunter et al. (2011) reference in alphabetical position | Present |
| Overlap with Jopia's suggestions | None: different paragraphs (fourth-problem Discussion paragraph, Conclusion, first Recommendations paragraph, ML definition, analytics Scope paragraph) |

**Findings for Buno:**
1. **The ML definition is not changed.** Suggestion `suggest.c1esurt79qs6` re-inserts the same text, and the
   separate "Add" suggestion was rejected. The definition still says "forecast of blood consumption … based on
   historical stock submission data … designed to progressively improve in accuracy". That contradicts the
   Methodology (next-day *requested* units, frozen per-series model, no automatic retraining), although the
   linked comment says it was corrected.
2. The Reproducibility paragraph cites "the research branch's" results files. The branch has no PR yet. Open one
   into `codex/panel-revisions-integration`, so the paper can cite the project repository.
3. `docs/research/POST-DEFENSE-MANUSCRIPT-CHANGES.md` records the manuscript edits as completed on 2026-11-02;
   the suggestions were made on 2026-11-05. Correct the record.
4. Optional: the first Recommendations paragraph's new text drops the opening sentence about resolving the
   study's other open decisions. Keep it if that was not intended.
