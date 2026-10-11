import { can, type Permission, type Principal } from "../auth/permissions";
import { canViewAnalyticsPreview } from "../features/analytics/analytics-access";

export interface NavigationItem {
  href: string;
  label: string;
  permission?: Permission;
  roles?: Principal["roleId"][];
  badge?: string;
  when?: (principal: Principal) => boolean;
}

export const navigation: NavigationItem[] = [
  { href: "/", label: "Dashboard" },
  { href: "/inventory", label: "Blood Inventory", permission: "inventory:read", when: p => !p.accountId || p.accountCategory === "BLOOD_BANK" },
  { href: "/transactions", label: "Blood Unit Transactions", permission: "inventory:read", when: p => p.accountCategory ? p.accountCategory === "BLOOD_BANK" : ["ROLE-01","ROLE-02"].includes(p.roleId) },
  { href: "/receipts", label: "Blood Unit Receipt", permission: "transfers:read", when: p => p.accountCategory ? p.accountCategory === "REQUESTOR" : p.roleId === "ROLE-03" },
  { href: "/transfers", label: "Requests & Transfers", permission: "transfers:read" },
  { href: "/alerts", label: "Alerts", permission: "alerts:read" },
  { href: "/audit", label: "Activity History", permission: "audit:read" },
  { href: "/analytics", label: "Analytics", when: canViewAnalyticsPreview },
  { href: "/consortium", label: "Network view", permission: "consortium:read" },
  { href: "/reporting", label: "Reports", permission: "reports:read" },
  { href: "/profile", label: "Profile", permission: "profile:read" },
  { href: "/accounts", label: "Staff Accounts", when: p => p.accountId ? p.accountCategory === "PRC" || (p.operators ?? []).some(o => o.capabilityProfile === "INSTITUTION_ADMIN") : ["ROLE-05", "ROLE-06"].includes(p.roleId) },
];

export const visibleNavigation = (principal: Principal) =>
  navigation.filter((item) => (!item.permission || can(principal, item.permission)) && (!item.roles || item.roles.includes(principal.roleId)) && (!item.when || item.when(principal)));
