import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import type { Pool } from "pg";
import { ApiFailure } from "./errors.js";
import { sha256 } from "./hash.js";
import { BANK_INSTITUTION_IDS } from "./institution-access.js";

// PA-REQ-01..05 (Accepted 2026-10-20; SIMULATION_ONLY, SYNTHETIC_REQUEST_DETAIL_V1). Requester details, pickup
// references, notes and supporting documents live off-chain beside the request; the ledger payload is unchanged.
// Patient/case reference is deliberately absent (RQ-20).
export const REQUEST_DETAIL_POLICY_VERSION = "SYNTHETIC_REQUEST_DETAIL_V1";
export const DOCUMENT_KINDS = ["REQUEST_FORM", "PICKUP_AUTHORIZATION"] as const;
export const DOCUMENT_TYPES = ["application/pdf", "image/png", "image/jpeg"] as const;
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const MAX_DOCUMENTS_PER_REQUEST = 3;
export const DOCUMENT_ID_PATTERN = /^DOC_[0-9A-F]{40}$/;
/** JSON transport for up to three base64 documents plus the request fields. */
export const REQUEST_UPLOAD_BODY_LIMIT = 22 * 1024 * 1024;
const DETAIL_KEYS = ["attendingPhysician", "notes", "pickupAuthorizationReference", "pickupRepresentative", "requestingPerson", "requiredAt", "staffId"] as const;
const DOCUMENT_KEYS = ["contentBase64", "contentSha256", "contentType", "fileName", "kind"];

export interface RequestDetailInput {
  requestingPerson: string;
  staffId: string | null;
  attendingPhysician: string | null;
  requiredAt: string;
  pickupRepresentative: string | null;
  pickupAuthorizationReference: string | null;
  notes: string | null;
}
export interface RequestDocumentInput { kind: (typeof DOCUMENT_KINDS)[number]; fileName: string; contentType: (typeof DOCUMENT_TYPES)[number]; contentSha256: string; content: Buffer }
export interface RequestDocumentView { documentId: string; kind: string; displayName: string; contentType: string; sizeBytes: number; contentSha256: string; uploadedAt: string }
export interface RequestDetailRecord extends RequestDetailInput {
  transferId: string; sourceInstitutionId: string; destinationInstitutionId: string; version: number; detailSha256: string;
  lastIdempotencyKey: string; createdAt: string; updatedAt: string;
}
export interface RequestDetailStore {
  get(transferId: string): Promise<RequestDetailRecord | null>;
  /** Inserts once; an identical retry is a no-op and a different digest is reported as a conflict. */
  create(record: Omit<RequestDetailRecord, "version" | "createdAt" | "updatedAt">, now: Date): Promise<"CREATED" | "REPLAYED" | "CONFLICT">;
  update(transferId: string, expectedVersion: number, details: RequestDetailInput, detailSha256: string, idempotencyKey: string, now: Date): Promise<RequestDetailRecord | "STALE">;
  /** True while the supplier has not decided: queued (no projection yet) or PENDING without a reservation. */
  editable(transferId: string): Promise<boolean>;
  listDocuments(transferId: string): Promise<RequestDocumentView[]>;
  addDocument(transferId: string, documentId: string, document: RequestDocumentInput, actorUserId: string, now: Date): Promise<"ADDED" | "REPLAYED" | "LIMIT">;
  readDocument(transferId: string, documentId: string): Promise<{ view: RequestDocumentView; content: Buffer } | null>;
  deleteDocument(transferId: string, documentId: string, now: Date): Promise<boolean>;
}

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
function invalid(field: string, rule: string): never { throw new ApiFailure(400, "REQUEST_DETAIL_INVALID", "The request details are invalid.", [{ field, rule }]); }
function name(value: unknown, field: string, required: boolean): string | null {
  if (value === null || value === undefined || value === "") { if (required) invalid(field, "REQUIRED"); return null; }
  if (typeof value !== "string") invalid(field, "TYPE");
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 80 || CONTROL.test(trimmed) || /[\r\n]/.test(trimmed)) invalid(field, "LENGTH_2_80");
  return trimmed;
}
function pattern(value: unknown, field: string, expected: RegExp): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !expected.test(value)) invalid(field, "SYNTHETIC_FORMAT");
  return value;
}

export function validateRequestDetails(body: unknown, now: Date): RequestDetailInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) invalid("details", "OBJECT");
  const value = body as Record<string, unknown>;
  const unknownKey = Object.keys(value).find(key => !(DETAIL_KEYS as readonly string[]).includes(key));
  if (unknownKey) invalid(unknownKey, "NOT_SUPPORTED");
  const requiredAt = value.requiredAt;
  if (typeof requiredAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(requiredAt) || new Date(requiredAt).toISOString() !== requiredAt) invalid("requiredAt", "UTC_TIMESTAMP");
  if (Date.parse(requiredAt) <= now.getTime()) invalid("requiredAt", "FUTURE");
  let notes: string | null = null;
  if (value.notes !== null && value.notes !== undefined && value.notes !== "") {
    if (typeof value.notes !== "string") invalid("notes", "TYPE");
    notes = value.notes.replace(/\r\n/g, "\n").replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").trim();
    if (notes.length > 500) invalid("notes", "MAX_500");
    if (!notes) notes = null;
  }
  return {
    requestingPerson: name(value.requestingPerson, "requestingPerson", true)!,
    staffId: pattern(value.staffId, "staffId", /^SYN-STAFF-\d{4}$/),
    attendingPhysician: name(value.attendingPhysician, "attendingPhysician", false),
    requiredAt,
    pickupRepresentative: name(value.pickupRepresentative, "pickupRepresentative", false),
    pickupAuthorizationReference: pattern(value.pickupAuthorizationReference, "pickupAuthorizationReference", /^SYN-AUTH-[A-Z0-9]{6}$/),
    notes,
  };
}

function documentRejected(rule: string, index: number): never { throw new ApiFailure(400, "REQUEST_DOCUMENT_REJECTED", "A supporting document was not accepted.", [{ field: `documents[${index}]`, rule }]); }
function magicType(content: Buffer): string | null {
  if (content.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (content.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff) return "image/jpeg";
  return null;
}
const EXTENSIONS: Record<string, readonly string[]> = { "application/pdf": [".pdf"], "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"] };

export function validateRequestDocuments(body: unknown): RequestDocumentInput[] {
  if (body === undefined) return [];
  if (!Array.isArray(body) || body.length > MAX_DOCUMENTS_PER_REQUEST) documentRejected("MAX_3", 0);
  return body.map((item, index) => {
    if (!item || typeof item !== "object" || Object.keys(item).sort().join(",") !== DOCUMENT_KEYS.join(",")) documentRejected("SHAPE", index);
    const value = item as Record<string, unknown>;
    if (!(DOCUMENT_KINDS as readonly unknown[]).includes(value.kind)) documentRejected("KIND", index);
    if (!(DOCUMENT_TYPES as readonly unknown[]).includes(value.contentType)) documentRejected("TYPE", index);
    if (typeof value.fileName !== "string" || typeof value.contentBase64 !== "string" || typeof value.contentSha256 !== "string" || !/^[0-9a-f]{64}$/.test(value.contentSha256)) documentRejected("SHAPE", index);
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value.contentBase64) || value.contentBase64.length > Math.ceil(MAX_DOCUMENT_BYTES / 3) * 4) documentRejected("MAX_5_MB", index);
    const content = Buffer.from(value.contentBase64, "base64");
    if (content.length === 0) documentRejected("EMPTY", index);
    if (content.length > MAX_DOCUMENT_BYTES) documentRejected("MAX_5_MB", index);
    if (createHash("sha256").update(content).digest("hex") !== value.contentSha256) documentRejected("DIGEST_MISMATCH", index);
    const contentType = value.contentType as RequestDocumentInput["contentType"];
    if (magicType(content) !== contentType) documentRejected("CONTENT_DOES_NOT_MATCH_TYPE", index);
    const displayName = value.fileName.normalize("NFKC").replace(/[^A-Za-z0-9 ._()-]/g, "_").replace(/^[.\s]+/, "").slice(-80);
    if (!displayName || !EXTENSIONS[contentType]!.some(extension => displayName.toLowerCase().endsWith(extension))) documentRejected("EXTENSION", index);
    return { kind: value.kind as RequestDocumentInput["kind"], fileName: displayName, contentType, contentSha256: value.contentSha256, content };
  });
}

/** Operator verification binds document metadata and digest, not the base64 bytes (the route rechecks the digest). */
export function operatorBoundPayload(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body) || !Array.isArray((body as { documents?: unknown }).documents)) return body;
  const value = body as Record<string, unknown> & { documents: unknown[] };
  return { ...value, documents: value.documents.map(item => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).filter(([key]) => key !== "contentBase64")) : item) };
}

export function detailDigest(details: RequestDetailInput, documents: readonly RequestDocumentInput[] = []): string {
  return sha256({ details, documents: documents.map(({ kind, fileName, contentType, contentSha256 }) => ({ kind, fileName, contentType, contentSha256 })), policyVersion: REQUEST_DETAIL_POLICY_VERSION });
}
export function documentId(transferId: string, document: RequestDocumentInput): string {
  return "DOC_" + sha256({ transferId, kind: document.kind, contentSha256: document.contentSha256 }).slice(0, 40).toUpperCase();
}
export function isRequestSupplier(institutionId: string): boolean { return BANK_INSTITUTION_IDS.includes(institutionId); }

export function detailView(record: RequestDetailRecord, documents: readonly RequestDocumentView[], editable: boolean, viewerInstitutionId: string) {
  const { lastIdempotencyKey: _key, detailSha256: _digest, ...rest } = record;
  return {
    ...rest, documents, editable: editable && viewerInstitutionId === record.destinationInstitutionId,
    viewerRole: viewerInstitutionId === record.destinationInstitutionId ? "REQUESTER" as const : "SUPPLIER" as const,
    unavailableFields: [{ field: "patientCaseReference", dependency: "RQ-20" }],
    pickupAuthorityVerified: false as const,
    policyVersion: REQUEST_DETAIL_POLICY_VERSION, classification: "SIMULATION_ONLY" as const,
  };
}

function iso(value: unknown): string { return new Date(String(value)).toISOString(); }
function row(value: Record<string, unknown>): RequestDetailRecord {
  return {
    transferId: String(value.transfer_id), sourceInstitutionId: String(value.source_institution_id), destinationInstitutionId: String(value.destination_institution_id),
    requestingPerson: String(value.requesting_person), staffId: (value.staff_id as string | null) ?? null, attendingPhysician: (value.attending_physician as string | null) ?? null,
    requiredAt: iso(value.required_at), pickupRepresentative: (value.pickup_representative as string | null) ?? null, pickupAuthorizationReference: (value.pickup_authorization_reference as string | null) ?? null,
    notes: (value.notes as string | null) ?? null, version: Number(value.version), detailSha256: String(value.detail_sha256), lastIdempotencyKey: String(value.last_idempotency_key),
    createdAt: iso(value.created_at), updatedAt: iso(value.updated_at),
  };
}
function documentRow(value: Record<string, unknown>): RequestDocumentView {
  return { documentId: String(value.document_id), kind: String(value.kind), displayName: String(value.display_name), contentType: String(value.content_type), sizeBytes: Number(value.size_bytes), contentSha256: String(value.content_sha256), uploadedAt: iso(value.uploaded_at) };
}

/** Files live under a project-owned directory, named only by their server-generated document ID. */
export class PostgresRequestDetailStore implements RequestDetailStore {
  constructor(private readonly pool: Pool, private readonly directory: string) {}
  private file(documentId: string): string {
    if (!DOCUMENT_ID_PATTERN.test(documentId)) throw new ApiFailure(400, "REQUEST_DOCUMENT_ID_INVALID", "Document ID is invalid.");
    return path.join(this.directory, documentId);
  }
  async get(transferId: string) {
    const result = await this.pool.query<Record<string, unknown>>("SELECT * FROM app.v2_request_details WHERE transfer_id=$1", [transferId]);
    return result.rows[0] ? row(result.rows[0]) : null;
  }
  async create(record: Omit<RequestDetailRecord, "version" | "createdAt" | "updatedAt">, now: Date) {
    const inserted = await this.pool.query(`INSERT INTO app.v2_request_details(transfer_id,source_institution_id,destination_institution_id,requesting_person,staff_id,attending_physician,required_at,pickup_representative,pickup_authorization_reference,notes,version,detail_sha256,last_idempotency_key,policy_version,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1,$11,$12,$13,$14,$14) ON CONFLICT(transfer_id) DO NOTHING`, [record.transferId, record.sourceInstitutionId, record.destinationInstitutionId, record.requestingPerson, record.staffId, record.attendingPhysician, record.requiredAt, record.pickupRepresentative, record.pickupAuthorizationReference, record.notes, record.detailSha256, record.lastIdempotencyKey, REQUEST_DETAIL_POLICY_VERSION, now]);
    if (inserted.rowCount === 1) return "CREATED" as const;
    const existing = await this.get(record.transferId);
    return existing && existing.lastIdempotencyKey === record.lastIdempotencyKey && existing.version === 1 && existing.detailSha256 === record.detailSha256 ? "REPLAYED" as const : "CONFLICT" as const;
  }
  async update(transferId: string, expectedVersion: number, details: RequestDetailInput, detailSha256: string, idempotencyKey: string, now: Date) {
    const result = await this.pool.query<Record<string, unknown>>(`UPDATE app.v2_request_details SET requesting_person=$3,staff_id=$4,attending_physician=$5,required_at=$6,pickup_representative=$7,pickup_authorization_reference=$8,notes=$9,detail_sha256=$10,last_idempotency_key=$11,version=version+1,updated_at=$12
      WHERE transfer_id=$1 AND version=$2 RETURNING *`, [transferId, expectedVersion, details.requestingPerson, details.staffId, details.attendingPhysician, details.requiredAt, details.pickupRepresentative, details.pickupAuthorizationReference, details.notes, detailSha256, idempotencyKey, now]);
    if (result.rows[0]) return row(result.rows[0]);
    const existing = await this.get(transferId);
    return existing && existing.lastIdempotencyKey === idempotencyKey && existing.detailSha256 === detailSha256 ? existing : "STALE" as const;
  }
  async editable(transferId: string) {
    const result = await this.pool.query<{ status: string; reserved: boolean }>("SELECT t.status,EXISTS(SELECT 1 FROM app.v2_reservations r WHERE r.transfer_id=t.transfer_id) AS reserved FROM app.v2_transfer_requests t WHERE t.transfer_id=$1", [transferId]);
    const current = result.rows[0];
    return !current || (current.status === "PENDING" && !current.reserved);
  }
  async listDocuments(transferId: string) {
    const result = await this.pool.query<Record<string, unknown>>("SELECT * FROM app.v2_request_documents WHERE transfer_id=$1 AND deleted_at IS NULL ORDER BY uploaded_at,document_id", [transferId]);
    return result.rows.map(documentRow);
  }
  async addDocument(transferId: string, id: string, document: RequestDocumentInput, actorUserId: string, now: Date) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT 1 FROM app.v2_request_details WHERE transfer_id=$1 FOR UPDATE", [transferId]);
      const existing = await client.query<{ deleted_at: unknown }>("SELECT deleted_at FROM app.v2_request_documents WHERE document_id=$1", [id]);
      if (existing.rows[0] && existing.rows[0].deleted_at === null) { await client.query("ROLLBACK"); return "REPLAYED" as const; }
      const count = await client.query<{ count: number }>("SELECT count(*)::int AS count FROM app.v2_request_documents WHERE transfer_id=$1 AND deleted_at IS NULL", [transferId]);
      if (count.rows[0]!.count >= MAX_DOCUMENTS_PER_REQUEST) { await client.query("ROLLBACK"); return "LIMIT" as const; }
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      await writeFile(this.file(id), document.content, { mode: 0o600 });
      await client.query(`INSERT INTO app.v2_request_documents(document_id,transfer_id,kind,display_name,content_type,size_bytes,content_sha256,uploaded_by,uploaded_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT(document_id) DO UPDATE SET deleted_at=NULL,uploaded_at=EXCLUDED.uploaded_at,uploaded_by=EXCLUDED.uploaded_by,display_name=EXCLUDED.display_name`, [id, transferId, document.kind, document.fileName, document.contentType, document.content.length, document.contentSha256, actorUserId, now]);
      await client.query("COMMIT");
      return "ADDED" as const;
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }
  async readDocument(transferId: string, id: string) {
    const result = await this.pool.query<Record<string, unknown>>("SELECT * FROM app.v2_request_documents WHERE transfer_id=$1 AND document_id=$2 AND deleted_at IS NULL", [transferId, id]);
    if (!result.rows[0]) return null;
    const view = documentRow(result.rows[0]);
    try { return { view, content: await readFile(this.file(id)) }; } catch { return null; }
  }
  async deleteDocument(transferId: string, id: string, now: Date) {
    const result = await this.pool.query("UPDATE app.v2_request_documents SET deleted_at=$3 WHERE transfer_id=$1 AND document_id=$2 AND deleted_at IS NULL", [transferId, id, now]);
    if (!result.rowCount) return false;
    await rm(this.file(id), { force: true });
    return true;
  }
}

/** Test and disposable-host store; same semantics without PostgreSQL or files. */
export class InMemoryRequestDetailStore implements RequestDetailStore {
  details = new Map<string, RequestDetailRecord>();
  documents = new Map<string, { transferId: string; view: RequestDocumentView; content: Buffer; deleted: boolean }>();
  locked = new Set<string>();
  async get(transferId: string) { const value = this.details.get(transferId); return value ? { ...value } : null; }
  async create(record: Omit<RequestDetailRecord, "version" | "createdAt" | "updatedAt">, now: Date) {
    const existing = this.details.get(record.transferId);
    if (!existing) { this.details.set(record.transferId, { ...record, version: 1, createdAt: now.toISOString(), updatedAt: now.toISOString() }); return "CREATED" as const; }
    return existing.lastIdempotencyKey === record.lastIdempotencyKey && existing.version === 1 && existing.detailSha256 === record.detailSha256 ? "REPLAYED" as const : "CONFLICT" as const;
  }
  async update(transferId: string, expectedVersion: number, details: RequestDetailInput, detailSha256: string, idempotencyKey: string, now: Date) {
    const existing = this.details.get(transferId);
    if (!existing) return "STALE" as const;
    if (existing.version !== expectedVersion) return existing.lastIdempotencyKey === idempotencyKey && existing.detailSha256 === detailSha256 ? { ...existing } : "STALE" as const;
    const next = { ...existing, ...details, detailSha256, lastIdempotencyKey: idempotencyKey, version: existing.version + 1, updatedAt: now.toISOString() };
    this.details.set(transferId, next);
    return { ...next };
  }
  async editable(transferId: string) { return !this.locked.has(transferId); }
  async listDocuments(transferId: string) { return [...this.documents.values()].filter(item => item.transferId === transferId && !item.deleted).map(item => item.view); }
  async addDocument(transferId: string, id: string, document: RequestDocumentInput, _actorUserId: string, now: Date) {
    const existing = this.documents.get(id);
    if (existing && !existing.deleted) return "REPLAYED" as const;
    if ((await this.listDocuments(transferId)).length >= MAX_DOCUMENTS_PER_REQUEST) return "LIMIT" as const;
    this.documents.set(id, { transferId, deleted: false, content: document.content, view: { documentId: id, kind: document.kind, displayName: document.fileName, contentType: document.contentType, sizeBytes: document.content.length, contentSha256: document.contentSha256, uploadedAt: now.toISOString() } });
    return "ADDED" as const;
  }
  async readDocument(transferId: string, id: string) {
    const value = this.documents.get(id);
    return value && value.transferId === transferId && !value.deleted ? { view: value.view, content: value.content } : null;
  }
  async deleteDocument(transferId: string, id: string) {
    const value = this.documents.get(id);
    if (!value || value.transferId !== transferId || value.deleted) return false;
    value.deleted = true;
    return true;
  }
}
