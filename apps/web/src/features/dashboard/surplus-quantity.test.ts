import {expect,it} from "vitest";
import {sourceSurplusQuantity} from "./surplus-quantity";
import type {SourceSurplusView} from "../../services/api/coordination";
const now=Date.parse("2026-10-15T02:00:00Z");
const view:SourceSurplusView={schemaVersion:"SOURCE_SURPLUS_VIEW_V1",institutionId:"INST_BANK",businessDate:"2026-10-15",status:"CURRENT",unavailableReason:null,census:{snapshotId:"CENSUS_TEST",capturedAt:"2026-10-14T16:00:00Z"},forecast:{runId:"RUN_TEST",datasetVersion:"SYNTHETIC_FORECAST_V5_RUNTIME_V1",originDate:"2026-10-14",horizonDate:"2026-10-15",generatedAt:"2026-10-14T16:01:00Z"},reserve:{safetyAllowance:2,minimumReserve:10,rounding:"FLOOR"},series:[{bloodType:"A_POSITIVE",componentType:"FRESH_FROZEN_PLASMA",availableCount:57,forecastDemand:1,surplusQuantity:44,forecastId:"FC_TEST",evidenceId:"SURP_TEST",status:"AVAILABLE",unavailableReason:null}],policyVersion:"TEST",classification:"SIMULATION_ONLY",recommendationEligibility:"DISABLED_UNAPPROVED_POLICY"};
const read=(data:SourceSurplusView)=>sourceSurplusQuantity(data,"INST_BANK","A_POSITIVE","FRESH_FROZEN_PLASMA",57,now);
it("uses the backend source-surplus quantity separately from static dashboard excess",()=>{expect(read(view)).toBe(44);expect(read({...view,series:[{...view.series[0],surplusQuantity:0}]})).toBe(0);});
it("rejects unavailable, foreign, incomplete, future and stale evidence",()=>{
 for(const data of [{...view,status:"UNAVAILABLE" as const},{...view,institutionId:"INST_OTHER"},{...view,census:null},{...view,forecast:null},{...view,businessDate:"2026-10-14"},{...view,forecast:{...view.forecast!,generatedAt:"2026-10-16T00:00:00Z"}},{...view,forecast:{...view.forecast!,originDate:"2026-10-13"}}]) expect(read(data)).toBeNull();
});
it("rejects duplicate or mismatched series and negative/fractional/excess quantities",()=>{
 expect(read({...view,series:[view.series[0],view.series[0]]})).toBeNull();
 for(const patch of [{availableCount:56},{bloodType:"O_POSITIVE"},{surplusQuantity:-1},{surplusQuantity:1.5},{surplusQuantity:58},{evidenceId:null}])expect(read({...view,series:[{...view.series[0],...patch}]})).toBeNull();
});
