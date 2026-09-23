import type { Principal } from "../../auth/permissions";

export function canViewAnalyticsPreview(principal: Principal): boolean {
  return ["ROLE-01", "ROLE-02"].includes(principal.roleId);
}

export function analyticsScopeLabel(principal: Principal): string {
  return `${principal.institutionDisplayName} · institution-only preview`;
}
