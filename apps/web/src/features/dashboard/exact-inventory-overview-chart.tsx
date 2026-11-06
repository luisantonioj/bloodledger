import {useState,type CSSProperties} from "react";
import {useExactStock} from "./use-exact-stock";
import {classifyStock,stockSegments,type StockSegment} from "./stock-classification";
import {StockThresholdSegment} from "./stock-threshold-segment";
import {formatBloodType,formatManilaDateTime} from "../../components/ui/display";
import {componentLabel} from "../transfers/requester-transfer-data";
import {V2_COMPONENT_TYPES} from "../../services/api/v2";
import {bloodTypeOrder} from "./inventory-overview";
import type {ExactStockRow,STOCK_STATUS_FIELDS} from "../../services/api/panel-revisions";

const availabilityOptions = {
 AVAILABLE: {label:"Available", axis:"Available units", count:(row:ExactStockRow)=>row.available},
 RESERVED: {label:"Reserved", axis:"Reserved units", count:(row:ExactStockRow)=>row.reserved},
};
type Availability = keyof typeof availabilityOptions;

const exactStatusLabels = {
 available:"Available",
 reserved:"Reserved",
 expired:"Expired",
 labelExpiredPendingEvaluation:"Label expired, pending evaluation",
 outgoingInTransit:"Outgoing in transit",
 received:"Received (not usable)",
 onHold:"On hold",
 compromised:"Compromised",
} satisfies Record<(typeof STOCK_STATUS_FIELDS)[number], string>;
const tooltipFields = Object.keys(exactStatusLabels) as (keyof typeof exactStatusLabels)[];
export function ExactInventoryOverviewChart({institutionId}:{institutionId:string}){
 const stock=useExactStock(institutionId),[component,setComponent]=useState("ALL");
 const [availability,setAvailability]=useState<Availability>("AVAILABLE");
 const view=availabilityOptions[availability],showBands=availability==="AVAILABLE";
 const data=stock.data,rows=data?.rows.filter(row=>component==="ALL"||row.componentType===component)??[],products=component==="ALL"?[...V2_COMPONENT_TYPES]:[component];
 const maximum=Math.ceil(Math.max(5,...rows.map(view.count))/5)*5,styles={"--overview-groups":bloodTypeOrder.length,"--overview-products":products.length,"--overview-width":`${Math.max(720,bloodTypeOrder.length*products.length*72)}px`} as CSSProperties;
 return <section className="inventory-overview-card exact-stock-card" aria-labelledby="inventory-overview-title"><header><h2 id="inventory-overview-title">Blood Inventory Overview</h2><a className="inventory-overview-link" href="/inventory">View inventory →</a></header>
 <div className="inventory-overview-controls">
  <label>Blood component<span className="requester-select"><select aria-label="Inventory overview blood component" value={component} onChange={event=>setComponent(event.target.value)}><option value="ALL">All</option>{V2_COMPONENT_TYPES.map(value=><option key={value} value={value}>{componentLabel(value)}</option>)}</select></span></label>
  <label>Availability<span className="requester-select"><select aria-label="Availability" value={availability} onChange={event=>setAvailability(event.target.value as Availability)}>
    {Object.entries(availabilityOptions).map(([value,option])=><option key={value} value={value}>{option.label}</option>)}
  </select></span></label>
  {showBands&&<div className="inventory-overview-legend" aria-label="Demonstration stock bands">{["critical","low","adequate","surplus"].map(band=><span key={band}><i className={band}/>{band[0].toUpperCase()+band.slice(1)}</span>)}</div>}
 </div>
 {data?<>{data.pendingCommands>0&&<p className="panel-stock-pending">{data.pendingCommands} changes pending ledger confirmation</p>}<div className="inventory-overview-scroll" tabIndex={0} role="region" aria-label="Scrollable inventory chart" style={styles}><div className="inventory-overview-frame"><div className="inventory-overview-axis-title">{view.axis}</div><div className="inventory-overview-axis" aria-hidden="true">{Array.from({length:6},(_,i)=><span key={i} style={{"--tick-index":i} as CSSProperties}>{maximum*(5-i)/5}</span>)}</div><div className="inventory-overview-chart" role="list" aria-label={`${view.axis} by blood type and component`}>{bloodTypeOrder.map(blood=><div className="inventory-overview-group" role="listitem" key={blood} aria-label={formatBloodType(blood)}><div className="inventory-overview-products" role="list" aria-label={formatBloodType(blood)+" components"}>{rows.filter(row=>row.bloodType===blood).map(row=>{
 const count=view.count(row),height=count/maximum*100,product=formatBloodType(blood)+" "+componentLabel(row.componentType);
 const band=showBands&&stock.fresh?classifyStock(blood,row.componentType,row.available):null;
 const countSummary=showBands?undefined:`${view.label}: ${count}`;
 const exact=tooltipFields.map((field): [string, number] => [exactStatusLabels[field], row[field]]);
 const description=exact.map(([label,count])=>label+": "+count).join("; ");
 const segments:StockSegment[]=showBands
  ? stockSegments(blood,row.componentType,count,stock.fresh?count:null)
  : [{band:"unknown",start:0,end:count,range:String(count),explanation:"Exact count for this availability view."}];
 const tooltip={product,exact,stockBand:band??"unavailable",countSummary};
 return <div className={`inventory-overview-bar stock-${band??"unknown"}`} role="listitem" key={row.componentType} aria-label={`${product}: ${description}; ${countSummary??"demo band "+(band??"unavailable")}`}>
  <div className="inventory-overview-track">
   <strong style={{bottom:`calc(${height}% + 9px)`}}>{count}</strong>
   {count>0?<span className="inventory-overview-fill threshold-segmented-fill" style={{height:`${height}%`}}>
     {segments.map(segment=><StockThresholdSegment key={segment.band} segment={segment} total={count} {...tooltip}/>)}
   </span>:<StockThresholdSegment empty segment={{band:band??"unknown",start:0,end:0,range:"0",explanation:"No units recorded for this availability view."}} total={1} {...tooltip}/>}
  </div>
  <span className="inventory-overview-product-label">{componentLabel(row.componentType)}</span>
 </div>;
 })}</div><span className="inventory-overview-label">{formatBloodType(blood)}</span></div>)}</div></div></div>
 </>:<p role="status">{stock.error?"Exact stock counts unavailable. Refresh to try again.":"Loading exact stock counts…"}</p>}
 {stock.error&&data&&<p role="alert">Exact counts could not refresh. Displayed snapshot is from {formatManilaDateTime(data.evaluatedAt)}; do not treat it as current.</p>}</section>;
}
