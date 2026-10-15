import {describe,it,expect} from "vitest";
import {redistributionUnits} from "./redistribution-review";
import type {V2Component} from "../../services/api/v2";
import type {TransferRequestDetail} from "../../services/api/v2-navigation";
const now=Date.parse("2026-10-15T00:00:00Z");
const request={blood_type:"A_POSITIVE",component_type:"FRESH_FROZEN_PLASMA",quantity:2} as TransferRequestDetail;
const unit=(componentId:string,expiresAt="2026-10-17T00:00:00Z",extra:Partial<V2Component>={}):V2Component=>({componentId,institutionId:"INST_TEST",bloodType:"A_POSITIVE",componentType:"FRESH_FROZEN_PLASMA",inventoryStatus:"AVAILABLE",expiryState:"CURRENT",reservationId:null,expiresAt,...extra} as V2Component);
describe("redistribution FEFO preview",()=>{
 it("excludes unavailable, expired and reserved units and follows expiry/id tie-break",()=>{
  const items=[unit("COMP_Z"),unit("COMP_B","2026-10-16T00:00:00Z"),unit("COMP_A","2026-10-16T00:00:00Z"),unit("COMP_OLD","2026-10-14T00:00:00Z"),unit("COMP_PENDING",undefined,{expiryState:"LABEL_EXPIRED_PENDING_EVALUATION"}),unit("COMP_RESERVED",undefined,{reservationId:"RES_TEST"}),unit("COMP_OTHER",undefined,{bloodType:"O_POSITIVE"})];
  expect(redistributionUnits(items,"INST_TEST",request,now).map(row=>row.componentId)).toEqual(["COMP_A","COMP_B"]);
 });
 it("fails closed on foreign stock",()=>{expect(()=>redistributionUnits([unit("COMP_FOREIGN",undefined,{institutionId:"INST_OTHER"})],"INST_TEST",request,now)).toThrow("scope");});
});
