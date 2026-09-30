# Jopia reply to Buno — ML V5

**Status:** Posted on [PR #19](https://github.com/luisantonioj/bloodledger/pull/19#issuecomment-5903749515) after user approval on 2026-09-30. Buno's response and agreement are not recorded. **Scope:** FR-14 / BR-ALG-07, `SIMULATION_ONLY`.

> I reviewed PR #19 and the updated V5 handoff as Jopia. I implemented an inactive backend candidate for the frozen selected model: a saved-mean runtime adapter, immutable V5 forecast persistence, an authenticated version-aware API read, and separate surplus/BROA evidence based on committed inventory. V4 remains the default. The research training, evaluation and preview protocol is unchanged.
>
> The adapter pins both the delivered model-file SHA-256 (`1e0f0c240109e49e8f1a89a713021afae07c2f5fae5b0e2bc8e3904610fb9764`) and canonical parameter SHA-256 (`ceb0e74b2eb2f8af7fcafabb3619f2a23681c38eac65998816e7daf40b5afb86`). It maps your ordered A+, B+, O+, AB+ series, each with WB, PRBC, FFP, PC and CRYO, explicitly. Saved-mean inference needs no recent history, but your research training and evaluation requirements stay intact. Please review the twenty mapped calculations and confirm that this interpretation matches the evaluated artifact.
>
> I propose treating the origin and next-day target as Manila business dates, with the result current only on its target day and expired at the following Manila midnight. The frozen training cutoff remains separate from inference time. I also propose an external, versioned synthetic binding between `SIM_INSTITUTION_01`, the reviewed model hash and an authorized application institution; no mapping is enabled in the repository. Please review those freshness and binding terms before we record them as accepted.
>
> Surplus uses independently timestamped committed inventory. Missing or stale inventory produces no usable surplus, and the V5 BROA path remains simulation-only with automatic approval disabled. RQ-07 and the existing clinical and production gates remain open. Activation also waits for Lat's compatible frontend and browser validation and an explicit Jopia activation record.

The candidate contract is [ML-RUNTIME-INTEGRATION-V5.md](ML-RUNTIME-INTEGRATION-V5.md). Jopia's backend checks are recorded in [ML-V5-JOPIA-VALIDATION.md](ML-V5-JOPIA-VALIDATION.md); they are self-validation, not Buno's calculation review.
