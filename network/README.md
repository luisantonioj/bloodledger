# BloodLedger Development Network

**Status:** Approved Sprint 1 planning baseline; not yet implemented or verified

This document is the authoritative source for Sprint 1 Fabric network names,
development identities, ports, generated-material boundaries, and the disposable
health contract. It describes the intended configuration; it does not claim that
the network currently runs.

## 1. Topology boundary

The development network has one operational hospital organization: Mary
Mediatrix Medical Center. PRC, DOH, and secondary hospitals remain application
users and do not operate peers.

The ordering organization is a technical network-operations boundary required
to issue and manage the orderer identity. It is not a second hospital consortium
member and does not represent PRC or DOH.

## 2. Approved identifiers

| Purpose | Identifier |
|---|---|
| Docker Compose project | `bloodledger` |
| Development channel | `bloodledger-dev` |
| Hospital organization key | `mediatrix` |
| Hospital display name | `Mary Mediatrix Medical Center` |
| Hospital MSP ID | `MediatrixMSP` |
| Hospital domain | `mediatrix.bloodledger.local` |
| Hospital CA | `ca.mediatrix.bloodledger.local` |
| Hospital peer | `peer0.mediatrix.bloodledger.local` |
| Ordering organization key | `orderer` |
| Ordering MSP ID | `OrdererMSP` |
| Ordering domain | `orderer.bloodledger.local` |
| Ordering CA | `ca.orderer.bloodledger.local` |
| Orderer node | `orderer0.orderer.bloodledger.local` |
| Health chaincode name | `bloodledger-health` |
| Health chaincode label | `bloodledger-health_0.1.0` |
| Health contract name | `HealthContract` |

Names are lowercase except Fabric MSP IDs and code-level contract names. Local
overrides may change host ports but must not change MSP IDs, channel name,
logical service names, or ledger identifiers without an ADR update.

## 3. Planned Compose service names and ports

| Service | Compose service name | Container port | Default host binding |
|---|---|---:|---|
| Mediatrix Fabric CA | `ca-mediatrix` | 7054 | `127.0.0.1:7054` |
| Orderer Fabric CA | `ca-orderer` | 7054 | `127.0.0.1:8054` |
| Mediatrix peer | `peer0-mediatrix` | 7051 | `127.0.0.1:7051` |
| Mediatrix peer chaincode endpoint | internal to Compose | 7052 | Not published |
| Ordering node | `orderer0` | 7050 | `127.0.0.1:7050` |
| PostgreSQL | `postgres` | 5432 | `127.0.0.1:5432` |

Compose service discovery uses service names and container ports. Host bindings
exist only for local development tools and validation. Before implementation,
S1-02 must detect collisions; an override must be recorded in local untracked
configuration and validation evidence.

Do not set fixed `container_name` values unless implementation proves they are
necessary. The Compose project name should scope generated container, network,
and volume names.

## 4. Environment-variable names

Only names and safe non-secret defaults belong in the future `.env.example`.

| Variable | Safe planning value | Secret? |
|---|---|:---:|
| `COMPOSE_PROJECT_NAME` | `bloodledger` | No |
| `FABRIC_CHANNEL_NAME` | `bloodledger-dev` | No |
| `MEDIATRIX_MSP_ID` | `MediatrixMSP` | No |
| `ORDERER_MSP_ID` | `OrdererMSP` | No |
| `FABRIC_PEER_ENDPOINT` | `peer0-mediatrix:7051` | No |
| `FABRIC_ORDERER_ENDPOINT` | `orderer0:7050` | No |
| `FABRIC_HEALTH_CHAINCODE_NAME` | `bloodledger-health` | No |
| `MEDIATRIX_CA_ADMIN_USER` | `mediatrix-ca-admin` | No |
| `MEDIATRIX_CA_ADMIN_PASSWORD` | Empty placeholder | Yes |
| `ORDERER_CA_ADMIN_USER` | `orderer-ca-admin` | No |
| `ORDERER_CA_ADMIN_PASSWORD` | Empty placeholder | Yes |

Passwords, enrollment secrets, private keys, and generated certificates never
belong in `.env.example`, Git, logs, or command output captured as evidence.

## 5. Fabric CA identity model

### 5.1 Identities

| CA | Enrollment ID | Fabric type | Purpose | Registrar? |
|---|---|---|---|:---:|
| Mediatrix CA | `mediatrix-ca-admin` | `client` | Bootstrap CA administrator; registers Mediatrix identities | Yes |
| Mediatrix CA | `mediatrix-admin` | `admin` | Organization/channel administration | No |
| Mediatrix CA | `peer0` | `peer` | Peer enrollment and TLS identity | No |
| Mediatrix CA | `api-gateway` | `client` | Organizational service identity for later Gateway submissions | No |
| Orderer CA | `orderer-ca-admin` | `client` | Bootstrap CA administrator; registers orderer identities | Yes |
| Orderer CA | `orderer-admin` | `admin` | Ordering organization/channel administration | No |
| Orderer CA | `orderer0` | `orderer` | Orderer enrollment and TLS identity | No |

The `api-gateway` identity is planned with application attributes identifying it
as a Mediatrix service identity. Exact attribute names and chaincode checks are
defined before Sprint 2. Sprint 1 does not enroll individual application users.

### 5.2 Certificate rules

- Node OUs are enabled for the `client`, `peer`, `admin`, and `orderer` roles so
  MSP role checks match the registered identity types.
- Enrollment certificates and TLS certificates are requested separately.
- CA bootstrap administrators are used only for registration/enrollment work.
- Node identities cannot register other identities.
- The API service identity cannot administer the channel or CA.
- Organization administrators are not used as routine application identities.
- Development re-enrollment and reset behavior must be reproducible.
- Production rotation, revocation, HSM use, and disaster recovery remain outside
  Sprint 1 and require a separate production-readiness design.

## 6. Generated and committed material

Planned generated root:

```text
network/generated/
├── fabric-ca/
├── organizations/
│   ├── peerOrganizations/mediatrix.bloodledger.local/
│   └── ordererOrganizations/orderer.bloodledger.local/
└── channel-artifacts/
```

Everything under `network/generated/` is local and untracked. Private keys,
wallets, MSP enrollment output, TLS keys, CA database files, blocks, and channel
artifacts generated for a run are not committed.

Templates, public planning documentation, non-secret Compose/config templates,
and scripts may be committed once implementation is authorized and verified.

## 7. Disposable health contract specification

### 7.1 Purpose

`bloodledger-health` proves the Fabric chaincode lifecycle, endorsement,
submission, commitment, event, and query path. It contains no inventory,
transfer, hospital, patient, donor, forecasting, or algorithm behavior.

### 7.2 Interface

| Transaction | Type | Input | Result |
|---|---|---|---|
| `RecordProbe` | Submit | `probeId` matching `[A-Za-z0-9._-]{1,64}` | Stores and returns `{ "probeId": "...", "status": "OK" }` |
| `ReadProbe` | Evaluate | `probeId` | Returns the stored probe record or a stable not-found error |

State key format: `health:<probeId>`.

`RecordProbe` is deterministic. It uses no clock, random value, external call,
database, or caller-provided arbitrary payload. Repeating the same `probeId`
returns the existing identical result and does not create a second logical
record. A successful new record emits `HealthProbeRecorded` containing only the
probe ID.

### 7.3 Lifecycle baseline

- Package/contract version: `0.1.0`.
- Initial definition sequence: `1`.
- Endorsement: Mediatrix peer organization only for this one-organization
  development network.
- Allowed submitters: the authenticated Mediatrix organization administrator or
  approved organizational service identity used by the validation procedure.
- The contract is never presented as BloodLedger feature chaincode.

Before Sprint 2, the team either resets the development network to obtain a
clean ledger or retains this chaincode under its separate health-only name. A
committed chaincode definition is not described as "deleted" from an existing
ledger.

## 8. Reset boundary

Network reset may remove only:

- containers, networks, and volumes belonging to Compose project `bloodledger`;
- Fabric material below the resolved repository path `network/generated/`; and
- disposable health-contract packaging output below project-owned build paths.

It must not run global Docker prune commands, remove unrelated volumes or
containers, delete the developer's `.env`, or delete outside the resolved
BloodLedger working tree. The complete reset policy is in
`docs/LOCAL-DEVELOPMENT.md`.

## 9. Verification evidence required during Sprint 1

- Resolved identifiers and effective ports.
- CA registrations and enrollments with secrets redacted.
- MSP and TLS directory existence without private-key contents.
- Peer and orderer health.
- Channel creation and peer membership.
- Health contract package/install/approve/commit evidence.
- `RecordProbe` commit and `ReadProbe` equality.
- Secret/private-key scan result.
- Stop, restart, network reset, and recreate results.
