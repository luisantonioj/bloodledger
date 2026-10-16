import { describe, expect, it } from "vitest";
import type { Principal } from "../../auth/permissions";
import { CENSUS_ORDER, parseCensusIndex } from "./census-index";
const principal = {roleId:"ROLE-02",institutionId:"INST_SYNTH"} as Principal;
const snapshot = {snapshotId:"CENSUS_SYNTH_A",institutionId:"INST_SYNTH",scheduledFor:"2026-10-10T00:00:00Z",capturedAt:"2026-10-10T00:05:00Z",reportPolicyVersion:"SYNTHETIC_CENSUS_V1",triggerType:"SCHEDULED",classification:"SIMULATION_ONLY"};
const index = {scope:"INSTITUTION",snapshots:[snapshot],nextCursor:null,displayPolicyVersion:"DOH_CENSUS_COLUMN_ORDER_V1",displayBloodTypeOrder:CENSUS_ORDER,totalColumn:"CALCULATED",reportAvailability:"EXPORT_DISABLED_PENDING_FORMAT",exportAvailable:false,classification:"SIMULATION_ONLY"};
describe("FR-11/12 issue36 census discovery",()=>{
 it("preserves scheduled and capture timestamps rather than claiming current inventory",()=>expect(parseCensusIndex(index,principal).snapshots[0]).toMatchObject({scheduledFor:snapshot.scheduledFor,capturedAt:snapshot.capturedAt}));
 it.each([{scope:"REGULATORY_AGGREGATE"},{snapshots:[{...snapshot,institutionId:"INST_OTHER"}]},{snapshots:[snapshot,snapshot]},{displayBloodTypeOrder:[...CENSUS_ORDER].reverse()},{nextCursor:"../outside"},{snapshots:[{...snapshot,capturedAt:"invalid"}]},{exportAvailable:true}])("rejects scope, identity, order and contract changes %j", patch=>expect(()=>parseCensusIndex({...index,...patch},principal)).toThrow());
 it("allows regulatory aggregate discovery without claiming custodian access",()=>expect(parseCensusIndex({...index,scope:"REGULATORY_AGGREGATE"},{...principal,roleId:"ROLE-04"}).scope).toBe("REGULATORY_AGGREGATE"));
});

import {afterEach,vi} from "vitest";
import {readCompleteCensusIndex} from "./census-index";
afterEach(()=>vi.unstubAllGlobals());
describe("complete census discovery",()=>{
 it("reads every cursor page so today's count is not a capped-list count",async()=>{const fetch=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({...index,nextCursor:"CENSUS_SYNTH_A"}))).mockResolvedValueOnce(new Response(JSON.stringify({...index,snapshots:[{...snapshot,snapshotId:"CENSUS_SYNTH_B"}]})));vi.stubGlobal("fetch",fetch);const result=await readCompleteCensusIndex(principal,new AbortController().signal);expect(result.snapshots).toHaveLength(2);expect(result.nextCursor).toBeNull();expect(fetch.mock.calls[1][0]).toContain("cursor=CENSUS_SYNTH_A");});
 it("rejects repeated pages rather than looping or counting twice",async()=>{vi.stubGlobal("fetch",vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({...index,nextCursor:"CENSUS_SYNTH_A"}))).mockResolvedValueOnce(new Response(JSON.stringify({...index,nextCursor:"CENSUS_SYNTH_A"}))));await expect(readCompleteCensusIndex(principal,new AbortController().signal)).rejects.toThrow("repeated");});
 it("does not return a partial count when a later page is denied",async()=>{vi.stubGlobal("window",{dispatchEvent:vi.fn()});vi.stubGlobal("fetch",vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({...index,nextCursor:"CENSUS_SYNTH_A"}))).mockResolvedValueOnce(new Response(JSON.stringify({error:{code:"AUTH_SCOPE_FORBIDDEN"}}),{status:403})));await expect(readCompleteCensusIndex(principal,new AbortController().signal)).rejects.toThrow();});
});
