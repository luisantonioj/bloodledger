import {afterEach,describe,expect,it,vi} from "vitest";
import type {Principal} from "../../auth/permissions";
import {ApiRequestError,setCommandVerifier} from "./client";
import {parseReservationDetail,parseTransferRequest,readSelectedRecord,recordErrorMessage} from "./v2-navigation";
const principal={institutionId:"INST_MEDIATRIX"} as Principal;
const reservation={reservationId:"RES_TEST",purpose:"TRANSFER",status:"ACTIVE",version:2,sourceInstitutionId:"INST_MEDIATRIX",destinationInstitutionId:"INST_SYNTH_MEDIX",transferId:"TRF_TEST",localReleaseId:null,preparedAt:null,preparedEvidencePresent:false,updatedAt:"2026-10-09T00:00:00Z",components:[{componentId:"COMP_TEST",componentType:"PLATELETS",inventoryStatus:"RESERVED",inventoryVersion:2}],classification:"SIMULATION_ONLY"};
afterEach(()=>{setCommandVerifier();vi.unstubAllGlobals();});
describe("FR-01/05/12 operational detail navigation",()=>{
 it("keeps reservation purpose, version and members separate from the request state",()=>{expect(parseReservationDetail(reservation,"RES_TEST",principal)).toMatchObject({purpose:"TRANSFER",status:"ACTIVE",components:[{componentId:"COMP_TEST"}]});});
 it("accepts local-release references without inventing a request",()=>{expect(parseReservationDetail({...reservation,purpose:"LOCAL_RELEASE",transferId:null,localReleaseId:"REL_TEST",destinationInstitutionId:null},"RES_TEST",principal)).toMatchObject({localReleaseId:"REL_TEST",transferId:null});});
 it.each([{reservationId:"RES_OTHER"},{components:[reservation.components[0],reservation.components[0]]},{purpose:"LOCAL_RELEASE"},{transferId:null}])("rejects inconsistent identity/member/purpose response %j",patch=>{expect(()=>parseReservationDetail({...reservation,...patch},"RES_TEST",principal)).toThrow();});
 it("rejects a foreign institution response before it can be displayed",()=>{expect(()=>parseReservationDetail({...reservation,sourceInstitutionId:"INST_OTHER",destinationInstitutionId:null},"RES_TEST",principal)).toThrow(ApiRequestError);});
 it("matches existing snake-case request identities",()=>{expect(parseTransferRequest({transfer_id:"TRF_TEST",source_institution_id:"INST_MEDIATRIX",destination_institution_id:"INST_SYNTH_MEDIX",blood_type:"A_POSITIVE",component_type:"PLATELETS",quantity:1,status:"PENDING",ledger_transaction_id:null},"TRF_TEST",principal)).toMatchObject({status:"PENDING",ledger_transaction_id:null});});
 it("reads requests from the real list contract and never a guessed detail endpoint",async()=>{
  const fetchMock=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify({classification:"SIMULATION_ONLY",requests:[]})));vi.stubGlobal("fetch",fetchMock);
  await expect(readSelectedRecord({kind:"request",id:"TRF_MISSING"},principal)).rejects.toMatchObject({status:404});expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v2/transfers");
 });
 it("rejects unsafe record IDs before a request",async()=>{const fetchMock=vi.fn();vi.stubGlobal("fetch",fetchMock);await expect(readSelectedRecord({kind:"component",id:"../outside"},principal)).rejects.toMatchObject({status:404});expect(fetchMock).not.toHaveBeenCalled();});
 it.each([403,404,409,503])("shows distinct denied/missing/conflict/error status %i",status=>{const message=recordErrorMessage(new ApiRequestError(status,"Unsafe server details"));expect(message).not.toContain("Unsafe");expect(message).toContain(status===403?"denied":status===404?"unavailable":status===409?"conflicted":"verified");});
});
