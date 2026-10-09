import { readFileSync } from "node:fs";
import { permissionsFor, type Permission, type RoleId } from "./web-access.js";
import type { CredentialRecord, WebPrincipal } from "./session.js";

export const ACCOUNT_POLICY_VERSION = "SYNTHETIC_INSTITUTION_ACCOUNTS_V1" as const;
export type AccountCategory = "BLOOD_BANK" | "REQUESTOR" | "PRC" | "DOH" | "SYSTEM";
export interface OperatorProfile { operatorId: string; roleId: RoleId; capabilityProfile: "ROLE" | "PRC_REVIEWER" | "INSTITUTION_ADMIN"; version: number; actionCapabilities?: readonly string[]; permissions?: readonly Permission[] }
export interface AccountPolicyEntry { institutionId: string; accountId: string; username: string; category: AccountCategory; readRoleId: RoleId }
export const accountPolicy = JSON.parse(readFileSync(new URL("../../policy/institution-accounts-v1.json", import.meta.url), "utf8")) as {
  policyVersion: typeof ACCOUNT_POLICY_VERSION; classification: "SIMULATION_ONLY"; accounts: AccountPolicyEntry[];
};
export const BANK_INSTITUTION_IDS = accountPolicy.accounts.filter(a => a.category === "BLOOD_BANK").map(a => a.institutionId);
export function operatorActions(operator: OperatorProfile): string[] {
  if(operator.capabilityProfile==='PRC_REVIEWER')return ['onboarding:invite','onboarding:review','onboarding:approve','onboarding:activate','institution:suspend','institution:reactivate','institution:profile','institution:account','operator:create-administrator','operator:reset-pin','operator:revoke'];
  if(operator.capabilityProfile==='INSTITUTION_ADMIN')return ['institution:profile','operator:create-administrator','operator:reset-pin','operator:revoke'];
  if(operator.roleId==='ROLE-03')return ['transfer:request','transfer:receive','transfer:cancel','transfer:compromise'];
  if(!['ROLE-01','ROLE-02'].includes(operator.roleId))return [];
  return ['inventory:capture','inventory:local-release','inventory:reconcile','inventory:expiry','alert:acknowledge','transfer:prepare','transfer:dispatch','transfer:transit','transfer:cancel','transfer:compromise',...(operator.roleId==='ROLE-02'?['transfer:request','transfer:approve','transfer:reject']:[])];
}
export function primaryPrincipal(record: CredentialRecord): WebPrincipal {
  const category = record.accountCategory;
  if (!category) throw new Error("ACCOUNT_CATEGORY_REQUIRED");
  const permissions = permissionsFor(record.roleId).filter(p => !["inventory:write", "transfers:write", "alerts:acknowledge"].includes(p));
  return { userId: record.userId, accountId: record.userId, displayName: record.displayName,
    institutionId: record.institutionId, institutionDisplayName: record.institutionDisplayName,
    institutionCategory: record.institutionCategory, accountCategory: category, accountState: "ACTIVE",
    roleId: record.roleId, roleDisplayName: "Institution account", permissions,
    operators: (record.operators ?? []).map(o=>({...o,permissions:permissionsFor(o.roleId),actionCapabilities:operatorActions(o)})), verificationRequired: true, authorizationPolicyVersion: ACCOUNT_POLICY_VERSION,
    administrativeCapabilities: category === "PRC" ? ["onboarding:read", "onboarding:review"] : [],
    classification: "SIMULATION_ONLY" };
}
export function operatorPrincipal(account: WebPrincipal, operator: OperatorProfile): WebPrincipal {
  const permissions: readonly Permission[] = permissionsFor(operator.roleId);
  return { ...account, userId: operator.operatorId, roleId: operator.roleId, roleDisplayName: "Verified operator",
    operatorId: operator.operatorId, permissions, administrativeCapabilities:
      operator.capabilityProfile === "PRC_REVIEWER" ? ["onboarding:read", "onboarding:review", "onboarding:write", "operators:manage"] :
      operator.capabilityProfile === "INSTITUTION_ADMIN" ? ["institution:manage", "operators:manage"] : [] };
}
