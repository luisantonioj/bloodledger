import {describe,it,expect} from "vitest";
import {redistributionUnits,redistributionRequestCandidates} from "./redistribution-review";
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

describe("redistribution request selection",()=>{
 const valid={transfer_id:"TRF_MATCH",source_institution_id:"INST_TEST",destination_institution_id:"INST_DEST",blood_type:"A_POSITIVE",component_type:"FRESH_FROZEN_PLASMA",quantity:2,status:"PENDING",ledger_transaction_id:"LEDGER_SYNTH"};
 it("only offers confirmed pending source/product/destination matches without an existing reservation",()=>{const rows=[valid,{...valid,transfer_id:"TRF_NO_LEDGER",ledger_transaction_id:null},{...valid,transfer_id:"TRF_FOREIGN",source_institution_id:"INST_OTHER"},{...valid,transfer_id:"TRF_OTHER_DEST",destination_institution_id:"INST_OTHER"},{...valid,transfer_id:"TRF_OTHER_PRODUCT",component_type:"PLATELETS"},{...valid,transfer_id:"TRF_DONE",status:"RECEIVED"},{...valid,transfer_id:"TRF_RESERVED"}];expect(redistributionRequestCandidates(rows,[{transfer_id:"TRF_RESERVED"}],"INST_TEST","INST_DEST","A_POSITIVE","FRESH_FROZEN_PLASMA").map(row=>row.transfer_id)).toEqual(["TRF_MATCH"]);});
 it("preserves multiple matches instead of silently choosing one",()=>{expect(redistributionRequestCandidates([valid,{...valid,transfer_id:"TRF_SECOND"}],[],"INST_TEST","INST_DEST","A_POSITIVE","FRESH_FROZEN_PLASMA")).toHaveLength(2);});
});
