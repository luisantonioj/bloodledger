import { ApiFailure } from "./errors.js";

// PA-REV-01 (Proposed): a supplier may approve fewer units than requested with a coded, non-PHI reason.
export const PARTIAL_APPROVAL_POLICY_VERSION = "SYNTHETIC_PARTIAL_APPROVAL_REASONS_V1" as const;
export const PARTIAL_APPROVAL_REASON_CODES = ["INSUFFICIENT_ELIGIBLE_STOCK", "LOCAL_RESERVE_PROTECTED", "OTHER_OPERATIONAL"] as const;

export interface ApprovalQuantity { requestedQuantity: number; approvedQuantity: number; partialReasonCode: string | null }

// Without approvedQuantity the full requested quantity is approved, as before PA-REV-01.
export function approvalQuantity(body: Record<string, unknown>, requestedQuantity: number): ApprovalQuantity {
  if (!("approvedQuantity" in body)) return { requestedQuantity, approvedQuantity: requestedQuantity, partialReasonCode: null };
  const invalid = (message: string) => new ApiFailure(400, "PARTIAL_APPROVAL_INVALID", message);
  const approved = body.approvedQuantity, reason = body.partialReasonCode;
  if (!Number.isSafeInteger(approved) || Number(approved) < 1 || Number(approved) > requestedQuantity) throw invalid("Approved quantity must be between 1 and the requested quantity.");
  if (Number(approved) === requestedQuantity) {
    if (reason !== null) throw invalid("A full approval takes no partial-approval reason.");
    return { requestedQuantity, approvedQuantity: requestedQuantity, partialReasonCode: null };
  }
  if (typeof reason !== "string" || !(PARTIAL_APPROVAL_REASON_CODES as readonly string[]).includes(reason)) throw invalid("A partial approval needs a supported reason.");
  return { requestedQuantity, approvedQuantity: Number(approved), partialReasonCode: reason };
}
