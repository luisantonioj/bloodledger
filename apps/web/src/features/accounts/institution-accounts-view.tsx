import {useInstitutionStaffManagement} from "./institution-staff-management";
import { PublicApplicationsPanel } from "./public-applications-panel";
import { safeText,type RetainedFacilityProfile,type ApplicationLink } from "../auth/application-details";
import { PaginatedTable } from "../../components/ui/record-pagination";
import { SortableHeader, TableViewBar, useTableView, type TableColumn } from "../../components/ui/table-view";
import { InstitutionProfileSections } from "../profile/institution-profile-sections";
import { InformationHelp } from "../../components/ui/information-help";
import { humanizeCode, statusClassName } from "../../components/ui/display";
import { useRef, useState } from "react";
import { canAct, type Principal } from "../../auth/permissions";
import { useLiveData } from "../../hooks/use-live-data";
import { ApiRequestError, requestJson } from "../../services/api/client";
import { newMutationKeys, type MutationKeys } from "../../services/api/mutation-keys";

interface Institution {institution_id: string; display_name: string; account_category: string; status: string; version: number; username?: string}
interface Operator {job_title?:string|null;operator_id: string; role_id: string; capability_profile: string; status: string; version: number}
const institutionColumns: TableColumn<Institution>[] = [
  { id: "institution", label: "Institution", sortValue: inst => inst.display_name },
  { id: "category", label: "Category", sortValue: inst => inst.account_category },
  { id: "login", label: "Login", sortValue: inst => inst.username },
  { id: "status", label: "Status", sortValue: inst => inst.status },
  { id: "actions", label: "Actions", hideable: false },
];
const accessProfile = (value: string) => value === "INSTITUTION_ADMIN" ? "Administrator" : value === "ROLE" ? "Role permissions" : humanizeCode(value);
const operatorColumns: TableColumn<Operator>[] = [
  { id: "operator", label: "Operator", sortValue: operator => operator.operator_id },
  { id: "role", label: "Role", sortValue: operator => operator.job_title??roleName(operator.role_id) },
  { id: "access", label: "Access profile", sortValue: operator => accessProfile(operator.capability_profile) },
  { id: "status", label: "Status", sortValue: operator => humanizeCode(operator.status) },
  { id: "actions", label: "Actions", hideable: false },
];
export type InstitutionAction = {path: string; title: string; version?: number; fields: string[]; fixed?: Record<string, unknown>};

export function InstitutionAccountsView({principal,mode="accounts"}: {principal: Principal;mode?:"profile"|"accounts"}) {
  const profileMode=mode==="profile";
  const prc = principal.accountCategory === "PRC" && !profileMode;
  const directory = useLiveData<{institutions: Institution[]}>(prc ? "/api/v2/onboarding/institutions" : null);
  const profile = useLiveData<{institution: Institution; operators: Operator[];facilityProfile?:RetainedFacilityProfile|null;application?:ApplicationLink|null}>("/api/v2/onboarding/institutions/" + principal.institutionId);
  const [applicationRevision,setApplicationRevision]=useState(0),[viewInstitution,setViewInstitution]=useState<string>();
  const otherProfile=useLiveData<{institution:Institution;application?:ApplicationLink|null}>(prc&&viewInstitution?"/api/v2/onboarding/institutions/"+encodeURIComponent(viewInstitution):null);
  const [search,setSearch]=useState(""),[operatorStatus,setOperatorStatus]=useState("ACTIVE");
  const [selected, setSelected] = useState<InstitutionAction>();
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [detailPurged,setDetailPurged]=useState(false);
  const attempt = useRef<{keys: MutationKeys; payload: Record<string, unknown>} | undefined>(undefined);
  const institutions = prc ? directory.data?.institutions ?? [] : profile.data ? [profile.data.institution] : [];
  function choose(action: InstitutionAction) {setDetailPurged(false);setSelected(action); setValues({reasonCode:action.path.endsWith("/revoke")?"OPERATOR_REVOKED":action.path.endsWith("/reset-pin")?"CREDENTIAL_RESET":"SYNTHETIC_REVIEW",...Object.fromEntries(Object.entries(action.fixed??{}).filter(([,value])=>typeof value==="string"))} as Record<string,string>); setMessage(""); attempt.current = undefined;}
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!selected||detailPurged) return;
    setBusy(true); setMessage("");
    const current = attempt.current ?? (() => {
      const keys = newMutationKeys();
      const payload: Record<string, unknown> = {...Object.fromEntries(selected.fields.map(field => [field, values[field]])), ...selected.fixed, correlationId:keys.correlationId};
      if (selected.version !== undefined) payload.expectedVersion = selected.version;
      return {keys, payload};
    })();
    attempt.current = current;
    try {
      const result = await requestJson<{invitationSecret?: string | null}>(selected.path, {method:"POST",headers:{"Idempotency-Key":current.keys.idempotencyKey},body:JSON.stringify(current.payload)});
      setMessage(result.invitationSecret ? "Invitation secret for private delivery: " + result.invitationSecret : "Change recorded. The server remains authoritative for access.");
      setValues({}); setSelected(undefined); attempt.current = undefined;
      directory.manual(); profile.manual(); otherProfile.manual(); setApplicationRevision(value=>value+1);
    } catch (reason) {if(reason instanceof ApiRequestError&&reason.code==="ONB_APPLICATION_DETAIL_PURGED"){attempt.current=undefined;setDetailPurged(true);setMessage("This application’s retained details have expired. The facility must reapply before activation. This attempt cannot be retried.");}else setMessage(reason instanceof Error ? reason.message : "Change failed.");}
    finally {setBusy(false);}
  }
  const admin = principal.accountCategory === "PRC" || canAct(principal,"institution:profile");
  const institution=profile.data?.institution;
  const name=institution?.institution_id==="INST_SYNTH_METROLIPA" && institution.display_name==="Synthetic Metro Lipa" ? "Metro Lipa Medical Center" : institution?.display_name ?? principal.institutionDisplayName;
  const operators=profile.data?.operators;
  const staff=useInstitutionStaffManagement(principal,institution,operators??[],()=>{profile.manual();directory.manual();window.dispatchEvent(new Event("bloodledger:staff-updated"));});
  const filteredOperators=(operators??[]).filter(operator=>(operatorStatus==="ALL"||operator.status===operatorStatus)&&`${operator.operator_id} ${operator.role_id} ${operator.capability_profile} ${operator.job_title??""} ${roleName(operator.role_id)}`.toLowerCase().includes(search.trim().toLowerCase()));
  const institutionView=useTableView("institution-accounts",institutionColumns,institutions),showInstitution=institutionView.isVisible;
  const operatorView=useTableView("staff-accounts",operatorColumns,filteredOperators),showOperator=operatorView.isVisible;
  const facility=profile.data?.facilityProfile?.facility;
  const linkedProfile=profile.data?.facilityProfile,applicationLink=profile.data?.application;
  const ownEdit=institution&&institution.status!=="DEREGISTERED"?{path:`/api/v2/onboarding/institutions/${institution.institution_id}/profile`,title:"Edit institution profile",version:institution.version,fields:["displayName"]}:undefined;
  return <section className={profileMode?"institution-profile-view":"institution-accounts-view"}>
    {[directory.error,profile.error,otherProfile.error].filter(Boolean).map((error,i)=><div className="requester-transfer-notice" role="status" key={i}><span className="requester-notice-icon" aria-hidden="true">!</span><div className="requester-notice-copy"><strong>Account information unavailable</strong><p>{error}</p></div><button className="button compact dashboard-refresh" onClick={()=>{directory.manual();profile.manual();otherProfile.manual();setApplicationRevision(value=>value+1);}}>Retry</button></div>)}
    {profileMode?<>
      <div className="institution-identity-card"><span className="institution-identity-avatar" aria-hidden="true">{name.split(/\s+/).slice(0,2).map(part=>part[0]).join("")}</span><div><span className="receipt-eyebrow">Institution profile</span><h2>{name}</h2><p>{categoryName(institution?.account_category??principal.accountCategory??"")}</p></div></div>
      <div className="institution-profile-grid"><section className="institution-settings-card"><header><h2>Facility information</h2>{admin&&ownEdit&&<button className="button compact" onClick={()=>choose(ownEdit)}>Edit profile</button>}<InformationHelp label="Facility information">Review your institution’s registered identity and participation type. Authorized administrators can update its display name using operator verification.</InformationHelp></header><dl className="institution-field-grid"><ProfileField label="Facility name" value={name}/><ProfileField label="Participation type" value={categoryName(institution?.account_category??principal.accountCategory??"")}/><ProfileField label="Institution ID" value={principal.institutionId}/><ProfileField label="Account status" value={humanizeCode(institution?.status??principal.accountState??"Unavailable")}/><ProfileField label="Registered legal name" value={safeText(facility?.legalName)}/><ProfileField label="Ownership" value={safeText(facility?.ownership)}/><ProfileField label="Facility classification" value={safeText(facility?.facilityClassification)}/><ProfileField label="Complete address" value={safeText(facility?.streetAddress)}/><ProfileField label="City / Municipality" value={safeText(facility?.city)}/><ProfileField label="Province" value={safeText(facility?.province)}/></dl></section>
      <section className="institution-settings-card"><header><h2>Official contact</h2><InformationHelp label="Official contact">Official contact details come from the retained activated facility profile when available.</InformationHelp></header><dl className="institution-field-grid"><ProfileField label="Official email" value={safeText(facility?.officialEmail)}/><ProfileField label="Official phone" value={safeText(facility?.officialPhone)}/></dl>{!facility&&<p className="institution-section-note">No retained facility contact profile is available.</p>}</section></div>
      <section className="institution-settings-card institution-access-reference"><header><h2>Facility Account</h2><InformationHelp label="Account information">This is the shared institution account. Manage individual operators, PINs and access in Staff Accounts.</InformationHelp></header><dl className="institution-field-grid"><ProfileField label="Account ID" value={principal.accountId}/><ProfileField label="Account type" value="Institution account"/><ProfileField label="Facility Account email" value={safeText(linkedProfile?.loginEmail)}/><ProfileField label="Account status" value={humanizeCode(institution?.status??principal.accountState??"Unavailable")}/></dl></section>
      <InstitutionProfileSections principal={principal} facilityProfile={linkedProfile} application={applicationLink}/>
    </>:<>
    <header className="institution-staff-header"><h1 className="page-title">Staff Accounts</h1>{staff.enabled?staff.add:!prc&&admin&&institution&&["BLOOD_BANK","REQUESTOR"].includes(institution.account_category)&&<button className="button primary compact" onClick={()=>choose({path:"/api/v2/onboarding/operators",title:"Add institution administrator",version:institution.version,fields:["pin"],fixed:{institutionId:institution.institution_id}})}>+ Add administrator</button>}</header>
    <div className="institution-operator-summary" role="group" aria-label="Staff matching current filters">{[["Operators",operators?filteredOperators.length:undefined],["Active",operators?filteredOperators.filter(o=>o.status==="ACTIVE").length:undefined],["Administrators",operators?filteredOperators.filter(o=>o.capability_profile==="INSTITUTION_ADMIN").length:undefined],["Revoked",operators?filteredOperators.filter(o=>o.status==="REVOKED").length:undefined]].map(([label,count])=><article key={String(label)}><span>{label}</span><strong>{count??"—"}</strong></article>)}</div>
    {prc&&<section className="institution-settings-card"><header><h2>Institution accounts</h2></header><PaginatedTable total={institutions.length} ready={Boolean(directory.data)} label="Institution accounts" resetKey={institutionView.sortKey} toolbar={<TableViewBar view={institutionView}/>}><table className="data-table"><thead><tr><SortableHeader view={institutionView} id="institution">Institution</SortableHeader><SortableHeader view={institutionView} id="category">Category</SortableHeader><SortableHeader view={institutionView} id="login">Login</SortableHeader><SortableHeader view={institutionView} id="status">Status</SortableHeader><SortableHeader view={institutionView} id="actions">Actions</SortableHeader></tr></thead><tbody>{institutionView.rows.map(inst=><tr key={inst.institution_id}>{showInstitution("institution")&&<td>{inst.display_name}</td>}{showInstitution("category")&&<td>{inst.account_category}</td>}{showInstitution("login")&&<td>{inst.username ?? "Current institution login"}</td>}{showInstitution("status")&&<td>{inst.status}</td>}{showInstitution("actions")&&<td>
      {admin && inst.status!=="DEREGISTERED" && <button className="button compact" onClick={()=>choose({path:`/api/v2/onboarding/institutions/${inst.institution_id}/profile`,title:"Edit institution profile",version:inst.version,fields:["displayName"]})}>Edit profile</button>}
      {prc && ["ACTIVE","SUSPENDED"].includes(inst.status) && ["BLOOD_BANK","REQUESTOR"].includes(inst.account_category) && <><button className="button compact" onClick={()=>choose({path:`/api/v2/onboarding/institutions/${inst.institution_id}/${inst.status === "ACTIVE" ? "suspend" : "reactivate"}`,title:inst.status === "ACTIVE" ? "Suspend institution" : "Reactivate institution",version:inst.version,fields:["reasonCode"]})}>{inst.status === "ACTIVE" ? "Suspend" : "Reactivate"}</button><button className="button compact" disabled={inst.status!=="ACTIVE"} onClick={()=>choose({path:`/api/v2/onboarding/institutions/${inst.institution_id}/account`,title:"Replace primary login",version:inst.version,fields:["loginEmail","password"]})}>Replace login</button></>}
      {admin && inst.status==="ACTIVE" && ["BLOOD_BANK","REQUESTOR"].includes(inst.account_category) && <button className="button compact" onClick={()=>choose({path:"/api/v2/onboarding/operators",title:"Add institution administrator",version:inst.version,fields:["pin"],fixed:{institutionId:inst.institution_id}})}>Add administrator</button>}
    {prc&&<button className="button compact" onClick={()=>setViewInstitution(inst.institution_id)}>View institution</button>}
    </td>}</tr>)}</tbody></table></PaginatedTable></section>}
    <section className="institution-settings-card"><header><h2>Authorized operators</h2><InformationHelp label="Authorized operators">Each operator uses an individual PIN to authorize permitted actions. Reset PIN and Revoke remain subject to administrator permissions and operator verification. Revoking access does not remove historical attribution.</InformationHelp></header>
    <div className="institution-operator-filters"><label>Find operator<input type="search" placeholder="Search ID or role" value={search} onChange={event=>setSearch(event.target.value)}/></label><label>Status<span className="requester-select"><select aria-label="Operator status" value={operatorStatus} onChange={event=>setOperatorStatus(event.target.value)}><option value="ALL">All statuses</option><option value="ACTIVE">Active</option>{[...new Set((operators??[]).map(o=>o.status))].filter(status=>status!=="ACTIVE").sort().map(status=><option key={status} value={status}>{humanizeCode(status)}</option>)}</select></span></label><span>{filteredOperators.length} operators</span><TableViewBar view={operatorView}/></div>
    <PaginatedTable total={filteredOperators.length} ready={Boolean(operators)} label="Staff accounts" resetKey={search+"|"+operatorStatus+"|"+operatorView.sortKey}><table className="data-table"><thead><tr><SortableHeader view={operatorView} id="operator">Operator</SortableHeader><SortableHeader view={operatorView} id="role">Role</SortableHeader><SortableHeader view={operatorView} id="access">Access profile</SortableHeader><SortableHeader view={operatorView} id="status">Status</SortableHeader><SortableHeader view={operatorView} id="actions">Actions</SortableHeader></tr></thead><tbody>{operatorView.rows.map(operator=><tr key={operator.operator_id}>{showOperator("operator")&&<td className="mono">{operator.operator_id}</td>}{showOperator("role")&&<td>{operator.job_title??roleName(operator.role_id)}</td>}{showOperator("access")&&<td>{accessProfile(operator.capability_profile)}</td>}{showOperator("status")&&<td><span className={statusClassName(operator.status)}>{humanizeCode(operator.status)}</span></td>}{showOperator("actions")&&<td>{staff.enabled?staff.actions(operator):canAct(principal,"operator:reset-pin") && operator.status==="ACTIVE" && <><button className="button compact" onClick={()=>choose({path:`/api/v2/onboarding/operators/${operator.operator_id}/reset-pin`,title:"Reset operator PIN",version:operator.version,fields:["reasonCode","pin"]})}>Reset PIN</button><button className="button compact" onClick={()=>choose({path:`/api/v2/onboarding/operators/${operator.operator_id}/revoke`,title:"Revoke operator",version:operator.version,fields:["reasonCode"]})}>Revoke</button></>}</td>}</tr>)}</tbody></table></PaginatedTable>
    {!operators?<div className="requester-records-empty"><strong>{profile.error?"Operator list unavailable":"Loading operators…"}</strong></div>:filteredOperators.length===0&&<div className="requester-records-empty"><strong>{operators.length?"No operators match your filters":"No operators recorded"}</strong></div>}</section>
    {prc&&<PublicApplicationsPanel key={applicationRevision} principal={principal} onSelect={choose}/>}
    {prc&&viewInstitution&&<section className="institution-settings-card"><header><h2>Institution lifecycle</h2><button className="text-button" onClick={()=>setViewInstitution(undefined)}>Close institution</button></header>{otherProfile.data?.institution.institution_id===viewInstitution?<div className="application-read-details"><p>{otherProfile.data.institution.display_name} · {otherProfile.data.institution.status}</p>{otherProfile.data.application&&<p>Application: {otherProfile.data.application.applicationId}</p>}{otherProfile.data.application&&otherProfile.data.institution.status==="SUSPENDED"&&canAct(principal,"institution:deregister")&&<><p>Deregistration retires access and preserves history. It cannot be undone. Retained obligations must be resolved first.</p><button className="button compact" onClick={()=>choose({path:`/api/v2/onboarding/institutions/${viewInstitution}/deregister`,title:"Deregister institution",version:otherProfile.data!.institution.version,fields:["reasonCode"]})}>Deregister institution</button></>}{otherProfile.data.institution.status==="DEREGISTERED"&&<p>This institution is permanently deregistered. Historical records are retained.</p>}</div>:<p>{otherProfile.error?"Institution details unavailable.":"Loading institution details…"}</p>}</section>}

    </>}
    {staff.form}
    {selected && <section className="v2-operation-card"><h3>{selected.title}</h3><form className={`v2-operation-form${profileMode ? " institution-profile-edit-form" : ""}`} onSubmit={event=>void submit(event)}>{selected.fields.map(field=><label key={field}>{({reasonCode:"Reason code",displayName:"Institution display name",loginEmail:"Institution email",password:"New account password",pin:"New operator PIN",operatorPin:"New administrator PIN",verificationReference:"Synthetic verification reference",category:"Account category"} as Record<string,string>)[field] ?? field}{field==="category" ? <select value={values[field] ?? ""} onChange={event=>{attempt.current=undefined;setValues({...values,[field]:event.target.value});}} required><option value="">Choose category</option><option value="BLOOD_BANK">Blood bank</option><option value="REQUESTOR">Requestor</option></select> : <input readOnly={Boolean(selected.fixed&&field in selected.fixed)} type={["pin","password","operatorPin"].includes(field) ? "password" : field==="loginEmail" ? "email" : "text"} value={values[field] ?? ""} autoComplete="off" minLength={field==="password" ? 12 : ["pin","operatorPin"].includes(field) ? (principal.operatorPinLength ?? 8) : undefined} maxLength={["pin","operatorPin"].includes(field) ? (principal.operatorPinLength ?? 8) : undefined} onChange={event=>{attempt.current=undefined;setValues({...values,[field]:event.target.value});}} required/>}</label>)}<div className="institution-edit-actions"><button className="button compact" type="button" disabled={busy} onClick={()=>{setSelected(undefined);setValues({});attempt.current=undefined;}}>Cancel</button><button className="button primary compact" disabled={busy||detailPurged}>{busy ? "Waiting for verification…" : "Verify and submit change"}</button></div></form></section>}
    {message && <p role="status">{message}</p>}
  </section>;
}

function categoryName(value:string){return ({REQUESTOR:"Requester facility",BLOOD_BANK:"Blood-bank facility",PRC:"PRC administration",DOH:"DOH regulatory office"} as Record<string,string>)[value]??humanizeCode(value||"Unavailable");}
function roleName(value:string){return ({"ROLE-01":"Medical technologist","ROLE-02":"Hospital administrator","ROLE-03":"Requester operator","ROLE-04":"Regulatory viewer","ROLE-05":"System administrator","ROLE-06":"Institution administrator"} as Record<string,string>)[value]??humanizeCode(value);}
function ProfileField({label,value}:{label:string;value?:string}){return <div><dt>{label}</dt><dd className={value?undefined:"institution-field-unavailable"}>{value??"Not available"}</dd></div>;}
