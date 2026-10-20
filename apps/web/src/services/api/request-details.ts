import { requestJson } from "./client";
import type { MutationKeys } from "./mutation-keys";
export { operatorBoundPayload } from "./operator-payload";

// PA-REQ-01..05 (Accepted 2026-10-20; SYNTHETIC_REQUEST_DETAIL_V1). Synthetic values only.
export const DOCUMENT_KINDS = ["REQUEST_FORM", "PICKUP_AUTHORIZATION"] as const;
export type RequestDocumentKind = (typeof DOCUMENT_KINDS)[number];
export const DOCUMENT_ACCEPT = "application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg";
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const MAX_DOCUMENTS = 3;
export const STAFF_ID_PATTERN = "SYN-STAFF-[0-9]{4}";
export const AUTHORIZATION_PATTERN = "SYN-AUTH-[A-Z0-9]{6}";

export interface RequestDetailInput {
  requestingPerson: string;
  staffId: string | null;
  attendingPhysician: string | null;
  requiredAt: string;
  pickupRepresentative: string | null;
  pickupAuthorizationReference: string | null;
  notes: string | null;
}
export interface RequestDocumentUpload { kind: RequestDocumentKind; fileName: string; contentType: string; contentSha256: string; contentBase64: string }
export interface RequestDocumentView { documentId: string; kind: RequestDocumentKind; displayName: string; contentType: string; sizeBytes: number; uploadedAt: string }
export interface RequestDetailView extends RequestDetailInput {
  transferId: string; sourceInstitutionId: string; destinationInstitutionId: string; version: number; updatedAt: string;
  documents: RequestDocumentView[]; editable: boolean; viewerRole: "REQUESTER" | "SUPPLIER"; pickupAuthorityVerified: false;
  unavailableFields: Array<{ field: string; dependency: string }>;
}
export interface EligibleSupplier { institutionId: string; displayName: string; availabilityBand: "1_TO_4" | "5_TO_9" | "10_OR_MORE"; meetsRequestedQuantity: boolean }
export interface EligibleSuppliers { suppliers: EligibleSupplier[]; readAt: string }

export const AVAILABILITY_BAND_LABEL: Record<EligibleSupplier["availabilityBand"], string> = { "1_TO_4": "1–4 available", "5_TO_9": "5–9 available", "10_OR_MORE": "10+ available" };
export const DOCUMENT_KIND_LABEL: Record<RequestDocumentKind, string> = { REQUEST_FORM: "Standard Blood Request Form", PICKUP_AUTHORIZATION: "Pickup Authorization / Valid ID" };

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}
function contentTypeFor(file: File): string | undefined {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return undefined;
}

/** Reads a selected file into an upload; rejects size and type locally before any request (the server rechecks). */
export async function readDocumentFile(kind: RequestDocumentKind, file: File): Promise<RequestDocumentUpload> {
  const contentType = contentTypeFor(file);
  if (!contentType) throw new Error("Choose a PDF, PNG or JPEG file.");
  if (file.size === 0) throw new Error("The selected file is empty.");
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error("Each document must be 5 MB or smaller.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return { kind, fileName: file.name, contentType, contentSha256: Array.from(digest, value => value.toString(16).padStart(2, "0")).join(""), contentBase64: base64(bytes) };
}

export function readEligibleSuppliers(bloodType: string, componentType: string, quantity: number): Promise<EligibleSuppliers> {
  const query = new URLSearchParams({ bloodType, componentType, quantity: String(quantity) });
  return requestJson(`/api/v2/eligible-suppliers?${query}`, {}, "Supplying blood banks could not be loaded.");
}
export function requestDetailPath(transferId: string): string { return `/api/v2/transfers/${encodeURIComponent(transferId)}/details`; }
export function requestDocumentPath(transferId: string, documentId: string): string { return `/api/v2/transfers/${encodeURIComponent(transferId)}/documents/${encodeURIComponent(documentId)}`; }
export function readRequestDetails(transferId: string): Promise<RequestDetailView> {
  return requestJson(requestDetailPath(transferId), {}, "Request details could not be loaded.");
}
function post<T>(path: string, keys: MutationKeys, body: object, fallback: string): Promise<T> {
  return requestJson(path, { method: "POST", headers: { "Idempotency-Key": keys.idempotencyKey }, body: JSON.stringify({ ...body, correlationId: keys.correlationId }) }, fallback);
}
export function updateRequestDetails(transferId: string, expectedVersion: number, details: RequestDetailInput, keys: MutationKeys): Promise<RequestDetailView> {
  return post(requestDetailPath(transferId), keys, { expectedVersion, details }, "Request details were not saved.");
}
export function uploadRequestDocuments(transferId: string, documents: RequestDocumentUpload[], keys: MutationKeys): Promise<RequestDetailView> {
  return post(`/api/v2/transfers/${encodeURIComponent(transferId)}/documents`, keys, { documents }, "The document was not uploaded.");
}
export function deleteRequestDocument(transferId: string, documentId: string, keys: MutationKeys): Promise<RequestDetailView> {
  return post(`${requestDocumentPath(transferId, documentId)}/delete`, keys, {}, "The document was not removed.");
}

/** datetime-local value (Asia/Manila wall time) ⇄ UTC instant. Manila has no DST, so a fixed +08:00 offset is exact. */
export function manilaLocalToUtc(value: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}:00.000+08:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}
export function utcToManilaLocal(value: string): string {
  return new Date(Date.parse(value) + 8 * 3_600_000).toISOString().slice(0, 16);
}
