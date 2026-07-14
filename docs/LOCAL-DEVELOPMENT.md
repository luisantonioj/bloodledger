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
| Windows | Not recorded | Not recorded | Not recorded |
| WSL | Not recorded | Not recorded | Not recorded |
| Ubuntu | Not recorded | Not recorded | Not recorded |
| Docker Desktop | Not recorded | Not recorded | Not recorded |
| Docker Engine | Not recorded | Not recorded | Not recorded |
| Docker Compose | Not recorded | Not recorded | Not recorded |
| Git | Not recorded | Not recorded | Not recorded |
| Node.js/npm | Not recorded | Not recorded | Not recorded |
| Fabric/Fabric CA | Not recorded | Not recorded | Not recorded |
| PostgreSQL | Not recorded | Not recorded | Not recorded |

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
- deviations, errors, and resolution; and
- date reviewed by Buno and Lat.

Do not paste credentials, tokens, enrollment secrets, private keys, complete
certificates, or connection strings into evidence.

## 6. Troubleshooting record

Add an entry only after the problem is observed:

| Date | Host | Symptom | Root cause | Verified resolution | Affected versions |
|---|---|---|---|---|---|

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
