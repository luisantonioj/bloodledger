import {describe,expect,it} from "vitest";
import {actionCapability,eligibleOperators} from "./operator-actions";
import type {OperatorProfile} from "./permissions";
const operators: OperatorProfile[] = [
  {operatorId:"USR_TECH",roleId:"ROLE-01",capabilityProfile:"ROLE",version:1,actionCapabilities:["inventory:capture","inventory:local-release"]},
  {operatorId:"USR_ADMIN",roleId:"ROLE-06",capabilityProfile:"INSTITUTION_ADMIN",version:1,actionCapabilities:["operator:reset-pin","institution:profile"]},
];
describe("PA-ACCOUNT-01 operator visibility",()=>{
  it("separates clinical actions from institution administration",()=>{
    expect(eligibleOperators(operators,"POST /api/v2/local-releases").map(o=>o.operatorId)).toEqual(["USR_TECH"]);
    expect(eligibleOperators(operators,"POST /api/v2/onboarding/operators/USR_TECH/reset-pin").map(o=>o.operatorId)).toEqual(["USR_ADMIN"]);
    expect(eligibleOperators(operators,"POST /api/v2/transfers")).toEqual([]);
    expect(eligibleOperators(operators,"POST /api/v2/unknown")).toEqual([]);
  });
  it("J4 maps only expiry POSTs to the explicitly provisioned capability", () => {
    const expiryOperator: OperatorProfile = {...operators[0], actionCapabilities: ["inventory:expiry"]};
    expect(actionCapability("POST /api/v2/components/COMP_SYNTH/expiry")).toBe("inventory:expiry");
    expect(actionCapability("GET /api/v2/components/COMP_SYNTH/expiry")).toBeUndefined();
    expect(eligibleOperators([...operators, expiryOperator], "POST /api/v2/components/COMP_SYNTH/expiry")).toEqual([expiryOperator]);
  });
});
