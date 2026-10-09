import {describe,expect,it} from "vitest";
import {eligibleOperators} from "./operator-actions";
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
});
