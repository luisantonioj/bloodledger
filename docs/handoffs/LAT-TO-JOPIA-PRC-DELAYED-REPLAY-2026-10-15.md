# Lat → Jopia: delayed PRC submission replay

Date: 2026-10-15. Classification: **SIMULATION_ONLY**.
Owner: Jopia (backend); reporter: Lat (frontend). Policy: PA-DEF-06 / ADR-044.

## Resolution — merged PR #61

**Fixed** in [PR #61](https://github.com/luisantonioj/bloodledger/pull/61),
merge `4bdf8b0`. Lat reviewed merged source: `parseSubmission` validates body
shape; `audited` checks the actor/key replay before `assertRequiredByWindow`
is called inside the new-write callback. Changed-body conflict remains intact.
Jopia reports 61 backend probe assertions and 4/4 runs; those results are
Jopia-host evidence, not an additional Lat backend probe run.

The UI keeps its conservative frozen-attempt behavior. Its synthetic browser
retry now advances the clock 61 minutes, proves the original deadline is within
one hour, and confirms the replay result using identical operator/key/body.
No live PRC action is authorized or executed. The original finding below is
retained as history; it no longer blocks PR #60 readiness.

## Original finding (before PR #61)

On merged backend baseline `797377e`, `PostgresPrcSupply.submit` in
`services/api/src/prc-supply.ts:176` calls `validateSubmission(value, now)`
before entering `audited`. The moving Required By window is checked at line 59;
the actor/key replay lookup happens later in `audited` (line 165).
Consequently an already accepted submission can become impossible to replay
once its deadline is less than an hour away.

Illustrative synthetic reproduction (source inspection; not executed against
retained data):

1. At 10:00 Manila, submit Required By 12:00 with a valid operator, body and key.
2. The write succeeds, but its response is lost.
3. At 11:01, explicitly retry the identical body/key with the same operator.
4. The window check returns `400 PRC_SUPPLY_REQUIRED_BY_OUT_OF_WINDOW` before
   looking up the earlier stored result. Expected replay behavior is the stored
   result with `replayed: true`, without another write.

A new submission at 11:01 with that deadline should still be rejected. A changed
body under the original key must still conflict. Authorization and operator
verification remain required.

## Frontend behavior and requested follow-up

The UI never automatically retries a mutation. An unconfirmed attempt retains
its exact body, correlation ID, idempotency key and original operator binding.
A later 400/403/409 or cancelled verification cannot establish that the earlier
write failed, so the UI keeps that attempt frozen and allows read-only review.
It does not silently create a replacement request. Synthetic browser tests cover
lost response, cancelled retry verification and delayed window rejection.

Please review replay ordering and add backend regression coverage for a stored
submission replayed after its deadline window, including changed-body conflict
and an actually new invalid deadline. Lat has not changed backend code, OpenAPI
or policy. The UI cannot recover this server-side replay case by itself.

## Validation boundary

Lat host migration and read-only empty-list checks are complete; no live PRC
submission, cancellation, acknowledgement, fulfilment or decline was executed.
See [PRC UI validation](../validation/lat-prc-supply-2026-10-15/README.md).
