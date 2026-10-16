import {describe,it,expect} from "vitest";
import {checkpointRecord,checkpointClipboard} from "./checkpoint-copy";
import {CENSUS_ORDER,type CensusSnapshot} from "../../services/api/census-index";
import {V2_COMPONENT_TYPES} from "../../services/api/v2";
const now=Date.parse("2026-10-16T08:30:00Z"),record:CensusSnapshot={snapshotId:"CENSUS_MORNING",institutionId:"INST_TEST",scheduledFor:"2026-10-16T01:00:00Z",capturedAt:"2026-10-16T01:00:02Z",reportPolicyVersion:"SYNTHETIC_COPY_V2_1",triggerType:"SCHEDULED"};
const detail={...record,timezone:"Asia/Manila",classification:"SIMULATION_ONLY",groups:V2_COMPONENT_TYPES.map((componentType,c)=>({componentType,bloodTypes:CENSUS_ORDER.map((bloodType,b)=>({bloodType,availableCount:c*8+b,reservedCount:1,reportableCount:c*8+b+1}))}))};
describe("checkpoint copy",()=>{
 it("selects the scheduled Manila slot, not capture time, other dates or institutions",()=>{expect(checkpointRecord([record,{...record,snapshotId:"CENSUS_FOREIGN",institutionId:"INST_OTHER"},{...record,snapshotId:"CENSUS_YESTERDAY",scheduledFor:"2026-10-15T01:00:00Z"}],"INST_TEST","2026-10-16","09",now).record?.snapshotId).toBe(record.snapshotId);expect(checkpointRecord([record],"INST_TEST","2026-10-16","16",now).record).toBeUndefined();});
 it("does not silently choose a record across multiple policies or a future slot",()=>{expect(checkpointRecord([record,{...record,snapshotId:"CENSUS_SECOND",reportPolicyVersion:"OTHER"}],"INST_TEST","2026-10-16","09",now).ambiguous).toBe(true);expect(checkpointRecord([record],"INST_TEST","2026-10-16","09",Date.parse("2026-10-16T00:59:59Z")).record).toBeUndefined();});
 it("copies exactly all forty saved values in an eight-row, five-component spreadsheet matrix",()=>{const rows=checkpointClipboard(detail,record).trimEnd().split("\r\n").map(row=>row.split("\t"));expect(rows).toHaveLength(9);expect(rows.every(row=>row.length===7)).toBe(true);expect(rows[0]).toEqual(["Blood type","Whole Blood","PRBC","FFP","Platelets","Cryo","Total"]);expect(rows[1]).toEqual(["O+","1","9","17","25","33","85"]);expect(rows[8]).toEqual(["AB-","8","16","24","32","40","120"]);});
 it("rejects missing cryo, incomplete blood-type coverage and wrong snapshot identity",()=>{expect(()=>checkpointClipboard({...detail,groups:detail.groups.slice(0,4)},record)).toThrow();expect(()=>checkpointClipboard({...detail,groups:detail.groups.map(g=>({...g,bloodTypes:g.bloodTypes.slice(0,7)}))},record)).toThrow();expect(()=>checkpointClipboard({...detail,snapshotId:"CENSUS_OTHER"},record)).toThrow();});
});

import {latestCheckpointRecord} from "./checkpoint-copy";
import {demonstrationStockRecords} from "./demo-stock-records";
describe("retained latest checkpoint",()=>{
 const yesterday={...record,snapshotId:"CENSUS_YESTERDAY",scheduledFor:"2026-10-15T01:00:00Z",capturedAt:"2026-10-15T01:00:01Z"};
 it("retains yesterday's morning record until a newer reached morning record exists",()=>{expect(latestCheckpointRecord([yesterday,record],"INST_TEST","09",Date.parse("2026-10-16T00:59:59Z")).record?.snapshotId).toBe(yesterday.snapshotId);expect(latestCheckpointRecord([yesterday,record],"INST_TEST","09",now).record?.snapshotId).toBe(record.snapshotId);});
 it("keeps morning and afternoon independent and detects ambiguous latest policies",()=>{expect(latestCheckpointRecord([yesterday],"INST_TEST","16",now).record).toBeUndefined();expect(latestCheckpointRecord([record,{...record,snapshotId:"CENSUS_OTHER"}],"INST_TEST","09",now).ambiguous).toBe(true);});
 it("seeds two explicit, identical frontend-only demo matrices",()=>{const demos=demonstrationStockRecords("INST_TEST");expect(demos).toHaveLength(2);expect(demos.every(row=>row.record.triggerType==="DEMONSTRATION")).toBe(true);expect(demos[0].snapshot.groups).toEqual(demos[1].snapshot.groups);expect(demos[0].snapshot.groups.flatMap(g=>g.bloodTypes)).toHaveLength(40);});
});
