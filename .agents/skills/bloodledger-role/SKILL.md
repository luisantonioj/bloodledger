---
name: bloodledger-role
description: Apply a selected BloodLedger owner perspective to planning, implementation, review, and prompt answers, with explicit Jopia, Buno, and Lat ownership routing.
metadata:
  short-description: Switch BloodLedger owner context
---

# BloodLedger role context

Use this skill for BloodLedger work when the user wants Codex to reason from a
project-owner perspective before answering, planning, reviewing, or
implementing. The role is conversational context for one task; it is not an
account identity, an authorization grant, or a substitute for human approval
or independent validation.

## Select and retain a role

At the beginning of a task, determine the active role from the user's explicit
selection. Accept `$bloodledger-role Jopia`, `$bloodledger-role Buno`,
`$bloodledger-role Lat`, or natural-language requests such as “switch to
Buno.” Treat `/role jopia`, `/role buno`, `/role lat`, `/role status`, and
`/role clear` as message-text aliases. These are conversational conventions;
do not claim that Codex registered native slash commands.

If no role has been selected in the current conversation, ask the user to
choose Jopia, Buno, or Lat before beginning substantive BloodLedger work. An
explicit role in the opening request satisfies this requirement. Keep the
selected role in the current conversation until the user switches or clears
it; never infer or store an account-wide or repository-wide active role.

When switching roles, acknowledge the new role briefly. For `status`, report
the current role or say that none is selected. For `clear`, remove the role
from conversation context and ask again before the next substantive task. If a
role name is unknown, list the three valid roles and do not guess.

Show the active role at the start of a substantive plan and in implementation
updates when it affects the work. Do not add a role banner to every short
answer.

## Ownership routing

Use the selected role to prioritize discovery, decisions, and validation:

| Role | Primary ownership |
| --- | --- |
| Jopia | Backend, API, blockchain and chaincode, database, infrastructure, integration, and work not assigned to Buno or Lat |
| Buno | Forecasting and ML, including data preparation, model pipelines, lineage, evaluation, and reproducibility |
| Lat | Frontend, including web and mobile interfaces, interaction design, accessibility, and presentation of API data |

Ownership guides perspective and coordination. It does not isolate the task
to one code area. For a cross-owner request, identify each affected owner,
the interface or dependency between them, and the work covered by the user's
authorization. Complete the authorized scope without requiring extra approval
solely because another owner's area is involved. Do not silently take an
unrequested ownership transfer or alter another owner's implementation when a
boundary is material; surface the dependency and keep the interface explicit.

Preserve phase-specific assignments in repository documents. For example,
Buno's UAT coordination and Lat's accountable review remain in force even
when another role is active. Role selection cannot create approval evidence,
claim validation, or mark a requirement complete.

## Before planning or implementation

Use the selected perspective to identify the relevant components, interfaces,
tests, and cross-owner dependencies before proposing or executing work. Follow
the repository reading map in [`AGENTS.md`](../../../AGENTS.md), then read only
the authoritative sources needed for the task: [`docs/PROJECT.md`](../../../docs/PROJECT.md),
[`docs/REQUIREMENTS.md`](../../../docs/REQUIREMENTS.md),
[`docs/ARCHITECTURE.md`](../../../docs/ARCHITECTURE.md), the applicable sprint
or phase document, and any linked contract or ADR.

Keep BloodLedger's research-prototype, simulation-only, privacy, safety,
authorization, and unresolved `RQ-*` boundaries. Do not duplicate those rules
in this skill or weaken them through role language. A selected role also does
not override Plan Mode, repository instructions, user scope, or required
approval gates.

When reporting work, distinguish the active perspective from the accountable
owner, validator, and evidence source. State uncertainty when the repository
does not establish an owner or when a cross-owner contract is unresolved.
