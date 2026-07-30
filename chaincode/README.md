# Sprint 2 Inventory Contract

This workspace implements `InventoryContract` under the explicitly synthetic,
non-clinical `SYNTHETIC_INVENTORY_V1` policy. The policy proves deterministic
software behavior while Mediatrix data-gathering approval is pending. It is not
hospital policy, clinical guidance, or validation evidence.

The machine-readable policy in
`policy/synthetic-inventory-v1.json` is authoritative for its allowlist and
threshold values. Never edit an applied policy version. Add a new policy and
chaincode version/sequence, preserve existing asset policy references, and
document supersession and compatibility.

## Contract interface

`RegisterBloodUnit(inputJson)` registers one globally unique allowlisted unit in
`AVAILABLE`. `ReadBloodUnit(unitId)` returns its committed state.
`EvaluateBloodUnitExpiry(inputJson)` deterministically returns `CURRENT`,
`NEAR_EXPIRY`, or transitions `AVAILABLE` to `EXPIRED`.

Mutations accept one JSON object string so unknown fields can be rejected.
Required identifiers are stable uppercase opaque values. Timestamps must be
canonical UTC strings such as `2026-07-30T00:00:00.000Z`.

The only Sprint 2 lifecycle transition is:

```text
AVAILABLE -> EXPIRED
```

The contract has no scheduler or clock. The application supplies evaluation
time, policy version, expected asset version, correlation ID, and idempotency
key. Transfer and exception states are not part of this contract version.

## Local checks

```bash
npm run check:inventory-contract
npm run test:inventory-contract
```

With the approved development network running and regenerated `api-gateway`
identity attributes present:

```bash
npm run package:inventory-contract
npm run deploy:inventory-contract
npm run validate:network --workspace @bloodledger/inventory-contract -- S2VALIDATION01
```

The validation suffix must be unique because committed test assets are
immutable. Package, identity, MSP, and other generated material remains ignored.
