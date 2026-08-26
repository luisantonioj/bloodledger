export type Permission =
  | "dashboard:operational"
  | "dashboard:regulatory"
  | "inventory:read"
  | "inventory:write"
  | "transfers:read"
  | "transfers:write"
  | "alerts:read"
  | "alerts:acknowledge"
  | "consortium:read"
  | "audit:read"
  | "reports:read"
  | "profile:read";

export interface Principal {
  userId: string;
  displayName: string;
  institutionId: string;
  institutionDisplayName: string;
  roleId: "ROLE-01" | "ROLE-02" | "ROLE-03" | "ROLE-04" | "ROLE-05" | "ROLE-06";
  roleDisplayName: string;
  permissions: Permission[];
  classification: "SIMULATION_ONLY";
}

export const can = (principal: Principal, permission: Permission) => principal.permissions.includes(permission);

export const composition = (principal: Principal) =>
  can(principal, "dashboard:regulatory")
    ? "REGULATORY"
    : can(principal, "dashboard:operational")
      ? "OPERATIONAL"
      : "ADMINISTRATIVE";
