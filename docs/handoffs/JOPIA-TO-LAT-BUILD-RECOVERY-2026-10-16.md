# Jopia → Lat: build recovery and continuation from rollout step 6

Date: 2026-10-16, Asia/Manila. **SIMULATION_ONLY**. Reply to your stopped-gate
report. Builds on the [rollout decisions D1–D5](JOPIA-TO-LAT-PUBLIC-APPLICATIONS-ROLLOUT-2026-10-16.md).

## Accepted from your report

Gates 1–5 passed: the backup was validated and both migrations were applied one
at a time (34 applied, 0 pending). The three new tables are empty and all seven
protected counts are unchanged (institutions 9, users 22, applications 0,
account audit 6, components 532, reservations 27, commands 595). Stopping at
the failed build without retrying was correct. **Do not rerun, roll back or
restore any migration.**

## Root cause, fixed in PR #70

The one-shot `node:24.17.0` build containers in our scripts ran as root on the
writable repository mount, leaving root-owned files in the Git-ignored
`services/api/build`, `services/coordination/build` and `chaincode/build`.
[PR #70](https://github.com/luisantonioj/bloodledger/pull/70) is merged as
`1124d6a`: those containers now run as the invoking user. The merge changes
scripts and docs only. `git diff d83509b 1124d6a` shows no change under
`services`, `apps`, `database`, `chaincode/src` or `contracts`.

**New rollout target: `1124d6a`.** It deploys the same application source as
`d83509b`, and no script can recreate the root-owned files. Record both SHAs in
your evidence.

## Authorized now (Jopia, accountable owner)

### A. One-time recovery of generated files

1. Check out `1124d6a`. Confirm `git diff --quiet d83509b 1124d6a -- services apps database chaincode/src contracts`
   succeeds, `npm run migrate:status` still shows 0 pending, and
   `git status --porcelain` matches your recorded state.
2. Record the count from
   `find services/api/build services/coordination/build chaincode/build -not -user "$(id -u)"`.
3. Confirm each directory is ignored: `git check-ignore -q <dir>/x`. Stop if any
   is not.
4. Run exactly
   `sudo chown -R "$(id -u):$(id -g)" services/api/build services/coordination/build chaincode/build`.
   No other `sudo`, `chown` or `rm`, and no other path: leave Docker volumes,
   `.env`, generated Fabric identities and the backup alone.
5. Rerun the `find` from step 2; it must return 0.

### B. Continue from step 6, read-only

6. As your normal user, build the API with the pinned Node 24.17.0, either
   natively or with the `1124d6a` scripts. Never build as root. Start the API
   and workers on the existing retained configuration. Then check:
   - `GET /api/v2/onboarding/sample-facilities` returns 200 with ten `ELIGIBLE` samples
   - `GET /api/v2/onboarding/sample-facilities/selection?category=BLOOD_BANK` and `…=REQUESTOR` return `SELECTED`
   - `GET /api/v2/onboarding/applications` as PRC returns 200
   - all seven protected counts are unchanged
7. **D5, only if every step 6 check passes:** build and deploy the web app with
   `VITE_BLOODLEDGER_PUBLIC_APPLICATIONS_READY` enabled. In the browser, Fill Up
   must fill all four steps, tick no checkbox and send no POST. Do not press
   Submit.

Stop at the first failure, leave the API and web stopped, and report. Do not
retry by another route.

## Still not authorized (D4)

Live public submission, PRC activation or deregistration; reset, population or
account creation; any Fabric change.

## PR #69 before it merges

1. Rebase onto `1124d6a`.
2. `scripts/scan-secrets.sh` fails on your branch with two `generic-api-key`
   false positives:
   - `docs/validation/lat-public-applications-2026-10-16/RETAINED-ROLLOUT.json:3`:
     `apiTargetCommit`, the `d83509b` merge SHA.
   - `docs/validation/lat-blood-bank-completion-2026-10-15/FORECAST-HOST-READ.json:14`:
     `run_key`, a deterministic `RUNKEY_…` forecast run identifier.

   Add one path-scoped `.gitleaks.toml` allowlist entry per file, with
   `regexTarget = "secret"` and an exact regex for that value, following the
   existing entries. Rerun the scan to a full PASS. Don't redact or rewrite the
   evidence.
3. After step 7 passes, mark PR #69 ready for review.

## Report back

Add to `docs/validation/lat-public-applications-2026-10-16/`:
- the target SHAs (`d83509b` → `1124d6a`)
- the before and after `find` counts and the exact `chown` command
- the build result, the step 6 and step 7 results, and the after counts
- the passing secret scan
- a statement that no live application, activation or deregistration was
  performed

This establishes no clinical, regulatory or production readiness.
