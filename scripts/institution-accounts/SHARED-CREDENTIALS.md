# Shared development credentials

SIMULATION_ONLY; user-authorized maintenance, 2026-10-20. Each institution and
operator retains its own secret. Account passwords in the current package are
exactly 12 characters (`SYNTHETIC_ACCOUNT_PASSWORD_12_V1`); operator PINs are
exactly six digits. The same identity uses matching credentials
across participating laptops. No database, account or ledger replication.

## Prepare

Use matching API/web source, Node 24.17.0 and the existing private `.env`.
Build: `npm run build --workspace @bloodledger/api`. The old bootstrap remains
an eight-digit provisioning tool and is not used for this import.

Privately transfer `build/accounts/shared-credentials.json`, preserving its
bytes. Never post it in Git, a PR, chat, handoff or public download. Independently
verify its SHA-256. Directory mode 0700; file mode 0600. Do not regenerate it
on the receiving host. Run:

```sh
node scripts/institution-accounts/shared-credentials.mjs check \
  --file build/accounts/shared-credentials.json --sha256 <verified-sha256>
```

All account/operator IDs, scopes, roles and capability profiles must match.
Mismatch means stop and coordinate, not create/reactivate identities.

## Apply separately on each host

1. Quiesce API/workers and confirm no pending commands or population lock.
   Preserve existing config, identities and volumes.
2. Take a fresh private custom-format PostgreSQL backup. Validate it with
   `pg_restore --list`, record its checksum and preserve the old credential file.
   The tool's header check does not replace dump validation.
3. Record counts/fingerprints and apply:

```sh
node scripts/institution-accounts/shared-credentials.mjs apply \
  --file build/accounts/shared-credentials.json --sha256 <verified-sha256> \
  --backup <validated-private-custom-dump> --confirm-target bloodledger_dev
```

4. The transaction rotates independently salted verifiers, increments versions,
   updates only PINs that differ from the package, revokes old sessions/grants
   and appends one non-secret
   maintenance audit row. It preserves institutions, roles, IDs and domain data.
   Matching PIN hashes and operator versions remain untouched. Exact replay
   verifies hashes and adds no audit row or version increment.
5. Select `BLOODLEDGER_OPERATOR_PIN_POLICY_VERSION=SYNTHETIC_OPERATOR_PIN_6_V1`
   in the private API environment and deploy matching API/web builds as the normal
   user. Session `operatorPinLength` must be 6. Sign in again after rotation.
6. Retire stale local credential copies. For legacy tools, preserve the former
   `build/accounts/private.json` privately, then make that compatibility path a
   relative symlink to `shared-credentials.json`. Never replace `.env` or copy
   another host's private runtime file.
7. Verify every account/operator hash, login, exact six-digit verification,
   prior-session revocation and unchanged domain fingerprints. Restart only
   previously running workers. Keep the general sync worker stopped where required.

Stop on unexpected results. No automatic backup restore or domain write.
A checksum is not encryption; the package requires private custody. Never print
it or log authentication bodies. Later account changes, PIN resets or unrelated
credential rotation require a coordinated new package, not edits to this one.

## Source-host generation only

```sh
node scripts/institution-accounts/shared-credentials.mjs generate \
  --file build/accounts/shared-credentials.json
```

Generation uses exclusive creation and refuses overwrite. It is not an import.
Only `bloodledger_dev` and the isolated `bloodledger_credentials_test` targets
are supported. No migrations, account creation, model activation or Fabric work
is included in this operation.

## Password-only replacement package

For the 2026-10-20 length adjustment, the source host created a NEW bundle ID
with exactly 12-character random passwords and the SAME existing six-digit
PINs. The superseded bundle/ZIP is retained privately for evidence; it must not
be distributed or reapplied. The canonical filename and local access list now
refer to the replacement. Check the revised handoff's checksum.

Source-host creation (never regenerate on the receiving host):

```sh
node scripts/institution-accounts/shared-credentials.mjs generate \
  --file build/accounts/shared-credentials-password12-20261020.json \
  --preserve-pins-from build/accounts/shared-credentials.json \
  --previous-sha256 <verified-previous-bundle-sha256>
```

The source verifies the previous package checksum and roster before preserving
its PINs. Normal generation also makes exactly 12-character passwords. Legacy
packages remain readable for evidence; do not edit an existing bundle in place.
A host which already imported the earlier six-digit package can import this
replacement without changing its PIN hashes or operator versions. A host still
using its original PINs imports the same replacement directly to synchronize
both passwords and PINs. Existing application password acceptance remains
12–128 characters; this adjustment fixes the shared package's credential length,
not the public password-entry contract.
