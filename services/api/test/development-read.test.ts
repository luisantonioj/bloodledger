import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { PostgresDevelopmentReader, registerDevelopmentReads } from "../src/development-read.js";
import type { Pool } from "pg";
import type { WebPrincipal } from "../src/session.js";
const principal = { userId: "USR_MEDIATRIX_TECH", institutionId: "INST_MEDIATRIX", roleId: "ROLE-02" } as WebPrincipal;
test("FR-12: historical records deny unrelated institutions and roles before querying", async () => {
  const reader = new PostgresDevelopmentReader({ query: async () => { throw Error("SHOULD_NOT_QUERY"); } } as unknown as Pool);
  for (const value of [{ ...principal, institutionId: "INST_DIVINE_LOVE" }, { ...principal, roleId: "ROLE-03" as const }]) await assert.rejects(reader.read("historical", value), /Historical stock requires/);
});
test("FR-12: operational reads deny regulator before accessing component records", async () => {
  const reader = new PostgresDevelopmentReader({ query: async () => { throw Error("SHOULD_NOT_QUERY"); } } as unknown as Pool);
  for (const roleId of ["ROLE-01", "ROLE-03", "ROLE-04"] as const) await assert.rejects(reader.read("audit", { ...principal, roleId }), /audit-reader role/);
});
test("NFR-01: historical pages validate cursor and bounded limit; restore authentication", async () => {
  const app = Fastify(); let called = 0;
  registerDevelopmentReads(app, { read: async () => { called++; return { classification: "SIMULATION_ONLY" }; }, acknowledge: async () => undefined }, async () => ({ principal }), "http://127.0.0.1:5174");
  const path = "/api/v2/historical-snapshots/HSNAP_" + "A".repeat(40);
  assert.equal((await app.inject(path + "?limit=101")).statusCode, 400);
  assert.equal(called, 0);
  assert.equal((await app.inject(path + "?limit=100")).statusCode, 200);
  assert.equal(called, 1); await app.close();
});
test("FR-12: acknowledgement requires same browser origin", async () => {
  const app = Fastify(); let written = false;
  registerDevelopmentReads(app, { read: async () => ({}), acknowledge: async () => { written = true; } }, async () => ({ principal }), "http://127.0.0.1:5174");
  await app.inject({ method: "POST", url: "/api/v2/alerts/V2EXP_COMP_TEST/acknowledge", headers: { origin: "https://other.invalid" } });
  assert.equal(written, false); await app.close();
});
