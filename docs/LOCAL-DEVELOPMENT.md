# BloodLedger Local Development Guide

**Status:** S1-08 operational interface implemented; Jopia-host integrated
validation remains partial until a complete untracked `.env` is supplied, and
S1-09 cross-machine validation remains pending

This guide defines the intended local workflow and evidence format. Command
examples are added only after Sprint 1 implementation validates them.

## 1. Supported workflow

- Host: Windows 11.
- Linux environment: WSL2 with Ubuntu 24.04 LTS.
- Canonical shell: Bash inside WSL2.
- Canonical working-copy location: the WSL Linux filesystem, normally below the
  user's home directory rather than `/mnt/c`.
- Container runtime: Docker Desktop with WSL2 integration.
- Package management: npm workspaces with one lockfile.

Windows-native commands may be used for host diagnostics, but repository
operations and project scripts are designed and validated through Bash.

## 2. Planning targets to verify

The approved targets remain in `docs/ARCHITECTURE.md` Section 3.1. S1-02 records
effective output rather than assuming the installed version matches the target.

| Tool | Jopia effective version | Buno effective version | Lat effective version |
|---|---|---|---|
| Windows | Windows 11 build `22631.6199` | Not recorded | Not recorded |
| WSL | `2.7.10.0`; kernel `6.18.33.2-2` | Not recorded | Not recorded |
| Ubuntu | `24.04.4 LTS` | Not recorded | Not recorded |
| Docker Desktop | `4.82.0` (build `233772`) | Not recorded | Not recorded |
| Docker Engine | `29.6.1` | Not recorded | Not recorded |
| Docker Compose | `5.3.0` | Not recorded | Not recorded |
| Git | `2.43.0` | Not recorded | Not recorded |
| Node.js/npm | Node.js `24.17.0`; npm `11.13.0`; nvm `0.40.5` | Not recorded | Not recorded |
| Migration packages | `node-pg-migrate` `8.0.4`; `pg` `8.22.0`; root lockfile and clean install verified 2026-07-15 | Not recorded | Not recorded |
| Gitleaks | `8.30.1`; official container and repository scans verified 2026-07-15; digest `sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f` | Not recorded | Not recorded |
| Fabric/Fabric CA | Fabric `2.5.16`; Fabric CA `1.5.15` | Not recorded | Not recorded |
| PostgreSQL | Server/client `17.10` (Debian `17.10-1.pgdg13+1`); Compose health, migration, persistence, and recreate checks verified 2026-07-15 | Not recorded | Not recorded |

A difference is not silently normalized. Jopia records the decision or deviation;
Buno and Lat review the resulting supported baseline.

## 3. Operational interface

Run the repository-level interface through canonical Bash. It resolves the
repository root independently of the caller's current directory.

```bash
scripts/bloodledger-dev.sh doctor
scripts/bloodledger-dev.sh bootstrap
scripts/bloodledger-dev.sh start
scripts/bloodledger-dev.sh status
scripts/bloodledger-dev.sh logs [ca-mediatrix|ca-orderer|peer0-mediatrix|orderer0|postgres]
scripts/bloodledger-dev.sh stop
scripts/bloodledger-dev.sh reset-fabric --dry-run
scripts/bloodledger-dev.sh reset-all --dry-run
```

- `doctor` reports the effective host and repository-managed versions,
  validates approved non-secret values and pinned images/dependencies, and
  refuses non-project host-port collisions. It installs or changes nothing.
- `bootstrap` validates `.env`, starts and migrates PostgreSQL, reuses the
  identity, node, channel, package, lifecycle, and probe component automation,
  and finishes with consolidated health. Matching state is reused; component
  conflict checks refuse mismatched state. It creates no domain tables or data.
- `start` requires the bootstrap marker, channel artifact, and health package,
  starts existing state, and succeeds only after consolidated health. It does
  not migrate, enroll, join, deploy, invoke, or reset implicitly.
- `status` is read-only. It checks container health, authenticated PostgreSQL
  access, migration status, CA readiness, peer/orderer operations health,
  channel participation and membership, the committed health-contract
  definition, and `ReadProbe` for the fixed synthetic `s1-08-bootstrap` probe.
- `logs` follows only the five approved Compose services and rejects any other
  service name.
- `stop` performs project-scoped Compose shutdown without volume or generated
  file deletion.

All commands use Compose project `bloodledger`, return nonzero on a failed
required layer, and do not print passwords, keys, certificates, wallets, or
credential-bearing connection strings. Copy `.env.example` to the untracked
`.env` and fill all five local password values before mutation. Presence is
checked without printing values.

The secret scan uses the official Gitleaks container pinned to `8.30.1`; never
use its `latest` tag. S1-02 records the resolved container digest on each host.
The tested repository command must scan committed history plus tracked and
staged repository content, redact detected values, and fail closed when the
scanner cannot run. Local `.env` and generated Fabric identities necessarily
contain development secrets and remain outside Git; their protection is proved
by ignore-path tests and tracked-file inspection rather than by committing or
printing their contents for a directory scan.

## 4. Reset-safety policy

### Level 0 — Stop

Purpose: stop BloodLedger services while preserving Fabric identities, ledger
data, channel state, PostgreSQL data, and local configuration.

Requirements:

- default operational shutdown;
- no volume removal;
- no generated-file deletion; and
- restart restores the prior development state.

### Level 1 — Fabric network reset

Purpose: recreate the BloodLedger Fabric development network without deleting
the PostgreSQL development database.

Allowed targets:

- containers, networks, and Fabric volumes labeled for Compose project
  `bloodledger`;
- resolved paths below `network/generated/`; and
- disposable health-contract build/package output below project-owned paths.

Requirements:

- show targets before deletion;
- verify filesystem targets resolve inside the repository working tree;
- preserve `.env` and PostgreSQL volume `postgres-data`; and
- require an explicit reset flag or confirmation token.

```bash
scripts/bloodledger-dev.sh reset-fabric --dry-run
scripts/bloodledger-dev.sh reset-fabric --confirm RESET_BLOODLEDGER_FABRIC
```

Level 1 validates the four Fabric Compose containers, the four Fabric volume
keys, the labeled `bloodledger_default` network, and, when present, the exact
health-contract runtime derived from the recorded package ID. The shared
network is preserved because PostgreSQL may remain attached. Only the resolved
contents of `network/generated/` and `network/health-contract/build/` are
deleted after repository-boundary, traversal, and symlink checks.

### Level 2 — Full development reset

Purpose: return all BloodLedger development infrastructure to an empty state.

In addition to Level 1 targets, this may remove the BloodLedger PostgreSQL
volume and migration history. It requires a stronger explicit confirmation,
such as a literal project-specific token, after displaying the affected
resources.

```bash
scripts/bloodledger-dev.sh reset-all --dry-run
scripts/bloodledger-dev.sh reset-all --confirm RESET_BLOODLEDGER_DEVELOPMENT
```

Level 2 includes Level 1, the project PostgreSQL container and `postgres-data`
volume, and the project network removed by normal Compose shutdown. It
preserves `.env`, source, documentation, tests, and unrelated Docker resources.
After either reset, run `bootstrap` to recreate the approved Sprint 1 baseline.

### Forbidden reset behavior

- `docker system prune` or any global prune operation;
- deleting containers, networks, or volumes not scoped to project
  `bloodledger`;
- recursive deletion before resolving and checking the absolute target;
- deleting the repository, parent directory, user home, WSL distribution, or
  Docker Desktop data globally;
- deleting `.env`, source files, documentation, or evidence logs by default;
- deleting real or institutional data—such data must never be present here.

## 5. Validation evidence template

Each proponent's concise result is recorded in the current sprint's Review
record using the fields below. Raw terminal dumps, Docker inspection payloads,
certificates, screenshots containing local secrets, and scanner reports
containing detected values are not committed. A failing check is summarized
with its safe error and resolution or blocker.

For every team machine, record:

- reviewer/name;
- host and WSL/Ubuntu versions;
- working-copy location;
- Docker Desktop, Engine, and Compose versions;
- Git, Node/npm, Fabric/Fabric CA, and PostgreSQL versions;
- effective project ports;
- start/health/query results;
- normal restart persistence result;
- Fabric reset/recreate result;
- full development reset/recreate result;
- secret/private-key scan result;
- pinned Gitleaks version and resolved container digest;
- deviations, errors, and resolution; and
- date reviewed by Buno and Lat.

Do not paste credentials, tokens, enrollment secrets, private keys, complete
certificates, or connection strings into evidence.

## 6. Troubleshooting record

Add an entry only after the problem is observed:

| Date | Host | Symptom | Root cause | Verified resolution | Affected versions |
|---|---|---|---|---|---|
| 2026-07-15 | Jopia Windows 11/Ubuntu 24.04 host | Docker Desktop exited and `docker` was unavailable in the integrated WSL distribution | The Docker inference manager could not remove the empty `dockerInference` runtime endpoint and cancelled backend startup | Removed the empty runtime endpoint, restarted Windows, and verified `docker version`, `docker compose version`, and `docker run --rm hello-world` | Docker Desktop `4.82.0` |

Do not populate troubleshooting with speculative errors copied from external
guides. A fix belongs here only after it is reproduced and verified against the
BloodLedger environment.

## 7. Related authoritative documents

- Fabric names, identities, ports, generated files, and health contract:
  `network/README.md`.
- PostgreSQL roles, variables, migration scope, and persistence:
  `database/README.md`.
- Architecture and decisions: `docs/ARCHITECTURE.md`.
- Sprint tasks and acceptance: `docs/SPRINT-01.md`.
