import assert from "node:assert/strict";
import test from "node:test";
import { isRoleId, permissionsFor, permits, ROLE_IDS, WEB_ACCESS_POLICY_VERSION } from "../src/web-access.js";

test("SYNTHETIC_WEB_ACCESS_V1 recognizes exactly the six accepted roles", () => {
  assert.equal(WEB_ACCESS_POLICY_VERSION, "SYNTHETIC_WEB_ACCESS_V1");
  assert.deepEqual(ROLE_IDS, ["ROLE-01", "ROLE-02", "ROLE-03", "ROLE-04", "ROLE-05", "ROLE-06"]);
  assert.equal(isRoleId("ROLE-04"), true);
  assert.equal(isRoleId("SYSTEM_ADMIN"), false);
});

test("regulatory viewers are read-only and receive the distinct aggregate composition", () => {
  assert.equal(permits("ROLE-04", "dashboard:regulatory"), true);
  assert.equal(permits("ROLE-04", "reports:read"), true);
  assert.equal(permits("ROLE-04", "inventory:write"), false);
  assert.equal(permits("ROLE-04", "transfers:write"), false);
  assert.equal(permits("ROLE-04", "alerts:acknowledge"), false);
});

test("system and institution account administrators default to non-clinical profile access", () => {
  for (const role of ["ROLE-05", "ROLE-06"] as const) {
    assert.deepEqual(permissionsFor(role), ["profile:read"]);
    assert.equal(permits(role, "inventory:read"), false);
    assert.equal(permits(role, "transfers:write"), false);
  }
});

test("hospital roles share operational composition but retain different authority", () => {
  for (const role of ["ROLE-01", "ROLE-02", "ROLE-03"] as const) {
    assert.equal(permits(role, "dashboard:operational"), true);
    assert.equal(permits(role, "dashboard:regulatory"), false);
  }
  assert.equal(permits("ROLE-01", "inventory:write"), true);
  assert.equal(permits("ROLE-02", "inventory:write"), false);
  assert.equal(permits("ROLE-03", "inventory:read"), false);
});
