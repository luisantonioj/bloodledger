import { accountPolicy } from "./institution-access.js";
import { readFileSync } from "node:fs";
import { ApiFailure } from "./errors.js";
import type { WebPrincipal } from "./session.js";
import type { CorePolicyVersion } from "./v2-contracts.js";

// The packaged JSON is the authoritative mapping, shared with chaincode and inspect.
const policy = JSON.parse(readFileSync(new URL("../../../../chaincode/policy/persistent-development-core-v1.json", import.meta.url), "utf8")) as {
  classification: string;
  policyVersion: "PERSISTENT_DEVELOPMENT_CORE_V1";
  developmentActorIds: string[];
  actors: Record<string, { institutionId: string; role: string }>;
};
if (policy.classification !== "SIMULATION_ONLY" || policy.policyVersion !== "PERSISTENT_DEVELOPMENT_CORE_V1") throw new Error("DEVELOPMENT_POLICY_INVALID");

const institutionPolicy=JSON.parse(readFileSync(new URL("../../../../chaincode/policy/institution-core-v1.json", import.meta.url),"utf8")) as {
 policyVersion:"SYNTHETIC_INSTITUTION_CORE_V1"; institutionAccountActorIds:string[]; actors:Record<string,{institutionId:string;role:string}>;
};
export function selectCorePolicy(principal: Pick<WebPrincipal, "userId" | "roleId" | "institutionId" | "accountId" | "operatorId">, version: "V2" | "V2.1"): CorePolicyVersion {
  if (principal.accountId) {
    if(version!=="V2.1")throw new ApiFailure(409,"V2_1_CONTRACT_REQUIRED","Institution accounts require V2.1.");
    const account=accountPolicy.accounts.find(a=>a.institutionId===principal.institutionId);
    if(!account)throw new ApiFailure(403,"AUTH_SCOPE_FORBIDDEN","Institution is not approved for ledger workflows.");
    if(principal.operatorId){
      const actor=institutionPolicy.actors[principal.operatorId];
      if(!institutionPolicy.institutionAccountActorIds.includes(principal.operatorId)||!actor||actor.institutionId!==principal.institutionId||actor.role!==principal.roleId.replace("-","_"))throw new ApiFailure(403,"AUTH_SCOPE_FORBIDDEN","Operator is outside the packaged Fabric policy.");
    }
    return institutionPolicy.policyVersion;
  }
  if (!policy.developmentActorIds.includes(principal.userId)) return version === "V2.1" ? "INTERVIEW_DERIVED_CORE_V2_1" : "INTERVIEW_DERIVED_CORE_V2";
  const actor = policy.actors[principal.userId];
  if (!actor || actor.institutionId !== principal.institutionId || actor.role !== principal.roleId.replace("-", "_")) throw new ApiFailure(403, "AUTH_SCOPE_FORBIDDEN", "The retained development actor mapping does not match this session.");
  if (version !== "V2.1") throw new ApiFailure(409, "V2_1_CONTRACT_REQUIRED", "The retained development mapping requires V2.1.");
  return policy.policyVersion;
}
