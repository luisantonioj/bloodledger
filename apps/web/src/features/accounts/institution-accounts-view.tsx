import { useRef, useState } from "react";
import { canAct, type Principal } from "../../auth/permissions";
import { useLiveData } from "../../hooks/use-live-data";
import { requestJson } from "../../services/api/client";
import { newMutationKeys, type MutationKeys } from "../../services/api/mutation-keys";

interface Institution {institution_id: string; display_name: string; account_category: string; status: string; version: number; username?: string}
interface Operator {operator_id: string; role_id: string; capability_profile: string; status: string; version: number}
interface Application {application_id: string; status: string; version: number; institution_id: string | null; category: string; detail: {institutionDisplayName: string} | null}
type Action = {path: string; title: string; version?: number; fields: string[]; fixed?: Record<string, unknown>};

export function InstitutionAccountsView({principal}: {principal: Principal}) {
  const prc = principal.accountCategory === "PRC";
  const directory = useLiveData<{institutions: Institution[]}>(prc ? "/api/v2/onboarding/institutions" : null);
  const profile = useLiveData<{institution: Institution; operators: Operator[]}>("/api/v2/onboarding/institutions/" + principal.institutionId);
  const applications = useLiveData<{applications: Application[]}>(prc ? "/api/v2/onboarding/applications" : null);
  const [selected, setSelected] = useState<Action>();
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const attempt = useRef<{keys: MutationKeys; payload: Record<string, unknown>} | undefined>(undefined);
  const institutions = prc ? directory.data?.institutions ?? [] : profile.data ? [profile.data.institution] : [];
  function choose(action: Action) {setSelected(action); setValues({reasonCode:"SYNTHETIC_REVIEW"}); setMessage(""); attempt.current = undefined;}
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!selected) return;
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
      directory.manual(); profile.manual(); applications.manual();
    } catch (reason) {setMessage(reason instanceof Error ? reason.message : "Change failed.");}
    finally {setBusy(false);}
  }
  const admin = prc || canAct(principal,"institution:profile");
  return <section><h2>{prc ? "Institution accounts" : "Your institution account"}</h2><p>One primary login per institution. Operators verify individual privileged actions.</p>
    {[directory.error,profile.error,applications.error].filter(Boolean).map((error,i)=><p role="alert" key={i}>{error}</p>)}
    {prc && <button className="button" onClick={()=>choose({path:"/api/v2/onboarding/invitations",title:"Issue synthetic invitation",fields:["category"]})}>Issue invitation</button>}
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Institution</th><th>Category</th><th>Login</th><th>Status</th><th>Actions</th></tr></thead><tbody>{institutions.map(inst=><tr key={inst.institution_id}><td>{inst.display_name}</td><td>{inst.account_category}</td><td>{inst.username ?? "Current institution login"}</td><td>{inst.status}</td><td>
      {admin && <button className="button compact" onClick={()=>choose({path:`/api/v2/onboarding/institutions/${inst.institution_id}/profile`,title:"Update synthetic institution profile",version:inst.version,fields:["displayName"]})}>Edit profile</button>}
      {prc && ["BLOOD_BANK","REQUESTOR"].includes(inst.account_category) && <><button className="button compact" onClick={()=>choose({path:`/api/v2/onboarding/institutions/${inst.institution_id}/${inst.status === "ACTIVE" ? "suspend" : "reactivate"}`,title:inst.status === "ACTIVE" ? "Suspend institution" : "Reactivate institution",version:inst.version,fields:["reasonCode"]})}>{inst.status === "ACTIVE" ? "Suspend" : "Reactivate"}</button><button className="button compact" disabled={inst.status!=="ACTIVE"} onClick={()=>choose({path:`/api/v2/onboarding/institutions/${inst.institution_id}/account`,title:"Replace primary login",version:inst.version,fields:["loginEmail","password"]})}>Replace login</button></>}
      {admin && ["BLOOD_BANK","REQUESTOR"].includes(inst.account_category) && <button className="button compact" onClick={()=>choose({path:"/api/v2/onboarding/operators",title:"Add institution administrator",version:inst.version,fields:["pin"],fixed:{institutionId:inst.institution_id}})}>Add administrator</button>}
    </td></tr>)}</tbody></table></div>
    <h3>Your verified operators</h3><div className="table-wrap"><table className="data-table"><thead><tr><th>Operator</th><th>Role</th><th>Profile</th><th>Status</th><th>Actions</th></tr></thead><tbody>{profile.data?.operators.map(operator=><tr key={operator.operator_id}><td className="mono">{operator.operator_id}</td><td>{operator.role_id}</td><td>{operator.capability_profile}</td><td>{operator.status}</td><td>{canAct(principal,"operator:reset-pin") && operator.status==="ACTIVE" && <><button className="button compact" onClick={()=>choose({path:`/api/v2/onboarding/operators/${operator.operator_id}/reset-pin`,title:"Reset operator PIN",version:operator.version,fields:["reasonCode","pin"]})}>Reset PIN</button><button className="button compact" onClick={()=>choose({path:`/api/v2/onboarding/operators/${operator.operator_id}/revoke`,title:"Revoke operator",version:operator.version,fields:["reasonCode"]})}>Revoke</button></>}</td></tr>)}</tbody></table></div>
    {prc && <><h3>Synthetic applications</h3>{applications.data?.applications.length===0 && <p>No applications submitted.</p>}<div className="table-wrap"><table className="data-table"><thead><tr><th>Institution</th><th>Category</th><th>Status</th><th>Actions</th></tr></thead><tbody>{applications.data?.applications.map(app=><tr key={app.application_id}><td>{app.detail?.institutionDisplayName ?? "Retained decision reference"}</td><td>{app.category}</td><td>{app.status}</td><td>{(app.status==="SUBMITTED" ? ["review"] : app.status==="UNDER_REVIEW" ? ["approve","reject"] : app.status==="APPROVED" && !app.institution_id ? ["activate"] : []).map(action=><button className="button compact" key={action} onClick={()=>choose({path:`/api/v2/onboarding/applications/${app.application_id}/${action}`,title:action + " synthetic application",version:app.version,fields:action==="review" ? ["verificationReference"] : action==="activate" ? ["reasonCode","loginEmail","password","operatorPin"] : ["reasonCode"],fixed:action==="review" ? {verificationOutcome:"CONFIRMED"} : undefined})}>{action}</button>)}</td></tr>)}</tbody></table></div></>}
    {selected && <section className="v2-operation-card"><h3>{selected.title}</h3><form className="v2-operation-form" onSubmit={event=>void submit(event)}>{selected.fields.map(field=><label key={field}>{({reasonCode:"Reason code",displayName:"Synthetic institution name",loginEmail:"Institution email",password:"New account password",pin:"New operator PIN",operatorPin:"New administrator PIN",verificationReference:"Synthetic verification reference",category:"Account category"} as Record<string,string>)[field] ?? field}{field==="category" ? <select value={values[field] ?? ""} onChange={event=>{attempt.current=undefined;setValues({...values,[field]:event.target.value});}} required><option value="">Choose category</option><option value="BLOOD_BANK">Blood bank</option><option value="REQUESTOR">Requestor</option></select> : <input type={["pin","password","operatorPin"].includes(field) ? "password" : field==="loginEmail" ? "email" : "text"} value={values[field] ?? ""} autoComplete="off" minLength={field==="password" ? 12 : ["pin","operatorPin"].includes(field) ? 8 : undefined} maxLength={["pin","operatorPin"].includes(field) ? 8 : undefined} onChange={event=>{attempt.current=undefined;setValues({...values,[field]:event.target.value});}} required/>}</label>)}<button className="button primary" disabled={busy}>{busy ? "Waiting for verification…" : "Verify and submit change"}</button><button className="button" type="button" disabled={busy} onClick={()=>{setSelected(undefined);setValues({});attempt.current=undefined;}}>Cancel</button></form></section>}
    {message && <p role="status">{message}</p>}
  </section>;
}
