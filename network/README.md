# BloodLedger Development Network

**Status:** Validated Sprint 1 baseline; CA/identity, peer/orderer, channel, and
health-contract lifecycle/integration implemented and validated by the assigned
owner on Jopia's supported WSL2 host

This document is the authoritative source for Sprint 1 Fabric network names,
development identities, ports, generated-material boundaries, orderer bootstrap,
and the disposable health contract. Runtime claims require the validation
evidence described below.

## 1. Topology boundary

The development network has one operational hospital organization: Mary
Mediatrix Medical Center. PRC, DOH, and secondary hospitals remain application
users and do not operate peers.

Institutional application approval or activation is an off-chain application
decision under ADR-030. It does not register or enroll a Fabric identity,
create an MSP/CA/peer, join a channel, deploy chaincode, or change endorsement.
Independent organization membership remains deferred under `BL-EXP-01` and
`BL-EXP-02`.

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
| Mediatrix peer operations health | internal to `peer0-mediatrix` | 9443 | Not published |
| Ordering node | `orderer0` | 7050 | `127.0.0.1:7050` |
| Ordering node operations health | internal to `orderer0` | 8443 | Not published |
| PostgreSQL | `postgres` | 5432 | `127.0.0.1:5432` |

Compose service discovery uses service names and container ports. Host bindings
exist only for local development tools and validation. The `doctor` command
detects collisions; an override must be recorded in local untracked configuration
and validation evidence.

Do not set fixed `container_name` values unless implementation proves they are
necessary. The Compose project name should scope generated container, network,
and volume names.

Peer and orderer Compose health checks use the Fabric operations-service
`/healthz` resource on their internal-only ports. Those ports are not published
to the host. Operations TLS is disabled only for these read-only health and
version endpoints on the isolated local-development Compose network; it is not
a production TLS precedent. The CA services are checked with
`fabric-ca-client getcainfo` through their existing CA endpoints and do not
require additional ports. PostgreSQL uses its native readiness check.

The Fabric 2.5 ordering node starts with `BootstrapMethod: none` and channel
participation enabled, as accepted in ADR-029. Its mutually authenticated admin
endpoint is internal to the Compose network and is not published. S1-06 creates
no system-channel or application-channel block and joins no channel. S1-07 will
create `bloodledger-dev` with a single-consenter `etcdraft` configuration and
will use the internal admin endpoint to join it. The ordering organization is a
technical boundary, not a second operational hospital member.

The S1-06 peer leaves the default Docker chaincode-builder endpoint
unconfigured because this node-only batch does not install or run chaincode.
This prevents an unused Docker daemon dependency from making the node health
signal fail and avoids mounting the Docker socket into the peer. S1-07 must
configure and validate its authorized chaincode runtime before deploying the
disposable health contract; S1-06 health is not evidence of chaincode readiness.

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
- Orderer organization identities use the non-role `bloodledger` affiliation;
  an affiliation must not duplicate a Node OU role such as `orderer`.
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

The contract source and its package workspace live below
`network/health-contract/`. Sprint 2 domain chaincode remains below
`chaincode/`; the health contract is not moved into or reused by those domain
contracts.

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
- Sprint 1 lifecycle administration and probe submission use the authenticated
  `mediatrix-admin` identity. The `api-gateway` identity is enrolled to prove the
  approved identity path but is not used for health-contract submission until
  its application attributes and checks are accepted before Sprint 2.
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

## 10. Implemented CA and identity commands

These commands cover only the S1-06 CA and identity foundation. They do not
start a peer or orderer node, create a channel, or perform chaincode lifecycle
work. Set both approved CA administrator password variables in an untracked
`.env` copied from `.env.example`, or inject the same approved variables into
the local process environment. The other approved local secrets may remain
local to their own infrastructure workflow.

```bash
network/scripts/bootstrap-identities.sh
network/scripts/validate-identities.sh
```

The bootstrap command starts only `ca-mediatrix` and `ca-orderer`, waits for
their pinned Fabric CA 1.5.15 health checks, creates registration secrets below
`network/generated/secrets/` with restrictive permissions, registers the
approved identity types, and enrolls the MSP and TLS material. A completed,
valid run is idempotent: rerunning bootstrap validates the existing output and
makes no changes. Partial state fails safely.

Identity-only development recreation is deliberately separate from the S1-08
general reset interface. It displays the exact CA containers and generated
paths, refuses unexpected CA volumes, preserves `.env` and PostgreSQL, and
requires this literal confirmation token:

```bash
BLOODLEDGER_IDENTITY_RECREATE=REMOVE_BLOODLEDGER_CA_IDENTITIES \
  network/scripts/recreate-identities.sh
network/scripts/bootstrap-identities.sh
```

Static and live checks are:

```bash
npm run check:fabric-identities
npm run test:fabric-identities
```

The live validation reports only Fabric CA/client versions and certificate
subject/issuer metadata. It does not print registration secrets, keys, complete
certificates, or connection material. Generated output remains entirely below
`network/generated/` and is excluded from Git.

## 11. Implemented peer and orderer validation

These commands cover only the S1-06 peer/orderer node foundation. They are
component checks, not the general start, stop, status, log, or reset interface
reserved for S1-08. They do not create or join a channel and do not package,
install, approve, commit, invoke, or query chaincode.

With the approved generated identities present and both CA administrator
password variables supplied through the process environment or untracked
`.env`, validate already-running nodes with:

```bash
network/scripts/validate-nodes.sh
```

The validator checks the integrated Compose model, CA readiness, container
health, internal `/healthz` and `/version` resources, pinned images, MSP IDs,
TLS, LevelDB, bootstrap and participation settings, and host port publication.
It reports only approved non-secret configuration values.

The component integration check starts only the two existing CAs and the two
Fabric nodes, validates them, restarts only the peer and orderer, validates
again, and proves that the CA containers, identity completion marker,
PostgreSQL container state, and `postgres-data` volume are unchanged:

```bash
tests/network/node-integration.sh
```

The check creates the project-scoped `peer0-mediatrix-config`,
`peer0-mediatrix-data`, `orderer0-config`, and `orderer0-data` volumes when
absent and preserves them across restart. Explicit config volumes cover the
upstream images' declared `/etc/hyperledger/fabric` volume, while each data
volume covers `/var/hyperledger`; validation rejects anonymous node volumes.
The check does not implement or exercise a reset.

## 12. Implemented development channel commands

These commands implement only the channel portion of S1-07. They do not
package, install, approve, commit, invoke, or query the disposable health
contract, and they are not the general operational interface reserved for
S1-08.

With the four S1-06 Fabric services already healthy, create or validate the
approved channel, join the single development orderer through channel
participation, and join the Mediatrix peer with:

```bash
network/scripts/create-channel.sh
```

The command uses the pinned `hyperledger/fabric-tools:2.5.16` image as an
ephemeral tool container on the existing project-scoped Compose network. It
generates blocks only below `network/generated/channel-artifacts/`, uses the
`orderer-admin` mutual-TLS identity for the internal orderer administration
endpoint, and uses the `mediatrix-admin` MSP for peer channel administration.
On an existing channel it fetches and validates block zero against the approved
template before reporting success; a mismatch stops without overwriting ledger
state.

Query orderer participation, peer membership, and initialized channel ledger
information without printing certificates or keys with:

```bash
network/scripts/query-channel.sh
```

Static and live component checks are:

```bash
npm run check:fabric-channel
npm run test:fabric-channel
```

The live check runs channel creation twice and verifies stable artifacts and
membership. It preserves CA containers, the identity completion marker,
PostgreSQL container state, and `postgres-data`.

## 13. Implemented health-contract commands and validation

The disposable TypeScript `HealthContract`, its contract tests, deterministic
package staging, lifecycle automation, and Gateway probe validator live only
below the approved `network/health-contract/` and `network/scripts/`
boundaries. The exact direct dependency pins are `fabric-contract-api` `2.5.8`,
`fabric-shim` `2.5.8`, `@hyperledger/fabric-gateway` `1.11.0`, `typescript`
`5.9.3`, and `@types/node` `24.13.3` in the single root lockfile.

Component checks and lifecycle commands are:

```bash
npm run check:fabric-health-contract
npm run test:fabric-health-contract
npm run package:fabric-health-contract
npm run deploy:fabric-health-contract
npm run probe:fabric-health-contract -- s1-07-probe-001
```

The S1-08 consolidated status command uses this read-only component query for
the fixed bootstrap probe. It verifies the committed version and sequence
before evaluating `ReadProbe`; it does not submit `RecordProbe`:

```bash
network/scripts/query-health-contract.sh s1-08-bootstrap
```

The package command creates only ignored output below
`network/health-contract/build/`, normalizes generated archive metadata, and
reuses an identical package ID. The deploy command validates services,
identity material, channel membership, and equal orderer/peer heights before
install, approve, readiness, commit, and committed-definition queries. It
stops on package or definition conflicts and never changes version `0.1.0` or
sequence `1` silently.

On 2026-07-16 the original approval block exposed an invalid orderer enrollment:
the `orderer` identity type and identically named `orderer` affiliation produced
two role OUs, so the peer rejected the block signer before the channel Writers
policy could succeed. The orderer organization now uses the non-role
`bloodledger` affiliation, generated channel blocks assert the least-privilege
`OrdererMSP.orderer` Writers policy, and live identity validation requires one
role OU per orderer identity.

After the authorized channel-only recreation, package
`bloodledger-health_0.1.0:6561b8439ec026f5ea093ab2aeefd0c2dd6b9b114bbb98e76c81359825866724`
installed and version `0.1.0`, sequence `1` committed with both lifecycle
transactions reported `VALID`. Repeated deployment verified the exact approved
package ID, committed definition, and Mediatrix peer-only endorsement policy.
The Gateway probe then verified `VALID` commit status, exact
`HealthProbeRecorded` event correlation and payload, query equality, duplicate
idempotency with no duplicate event, stable not-found and argument failures,
and chaincode-level rejection of the `api-gateway` client identity.
