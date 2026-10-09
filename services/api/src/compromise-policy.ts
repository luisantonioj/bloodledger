export const COMPROMISE_POLICY_VERSION = "SYNTHETIC_COMPROMISE_REASONS_V1" as const;

export const COMPROMISE_REASONS = [
  { code: "TEMPERATURE_EXCURSION_REPORTED", label: "Temperature concern reported" },
  { code: "CONTAINER_DAMAGE_OR_LEAK_REPORTED", label: "Container damage or leakage reported" },
  { code: "VISIBLE_COMPONENT_ABNORMALITY_REPORTED", label: "Visible component concern reported" },
  { code: "HANDLING_OR_CUSTODY_DEVIATION_REPORTED", label: "Handling or custody deviation reported" },
] as const;

const codes = new Set<string>(COMPROMISE_REASONS.map(({ code }) => code));

export function isCompromiseReasonCode(value: unknown): boolean {
  return typeof value === "string" && codes.has(value);
}
