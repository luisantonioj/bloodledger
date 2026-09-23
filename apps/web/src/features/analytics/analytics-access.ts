import type { Principal } from "../../auth/permissions";

const prcPattern = /(?:^|[_\s-])PRC(?:$|[_\s-])|RED\s+CROSS/i;

export function canViewAnalyticsPreview(principal: Principal): boolean {
  if (["ROLE-01", "ROLE-02"].includes(principal.roleId)) return true;
  if (principal.roleId !== "ROLE-04") return false;
  return prcPattern.test(principal.institutionId) || prcPattern.test(principal.institutionDisplayName);
}

export function analyticsScopeLabel(principal: Principal): string {
  return principal.roleId === "ROLE-04"
    ? "PRC-authorized consortium aggregate preview"
    : `${principal.institutionDisplayName} · institution-only preview`;
}
