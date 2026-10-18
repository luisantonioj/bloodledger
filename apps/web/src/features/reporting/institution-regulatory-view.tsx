import { PaginatedTable } from "../../components/ui/record-pagination";
import { SortableHeader, TableViewBar, useTableView, type TableColumn } from "../../components/ui/table-view";
import {useState} from "react";
import {useLiveData} from "../../hooks/use-live-data";
import type {Dashboard} from "../../services/api/types";
import {AggregateTable} from "../../components/ui/aggregate-tables";
import {formatBloodType,formatManilaDateTime,humanizeCode} from "../../components/ui/display";
interface Snapshot {snapshotId:string;institutionId:string;capturedAt:string;scheduledFor:string}
interface Census {snapshotId:string;capturedAt:string;groups:{componentType:string;bloodTypes:{bloodType:string;availableCount:number;reservedCount:number;reportableCount:number}[]}[]}
type CensusRow = Census["groups"][number]["bloodTypes"][number] & {component:string};
const censusColumns:TableColumn<CensusRow>[]=[
  {id:"component",label:"Component",sortValue:row=>humanizeCode(row.component)},
  {id:"bloodType",label:"Blood type",sortValue:row=>formatBloodType(row.bloodType)},
  {id:"available",label:"Available",sortValue:row=>row.availableCount},
  {id:"reserved",label:"Reserved",sortValue:row=>row.reservedCount},
  {id:"reportable",label:"Reportable",sortValue:row=>row.reportableCount},
];
export function InstitutionRegulatoryView({report=false}:{report?:boolean}) {
  const dashboard=useLiveData<Dashboard>(report ? null : "/api/v2/dashboard");
  const list=useLiveData<{snapshots:Snapshot[];reportAvailability:string}>(report ? "/api/v2/reports/doh-census" : null);
  const [selected,setSelected]=useState("");
  const id=selected || list.data?.snapshots[0]?.snapshotId;
  const detail=useLiveData<Census>(report && id ? "/api/v2/reports/doh-census/"+id : null);
  const error=dashboard.error || list.error || detail.error;
  const rows=detail.data?.groups.flatMap(group=>group.bloodTypes.map(row=>({component:group.componentType,...row})))??[];
  const view=useTableView("institution-census",censusColumns,rows),show=view.isVisible;
  if(!report)return <section>{error&&<p role="alert">{error}</p>}{dashboard.data&&<AggregateTable items={dashboard.data.inventory} plainText/>}</section>;
  const loading=!error&&(list.busy||Boolean(id)&&detail.busy)&&rows.length===0;
  const table=<table className="data-table"><thead><tr><SortableHeader view={view} id="component">Component</SortableHeader><SortableHeader view={view} id="bloodType">Blood type</SortableHeader><SortableHeader view={view} id="available">Available</SortableHeader><SortableHeader view={view} id="reserved">Reserved</SortableHeader><SortableHeader view={view} id="reportable">Reportable</SortableHeader></tr></thead><tbody>
      {view.rows.map(row=><tr key={row.component+row.bloodType}>{show("component")&&<td>{humanizeCode(row.component)}</td>}{show("bloodType")&&<td><span className="aggregate-plain-text">{formatBloodType(row.bloodType)}</span></td>}{show("available")&&<td>{row.availableCount}</td>}{show("reserved")&&<td>{row.reservedCount}</td>}{show("reportable")&&<td>{row.reportableCount}</td>}</tr>)}
      {rows.length===0&&<tr><td colSpan={view.visibleCount}><div className="requester-records-empty census-report-empty" aria-live="polite"><strong>{loading?"Loading census reports…":error?"Reports are unavailable":"No census reports are recorded"}</strong><p>{loading?"Fetching saved inventory summaries.":error?"Use Refresh to try again.":"Saved inventory summaries will appear here when available."}</p></div></td></tr>}
    </tbody></table>;
  return <section className={"institution-census-reports"+(!detail.data?" census-report-without-data":"")}>
    {list.data&&list.data.snapshots.length>0&&<div className="census-report-selector"><label>Stored census<span className="requester-select"><select value={id} onChange={event=>setSelected(event.target.value)}>{list.data.snapshots.map(snapshot=><option key={snapshot.snapshotId} value={snapshot.snapshotId}>{snapshot.institutionId} · {formatManilaDateTime(snapshot.capturedAt)}</option>)}</select></span></label>{detail.data&&<p>Captured {formatManilaDateTime(detail.data.capturedAt)}</p>}</div>}
    {error&&rows.length>0&&<p role="alert">{error}</p>}
    <PaginatedTable total={rows.length} ready={Boolean(detail.data)} label="Census report" resetKey={(id??"")+"|"+view.sortKey} className="table-wrap census-report-table" toolbar={<TableViewBar view={view}/>}>{table}</PaginatedTable>
  </section>;
}
