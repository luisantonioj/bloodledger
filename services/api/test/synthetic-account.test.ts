import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import type { Pool } from "pg";
import { provisionSyntheticAccount, type SyntheticAccountInput } from "../src/synthetic-account.js";

const baseInput: SyntheticAccountInput = {
  institutionId: "INST_SYNTH_TEST",
  institutionDisplayName: "Synthetic Hospital Test",
  institutionCategory: "HOSPITAL",
  userId: "USR_SYNTH_TEST",
  username: "synth_account_test",
  userDisplayName: "Synthetic Account Test",
  roleId: "ROLE-03",
  password: randomBytes(24).toString("base64url"),
};

test("SYNTHETIC_WEB_ACCESS_V1 provisioning rejects incompatible role and institution scope before persistence", async () => {
  const unavailablePool = null as unknown as Pool;
  await assert.rejects(
    provisionSyntheticAccount(unavailablePool, { ...baseInput, roleId: "ROLE-01" }),
    /role and institution scope are incompatible/,
  );
  await assert.rejects(
    provisionSyntheticAccount(unavailablePool, { ...baseInput, roleId: "ROLE-04" }),
    /role and institution scope are incompatible/,
  );
  await assert.rejects(
    provisionSyntheticAccount(unavailablePool, { ...baseInput, roleId: "ROLE-05" }),
    /role and institution scope are incompatible/,
  );
});
