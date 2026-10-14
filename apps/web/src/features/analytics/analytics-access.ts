import { can, type Principal } from "../../auth/permissions";

// FR-14 / FR-12: match the official cookie forecast endpoint.
export function canViewAnalyticsPreview(principal: Principal): boolean {
  return ["ROLE-01", "ROLE-02", "ROLE-03"].includes(principal.roleId);
}

export function analyticsScopeLabel(principal: Principal): string {
  return `${principal.institutionDisplayName} · institution-only preview`;
}

// Regulatory summaries use existing read permissions; hospital forecast access is unchanged.
export function canViewRegulatoryAnalytics(principal: Principal): boolean {
  return principal.roleId === "ROLE-04" && (principal.accountCategory === "PRC" && can(principal,"consortium:read") || principal.accountCategory === "DOH" && can(principal,"reports:read"));
}
export function canViewAnalyticsPage(principal: Principal): boolean {
  return canViewAnalyticsPreview(principal) || canViewRegulatoryAnalytics(principal);
}
