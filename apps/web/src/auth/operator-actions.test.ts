import {describe,expect,it} from "vitest";
import {actionCapability,eligibleOperators} from "./operator-actions";
import type {OperatorProfile} from "./permissions";
const operators: OperatorProfile[] = [
  {operatorId:"USR_TECH",roleId:"ROLE-01",capabilityProfile:"ROLE",version:1,actionCapabilities:["inventory:capture","inventory:local-release"]},
  {operatorId:"USR_ADMIN",roleId:"ROLE-06",capabilityProfile:"INSTITUTION_ADMIN",version:1,actionCapabilities:["operator:reset-pin","institution:profile"]},
];
describe("PA-ACCOUNT-01 operator visibility",()=>{
  it("uses provisioned inventory capabilities for holds and local-release completion", () => {
    expect(actionCapability("POST /api/v2/reservations")).toBe("transfer:approve");
    expect(actionCapability("GET /api/v2/reservations")).toBeUndefined();
    expect(actionCapability("POST /api/v2/reconciliation")).toBe("inventory:reconcile");
    expect(actionCapability("POST /api/v2/reservations/RES_SYNTH/local-release-complete")).toBe("inventory:local-release");
  });
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

it("PA-REQ detail and document writes select request-capable operators only",()=>{
 const requester:OperatorProfile={operatorId:"USR_SYNTH_REQUESTER",roleId:"ROLE-03",capabilityProfile:"ROLE",version:1,actionCapabilities:["transfer:request"]};
 const document="DOC_"+"A".repeat(40);
 for(const action of ["details","documents",`documents/${document}/delete`]){
  const path=`/api/v2/transfers/TRF_SYNTH_REQUEST/${action}`;
  expect(actionCapability("POST "+path)).toBe("transfer:request");
  expect(eligibleOperators([...operators,requester],"POST "+path)).toEqual([requester]);
  expect(actionCapability("GET "+path)).toBeUndefined();
 }
 expect(actionCapability("POST /api/v2/transfers/TRF_SYNTH_REQUEST/documents/INVALID/delete")).toBeUndefined();
});
