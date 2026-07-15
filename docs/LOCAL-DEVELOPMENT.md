# BloodLedger Local Development Guide

**Status:** Sprint 1 operational-document baseline; commands remain unverified

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
| Migration packages | `node-pg-migrate` `8.0.4`; `pg` `8.22.0` selected, not installed | Not recorded | Not recorded |
| Gitleaks | `8.30.1` selected; official container validation not recorded | Not recorded | Not recorded |
| Fabric/Fabric CA | Fabric `2.5.16`; Fabric CA `1.5.15` | Not recorded | Not recorded |
| PostgreSQL | Not provisioned; deferred to S1-04 | Not recorded | Not recorded |

A difference is not silently normalized. Jopia records the decision or deviation;
Buno and Lat review the resulting supported baseline.

## 3. Planned operational interface

Sprint 1 implementation will provide a small, stable interface for:

- prerequisite/version inspection;
- initial bootstrap;
- starting project services;
- showing service/network/database health;
- viewing project service logs;
- stopping services without data loss;
- resetting Fabric development state; and
- performing a confirmed full development reset.

Exact command names are not documented as working until S1-08/S1-09 verifies
them. The root README will contain only the shortest tested quick start.

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

### Level 2 — Full development reset

Purpose: return all BloodLedger development infrastructure to an empty state.

In addition to Level 1 targets, this may remove the BloodLedger PostgreSQL
volume and migration history. It requires a stronger explicit confirmation,
such as a literal project-specific token, after displaying the affected
resources.

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
