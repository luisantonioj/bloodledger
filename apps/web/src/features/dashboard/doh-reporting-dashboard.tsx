import { DashboardAlertSummary } from "./dashboard-alert-summary";
import {useEffect,useState} from "react";
import type {Principal} from "../../auth/permissions";
import {can} from "../../auth/permissions";
import {InformationHelp} from "../../components/ui/information-help";
import {RefreshButton} from "../../components/ui/refresh-button";
import {formatBloodType,formatManilaDateTime} from "../../components/ui/display";
import {useLiveData} from "../../hooks/use-live-data";
import {CENSUS_ORDER,readCompleteCensusIndex,type CensusIndex,type CensusSnapshot} from "../../services/api/census-index";
import {V2_COMPONENT_TYPES} from "../../services/api/v2";
import {checkpointRecord} from "../reporting/checkpoint-copy";
import {parseComplianceStock} from "../reporting/compliance-stock";
import {componentLabel} from "../transfers/requester-transfer-data";

// Configured simulation participants, matching the existing bank request selector.
// This is not an authoritative register of licensed/required reporting facilities.
const hospitals=[
 {id:"INST_MEDIATRIX",name:"Mary Mediatrix Medical Center"},
 {id:"INST_SYNTH_MEDIX",name:"Lipa Medix Medical Center"},
 {id:"INST_SYNTH_NLVILLA",name:"N.L. Villa Memorial Medical Center"},
];
const slots=[{hour:"09",label:"Morning",time:"9 AM"},{hour:"16",label:"Afternoon",time:"4 PM"}] as const;
type Slot=typeof slots[number]["hour"];
function manilaToday(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}
function matchingReports(index:CensusIndex|undefined,institutionId:string,date:string,hour:Slot){
 // Reuse reached-checkpoint validation; retain every duplicate for explicit review.
 return (index?.snapshots??[]).filter(row=>checkpointRecord([row],institutionId,date,hour).record).sort((a,b)=>Date.parse(a.capturedAt)-Date.parse(b.capturedAt));
}
function captureTime(value:string){return new Intl.DateTimeFormat("en-PH",{timeZone:"Asia/Manila",hour:"numeric",minute:"2-digit"}).format(new Date(value));}

export function DohReportingDashboard({principal}:{principal:Principal}){
 const [date,setDate]=useState(manilaToday),[retry,setRetry]=useState(0);
 const [index,setIndex]=useState<CensusIndex>(),[busy,setBusy]=useState(true),[error,setError]=useState("");
 const [hospitalId,setHospitalId]=useState(""),[slot,setSlot]=useState<Slot>("09"),[recordId,setRecordId]=useState("");
 useEffect(()=>{
  const controller=new AbortController();setBusy(true);setIndex(undefined);setError("");
  if(!can(principal,"reports:read")){setError("Report access is unavailable for this account.");setBusy(false);return;}
  void readCompleteCensusIndex(principal,controller.signal).then(value=>{if(!controller.signal.aborted)setIndex(value);}).catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"Reports are unavailable.");}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});
  return()=>controller.abort();
 },[principal,retry]);
 const hospital=hospitals.find(row=>row.id===hospitalId);
 const candidates=matchingReports(index,hospitalId,date,slot);
 const selected=candidates.length===1?candidates[0]:candidates.find(row=>row.snapshotId===recordId);
 function view(id:string){setHospitalId(id);setRecordId("");setSlot(matchingReports(index,id,date,"09").length?"09":matchingReports(index,id,date,"16").length?"16":"09");}
 function status(id:string,hour:Slot){
  if(busy)return <span className="doh-report-status">Loading reports…</span>;
  if(!index)return <span className="doh-report-status">Unavailable</span>;
  const matches=matchingReports(index,id,date,hour);
  return matches.length===1?<div className="doh-report-checkpoint"><span className="doh-report-status recorded">Recorded</span><small>{captureTime(matches[0].capturedAt)}</small></div>:matches.length>1?<span className="doh-report-status review">Multiple records · Review</span>:<span className="doh-report-status">No report recorded</span>;
 }
 return <div className="doh-reporting-dashboard"><DashboardAlertSummary principal={principal}/>
  <header className="page-head doh-reporting-header"><h1 className="page-title">Dashboard</h1><div className="doh-reporting-tools"><label>Reporting date<input type="date" aria-label="Reporting date" required value={date} onChange={event=>{if(event.target.value){setDate(event.target.value);setRecordId("");}}}/></label><RefreshButton busy={busy} onRefresh={()=>setRetry(value=>value+1)}/></div></header>
  <section className="bank-record-card doh-hospital-reports">
   <header className="bank-section-heading"><h2>Hospital Reports</h2><InformationHelp label="Hospital Reports">The three configured simulation blood banks and saved 9 AM/4 PM census captures for the selected Manila date. These are saved records, not confirmed regulatory submissions. Missing records do not establish noncompliance. The configured list is not an official licensing or reporting roster.</InformationHelp></header>
   {error&&<div className="doh-report-read-error" role="status"><strong>Reports unavailable</strong><span>Refresh to try again. Reporting status cannot be determined.</span></div>}
   <div className="table-wrap"><table className="data-table doh-hospital-report-table"><thead><tr><th>Hospital</th><th>Morning <span>9 AM</span></th><th>Afternoon <span>4 PM</span></th><th>Action</th></tr></thead><tbody>
    {hospitals.map(row=><tr key={row.id} className={hospitalId===row.id?"selected":""}><td><strong>{row.name}</strong></td><td>{status(row.id,"09")}</td><td>{status(row.id,"16")}</td><td><button type="button" className="button compact" disabled={!index||busy} aria-label={"View reports for "+row.name} aria-pressed={hospitalId===row.id} onClick={()=>view(row.id)}>View reports</button></td></tr>)}
   </tbody></table></div>
  </section>
  <section className="bank-record-card doh-hospital-report-viewer" aria-label="Hospital report viewer">
   <header className="bank-section-heading"><h2>{hospital?.name??"Report Details"}</h2><InformationHelp label="Hospital report details">Select Morning or Afternoon to inspect the saved stock matrix for this hospital and date. A dash is missing component coverage. Saved stock does not establish verification or regulatory approval; no record is created from this view.</InformationHelp></header>
   {!hospital?<div className="requester-records-empty"><strong>Select a hospital</strong><span>Choose View reports to inspect its morning and afternoon stock records.</span></div>:<>
    <div className="doh-report-viewer-toolbar"><span>{date} · Asia/Manila</span><div className="doh-report-slots" role="group" aria-label="Reporting checkpoint">{slots.map(item=><button className={"button compact"+(slot===item.hour?" primary":"")} type="button" key={item.hour} aria-pressed={slot===item.hour} onClick={()=>{setSlot(item.hour);setRecordId("");}}>{item.label} · {item.time}</button>)}</div></div>
    {candidates.length>1&&<label className="doh-record-version">Recorded version<span className="requester-select"><select aria-label="Recorded version" value={recordId} onChange={event=>setRecordId(event.target.value)}><option value="">Choose a recorded version</option>{candidates.map(row=><option value={row.snapshotId} key={row.snapshotId}>{formatManilaDateTime(row.capturedAt)} · {row.snapshotId}</option>)}</select></span></label>}
    {selected?<RecordedStock key={selected.snapshotId+"|"+retry} selected={selected}/>:<div className="requester-records-empty"><strong>{busy?"Loading reports…":!index?"Reports unavailable":candidates.length>1?"Select a recorded version":"No report recorded"}</strong><span>{busy?"Fetching saved records.":!index?"Refresh to try again.":candidates.length>1?"Several captures match this checkpoint. Choose the record to inspect.":"No saved capture was found for this hospital, date and checkpoint."}</span></div>}
   </>}
  </section>
 </div>;
}
function RecordedStock({selected}:{selected:CensusSnapshot}){
 const detail=useLiveData<unknown>("/api/v2/reports/doh-census/"+encodeURIComponent(selected.snapshotId));
 let groups:ReturnType<typeof parseComplianceStock>=[],error=detail.error;
 if(detail.data&&!error){try{groups=parseComplianceStock(detail.data,selected);}catch{error="The selected report’s stock detail is unavailable.";}}
 return <>
  <p className="doh-report-captured">Recorded {formatManilaDateTime(selected.capturedAt)}</p>
  {error?<div className="requester-records-empty" role="status"><strong>Report details unavailable</strong><span>Use Refresh to try again.</span></div>:!groups.length?<div className="requester-records-empty"><strong>Loading recorded stock…</strong></div>:<div className="table-wrap"><table className="data-table compliance-stock-table doh-report-stock-table"><thead><tr><th>Blood type</th>{V2_COMPONENT_TYPES.map(component=><th key={component}>{componentLabel(component)}</th>)}<th>Total</th></tr></thead><tbody>{CENSUS_ORDER.map(type=>{
   const values=V2_COMPONENT_TYPES.map(component=>groups.find(group=>group.componentType===component)?.bloodTypes.find(row=>row.bloodType===type)?.reportableCount??null);
   return <tr key={type}><td>{formatBloodType(type)}</td>{values.map((value,i)=><td key={V2_COMPONENT_TYPES[i]}>{value??"—"}</td>)}<td>{values.every(value=>value!==null)?values.reduce<number>((sum,value)=>sum+value!,0):"—"}</td></tr>;
  })}</tbody></table></div>}
 </>;
}
