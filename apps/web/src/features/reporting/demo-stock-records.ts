import type {CensusSnapshot} from "../../services/api/census-index";
import {CENSUS_ORDER} from "../../services/api/census-index";
import {V2_COMPONENT_TYPES} from "../../services/api/v2";

// Explicit, frontend-only demonstration data. Never inserted into the census database,
// derived from live inventory, or represented as an observed historical capture.
const units:Record<string,readonly number[]>={
 O_POSITIVE:[8,40,60,12,20],A_POSITIVE:[5,40,60,13,23],B_POSITIVE:[5,44,62,28,21],AB_POSITIVE:[4,20,25,8,12],
 O_NEGATIVE:[0,0,0,0,0],A_NEGATIVE:[0,0,0,0,0],B_NEGATIVE:[0,0,0,0,0],AB_NEGATIVE:[0,0,0,0,0],
};
export function demonstrationStockRecords(institutionId:string){
 return (["09","16"] as const).map(hour=>{
  const scheduledFor=`2026-10-15T${hour}:00:00.000+08:00`;
  const record:CensusSnapshot={snapshotId:`DEMO_STOCK_20261015_${hour}`,institutionId,scheduledFor,capturedAt:scheduledFor,reportPolicyVersion:"FRONTEND_DEMO_STOCK_RECORD_V1",triggerType:"DEMONSTRATION"};
  return {record,snapshot:{...record,classification:"SIMULATION_ONLY",timezone:"Asia/Manila",groups:V2_COMPONENT_TYPES.map((componentType,c)=>({componentType,bloodTypes:CENSUS_ORDER.map(bloodType=>({bloodType,availableCount:units[bloodType][c],reservedCount:0,reportableCount:units[bloodType][c]}))}))}};
 });
}
