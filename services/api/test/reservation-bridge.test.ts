import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerV2Routes } from "../src/v2-routes.js";
import { InMemoryV2CommandStore } from "../src/v2-command.js";
import type { WebPrincipal } from "../src/session.js";
let principal = { userId: "USR_MEDIATRIX_TECH", institutionId: "INST_MEDIATRIX", roleId: "ROLE-02" } as WebPrincipal;
test("FR-05/12: canonical reservation bridge validates role, source request, selection and V2.1 before durable enqueue", async () => {
  const app = Fastify(); const store = new InMemoryV2CommandStore();
  registerV2Routes(app, { store, clock: () => new Date("2026-10-07T00:00:00.000Z"), webOrigin: "http://127.0.0.1:5174", restore: async () => ({ principal }), projection: { listComponents: async () => [], getComponent: async () => null, findComponentByIdentity: async () => null, getTransferRequest: async (_id, institution) => institution === "INST_MEDIATRIX" ? { status: "PENDING", destination_institution_id: "INST_DIVINE_LOVE", blood_type: "A_POSITIVE", component_type: "CRYOPRECIPITATE", quantity: 1 } : null } });
  const body = { correlationId: "CORR_" + "A".repeat(32), eventTime: "2026-10-07T00:00:00.000Z", transferId: "TRF_TEST", reservationId: "RES_TEST", selectedComponentIds: ["COMP_TEST"], expectedComponentVersions: [1] };
  const headers = { origin: "http://127.0.0.1:5174", "idempotency-key": "IDEM_RESERVATION_TEST", "x-bloodledger-contract-version": "V2.1" };
  try {
    principal = { ...principal, roleId: "ROLE-03", institutionId: "INST_DIVINE_LOVE" };
    assert.equal((await app.inject({ method: "POST", url: "/api/v2/reservations", headers, payload: body })).statusCode, 403);
    principal = { ...principal, roleId: "ROLE-02", institutionId: "INST_MEDIATRIX" };
    assert.equal((await app.inject({ method: "POST", url: "/api/v2/reservations", headers: { ...headers, "x-bloodledger-contract-version": "V2" }, payload: body })).statusCode, 409);
    assert.equal((await app.inject({ method: "POST", url: "/api/v2/reservations", headers, payload: { ...body, expectedComponentVersions: [0] } })).statusCode, 400);
    const first = await app.inject({ method: "POST", url: "/api/v2/reservations", headers, payload: body }); assert.equal(first.statusCode, 202);
    const replay = await app.inject({ method: "POST", url: "/api/v2/reservations", headers, payload: body }); assert.equal(replay.json().replayed, true);
    const command = await store.get(first.json().commandId, principal.institutionId, principal.userId);
    assert.equal(command?.operation, "RESERVE_COMPONENTS"); assert.equal(command?.ledgerTransactionId, null); assert.equal(command?.payload.transferId, body.transferId);
    assert.equal((await app.inject({ method: "POST", url: "/api/v2/transfers/TRF_TEST/approve", headers, payload: {} })).statusCode, 410);
  } finally { await app.close(); }
});
