import {describe,expect,it} from "vitest";
import {bankTransferSummary,type BankRequestRow,type BankReservationRow} from "./bank-transfer-list";
const request:BankRequestRow={transfer_id:"TRF_TEST",source_institution_id:"INST_A",destination_institution_id:"INST_B",blood_type:"A_POSITIVE",component_type:"PACKED_RED_BLOOD_CELLS",quantity:2,urgency:"URGENT",status:"PENDING",ledger_transaction_id:null};
const reservation:BankReservationRow={reservation_id:"RES_TEST",transfer_id:"TRF_TEST",purpose:"TRANSFER",status:"PREPARED",version:2,institution_id:"INST_A",destination_institution_id:"INST_B"};
describe("bank transfer table linkage",()=>{
 it("uses exact scoped linkage and distinguishes transfer and reservation IDs",()=>{expect(bankTransferSummary(reservation,[request],"INST_B")).toEqual({transferId:"TRF_TEST",bloodType:"A_POSITIVE",componentType:"PACKED_RED_BLOOD_CELLS",quantity:2,source:"INST_A",destination:"INST_B"});});
 it("keeps missing linked quantities unknown rather than zero",()=>{const row=bankTransferSummary(reservation,[],"INST_A");expect(row.quantity).toBeNull();expect(row.bloodType).toBeNull();expect(row.source).toBe("INST_A");});
 it("rejects foreign, duplicate and inconsistent request joins",()=>{for(const requests of [[{...request,source_institution_id:"INST_C",destination_institution_id:"INST_D"}],[request,request],[{...request,destination_institution_id:"INST_C"}]])expect(bankTransferSummary(reservation,requests,"INST_A").bloodType).toBeNull();});
 it("does not turn local releases into hospital transfers",()=>{const row=bankTransferSummary({...reservation,purpose:"LOCAL_RELEASE",transfer_id:null,destination_institution_id:null},[request],"INST_A");expect(row.transferId).toBeNull();expect(row.quantity).toBeNull();expect(row.destination).toBeNull();});
});
