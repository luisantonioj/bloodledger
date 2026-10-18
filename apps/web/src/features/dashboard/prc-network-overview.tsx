import {PaginatedTable} from "../../components/ui/record-pagination";
import {SortableHeader,TableViewBar,timeValue,useTableView,type TableColumn} from "../../components/ui/table-view";
import {useState} from "react";
import type {Dashboard,Consortium} from "../../services/api/types";
import {V2_BLOOD_TYPES,V2_COMPONENT_TYPES} from "../../services/api/v2";
import {formatBloodType,formatManilaDateTime} from "../../components/ui/display";
import {InformationHelp} from "../../components/ui/information-help";
import {componentLabel} from "../transfers/requester-transfer-data";
import {hospitalNetworkRows,networkComponentAvailable,networkColors} from "../consortium/hospital-network-view";

// FR-03/12: same validated city inventory and available-only coverage rules as Network View.
export const prcComponentAvailable = networkComponentAvailable;
export function prcNetworkOverview(data:Dashboard,component:string){
 const rows=hospitalNetworkRows({...data,alerts:[],transferSummary:[]} as Consortium);
 const ready=data.lastSuccessfulProjectionAt!==null&&Number.isFinite(Date.parse(data.lastSuccessfulProjectionAt));
 const facilities=[...new Map(rows.map(row=>[row.institutionId,row.facility])).entries()];
 const selected=rows.filter(row=>component==="ALL"||row.component===component);
 const totals=V2_BLOOD_TYPES.map(type=>ready?prcComponentAvailable(selected,type,component,facilities.length):null);
 return {ready,facilities,selected,totals};
}
export function PrcNetworkOverview({data,loading=false}:{data:Dashboard;loading?:boolean}){
 const [component,setComponent]=useState<string>("ALL");
 const [chartView,setChartView]=useState("Network Total");
 let view:ReturnType<typeof prcNetworkOverview>={ready:false,facilities:[],selected:[],totals:V2_BLOOD_TYPES.map(()=>null)},error="";
 try{view=prcNetworkOverview(data,component);}catch{error="Network inventory is unavailable for this view.";}
 const {ready,facilities,selected,totals}=view;
 const products=component==="ALL"?V2_COMPONENT_TYPES:[component];
 const matrix=ready?facilities.flatMap(([id,name])=>products.map(product=>{const rows=selected.filter(row=>row.institutionId===id&&row.component===product);return {id,name,product,rows,oldest:rows.reduce<string|null>((date,row)=>!date||Date.parse(row.updatedAt)<Date.parse(date)?row.updatedAt:date,null)};})):[];
 type MatrixRow=typeof matrix[number];
 const matrixColumns:TableColumn<MatrixRow>[]=[
  {id:"bank",label:"Blood bank",sortValue:row=>row.name},
  {id:"component",label:"Component",sortValue:row=>componentLabel(row.product)},
  ...V2_BLOOD_TYPES.map(type=>({id:type,label:formatBloodType(type),sortValue:(row:MatrixRow)=>row.rows.find(item=>item.bloodType===type)?.available??null})),
  {id:"redistributable",label:"Redistributable"},
  {id:"updated",label:"Last updated",sortValue:row=>timeValue(row.oldest)},
 ];
 const tableView=useTableView("prc-network-matrix",matrixColumns,matrix),show=tableView.isVisible;
 const label=component==="ALL"?"All components":componentLabel(component);
 const max=Math.max(1,...totals.map(value=>value??0),...facilities.flatMap(([id])=>V2_BLOOD_TYPES.map(type=>ready?prcComponentAvailable(selected.filter(row=>row.institutionId===id),type,component,1)??0:0)));
 return <>
 <section className="prc-dashboard-card prc-network-overview" aria-labelledby="prc-inventory-heading">
  <header><div><h2 id="prc-inventory-heading">Blood-Bank Inventory Overview</h2></div><InformationHelp label="Blood-Bank Inventory Overview">Compare reported available blood units across blood banks in the consortium. Select a component to update the chart. Reserved units are excluded. The consortium view is now part of this dashboard. All combines available component-unit counts; component rows in the matrix keep products separate. Network Total shows the combined stock; Compare Blood Banks shows each reporting bank. This view does not show stock approved for redistribution. Missing reports stay unavailable. Zero means an explicitly reported zero in this synthetic fixture.</InformationHelp></header>
  <div className="prc-network-controls"><label>Blood component<span className="requester-select"><select aria-label="Dashboard blood component" value={component} onChange={event=>setComponent(event.target.value)}><option value="ALL">All</option>{V2_COMPONENT_TYPES.map(value=><option key={value} value={value}>{componentLabel(value)}</option>)}</select></span></label><label>Chart view<span className="requester-select"><select aria-label="Chart View" value={chartView} onChange={event=>setChartView(event.target.value)}><option>Network Total</option><option>Compare Blood Banks</option></select></span></label></div>{ready&&chartView==="Compare Blood Banks"&&<div className="consortium-legend" aria-label="Reported blood banks">{facilities.map(([id,name],index)=><span key={id}><i style={{background:networkColors[index%networkColors.length]}}/>{name}</span>)}</div>}
  <div className="consortium-chart-scroll"><div className="consortium-chart" role="list" aria-label={label+" available inventory by blood type"}>
   {V2_BLOOD_TYPES.map((type,index)=><div className="consortium-chart-column prc-network-column" role="listitem" key={type} aria-label={formatBloodType(type)+": "+(totals[index]??"unavailable")+" available units"}>
    <span className="consortium-chart-value">{totals[index]??"—"}</span>
    <span className="consortium-bar-area" aria-hidden="true">{chartView==="Network Total"?<span className="consortium-bar" style={{height:totals[index]!==null?Math.max(totals[index]!>0?2:0,totals[index]!/max*100)+"%":"0%"}}/>:facilities.map(([id,name],facilityIndex)=>{const count=ready?prcComponentAvailable(selected.filter(row=>row.institutionId===id),type,component,1):null;return <span className="consortium-bar" key={id} title={name+": "+(count??"Not reported")} style={{background:networkColors[facilityIndex%networkColors.length],height:count!==null?Math.max(count>0?2:0,count/max*100)+"%":"0%"}}/>;})}</span>
    <strong>{formatBloodType(type)}</strong><small>{totals[index]===null?"Not reported":totals[index]===0?"No available units":"Available units"}</small>
   </div>)}
  </div></div>
  {!ready||!facilities.length?<div className="prc-network-empty" role="status"><strong>{loading?"Loading network inventory…":error?"Inventory overview unavailable":"Awaiting inventory data"}</strong><span>{error||"No blood-bank stock reports are available in this view yet."}</span></div>:<p className="consortium-chart-note">Reported available units · {label} · Reserved stock excluded</p>}
 </section>
 <section className="prc-dashboard-card consortium-matrix-card" aria-labelledby="prc-matrix-heading">
  <header><div><h2 id="prc-matrix-heading">Blood Bank Availability Matrix</h2></div><InformationHelp label="Blood Bank Availability Matrix">Review each reporting blood bank’s available units for the selected components. All shows a separate row for each bank and component. Reserved units appear beneath available counts. A dash means missing information. Reported availability does not establish redistributable supply or approve a transfer.</InformationHelp></header>
  <PaginatedTable total={matrix.length} ready={ready} resetKey={component+"|"+tableView.sortKey} label="Blood bank component records" toolbar={<TableViewBar view={tableView}/>}><table className="data-table consortium-matrix"><thead><tr><SortableHeader view={tableView} id="bank">Blood bank</SortableHeader><SortableHeader view={tableView} id="component">Component</SortableHeader>{V2_BLOOD_TYPES.map(type=><SortableHeader key={type} view={tableView} id={type}>{formatBloodType(type)}</SortableHeader>)}<SortableHeader view={tableView} id="redistributable">Redistributable</SortableHeader><SortableHeader view={tableView} id="updated">Last updated</SortableHeader></tr></thead><tbody>
   {tableView.rows.map(({id,name,product,rows,oldest})=>{return <tr key={id+product}>{show("bank")&&<td><strong>{name}</strong></td>}{show("component")&&<td>{componentLabel(product)}</td>}{V2_BLOOD_TYPES.filter(show).map(type=>{const row=rows.find(row=>row.bloodType===type);return <td key={type}><strong>{row?.available??"—"}</strong><small>{row?.reserved!==null&&row?.reserved!==undefined?row.reserved+" reserved":"Reserved: —"}</small></td>;})}{show("redistributable")&&<td>—<small>Not supplied</small></td>}{show("updated")&&<td>{oldest?formatManilaDateTime(oldest):"—"}</td>}</tr>;})}
   {!matrix.length&&<tr><td colSpan={tableView.visibleCount}><div className="requester-records-empty"><strong>{loading?"Loading network inventory…":"No network records available"}</strong><span>{error||"Reported blood-bank inventory will appear here. Missing reports do not mean zero stock."}</span></div></td></tr>}
  </tbody></table></PaginatedTable>
 </section>
 </>;
}
