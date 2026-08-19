export const WEB_ACCESS_POLICY_VERSION = "SYNTHETIC_WEB_ACCESS_V1" as const;
export const ROLE_IDS = ["ROLE-01", "ROLE-02", "ROLE-03", "ROLE-04", "ROLE-05", "ROLE-06"] as const;
export type RoleId = (typeof ROLE_IDS)[number];
export const PERMISSIONS = [
  "dashboard:operational", "dashboard:regulatory", "inventory:read", "inventory:write",
  "transfers:read", "transfers:write", "alerts:read", "alerts:acknowledge",
  "consortium:read", "audit:read", "reports:read", "profile:read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const rolePermissions: Readonly<Record<RoleId, readonly Permission[]>> = {
  "ROLE-01": ["dashboard:operational", "inventory:read", "inventory:write", "transfers:read", "transfers:write", "alerts:read", "alerts:acknowledge", "profile:read"],
  "ROLE-02": ["dashboard:operational", "inventory:read", "transfers:read", "transfers:write", "alerts:read", "alerts:acknowledge", "audit:read", "profile:read"],
  "ROLE-03": ["dashboard:operational", "transfers:read", "transfers:write", "alerts:read", "profile:read"],
  "ROLE-04": ["dashboard:regulatory", "inventory:read", "transfers:read", "alerts:read", "consortium:read", "audit:read", "reports:read", "profile:read"],
  "ROLE-05": ["profile:read"],
  "ROLE-06": ["profile:read"],
};

export function permissionsFor(roleId: RoleId): readonly Permission[] {
  return rolePermissions[roleId];
}

export function permits(roleId: RoleId, permission: Permission): boolean {
  return rolePermissions[roleId].includes(permission);
}

export function isRoleId(value: unknown): value is RoleId {
  return typeof value === "string" && (ROLE_IDS as readonly string[]).includes(value);
}
