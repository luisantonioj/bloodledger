// PA-REQ-01..05 (Accepted 2026-10-20; SYNTHETIC_REQUEST_DETAIL_V1): requester details, pickup references, notes,
// supporting documents and supplier choice. Synthetic values only.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { buildApp } from "../src/app.js";
import { interviewCorePayload } from "../src/fabric.js";
import { InMemoryV2CommandStore } from "../src/v2-command.js";
import type { CredentialRecord } from "../src/session.js";
import { InMemoryRequestDetailStore, operatorBoundPayload } from "../src/request-details.js";
import { MemoryRepository } from "./test-support.js";

const origin = "http://127.0.0.1:5174";
const now = "2026-10-20T02:00:00.000Z";
const supplier: CredentialRecord = { userId: "USR_SYNTH_ADMIN", username: "synth_admin", displayName: "Synthetic Hospital Administrator", institutionId: "INST_MEDIATRIX", institutionDisplayName: "Synthetic Mediatrix Verification", institutionCategory: "HOSPITAL", roleId: "ROLE-02", saltHex: "0".repeat(32), verifierHex: "0".repeat(128) };
const requester: CredentialRecord = { ...supplier, userId: "USR_SYNTH_RECIPIENT", username: "synth_recipient", institutionId: "INST_SYNTH_MEDIX", roleId: "ROLE-03" };
const outsider: CredentialRecord = { ...supplier, userId: "USR_SYNTH_OTHER", username: "synth_other", institutionId: "INST_SYNTH_NLVILLA", roleId: "ROLE-03" };
const details = { requestingPerson: "Synthetic Requester A", staffId: "SYN-STAFF-0001", attendingPhysician: "Synthetic Physician B", requiredAt: "2026-10-21T02:00:00.000Z", pickupRepresentative: "Synthetic Courier C", pickupAuthorizationReference: "SYN-AUTH-ABC123", notes: "Synthetic note." };
const pdf = Buffer.from("%PDF-1.4\n% synthetic test document\n");
const pdfDocument = { kind: "REQUEST_FORM", fileName: "request-form.pdf", contentType: "application/pdf", contentSha256: createHash("sha256").update(pdf).digest("hex"), contentBase64: pdf.toString("base64") };
const transfer = (overrides: Record<string, unknown> = {}) => ({ transferId: "TRF_SYNTH_DETAIL", sourceInstitutionId: "INST_MEDIATRIX", destinationInstitutionId: "INST_SYNTH_MEDIX", bloodType: "O_POSITIVE", componentType: "PACKED_RED_BLOOD_CELLS", quantity: 2, urgency: "URGENT", requestTime: now, eventTime: now, correlationId: "CORR_0123456789ABCDEF0123456789ABCDEF", ...overrides });

async function fixture(record: CredentialRecord, requestDetails = new InMemoryRequestDetailStore(), store = new InMemoryV2CommandStore()) {
  const sessions = { async findCredential() { return record; }, async createSession() {}, async restoreSession() { return record; }, async revokeSession() {} };
  const bloodBank = {
    async summary() { return {}; }, async requestHistory() { return []; },
    async networkAvailability() {
      return [
        { institution_id: "INST_MEDIATRIX", display_name: "Mediatrix", blood_type: "O_POSITIVE", component_type: "PACKED_RED_BLOOD_CELLS", available_units: 3 },
        { institution_id: "INST_SYNTH_NLVILLA", display_name: "N.L. Villa", blood_type: "O_POSITIVE", component_type: "PACKED_RED_BLOOD_CELLS", available_units: 12 },
        { institution_id: "INST_SYNTH_MEDIX", display_name: "Medix", blood_type: "O_POSITIVE", component_type: "PACKED_RED_BLOOD_CELLS", available_units: 40 },
        { institution_id: "INST_SYNTH_NLVILLA", display_name: "N.L. Villa", blood_type: "A_POSITIVE", component_type: "PACKED_RED_BLOOD_CELLS", available_units: 9 },
      ];
    },
  };
  const app = await buildApp(new MemoryRepository(), { host: "127.0.0.1", port: 3000, jwtSecret: "request-details-synthetic-".repeat(3), operatorId: "USR_SYNTH_CAPTURE", operatorCredential: "synthetic-test-credential", workerConfigured: false, webOrigin: origin }, () => new Date(now), sessions, undefined, undefined, { store, bloodBank, requestDetails });
  const token = app.jwt.sign({ userId: record.userId, institutionId: record.institutionId, roleId: record.roleId, sessionId: "SESS_SYNTH_DETAIL", binding: "b".repeat(64), policyVersion: "SYNTHETIC_WEB_ACCESS_V1" });
  const headers = (key?: string) => ({ cookie: `bloodledger_session=${token}`, origin, ...(key ? { "idempotency-key": key } : {}) });
  const post = (url: string, key: string, payload: unknown) => app.inject({ method: "POST", url, headers: headers(key), payload: payload as Record<string, unknown> });
  const get = (url: string) => app.inject({ method: "GET", url, headers: headers() });
  return { app, store, requestDetails, post, get };
}

test("PA-REQ-01..04 details and documents persist off-chain and reappear for the requester and supplier only", async () => {
  const shared = new InMemoryRequestDetailStore(); const commands = new InMemoryV2CommandStore();
  const { app, store, post, get } = await fixture(requester, shared, commands);
  try {
    const accepted = await post("/api/v2/transfers", "IDEM_DETAIL_OK", transfer({ details, documents: [pdfDocument] }));
    assert.equal(accepted.statusCode, 202, accepted.body);
    const command = await store.get(accepted.json().commandId, requester.institutionId, requester.userId);
    const ledger = JSON.stringify(interviewCorePayload(command!));
    for (const value of ["Synthetic Requester A", "SYN-STAFF", "SYN-AUTH", "Synthetic note", "request-form"]) assert.equal(ledger.includes(value), false, value);
    const read = await get("/api/v2/transfers/TRF_SYNTH_DETAIL/details");
    assert.equal(read.statusCode, 200, read.body);
    const view = read.json();
    for (const [key, value] of Object.entries(details)) assert.equal(view[key], value, key);
    assert.equal(view.editable, true); assert.equal(view.pickupAuthorityVerified, false);
    assert.deepEqual(view.unavailableFields, [{ field: "patientCaseReference", dependency: "RQ-20" }]);
    assert.equal(view.documents.length, 1);
    const download = await get(`/api/v2/transfers/TRF_SYNTH_DETAIL/documents/${view.documents[0].documentId}`);
    assert.equal(download.statusCode, 200); assert.equal(download.headers["content-type"], "application/pdf"); assert.equal(download.headers["x-content-type-options"], "nosniff");
    assert.deepEqual(download.rawPayload, pdf);
    // Retry with the same key and body: one command, one detail row, one document.
    const replay = await post("/api/v2/transfers", "IDEM_DETAIL_OK", transfer({ details, documents: [pdfDocument] }));
    assert.equal(replay.json().commandId, accepted.json().commandId); assert.equal(replay.json().replayed, true);
    assert.equal(shared.details.size, 1); assert.equal(shared.documents.size, 1);
    // Same transfer ID with different details is a conflict, not an overwrite.
    const conflict = await post("/api/v2/transfers", "IDEM_DETAIL_OTHER", transfer({ details: { ...details, notes: "Different." } }));
    assert.equal(conflict.statusCode, 409); assert.equal(conflict.json().error.code, "IDEMPOTENCY_CONFLICT");
    assert.equal((await get("/api/v2/transfers/TRF_SYNTH_DETAIL/details")).json().notes, "Synthetic note.");
  } finally { await app.close(); }
  const bank = await fixture(supplier, shared, commands);
  try {
    const read = await bank.get("/api/v2/transfers/TRF_SYNTH_DETAIL/details");
    assert.equal(read.statusCode, 200); assert.equal(read.json().viewerRole, "SUPPLIER"); assert.equal(read.json().editable, false);
    assert.equal(read.json().requestingPerson, details.requestingPerson);
    assert.equal((await bank.post("/api/v2/transfers/TRF_SYNTH_DETAIL/details", "IDEM_SUPPLIER_EDIT", { correlationId: "CORR_0123456789ABCDEF0123456789ABCDEF", expectedVersion: 1, details })).statusCode, 403);
  } finally { await bank.app.close(); }
  const other = await fixture(outsider, shared, commands);
  try {
    const denied = await other.get("/api/v2/transfers/TRF_SYNTH_DETAIL/details");
    assert.equal(denied.statusCode, 404); assert.equal(denied.json().error.code, "REQUEST_DETAIL_NOT_FOUND");
    const documentId = [...shared.documents.keys()][0];
    assert.equal((await other.get(`/api/v2/transfers/TRF_SYNTH_DETAIL/documents/${documentId}`)).statusCode, 404);
  } finally { await other.app.close(); }
});

test("PA-REQ-01..04 unsupported, malformed and real-format inputs fail with safe codes", async () => {
  const { app, post, requestDetails } = await fixture(requester);
  try {
    const cases: Array<[Record<string, unknown>, string, string]> = [
      [{ details: { ...details, patientCaseReference: "CASE-1" } }, "REQUEST_DETAIL_INVALID", "patientCaseReference"],
      [{ details: { ...details, requestingPerson: "" } }, "REQUEST_DETAIL_INVALID", "requestingPerson"],
      [{ details: { ...details, staffId: "EMP-12345" } }, "REQUEST_DETAIL_INVALID", "staffId"],
      [{ details: { ...details, pickupAuthorizationReference: "PASSPORT 1" } }, "REQUEST_DETAIL_INVALID", "pickupAuthorizationReference"],
      [{ details: { ...details, requiredAt: "2026-10-19T00:00:00.000Z" } }, "REQUEST_DETAIL_INVALID", "requiredAt"],
      [{ details: { ...details, notes: "x".repeat(501) } }, "REQUEST_DETAIL_INVALID", "notes"],
      [{ details, documents: [{ ...pdfDocument, contentType: "image/png" }] }, "REQUEST_DOCUMENT_REJECTED", "documents[0]"],
      [{ details, documents: [{ ...pdfDocument, contentSha256: "0".repeat(64) }] }, "REQUEST_DOCUMENT_REJECTED", "documents[0]"],
      [{ details, documents: [{ ...pdfDocument, fileName: "request-form.exe" }] }, "REQUEST_DOCUMENT_REJECTED", "documents[0]"],
      [{ details, documents: [pdfDocument, pdfDocument, pdfDocument, pdfDocument] }, "REQUEST_DOCUMENT_REJECTED", "documents[0]"],
    ];
    for (const [index, [extra, code, field]] of cases.entries()) {
      const response = await post("/api/v2/transfers", `IDEM_DETAIL_BAD_${index}`, transfer({ transferId: `TRF_SYNTH_BAD_${index}`, ...extra }));
      assert.equal(response.statusCode, 400, `${index} ${response.body}`);
      assert.equal(response.json().error.code, code, String(index));
      assert.equal(response.json().error.details[0].field, field, String(index));
      assert.equal(response.body.includes("EMP-12345"), false);
    }
    const oversized = Buffer.concat([pdf, Buffer.alloc(5 * 1024 * 1024)]);
    const big = await post("/api/v2/transfers", "IDEM_DETAIL_BIG", transfer({ transferId: "TRF_SYNTH_BIG", details, documents: [{ ...pdfDocument, contentSha256: createHash("sha256").update(oversized).digest("hex"), contentBase64: oversized.toString("base64") }] }));
    assert.equal(big.statusCode, 400); assert.equal(big.json().error.details[0].rule, "MAX_5_MB");
    assert.equal((await post("/api/v2/transfers", "IDEM_DOCS_ONLY", transfer({ transferId: "TRF_SYNTH_DOCS", documents: [pdfDocument] }))).statusCode, 400);
    assert.equal(requestDetails.details.size, 0);
  } finally { await app.close(); }
});

test("PA-REQ-01..04 requester edits are versioned, retry-safe and locked after the supplier decides", async () => {
  const { app, post, get, requestDetails } = await fixture(requester);
  try {
    assert.equal((await post("/api/v2/transfers", "IDEM_EDIT_BASE", transfer({ details }))).statusCode, 202);
    const edit = { correlationId: "CORR_0123456789ABCDEF0123456789ABCDEF", expectedVersion: 1, details: { ...details, notes: "Edited synthetic note.", pickupRepresentative: null } };
    const first = await post("/api/v2/transfers/TRF_SYNTH_DETAIL/details", "IDEM_EDIT_ONE", edit);
    assert.equal(first.statusCode, 200, first.body); assert.equal(first.json().version, 2); assert.equal(first.json().pickupRepresentative, null);
    assert.equal((await post("/api/v2/transfers/TRF_SYNTH_DETAIL/details", "IDEM_EDIT_ONE", edit)).json().version, 2);
    const stale = await post("/api/v2/transfers/TRF_SYNTH_DETAIL/details", "IDEM_EDIT_STALE", edit);
    assert.equal(stale.statusCode, 409); assert.equal(stale.json().error.code, "STALE_STATE");
    assert.equal((await get("/api/v2/transfers/TRF_SYNTH_DETAIL/details")).json().notes, "Edited synthetic note.");
    const added = await post("/api/v2/transfers/TRF_SYNTH_DETAIL/documents", "IDEM_DOC_ADD", { correlationId: edit.correlationId, documents: [pdfDocument] });
    assert.equal(added.statusCode, 200, added.body); assert.equal(added.json().documents.length, 1);
    const documentId = added.json().documents[0].documentId;
    const removed = await post(`/api/v2/transfers/TRF_SYNTH_DETAIL/documents/${documentId}/delete`, "IDEM_DOC_DEL", { correlationId: edit.correlationId });
    assert.equal(removed.json().documents.length, 0);
    assert.equal((await get(`/api/v2/transfers/TRF_SYNTH_DETAIL/documents/${documentId}`)).statusCode, 404);
    requestDetails.locked.add("TRF_SYNTH_DETAIL");
    const locked = await post("/api/v2/transfers/TRF_SYNTH_DETAIL/details", "IDEM_EDIT_LOCKED", { ...edit, expectedVersion: 2 });
    assert.equal(locked.statusCode, 409); assert.equal(locked.json().error.code, "REQUEST_DETAIL_LOCKED");
    assert.equal((await get("/api/v2/transfers/TRF_SYNTH_DETAIL/details")).json().editable, false);
  } finally { await app.close(); }
});

test("PA-REQ-05 eligible suppliers exclude the requester and non-matching products and order deterministically", async () => {
  const { app, get } = await fixture(requester);
  try {
    const response = await get("/api/v2/eligible-suppliers?bloodType=O_POSITIVE&componentType=PACKED_RED_BLOOD_CELLS&quantity=5");
    assert.equal(response.statusCode, 200, response.body);
    assert.deepEqual(response.json().suppliers, [
      { institutionId: "INST_SYNTH_NLVILLA", displayName: "N.L. Villa", availabilityBand: "10_OR_MORE", meetsRequestedQuantity: true },
      { institutionId: "INST_MEDIATRIX", displayName: "Mediatrix", availabilityBand: "1_TO_4", meetsRequestedQuantity: false },
    ]);
    assert.equal(JSON.stringify(response.json()).includes("availableUnits"), false);
    assert.equal((await get("/api/v2/eligible-suppliers?bloodType=O_POSITIVE&componentType=PACKED_RED_BLOOD_CELLS&quantity=0")).statusCode, 400);
  } finally { await app.close(); }
});

test("PA-REQ-03 operator verification binds document metadata and digest without the base64 bytes", () => {
  const bound = operatorBoundPayload({ ...transfer(), details, documents: [pdfDocument] }) as { documents: Record<string, unknown>[] };
  assert.equal("contentBase64" in bound.documents[0]!, false);
  assert.equal(bound.documents[0]!.contentSha256, pdfDocument.contentSha256);
  assert.deepEqual(operatorBoundPayload({ correlationId: "x" }), { correlationId: "x" });
});
