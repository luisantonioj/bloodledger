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
  accountId?: string;
  accountCategory?: "BLOOD_BANK" | "REQUESTOR" | "PRC" | "DOH" | "SYSTEM";
  accountState?: string;
  authorizationPolicyVersion?: string;
  verificationRequired?: boolean;
  administrativeCapabilities?: string[];
  operators?: OperatorProfile[];
  userId: string;
  displayName: string;
  institutionId: string;
  institutionDisplayName: string;
  roleId: "ROLE-01" | "ROLE-02" | "ROLE-03" | "ROLE-04" | "ROLE-05" | "ROLE-06";
  roleDisplayName: string;
  permissions: Permission[];
  classification: "SIMULATION_ONLY";
}

export interface OperatorProfile {
  operatorId: string;
  roleId: Principal["roleId"];
  capabilityProfile: "ROLE" | "PRC_REVIEWER" | "INSTITUTION_ADMIN";
  version: number;
  permissions?: Permission[];
  actionCapabilities?: string[];
}

export const canAct = (principal: Principal, action: string) =>
  principal.operators?.some(operator => operator.actionCapabilities?.includes(action)) ?? false;

export const can = (principal: Principal, permission: Permission) => principal.permissions.includes(permission);

export const composition = (principal: Principal) =>
  can(principal, "dashboard:regulatory")
    ? "REGULATORY"
    : can(principal, "dashboard:operational")
      ? "OPERATIONAL"
      : "ADMINISTRATIVE";
