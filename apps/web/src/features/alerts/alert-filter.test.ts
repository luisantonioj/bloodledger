import { describe, expect, it } from "vitest";
import { alertOptions, filterAlerts } from "./alert-filter";

const items=[{severity:"CRITICAL",status:"OPEN"},{severity:"WARNING",status:"OPEN"},{severity:"WARNING",status:"ACKNOWLEDGED"}];
describe("scoped alert filters",()=>{
  it("combines severity and status without expanding scope",()=>expect(filterAlerts(items,{severity:"WARNING",status:"OPEN"})).toEqual([{severity:"WARNING",status:"OPEN"}]));
  it("derives deterministic options",()=>expect(alertOptions(items,"severity")).toEqual(["CRITICAL","WARNING"]));
});
