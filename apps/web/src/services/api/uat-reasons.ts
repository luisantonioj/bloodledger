import { requestJson } from "./client";

export interface ReasonPolicy { policyVersion: string; reasons: { code: string; label: string }[] }
const policies = {
  compromise: { path: "/api/v2/reservations/compromise-reasons", version: "SYNTHETIC_COMPROMISE_REASONS_V1", effect: "QUARANTINE_PENDING_MANUAL_REVIEW", codes: ["TEMPERATURE_EXCURSION_REPORTED", "CONTAINER_DAMAGE_OR_LEAK_REPORTED", "VISIBLE_COMPONENT_ABNORMALITY_REPORTED", "HANDLING_OR_CUSTODY_DEVIATION_REPORTED"] },
  reconciliation: { path: "/api/v2/reconciliation/reasons", version: "SYNTHETIC_RECONCILIATION_REASONS_V1", effect: "RECONCILIATION_HOLD_ONLY", codes: ["LABEL_RECORD_MISMATCH", "POSSIBLE_DUPLICATE", "COMPONENT_TYPE_MISMATCH", "BLOOD_TYPE_MISMATCH", "DATE_MISMATCH", "CUSTODY_MISMATCH", "STATUS_MISMATCH"] },
} as const;
export type ReasonKind = keyof typeof policies;

// PR35 frozen policy: options come exclusively from the authenticated API.
export function parseReasonPolicy(value: unknown, kind: ReasonKind): ReasonPolicy {
  const row = value as Record<string, unknown> | null;
  const expected = policies[kind];
  if (!row || row.policyVersion !== expected.version || row.effect !== expected.effect || row.freeTextAllowed !== false ||
      row.classification !== "SIMULATION_ONLY" || !Array.isArray(row.reasons) || row.reasons.length !== expected.codes.length) throw new Error("The reason policy is unavailable or inconsistent. No action was submitted.");
  const reasons = row.reasons.map((value: unknown) => {
    const item = value as Record<string, unknown> | null;
    if (!item || typeof item.code !== "string" || !(expected.codes as readonly string[]).includes(item.code) || typeof item.label !== "string" || !item.label.trim()) throw new Error("The reason policy is incomplete.");
    return { code: item.code, label: item.label };
  });
  if (new Set(reasons.map(item => item.code)).size !== expected.codes.length) throw new Error("The reason policy contains duplicate options.");
  return { policyVersion: expected.version, reasons };
}
export async function readReasonPolicy(kind: ReasonKind, signal: AbortSignal): Promise<ReasonPolicy> {
  return parseReasonPolicy(await requestJson(policies[kind].path, { signal }, "The reason policy could not be loaded."), kind);
}
