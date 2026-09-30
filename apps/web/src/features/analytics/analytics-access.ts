import type { Principal } from "../../auth/permissions";

// FR-14 / FR-12: match the official cookie forecast endpoint.
export function canViewAnalyticsPreview(principal: Principal): boolean {
  return ["ROLE-01", "ROLE-02", "ROLE-03"].includes(principal.roleId);
}

export function analyticsScopeLabel(principal: Principal): string {
  return `${principal.institutionDisplayName} · institution-only preview`;
}
