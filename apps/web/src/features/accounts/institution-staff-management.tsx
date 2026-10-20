import {useRef,useState} from "react";
import type {Principal} from "../../auth/permissions";
import {canAct} from "../../auth/permissions";
import {ApiRequestError,requestJson} from "../../services/api/client";
import {newMutationKeys} from "../../services/api/mutation-keys";

type Operator={operator_id:string;role_id:string;capability_profile:string;status:string;version:number;job_title?:string|null};
type Institution={institution_id:string;version:number;status:string};
type Selection={kind:"create"|"revoke"|"restore"|"reset-pin";operator?:Operator};
const permissionNames:Record<string,string>={"ROLE-01":"Medical technologist · scan, prepare and dispatch","ROLE-02":"Hospital coordinator · requests, approval and blood operations","ROLE-03":"Requester operator · request and receive blood"};
const failures:Record<string,string>={STAFF_LAST_ADMINISTRATOR:"The last active administrator cannot be revoked. Add another administrator first.",STAFF_VERSION_CONFLICT:"Staff or institution details changed. Refresh and open this action again.",STAFF_APPROVAL_EXPIRED:"Administrator approval expired. Start the PIN reset again.",STAFF_APPROVAL_INVALID:"This approval no longer authorizes the reset. Start again with an active administrator.",STAFF_PERMISSION_SET_INVALID:"Choose an allowed permission set for this facility.",STAFF_JOB_TITLE_INVALID:"Enter a job title from 1 to 80 characters.",STAFF_TRANSITION_INVALID:"This action is not available for the current staff status.",STAFF_NOT_AUTHORIZED:"An active administrator from this institution must approve the change.",STAFF_IDEMPOTENCY_CONFLICT:"The saved request conflicts with an earlier change. Refresh and review the staff record."};
export function useInstitutionStaffManagement(principal:Principal,institution:Institution|undefined,operators:Operator[],onChanged:()=>void){
 const available=principal.staffManagementPolicyVersion==="SYNTHETIC_INSTITUTION_STAFF_V1"||Boolean(principal.operators?.some(operator=>operator.actionCapabilities?.includes("staff:create")));
 const enabled=available&&["BLOOD_BANK","REQUESTOR"].includes(principal.accountCategory??"");
 const [selection,setSelection]=useState<Selection>(),[title,setTitle]=useState(""),[profile,setProfile]=useState("ROLE"),[permission,setPermission]=useState(principal.accountCategory==="REQUESTOR"?"ROLE-03":"ROLE-01"),[pin,setPin]=useState(""),[repeat,setRepeat]=useState(""),[approval,setApproval]=useState<string>(),[busy,setBusy]=useState(false),[frozen,setFrozen]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const attempt=useRef<{path:string;keys:ReturnType<typeof newMutationKeys>;body:Record<string,unknown>;approval?:string}|undefined>(undefined);
 const canManage=enabled&&canAct(principal,"staff:create");
 function open(kind:Selection["kind"],operator?:Operator){if(busy||frozen)return;setSelection({kind,operator});setTitle("");setProfile("ROLE");setPermission(principal.accountCategory==="REQUESTOR"?"ROLE-03":"ROLE-01");setPin("");setRepeat("");setApproval(undefined);setError("");setMessage("");attempt.current=undefined;}
 function close(){if(busy||frozen)return;setSelection(undefined);setPin("");setRepeat("");setApproval(undefined);attempt.current=undefined;}
 async function submit(){
  if(!selection||!institution||busy)return;
  const approving=selection.kind==="reset-pin"&&!approval;
  if(!attempt.current){const keys=newMutationKeys(),base={expectedVersion:selection.operator?.version??institution.version,correlationId:keys.correlationId};attempt.current={keys,path:selection.kind==="create"?"/api/v2/staff":"/api/v2/staff/"+selection.operator!.operator_id+"/"+(approving?"reset-pin-approval":selection.kind),body:selection.kind==="create"?{...base,institutionId:institution.institution_id,jobTitle:title.trim(),accessProfile:profile,permissionSet:profile==="ROLE"?permission:null,pin}:selection.kind==="reset-pin"&&!approving?{...base,pin}:base,approval};}
  const saved=attempt.current;setBusy(true);setError("");
  try{
   const result=await requestJson<{approvalId?:string;classification?:string;status?:string}>(saved.path,{method:"POST",headers:{"Idempotency-Key":saved.keys.idempotencyKey,...(saved.approval?{"Staff-Reset-Approval":saved.approval}:{})},body:JSON.stringify(saved.body)});
   if(result.classification!=="SIMULATION_ONLY")throw Error("Invalid staff result");
   if(approving){if(!/^SPA_[0-9A-F]{40}$/.test(result.approvalId??""))throw Error("Invalid approval");setApproval(result.approvalId);}
   else{setMessage(selection.kind==="create"?"Staff added.":selection.kind==="revoke"?"Staff access revoked.":selection.kind==="restore"?"Staff access restored. Old sessions stay invalid.":"PIN reset. Staff access status is unchanged.");setSelection(undefined);setPin("");setRepeat("");setApproval(undefined);onChanged();}
   attempt.current=undefined;setFrozen(false);
  }catch(reason){const cancelled=reason instanceof Error&&reason.message==="Operator verification cancelled. The command was not sent.";const definite=reason instanceof ApiRequestError&&reason.status>=400&&reason.status<500&&reason.code!=="AUTH_CONTEXT_CHANGED";if(definite||(cancelled&&!frozen)){attempt.current=undefined;setFrozen(false);}else setFrozen(true);setError(cancelled?"Administrator verification cancelled. No new change was sent.":reason instanceof ApiRequestError?(failures[reason.code??""]??reason.message):"The outcome is unknown. Retry this exact saved attempt; do not create another change.");}
  finally{setBusy(false);}
 }
 const needsPin=selection?.kind==="create"||selection?.kind==="reset-pin"&&Boolean(approval);
 const pinLength=principal.operatorPinLength??8;
 const pinValid=new RegExp("^[0-9]{"+pinLength+"}$").test(pin)&&pin===repeat;
 const heading=selection?.kind==="create"?"Add institutional staff":selection?.kind==="revoke"?"Revoke staff access":selection?.kind==="restore"?"Restore staff access":"Reset staff PIN";
 const activeAdmins=operators.filter(o=>o.status==="ACTIVE"&&o.capability_profile==="INSTITUTION_ADMIN").length;
 return {
  enabled,canManage,open,
  add:enabled&&<button className="button primary compact" type="button" disabled={!canManage||!institution||institution.status!=="ACTIVE"||busy||frozen} title={!canManage?"An active institution administrator is required.":undefined} onClick={()=>open("create")}>+ Add staff</button>,
  actions:(o:Operator)=>enabled&&canManage&&<div className="staff-row-actions"><button className="button compact" disabled={busy||frozen} onClick={()=>open("reset-pin",o)}>Reset PIN</button>{o.status==="REVOKED"?<button className="button compact" disabled={busy||frozen} onClick={()=>open("restore",o)}>Restore</button>:o.status==="ACTIVE"?<button className="button compact" disabled={busy||frozen||o.capability_profile==="INSTITUTION_ADMIN"&&activeAdmins<=1} title={o.capability_profile==="INSTITUTION_ADMIN"&&activeAdmins<=1?"The last active administrator cannot be revoked.":undefined} onClick={()=>open("revoke",o)}>Revoke</button>:null}</div>,
  form:<>{selection&&<section className="institution-settings-card institution-staff-editor" aria-label={heading}><header><h2>{heading}</h2></header><form className="auth-form" onSubmit={event=>{event.preventDefault();void submit();}}><fieldset disabled={busy||frozen}>
   {selection.kind==="create"?<><label>Role / Job title<input required maxLength={80} value={title} onChange={event=>setTitle(event.target.value)} placeholder="e.g. Medical technologist"/></label><label>Access profile<span className="requester-select"><select aria-label="Access profile" value={profile} onChange={event=>setProfile(event.target.value)}><option value="ROLE">Role permissions</option><option value="INSTITUTION_ADMIN">Administration</option></select></span></label>{profile==="ROLE"&&<label>Permission set<span className="requester-select"><select aria-label="Permission set" value={permission} onChange={event=>setPermission(event.target.value)}>{(principal.accountCategory==="REQUESTOR"?["ROLE-03"]:["ROLE-01","ROLE-02"]).map(role=><option key={role} value={role}>{permissionNames[role]}</option>)}</select></span></label>}<p className="institution-section-note">The job title is a label. The selected permission set controls authorized actions.</p></>:<p className="staff-action-subject">{selection.operator?.job_title||selection.operator?.operator_id}</p>}
   {selection.kind==="reset-pin"&&!approval&&<p>First verify an existing institution administrator. You can enter the replacement PIN after approval.</p>}
   {selection.kind==="reset-pin"&&approval&&<p role="status">Administrator approved. Enter and confirm the new PIN within two minutes.</p>}
   {needsPin&&<><label>New operator PIN<input type="password" inputMode="numeric" autoComplete="off" required minLength={pinLength} maxLength={pinLength} pattern={"[0-9]{"+pinLength+"}"} value={pin} onChange={event=>setPin(event.target.value)}/></label><label>Confirm new PIN<input type="password" inputMode="numeric" autoComplete="off" required minLength={pinLength} maxLength={pinLength} value={repeat} onChange={event=>setRepeat(event.target.value)}/></label>{repeat&&pin!==repeat&&<p role="alert">The PINs do not match.</p>}</>}
   {selection.kind==="revoke"&&<p>Administrator approval revokes access and preserves history.</p>}{selection.kind==="restore"&&<p>Administrator approval restores access. Previous sessions and approvals will remain invalid.</p>}
   </fieldset>{error&&<p role="alert">{error}</p>}<div className="institution-edit-actions"><button className="button compact" type="button" disabled={busy||frozen} onClick={close}>Cancel</button><button className="button primary compact" type="submit" disabled={busy||!frozen&&(Boolean(needsPin&&!pinValid)||selection.kind==="create"&&!title.trim())}>{busy?"Waiting for approval…":frozen?"Retry saved staff change":selection.kind==="reset-pin"&&!approval?"Verify administrator":selection.kind==="reset-pin"?"Save new PIN":"Verify and submit change"}</button></div></form></section>}{message&&<p role="status">{message}</p>}</>,
 };
}
