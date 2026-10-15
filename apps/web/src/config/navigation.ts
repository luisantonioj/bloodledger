import { canReadPrcSupply } from "../services/api/prc-supply";
import { can, type Permission, type Principal } from "../auth/permissions";
import { canViewAnalyticsPage } from "../features/analytics/analytics-access";

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
  { href: "/prc-supply", label: "PRC Supply Requests", when: p => canReadPrcSupply(p) && (p.accountCategory === "PRC" || !can(p, "transfers:read")) },
  { href: "/alerts", label: "Alerts", permission: "alerts:read" },
  { href: "/audit", label: "Activity History", when: p => can(p,"audit:read") || (p.accountCategory === "REQUESTOR" || !p.accountCategory && p.roleId === "ROLE-03") && can(p,"transfers:read") },
  { href: "/analytics", label: "Analytics", when: canViewAnalyticsPage },
  { href: "/consortium", label: "Network view", permission: "consortium:read", when: p => p.accountCategory !== "PRC" },
  { href: "/reporting", label: "Reports", when: p => p.accountCategory === "BLOOD_BANK" || can(p, "reports:read") },
  { href: "/profile", label: "Profile", permission: "profile:read" },
  { href: "/accounts", label: "Staff Accounts", when: p => p.accountId ? p.accountCategory === "PRC" || (p.operators ?? []).some(o => o.capabilityProfile === "INSTITUTION_ADMIN") : ["ROLE-05", "ROLE-06"].includes(p.roleId) },
];

export const visibleNavigation = (principal: Principal) =>
  navigation.filter((item) => (!item.permission || can(principal, item.permission)) && (!item.roles || item.roles.includes(principal.roleId)) && (!item.when || item.when(principal))).map(item => item.href === "/reporting" && ["BLOOD_BANK","DOH"].includes(principal.accountCategory ?? "") ? {...item,label:"Compliance Reports"} : item);

export const canonicalPagePath = (principal:Principal,path:string) => (principal.accountCategory === "PRC" && path === "/consortium") || (path === "/redistribution" && (principal.accountCategory === "BLOOD_BANK" || !principal.accountCategory && ["ROLE-01","ROLE-02"].includes(principal.roleId))) ? "/" : path;
