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
