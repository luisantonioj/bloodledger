import { useRef, useState } from "react";
import { requestJson } from "../../services/api/client";
import { newMutationKeys, type MutationKeys } from "../../services/api/mutation-keys";

export function SyntheticApplication() {
  const [fields,setFields] = useState<Record<string,string>>({category:"BLOOD_BANK"});
  const [applicationId,setApplicationId] = useState("");
  const [application,setApplication] = useState<{applicationId:string;status:string;version:number}>();
  const [password,setPassword] = useState("");
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  const attempt = useRef<{keys:MutationKeys;payload:object} | undefined>(undefined);
  async function submit(event: React.FormEvent) {
    event.preventDefault();setBusy(true);setMessage("");
    const current=attempt.current ?? (()=>{const keys=newMutationKeys();return {keys,payload:{...fields,attested:true,correlationId:keys.correlationId}};})();attempt.current=current;
    try {
      const result=await requestJson<{applicationId:string}>("/api/v2/onboarding/applications",{method:"POST",headers:{"Idempotency-Key":current.keys.idempotencyKey},body:JSON.stringify(current.payload)});
      setApplicationId(result.applicationId);setFields({category:"BLOOD_BANK"});attempt.current=undefined;setMessage("Application submitted. Save its reference and sign in below to check the status.");
    } catch(reason){setMessage(reason instanceof Error ? reason.message : "Submission failed.");}finally{setBusy(false);}
  }
  async function login(event:React.FormEvent){
    event.preventDefault();setBusy(true);
    try{await requestJson("/api/v2/onboarding/applicant/session",{method:"POST",body:JSON.stringify({applicationId,password})});setPassword("");setApplication(await requestJson("/api/v2/onboarding/applicant/status"));setMessage("");}
    catch(reason){setApplication(undefined);setMessage(reason instanceof Error ? reason.message : "Status unavailable.");}finally{setBusy(false);}
  }
  async function withdraw(){
    if(!application)return;setBusy(true);const keys=newMutationKeys();
    try{await requestJson("/api/v2/onboarding/applicant/withdraw",{method:"POST",headers:{"Idempotency-Key":keys.idempotencyKey},body:JSON.stringify({expectedVersion:application.version,correlationId:keys.correlationId,reasonCode:"SYNTHETIC_WITHDRAWAL"})});setApplication(await requestJson("/api/v2/onboarding/applicant/status"));}
    catch(reason){setMessage(reason instanceof Error ? reason.message : "Withdrawal failed.");}finally{setBusy(false);}
  }
  return <section><h2>Apply for synthetic access</h2><p>A PRC invitation is required. Use synthetic institution details and generic contacts only. Do not upload documents.</p><form className="auth-form" onSubmit={event=>void submit(event)}>{["invitationSecret","institutionDisplayName","locality","genericContact","licenseReference","applicationReason","password"].map(field=><label key={field}>{({invitationSecret:"Private invitation secret",institutionDisplayName:"Synthetic institution name",locality:"Synthetic locality",genericContact:"Generic institution email",licenseReference:"Synthetic license reference",applicationReason:"Synthetic application reason",password:"Applicant password"} as Record<string,string>)[field]}<input type={["invitationSecret","password"].includes(field)?"password":"text"} autoComplete="off" value={fields[field]??""} minLength={field==="password"?12:undefined} onChange={event=>{attempt.current=undefined;setFields({...fields,[field]:event.target.value});}} required/></label>)}<label>Category<select value={fields.category} onChange={event=>{attempt.current=undefined;setFields({...fields,category:event.target.value});}}><option value="BLOOD_BANK">Blood bank</option><option value="REQUESTOR">Requestor</option></select></label><label><input type="checkbox" required/> I confirm that these details are synthetic.</label><button className="button primary" disabled={busy}>Submit application</button></form><h3>Application status</h3><form className="auth-form" onSubmit={event=>void login(event)}><label>Application reference<input value={applicationId} onChange={event=>{setApplication(undefined);setApplicationId(event.target.value);}} required/></label><label>Applicant password<input type="password" autoComplete="off" value={password} onChange={event=>setPassword(event.target.value)} required/></label><button className="button" disabled={busy}>Check status</button></form>{application&&<div><p>{application.status} · Version {application.version}</p>{["SUBMITTED","UNDER_REVIEW"].includes(application.status)&&<button className="button" disabled={busy} onClick={()=>void withdraw()}>Withdraw application</button>}<button className="button" onClick={()=>{setApplication(undefined);setPassword("");void requestJson("/api/v2/onboarding/applicant/session",{method:"DELETE"});}}>End applicant session</button></div>}{message&&<p role="status">{message}</p>}</section>;
}
