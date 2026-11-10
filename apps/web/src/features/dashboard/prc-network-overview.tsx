import {PaginatedTable} from "../../components/ui/record-pagination";
import {SortableHeader,TableViewBar,timeValue,useTableView,type TableColumn} from "../../components/ui/table-view";
import {useState,type CSSProperties} from "react";
import type {Dashboard,Consortium} from "../../services/api/types";
import {V2_BLOOD_TYPES,V2_COMPONENT_TYPES} from "../../services/api/v2";
import {formatBloodType,formatManilaDateTime} from "../../components/ui/display";
import {InformationHelp} from "../../components/ui/information-help";
import {componentLabel} from "../transfers/requester-transfer-data";
import {hospitalNetworkRows,networkComponentAvailable,networkColors} from "../consortium/hospital-network-view";

// FR-03/12: same validated city inventory and available-only coverage rules as Network View.
export const prcComponentAvailable = networkComponentAvailable;
export function niceScale(max:number){const raw=Math.max(1,max)/5,power=10**Math.floor(Math.log10(raw)),step=[1,1.5,2,2.5,3,4,5,6,8,10].map(m=>m*power).find(value=>value>=raw)!;return Math.max(5,Math.ceil(step)*5);}
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
 const [chartView,setChartView]=useState("Compare Blood Banks");
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
 // Round the axis up to 5 even, readable steps (e.g. 0–150 in 30s), like the blood-bank overview.
 // Network Total scales to the totals; Compare Blood Banks scales to the individual bank bars.
 const scale=niceScale(chartView==="Network Total"?Math.max(1,...totals.map(value=>value??0)):Math.max(1,...facilities.flatMap(([id])=>V2_BLOOD_TYPES.map(type=>ready?prcComponentAvailable(selected.filter(row=>row.institutionId===id),type,component,1)??0:0))));
 return <>
 <section className="prc-dashboard-card prc-network-overview" aria-labelledby="prc-inventory-heading">
  <header><div><h2 id="prc-inventory-heading">Blood-Bank Inventory Overview</h2></div><InformationHelp label="Blood-Bank Inventory Overview">Compare reported available blood units across blood banks in the consortium. Select a component to update the chart. Reserved units are excluded. The consortium view is now part of this dashboard. All combines available component-unit counts; component rows in the matrix keep products separate. Network Total shows the combined stock; Compare Blood Banks shows each reporting bank. This view does not show stock approved for redistribution. Missing reports stay unavailable. Zero means an explicitly reported zero in this synthetic fixture.</InformationHelp></header>
  <div className="inventory-overview-controls prc-network-filters"><label>Blood component<span className="requester-select"><select aria-label="Dashboard blood component" value={component} onChange={event=>setComponent(event.target.value)}><option value="ALL">All</option>{V2_COMPONENT_TYPES.map(value=><option key={value} value={value}>{componentLabel(value)}</option>)}</select></span></label><label>Chart view<span className="requester-select"><select aria-label="Chart View" value={chartView} onChange={event=>setChartView(event.target.value)}><option>Network Total</option><option>Compare Blood Banks</option></select></span></label>{ready&&chartView==="Compare Blood Banks"&&<div className="inventory-overview-legend prc-network-legend" aria-label="Reported blood banks">{facilities.map(([id,name],index)=><span key={id}><i style={{background:networkColors[index%networkColors.length]}}/>{name}</span>)}</div>}</div>
  <div className="consortium-chart-scroll prc-network-scroll"><div className="prc-network-frame">
   <div className="inventory-overview-axis-title">Available units</div>
   <div className="prc-network-axis" aria-hidden="true">{Array.from({length:6},(_,i)=><span key={i} style={{"--tick-index":i} as CSSProperties}>{scale*(5-i)/5}</span>)}</div>
   <div className="consortium-chart" role="list" aria-label={label+" available inventory by blood type"}>
   {V2_BLOOD_TYPES.map((type,index)=>{
    const total=totals[index];
    const counts=chartView==="Network Total"?[total]:facilities.map(([id])=>ready?prcComponentAvailable(selected.filter(row=>row.institutionId===id),type,component,1):null);
    const percent=(count:number|null)=>count!==null?Math.max(count>0?1:0,count/scale*100):0;
    return <div className="consortium-chart-column prc-network-column" role="listitem" key={type} aria-label={formatBloodType(type)+": "+(total??"unavailable")+" available units"}>
    <span className={"consortium-bar-area"+(chartView==="Network Total"?"":" prc-network-compare")} aria-hidden="true">{chartView==="Network Total"?<span className="consortium-bar" style={{height:percent(total)+"%"}}><span className="consortium-chart-value">{total??"—"}</span></span>:facilities.map(([id,name],facilityIndex)=><span className="consortium-bar" key={id} title={name+": "+(counts[facilityIndex]??"Not reported")} style={{background:networkColors[facilityIndex%networkColors.length],height:percent(counts[facilityIndex])+"%"}}><span className="consortium-chart-value">{counts[facilityIndex]??"—"}</span></span>)}</span>
    <strong>{formatBloodType(type)}</strong>
   </div>;})}
   </div>
  </div></div>
  {!ready||!facilities.length?<div className="prc-network-empty" role="status"><strong>{loading?"Loading network inventory…":error?"Inventory overview unavailable":"Awaiting inventory data"}</strong><span>{error||"No blood-bank stock reports are available in this view yet."}</span></div>:null}
 </section>
 <section className="prc-dashboard-card consortium-matrix-card" aria-labelledby="prc-matrix-heading">
  <header><div><h2 id="prc-matrix-heading">Blood Bank Availability Matrix</h2></div><TableViewBar view={tableView} placement="header"/><InformationHelp label="Blood Bank Availability Matrix">Review each reporting blood bank’s available units for the selected components. All shows a separate row for each bank and component. Reserved units appear beneath available counts. A dash means missing information. Reported availability does not establish redistributable supply or approve a transfer.</InformationHelp></header>
  <PaginatedTable total={matrix.length} ready={ready} resetKey={component+"|"+tableView.sortKey} label="Blood bank component records"><table className="data-table consortium-matrix"><thead><tr><SortableHeader view={tableView} id="bank">Blood bank</SortableHeader><SortableHeader view={tableView} id="component">Component</SortableHeader>{V2_BLOOD_TYPES.map(type=><SortableHeader key={type} view={tableView} id={type}>{formatBloodType(type)}</SortableHeader>)}<SortableHeader view={tableView} id="redistributable">Redistributable</SortableHeader><SortableHeader view={tableView} id="updated">Last updated</SortableHeader></tr></thead><tbody>
   {tableView.rows.map(({id,name,product,rows,oldest})=>{return <tr key={id+product}>{show("bank")&&<td><strong>{name}</strong></td>}{show("component")&&<td>{componentLabel(product)}</td>}{V2_BLOOD_TYPES.filter(show).map(type=>{const row=rows.find(row=>row.bloodType===type);return <td key={type}><strong>{row?.available??"—"}</strong><small>{row?(row.reserved??0)+" reserved":"Reserved: —"}</small></td>;})}{show("redistributable")&&<td>—<small>Not supplied</small></td>}{show("updated")&&<td>{oldest?formatManilaDateTime(oldest):"—"}</td>}</tr>;})}
   {!matrix.length&&<tr><td colSpan={tableView.visibleCount}><div className="requester-records-empty"><strong>{loading?"Loading network inventory…":"No network records available"}</strong><span>{error||"Reported blood-bank inventory will appear here. Missing reports do not mean zero stock."}</span></div></td></tr>}
  </tbody></table></PaginatedTable>
 </section>
 </>;
}
