import {useState} from "react";
import {CursorPaginatedTable} from "../../components/ui/record-pagination";
import {SortableHeader,TableViewBar,useTableView,type TableColumn} from "../../components/ui/table-view";
import {usePagedRead} from "../../hooks/use-paged-read";
import {useLiveData} from "../../hooks/use-live-data";
import {canAct,type Principal} from "../../auth/permissions";
import {ApplicationDetails} from "../auth/application-details";
import type {InstitutionAction} from "./institution-accounts-view";
interface Application{application_id:string;category:string;status:string;version:number;institution_id:string|null;schema_version?:string;detail:{institutionDisplayName:string;primaryAccount?:{requestedLoginEmail?:string}}|null}
const applicationColumns:TableColumn<Application>[]=[
 {id:"institution",label:"Institution",sortValue:row=>row.detail?.institutionDisplayName},
 {id:"category",label:"Category",sortValue:row=>row.category},
 {id:"status",label:"Status",sortValue:row=>row.status},
 {id:"actions",label:"Actions",hideable:false},
];
function parsePage(value:unknown){
 const row=value as {applications?:Application[];nextCursor?:unknown};
 if(!row||!Array.isArray(row.applications)||row.applications.some(app=>!app||typeof app.application_id!=="string"||!/^ONB_[A-Z0-9_]+$/.test(app.application_id)||!["BLOOD_BANK","REQUESTOR"].includes(app.category)||!["SUBMITTED","UNDER_REVIEW","APPROVED","REJECTED","WITHDRAWN"].includes(app.status)||!Number.isSafeInteger(app.version))||(row.nextCursor!==undefined&&row.nextCursor!==null&&(typeof row.nextCursor!=="string"||!/^ONBA_[A-Za-z0-9_-]+$/.test(row.nextCursor))))throw Error("Applications unavailable");
 return {rows:row.applications,nextCursor:row.nextCursor as string|null|undefined??null};
}
export function PublicApplicationsPanel({principal,onSelect}:{principal:Principal;onSelect:(action:InstitutionAction)=>void}){
 const list=usePagedRead("/api/v2/onboarding/applications",parsePage,"application_id",principal.userId+"|"+principal.institutionId);
 const [selected,setSelected]=useState<string>();
 const view=useTableView("institution-applications",applicationColumns,list.rows),show=view.isVisible;
 const detail=useLiveData<{application:Application}>(selected?"/api/v2/onboarding/applications/"+encodeURIComponent(selected):null);
 const app=detail.data?.application&&detail.data.application.application_id===selected?detail.data.application:undefined;
 function action(action:string){
  if(!app)return;
  const login=app.schema_version==="PUBLIC_APPLICATION_V1"?app.detail?.primaryAccount?.requestedLoginEmail:undefined;
  if(action==="activate"&&app.schema_version==="PUBLIC_APPLICATION_V1"&&!login)return;
  onSelect({path:`/api/v2/onboarding/applications/${app.application_id}/${action}`,title:action+" synthetic application",version:app.version,fields:action==="review"?["verificationReference"]:action==="activate"?["reasonCode","loginEmail","password","operatorPin"]:["reasonCode"],fixed:action==="review"?{verificationOutcome:"CONFIRMED"}:login?{loginEmail:login}:undefined});
 }
 return <section className="institution-settings-card"><header><h2>Institution applications</h2><button className="button compact" onClick={list.refresh}>Refresh applications</button></header>
 <CursorPaginatedTable total={list.rows.length} ready={list.ready} hasMore={Boolean(list.nextCursor)} busy={list.busy} error={list.error} loadMore={list.loadMore} label="Applications" resetKey={view.sortKey} toolbar={<TableViewBar view={view}/>}><table className="data-table"><thead><tr><SortableHeader view={view} id="institution">Institution</SortableHeader><SortableHeader view={view} id="category">Category</SortableHeader><SortableHeader view={view} id="status">Status</SortableHeader><SortableHeader view={view} id="actions">Actions</SortableHeader></tr></thead><tbody>{view.rows.map(row=><tr key={row.application_id}>{show("institution")&&<td>{row.detail?.institutionDisplayName??"Retained decision reference"}</td>}{show("category")&&<td>{row.category}</td>}{show("status")&&<td>{row.status}</td>}{show("actions")&&<td><button className="button compact" onClick={()=>setSelected(row.application_id)}>View application</button></td>}</tr>)}{list.ready&&!list.rows.length&&<tr><td colSpan={view.visibleCount}>No applications submitted.</td></tr>}</tbody></table></CursorPaginatedTable>
 {selected&&<section className="application-section"><header className="application-section-heading"><h3>Application details</h3><button className="text-button" onClick={()=>setSelected(undefined)}>Close details</button></header>{app?<><ApplicationDetails value={app}/><div className="application-review-actions">{(app.status==="SUBMITTED"?["review"]:app.status==="UNDER_REVIEW"?["approve","reject"]:app.status==="APPROVED"&&!app.institution_id?["activate"]:[]).filter(value=>canAct(principal,"onboarding:"+(value==="reject"?"approve":value))).map(value=><button className="button compact" key={value} disabled={value==="activate"&&app.schema_version==="PUBLIC_APPLICATION_V1"&&!app.detail?.primaryAccount?.requestedLoginEmail} onClick={()=>action(value)}>{value}</button>)}</div></>:<p>{detail.error?"Application details are unavailable.":"Loading application details…"}</p>}</section>}
 </section>;
}
