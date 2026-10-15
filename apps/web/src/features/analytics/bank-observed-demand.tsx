import {useEffect,useState} from "react";
import {requestJson,retryAfterContextChange} from "../../services/api/client";
import {historyChunks,parseRequestHistory,type RequestHistoryRow} from "../../services/api/blood-bank-completion";
import {InformationHelp} from "../../components/ui/information-help";
import {RefreshButton} from "../../components/ui/refresh-button";
import {ReportingFilters,emptyAnalyticsFilters,type AnalyticsFilters} from "./analytics-reporting-filters";

export function summarizeBankHistory(rows:RequestHistoryRow[],filters:AnalyticsFilters){
  const selected=rows.filter(row=>row.direction==="INCOMING"&&(!filters.bloodType||row.bloodType===filters.bloodType)&&(!filters.component||row.componentType===filters.component));
  const months=new Map<string,{month:string;requests:number;units:number}>();
  for(const row of selected){const month=row.requestDate.slice(0,7),total=months.get(month)??{month,requests:0,units:0};total.requests+=row.requestCount;total.units+=row.requestedUnits;months.set(month,total);}
  return {requests:selected.reduce((sum,row)=>sum+row.requestCount,0),units:selected.reduce((sum,row)=>sum+row.requestedUnits,0),months:[...months.values()].sort((a,b)=>a.month.localeCompare(b.month))};
}
export function BankObservedDemand(){
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const [filters,setFilters]=useState<AnalyticsFilters>({...emptyAnalyticsFilters,from:today.slice(0,4)+"-01-01",to:today});
  const [state,setState]=useState<{rows:RequestHistoryRow[];busy:boolean;ready:boolean;error:string}>({rows:[],busy:true,ready:false,error:""});
  const [revision,setRevision]=useState(0),[metric,setMetric]=useState<"units"|"requests">("units");
  useEffect(()=>{
    const controller=new AbortController();let current=true;
    setState({rows:[],busy:true,ready:false,error:""});
    void(async()=>{try{
      const chunks=historyChunks(filters.from,filters.to),rows:RequestHistoryRow[]=[];
      // Fetch sequential complete date chunks; never substitute the capped transfer list.
      for(const chunk of chunks){const value=await retryAfterContextChange(()=>requestJson<unknown>("/api/v2/analytics/request-history?"+new URLSearchParams(chunk),{signal:controller.signal}),()=>current&&!controller.signal.aborted);rows.push(...parseRequestHistory(value,chunk.from,chunk.to).rows);}
      if(current)setState({rows,busy:false,ready:true,error:""});
    }catch{if(current)setState({rows:[],busy:false,ready:false,error:"Choose a valid date range. If it is valid, request history is unavailable; refresh to try again."});}})();
    return()=>{current=false;controller.abort();};
  },[filters.from,filters.to,revision]);
  const result=summarizeBankHistory(state.rows,filters),peak=[...result.months].sort((a,b)=>b.units-a.units)[0],max=Math.max(1,...result.months.map(row=>row[metric]));
  const cards:[string,string|number|null,string][]=[
    ["Recorded Requests",state.ready?result.requests:null,"Complete incoming request count naming your bank as supplier in the selected Manila date range, across all statuses."],
    ["Units Requested",state.ready?result.units:null,"Requested quantities, not dispatched, received or transfused units."],
    ["Highest Recorded Month",state.ready&&peak?peak.month:null,"Month with the most requested units in the selected range; partial months follow the selected dates."],
    ["Months with Records",state.ready?result.months.length:null,"Months with recorded incoming requests. No departmental or clinical demand census is implied."],
  ];
  return <div className="observed-demand-workspace">
    <header className="page-head analytics-page-head"><h1 className="page-title">Analytics</h1><RefreshButton busy={state.busy} onRefresh={()=>setRevision(value=>value+1)}/></header>
    <ReportingFilters filters={filters} onChange={setFilters} completeHistory/>
    <div className="consortium-summary-grid">{cards.map(([label,value,help])=><section className="consortium-summary" key={label}><header className="consortium-summary-title"><span>{label}</span><InformationHelp label={label}>{help}</InformationHelp></header><strong className="observed-summary-value">{value??"—"}</strong></section>)}</div>
    <div className="regulator-insight-grid">
      <section className="bank-record-card"><header className="bank-section-heading"><h2>Which departments request blood most often?</h2></header><div className="analytics-empty"><strong>Department information unavailable</strong><p>Request departments are not recorded by the published contract.</p></div></section>
      <section className="bank-record-card"><header className="bank-section-heading"><h2>Which months have the greatest blood demand?</h2><InformationHelp label="Monthly demand">Complete incoming request aggregates for {filters.from} to {filters.to}, by Asia/Manila request date. These are observed requests, separate from predicted demand and actual receipts.</InformationHelp></header>
        <div className="observed-metric-controls">{(["units","requests"] as const).map(value=><button key={value} className={"button compact"+(metric===value?" primary":"")} aria-pressed={metric===value} onClick={()=>setMetric(value)}>{value==="units"?"Units requested":"Request count"}</button>)}</div>
        {state.ready&&result.months.length?<div className="observed-month-chart">{result.months.map(row=><div className="observed-month-row" key={row.month}><span>{row.month}</span><div className="observed-month-track"><span style={{width:row[metric]/max*100+"%"}}/></div><strong>{row[metric]}</strong></div>)}</div>:<div className="analytics-empty" role="status"><strong>{state.error?"Request history unavailable":state.busy?"Loading request history…":"No recorded requests in this range"}</strong>{state.error&&<p>{state.error}</p>}</div>}
      </section>
    </div>
  </div>;
}
