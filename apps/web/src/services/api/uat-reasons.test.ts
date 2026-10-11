import { describe, expect, it } from "vitest";
import { parseReasonPolicy } from "./uat-reasons";
const policy = { policyVersion:"SYNTHETIC_COMPROMISE_REASONS_V1", effect:"QUARANTINE_PENDING_MANUAL_REVIEW", freeTextAllowed:false, classification:"SIMULATION_ONLY", reasons:["TEMPERATURE_EXCURSION_REPORTED", "CONTAINER_DAMAGE_OR_LEAK_REPORTED", "VISIBLE_COMPONENT_ABNORMALITY_REPORTED", "HANDLING_OR_CUSTODY_DEVIATION_REPORTED"].map(code => ({code, label:code})) };
describe("PR35 / issue36 authenticated policy selectors", () => {
  it("uses labels and order from the API policy", () => expect(parseReasonPolicy({...policy, reasons:[...policy.reasons].reverse()}, "compromise").reasons[0]).toEqual(policy.reasons[3]));
  it.each([null, {...policy, freeTextAllowed:true}, {...policy, effect:"AUTOMATIC_DISPOSAL"}, {...policy, reasons:policy.reasons.slice(1)}, {...policy, reasons:[...policy.reasons.slice(1), policy.reasons[1]]}, {...policy, reasons:[...policy.reasons.slice(1),{code:"UNKNOWN",label:"Unknown"}]}])("fails closed on missing or changed policy %j", value => expect(() => parseReasonPolicy(value, "compromise")).toThrow());
});
