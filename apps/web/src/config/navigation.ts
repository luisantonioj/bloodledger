import { can, type Permission, type Principal } from "../auth/permissions";

export interface NavigationItem {
  href: string;
  label: string;
  permission?: Permission;
}

export const navigation: NavigationItem[] = [
  { href: "/", label: "Dashboard" },
  { href: "/inventory", label: "Inventory", permission: "inventory:read" },
  { href: "/transfers", label: "Transfers", permission: "transfers:read" },
  { href: "/alerts", label: "Alerts", permission: "alerts:read" },
  { href: "/consortium", label: "Network view", permission: "consortium:read" },
  { href: "/audit", label: "Audit", permission: "audit:read" },
  { href: "/reporting", label: "Reports", permission: "reports:read" },
  { href: "/profile", label: "Profile", permission: "profile:read" },
];

export const visibleNavigation = (principal: Principal) =>
  navigation.filter((item) => !item.permission || can(principal, item.permission));
