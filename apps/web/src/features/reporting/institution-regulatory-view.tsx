import {useState} from "react";
import {useLiveData} from "../../hooks/use-live-data";
import type {Dashboard} from "../../services/api/types";
import {AggregateTable} from "../../components/ui/aggregate-tables";
import {formatBloodType,formatManilaDateTime,humanizeCode} from "../../components/ui/display";
interface Snapshot {snapshotId:string;institutionId:string;capturedAt:string;scheduledFor:string}
interface Census {snapshotId:string;capturedAt:string;groups:{componentType:string;bloodTypes:{bloodType:string;availableCount:number;reservedCount:number;reportableCount:number}[]}[]}
export function InstitutionRegulatoryView({report=false}:{report?:boolean}) {
  const dashboard=useLiveData<Dashboard>(report ? null : "/api/v2/dashboard");
  const list=useLiveData<{snapshots:Snapshot[];reportAvailability:string}>(report ? "/api/v2/reports/doh-census" : null);
  const [selected,setSelected]=useState("");
  const id=selected || list.data?.snapshots[0]?.snapshotId;
  const detail=useLiveData<Census>(report && id ? "/api/v2/reports/doh-census/"+id : null);
  const error=dashboard.error || list.error || detail.error;
  if(!report)return <section>{error&&<p role="alert">{error}</p>}{dashboard.data&&<AggregateTable items={dashboard.data.inventory} plainText/>}</section>;
  const rows=detail.data?.groups.flatMap(group=>group.bloodTypes.map(row=>({component:group.componentType,...row})))??[];
  const loading=!error&&(list.busy||Boolean(id)&&detail.busy)&&rows.length===0;
  return <section className="institution-census-reports">
    {list.data&&list.data.snapshots.length>0&&<div className="census-report-selector"><label>Stored census<span className="requester-select"><select value={id} onChange={event=>setSelected(event.target.value)}>{list.data.snapshots.map(snapshot=><option key={snapshot.snapshotId} value={snapshot.snapshotId}>{snapshot.institutionId} · {formatManilaDateTime(snapshot.capturedAt)}</option>)}</select></span></label>{detail.data&&<p>Captured {formatManilaDateTime(detail.data.capturedAt)}</p>}</div>}
    {error&&rows.length>0&&<p role="alert">{error}</p>}
    <div className="table-wrap census-report-table"><table className="data-table"><thead><tr><th>Component</th><th>Blood type</th><th>Available</th><th>Reserved</th><th>Reportable</th></tr></thead><tbody>
      {rows.map(row=><tr key={row.component+row.bloodType}><td>{humanizeCode(row.component)}</td><td><span className="aggregate-plain-text">{formatBloodType(row.bloodType)}</span></td><td>{row.availableCount}</td><td>{row.reservedCount}</td><td>{row.reportableCount}</td></tr>)}
      {rows.length===0&&<tr><td colSpan={5}><div className="requester-records-empty census-report-empty" aria-live="polite"><strong>{loading?"Loading census reports…":error?"Reports are unavailable":"No census reports are recorded"}</strong><p>Reports summarize recorded inventory. Historical research stock is kept separate.</p><p>Missing report data does not mean there is no stock.</p>{list.data?.reportAvailability?.includes("EXPORT_DISABLED")&&<p>Report export is not available yet.</p>}{error&&<p role="alert">{error}</p>}</div></td></tr>}
    </tbody></table></div>
  </section>;
}
