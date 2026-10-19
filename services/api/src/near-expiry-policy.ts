// TC-E01 remediation: SYNTHETIC_NEAR_EXPIRY_V1 (Accepted 2026-10-19). Off-chain advisory lead times only; the ledger is unchanged.
// Red-cell and platelet leads reuse PA-S2-02 (12 h and 6 h); plasma and cryoprecipitate use a 24 h synthetic lead.
// These values are not clinical thresholds. RQ-03 stays open for any clinical or operational interpretation.
export const NEAR_EXPIRY_POLICY_VERSION = "SYNTHETIC_NEAR_EXPIRY_V1" as const;
export const NEAR_EXPIRY_LEAD_HOURS: Readonly<Record<string, number>> = {
  WHOLE_BLOOD: 12, PACKED_RED_BLOOD_CELLS: 12, PLATELETS: 6, FRESH_FROZEN_PLASMA: 24, CRYOPRECIPITATE: 24,
};

/** SQL expression for a component's lead interval; `$n` must be bound to `nearExpiryLeadParameter()`. */
export const nearExpiryLeadSql = (column: string, parameter: string) => `make_interval(hours => COALESCE((${parameter}::jsonb->>${column})::int, 0))`;
export const nearExpiryLeadParameter = () => JSON.stringify(NEAR_EXPIRY_LEAD_HOURS);

export function isNearExpiry(componentType: string, expiresAt: string, now: Date): boolean {
  const lead = NEAR_EXPIRY_LEAD_HOURS[componentType]; const expiry = Date.parse(expiresAt);
  return lead !== undefined && expiry > now.getTime() && expiry - now.getTime() <= lead * 3_600_000;
}
