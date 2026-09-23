export const RECONCILIATION_POLICY_VERSION = "SYNTHETIC_RECONCILIATION_REASONS_V1" as const;

export const RECONCILIATION_REASONS = [
  { code: "LABEL_RECORD_MISMATCH", label: "Label and record do not match" },
  { code: "POSSIBLE_DUPLICATE", label: "Possible duplicate component" },
  { code: "COMPONENT_TYPE_MISMATCH", label: "Component type needs verification" },
  { code: "BLOOD_TYPE_MISMATCH", label: "Blood type needs verification" },
  { code: "DATE_MISMATCH", label: "Collection or expiry date needs verification" },
  { code: "CUSTODY_MISMATCH", label: "Custody or location needs verification" },
  { code: "STATUS_MISMATCH", label: "Recorded status needs verification" },
] as const;

export type ReconciliationReasonCode = (typeof RECONCILIATION_REASONS)[number]["code"];

const reasonCodes = new Set<string>(RECONCILIATION_REASONS.map(({ code }) => code));

export function isReconciliationReasonCode(value: unknown): value is ReconciliationReasonCode {
  return typeof value === "string" && reasonCodes.has(value);
}
