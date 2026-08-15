# Sprint 3 Inventory and Transfer Contracts

This workspace packages `InventoryContract` and `TransferContract` together for
the single-Mediatrix development channel. It uses the immutable, non-clinical
`SYNTHETIC_INVENTORY_V1` and `SYNTHETIC_TRANSFER_V1` policies. These policies
prove deterministic software behavior only; they are not hospital policy,
clinical guidance, or production validation.

The machine-readable policy files under `policy/` are authoritative for the
synthetic allowlists and limits. A replacement must add a new policy and
chaincode version/sequence, preserve historical policy references, and document
supersession. Never silently edit a committed policy version.

## Contract interfaces

`InventoryContract` keeps the Sprint 2 registration, read, and caller-triggered
expiry transactions. Sprint 3 extends its asset states only so an inventory
unit can participate in an authorized transfer and expiry can cancel an
approved reservation or compromise custody.

`TransferContract` exposes:

- `SubmitTransferRequest`, `ReadTransfer`, `ApproveTransfer`, `RejectTransfer`,
  and `CancelTransfer`;
- `RecordDispatch`, `StartTransit`, `MarkTransferDelayed`, `ResumeTransfer`,
  `RecordReceipt`, and `MarkTransferCompromised`.

Approval reserves the full quantity atomically and requires the caller-supplied
unit list to match deterministic FEFO order. There is no partial reservation or
automatic reallocation. Every mutation validates the gateway identity,
synthetic application actor, policy version, current state/version, canonical
UTC event time, correlation ID, and idempotency key.

Exact coordinates never enter chaincode. Dispatch and receipt accept only a
validated `SYNTHETIC_LOCATION_V1` evidence summary containing its ID, SHA-256
digest, phase, time, source, facility-match/fallback flags, and policy version.
BROA/RPS/ML code never runs in chaincode. An optional recommendation digest is
lineage only and never authorizes approval.

## Synthetic lifecycle

```text
PENDING -> APPROVED | REJECTED | CANCELLED
APPROVED -> DISPATCHED | CANCELLED
DISPATCHED -> IN_TRANSIT | COMPROMISED
IN_TRANSIT -> DELAYED | RECEIVED | COMPROMISED
DELAYED -> IN_TRANSIT | RECEIVED | COMPROMISED
RECEIVED -> COMPROMISED
```

Received units remain unavailable under `SYNTHETIC_TRANSFER_V1`. Operational
release, real actors, thresholds, locations, and transfer authority remain
blocked on the open requirements in `docs/REQUIREMENTS.md`.

## Checks and local Fabric upgrade

```bash
npm run check:inventory-contract
npm run test:inventory-contract
npm run package:inventory-contract
npm run deploy:inventory-contract
npm run validate:network --workspace @bloodledger/inventory-contract -- S3VALIDATION01
```

The package label/version is `bloodledger-inventory-transfer_0.2.0`; the
existing ledger definition name remains `bloodledger-inventory` and upgrades
the accepted Sprint 2 definition from version `0.1.0`, sequence `1`, to version
`0.2.0`, sequence `2`. Deployment refuses an absent or different predecessor
and never resets the channel. The validation suffix must be unique because
committed synthetic assets are immutable. All generated packages, identities,
and ledger material remain ignored by Git.
