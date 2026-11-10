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
 it("fills zero for absent cryo, rejects incomplete blood-type coverage and wrong snapshot identity",()=>{const missingCryo=checkpointClipboard({...detail,groups:detail.groups.slice(0,4)},record).trimEnd().split("\r\n").map(row=>row.split("\t"));expect(missingCryo[0]).toContain("Cryo");expect(missingCryo[1][5]).toBe("0");expect(()=>checkpointClipboard({...detail,groups:detail.groups.map(g=>({...g,bloodTypes:g.bloodTypes.slice(0,7)}))},record)).toThrow();expect(()=>checkpointClipboard({...detail,snapshotId:"CENSUS_OTHER"},record)).toThrow();});
});

import {latestCheckpointRecord} from "./checkpoint-copy";
describe("retained latest checkpoint",()=>{
 const yesterday={...record,snapshotId:"CENSUS_YESTERDAY",scheduledFor:"2026-10-15T01:00:00Z",capturedAt:"2026-10-15T01:00:01Z"};
 it("retains yesterday's morning record until a newer reached morning record exists",()=>{expect(latestCheckpointRecord([yesterday,record],"INST_TEST","09",Date.parse("2026-10-16T00:59:59Z")).record?.snapshotId).toBe(yesterday.snapshotId);expect(latestCheckpointRecord([yesterday,record],"INST_TEST","09",now).record?.snapshotId).toBe(record.snapshotId);});
 it("keeps morning and afternoon independent and detects ambiguous latest policies",()=>{expect(latestCheckpointRecord([yesterday],"INST_TEST","16",now).record).toBeUndefined();expect(latestCheckpointRecord([record,{...record,snapshotId:"CENSUS_OTHER"}],"INST_TEST","09",now).ambiguous).toBe(true);});

});

// PA-DEF-07 must copy only real four-component matrices, never an invented cryo count.
describe("automatic checkpoint policy",()=>{
 const automatic={...record,reportPolicyVersion:"SYNTHETIC_STOCK_CHECKPOINT_V1"};
 const four={...detail,...automatic,groups:detail.groups.slice(0,4)};
 it("copies forty values with cryo zero-filled for a four-component automatic checkpoint",()=>{const rows=checkpointClipboard(four,automatic).trimEnd().split("\r\n").map(row=>row.split("\t"));expect(rows).toHaveLength(9);expect(rows.every(row=>row.length===7)).toBe(true);expect(rows[0]).toEqual(["Blood type","Whole Blood","PRBC","FFP","Platelets","Cryo","Total"]);expect(rows[1]).toEqual(["O+","1","9","17","25","0","52"]);expect(rows[8]).toEqual(["AB-","8","16","24","32","0","80"]);});
 it("rejects missing required components and accepts cryo when present in automatic checkpoint",()=>{expect(()=>checkpointClipboard({...four,groups:four.groups.slice(0,3)},automatic)).toThrow();expect(checkpointClipboard({...four,groups:detail.groups},automatic).split("\r\n")[0]).toContain("Cryo");});
 it("never manufactures a missed slot or accepts a future capture",()=>{expect(checkpointRecord([],"INST_TEST","2026-10-16","09",now).record).toBeUndefined();expect(latestCheckpointRecord([{...automatic,capturedAt:"2026-10-17T01:00:00Z"}],"INST_TEST","09",now).record).toBeUndefined();});
});
