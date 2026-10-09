import {useState} from "react";
import {useLiveData} from "../../hooks/use-live-data";
import type {Dashboard} from "../../services/api/types";
import {AggregateTable} from "../../components/ui/aggregate-tables";
import {formatManilaDateTime,humanizeCode} from "../../components/ui/display";
interface Snapshot {snapshotId:string;institutionId:string;capturedAt:string;scheduledFor:string}
interface Census {snapshotId:string;capturedAt:string;groups:{componentType:string;bloodTypes:{bloodType:string;availableCount:number;reservedCount:number;reportableCount:number}[]}[]}
export function InstitutionRegulatoryView({report=false}:{report?:boolean}) {
  const dashboard=useLiveData<Dashboard>(report ? null : "/api/v2/dashboard");
  const list=useLiveData<{snapshots:Snapshot[];reportAvailability:string}>(report ? "/api/v2/reports/doh-census" : null);
  const [selected,setSelected]=useState("");
  const id=selected || list.data?.snapshots[0]?.snapshotId;
  const detail=useLiveData<Census>(report && id ? "/api/v2/reports/doh-census/"+id : null);
  const error=dashboard.error || list.error || detail.error;
  return <section><h2>{report ? "Stored synthetic census reports" : "Institution inventory aggregates"}</h2><p>Authenticated aggregate reads. Historical research stock remains separate; these records do not establish an official reporting format or additional Fabric peers.</p>{error&&<p role="alert">{error}</p>}{dashboard.data&&<AggregateTable items={dashboard.data.inventory}/>}{report&&<><p>{list.data?.reportAvailability?.replaceAll("_"," ")}</p>{list.data?.snapshots.length===0&&<div className="empty">No census reports are recorded. Missing evidence is not shown as zero inventory.</div>}{list.data&&list.data.snapshots.length>0&&<label>Stored census<select value={id} onChange={event=>setSelected(event.target.value)}>{list.data.snapshots.map(snapshot=><option key={snapshot.snapshotId} value={snapshot.snapshotId}>{snapshot.institutionId} · {formatManilaDateTime(snapshot.capturedAt)}</option>)}</select></label>}{detail.data&&<><p>Captured {formatManilaDateTime(detail.data.capturedAt)}</p><div className="table-wrap"><table className="data-table"><thead><tr><th>Component</th><th>Blood type</th><th>Available</th><th>Reserved</th><th>Reportable</th></tr></thead><tbody>{detail.data.groups.flatMap(group=>group.bloodTypes.map(row=><tr key={group.componentType+row.bloodType}><td>{humanizeCode(group.componentType)}</td><td>{humanizeCode(row.bloodType)}</td><td>{row.availableCount}</td><td>{row.reservedCount}</td><td>{row.reportableCount}</td></tr>))}</tbody></table></div></>}</>}</section>;
}
