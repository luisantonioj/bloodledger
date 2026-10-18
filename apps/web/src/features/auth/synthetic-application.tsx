import {useEffect,useRef,useState,type FormEvent,type ReactNode} from "react";
import {useLiveData} from "../../hooks/use-live-data";
import {InformationHelp} from "../../components/ui/information-help";
import {ApiRequestError,requestJson,retryAfterContextChange} from "../../services/api/client";
import {newMutationKeys,type MutationKeys} from "../../services/api/mutation-keys";
import {humanizeCode} from "../../components/ui/display";
import {ApplicationDetails} from "./application-details";
import {applicationError,applicationField,buildPublicApplication,createApplicantPassword,documentDefinitions,identityKeys,parseApplicationResult,parseSampleCatalog,parseSampleSelection,publicApplicationsEnabled,readPublicSamples,selectPublicSample,submitPublicApplication,type ApplicationCategory,type ApplicationDocument,type SampleReference} from "../../services/api/public-applications";

const steps=["Facility","Qualification","Primary account","Documents"];
function Section({title,help,children}:{title:string;help:string;children:ReactNode}){return <section className="application-section"><header className="application-section-heading"><h3>{title}</h3><InformationHelp label={title}>{help}</InformationHelp></header>{children}</section>;}

export function SyntheticApplication(){
 const [category,setCategory]=useState<ApplicationCategory>();
 const [step,setStep]=useState(1),[fields,setFields]=useState<Record<string,string>>({}),[confirmation,setConfirmation]=useState("");
 const [attested,setAttested]=useState(false),[declarations,setDeclarations]=useState([false,false,false]);
 const [documents,setDocuments]=useState<Record<string,ApplicationDocument>>({}),[sample,setSample]=useState<SampleReference|null>(null);
 const [message,setMessage]=useState(""),[fillNotice,setFillNotice]=useState(""),[success,setSuccess]=useState(""),[applicationId,setApplicationId]=useState("");
 const [busy,setBusy]=useState(false),[filling,setFilling]=useState(false),[frozen,setFrozen]=useState(false);
 const [catalog,setCatalog]=useState<{category:ApplicationCategory;eligibleCount:number}>(),[errors,setErrors]=useState<Record<string,string>>({});
 const [retryAt,setRetryAt]=useState(0),[clock,setClock]=useState(Date.now());
 const attempt=useRef<{keys:MutationKeys;payload:ReturnType<typeof buildPublicApplication>}|undefined>(undefined);
 const form=useRef<HTMLFormElement>(null),fillController=useRef<AbortController|undefined>(undefined),alive=useRef(true);
 const bank=category==="BLOOD_BANK",ready=publicApplicationsEnabled&&catalog?.category===category;
 const cooldown=Math.max(0,Math.ceil((retryAt-clock)/1000)),locked=busy||filling||frozen;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;fillController.current?.abort();};},[]);
 useEffect(()=>{if(retryAt<=Date.now())return;const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer);},[retryAt]);
 useEffect(()=>{
  setCatalog(undefined);if(!category)return;
  const controller=new AbortController();
  void readPublicSamples(category,controller.signal,()=>!controller.signal.aborted).then(raw=>{const data=parseSampleCatalog(raw,category);if(!controller.signal.aborted)setCatalog({category,...data});}).catch(reason=>{if(!controller.signal.aborted&&reason instanceof ApiRequestError&&reason.retryAfter){setClock(Date.now());setRetryAt(Date.now()+reason.retryAfter*1000);}});
  return()=>controller.abort();
 },[category]);
 useEffect(()=>{form.current?.querySelector<HTMLInputElement>('input[aria-invalid="true"],select[aria-invalid="true"],textarea[aria-invalid="true"]')?.focus();},[step,errors]);
 useEffect(()=>{if(!frozen)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[frozen]);
 function update(key:string,value:string){if(locked)return;attempt.current=undefined;setMessage("");setErrors(old=>({...old,[key]:""}));setFields(old=>({...old,[key]:value}));if(sample&&identityKeys.has(key)){setSample(null);setFillNotice("Manual application. Catalog identities remain reserved; use Fill Up to restore the sample.");}}
 function reset(){fillController.current?.abort();setStep(1);setFields({});setConfirmation("");setAttested(false);setDeclarations([false,false,false]);setDocuments({});setSample(null);setMessage("");setFillNotice("");setErrors({});setFrozen(false);attempt.current=undefined;}
 function choose(value:ApplicationCategory){reset();setCategory(value);}
 async function fill(){
  if(!category||locked||cooldown)return;
  fillController.current?.abort();const controller=new AbortController();fillController.current=controller;
  setFilling(true);setMessage("");
  try{
   const raw=await selectPublicSample(category,sample?.sampleId,controller.signal,()=>!controller.signal.aborted&&alive.current);
   const selected=parseSampleSelection(raw,category);if(controller.signal.aborted||!alive.current)return;
   if(selected.status==="EXHAUSTED"){setFillNotice("No sample facilities remain for this category. You can still complete a manual application.");return;}
   const password=createApplicantPassword();attempt.current=undefined;setSample(selected.sample);setFields({...selected.fields,password});setConfirmation(password);setDocuments(selected.documents);
   setAttested(false);setDeclarations([false,false,false]);setErrors({});
   setFillNotice("All steps filled with "+selected.fields.institutionDisplayName+(selected.repeated?". This is the only available sample.":".")+" Review the declarations.");
  }catch(reason){if(!controller.signal.aborted&&alive.current){setMessage(applicationError(reason));if(reason instanceof ApiRequestError&&reason.retryAfter){setClock(Date.now());setRetryAt(Date.now()+reason.retryAfter*1000);}}}
  finally{if(!controller.signal.aborted&&alive.current)setFilling(false);}
 }
 function input(label:string,key:string,type="text",placeholder=""){
  return <label className={key==="address"||key==="referralFacility"||key==="accountEmail"?"wide":undefined}>{label}<input aria-label={label} type={type} autoComplete="off" required aria-invalid={Boolean(errors[key])} minLength={key==="password"?12:undefined} maxLength={key==="password"?128:undefined} value={fields[key]??""} placeholder={placeholder} onChange={event=>update(key,event.target.value)}/></label>;
 }
 function select(label:string,key:string,options:string[]){
  return <label className={key==="bsfCategory"?"wide":undefined}>{label}<span className="requester-select"><select aria-label={label} required aria-invalid={Boolean(errors[key])} value={fields[key]??""} onChange={event=>update(key,event.target.value)}><option value="" disabled>Select an option</option>{options.map(value=><option key={value} value={value}>{humanizeCode(value)}</option>)}</select></span></label>;
 }
 function next(){if(!form.current?.reportValidity())return;if(step===3&&fields.password!==confirmation){setMessage("Passwords do not match.");return;}setMessage("");setStep(value=>Math.min(4,value+1));}
 async function submit(event:FormEvent){
  event.preventDefault();if(step<4){next();return;}if(busy||cooldown)return;
  if(!ready||!category){setMessage("Public application submission is not connected yet.");return;}
  if(!attempt.current&&declarations.some(value=>!value)){setStep(2);setMessage("Review and confirm the capability declarations before submitting.");return;}
  if(!attempt.current&&fields.password!==confirmation){setStep(3);setErrors({password:"Passwords do not match."});setMessage("Passwords do not match.");return;}
  setBusy(true);setMessage("");
  try{
   if(!attempt.current){const keys=newMutationKeys();attempt.current={keys,payload:buildPublicApplication(category,fields,sample,documents,declarations,attested,keys.correlationId)};}
   const result=parseApplicationResult(await submitPublicApplication(attempt.current.keys,attempt.current.payload),category,attempt.current.payload.sample);
   if(!alive.current)return;
   reset();setCategory(undefined);setApplicationId(result.applicationId);setSuccess("Application submitted for PRC review. This is not an activated account. Save your reference; the applicant password is only for checking application status.");
  }catch(reason){if(!alive.current)return;
   setMessage(applicationError(reason));
   if(!attempt.current){setMessage(reason instanceof Error?reason.message:"Review the form before submitting.");return;}
   const definitive=reason instanceof ApiRequestError&&reason.status<500&&reason.code!=="AUTH_CONTEXT_CHANGED";
   if(!definitive){setFrozen(Boolean(attempt.current));setMessage("Submission outcome is unknown. Retry this exact attempt; your fields and key are preserved.");}
   else{
    attempt.current=undefined;setFrozen(false);
    if(["ONB_SAMPLE_UNKNOWN","ONB_SAMPLE_CATEGORY_MISMATCH","ONB_SAMPLE_METADATA_MISMATCH"].includes(reason.code??"")){setSample(null);setFillNotice("Manual application. Use Fill Up to select a current sample.");}
    if(reason.details?.length){const errors:Record<string,string>={};for(const detail of reason.details){const target=applicationField(detail.field);errors[target.key]="Review this field ("+humanizeCode(detail.rule)+").";}setErrors(errors);setStep(applicationField(reason.details[0].field).step);}
    if(reason.retryAfter){setClock(Date.now());setRetryAt(Date.now()+reason.retryAfter*1000);}
   }
  }finally{if(alive.current)setBusy(false);}
 }
 return <div className="access-application-workspace">
 {!category?<div className="application-choice"><div className="auth-card-heading"><p className="eyebrow">Institution application</p><h2>How will your facility participate?</h2><p>Choose the application that matches your facility.</p></div><div className="application-type-grid">
 <button type="button" onClick={()=>choose("BLOOD_BANK")}><span className="application-type-icon" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3c-2.4 3.4-7 7.8-7 12a7 7 0 0 0 14 0c0-4.2-4.6-8.6-7-12Z"/><path d="M9 15h6m-3-3v6"/></svg></span><strong>Apply as a Blood Bank</strong><p>For a facility supplying, storing, processing and issuing blood.</p><ul><li>Blood-service license and qualifications</li><li>Responsible professional roles</li><li>Facility assessment documents</li></ul><b>Start Blood Bank Application →</b></button>
 <button type="button" onClick={()=>choose("REQUESTOR")}><span className="application-type-icon requestor" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21V7h16v14M2 21h20M9 21v-5h6v5M9 3h6v4H9zM9 11h6m-3-2v4"/></svg></span><strong>Apply as a Requestor</strong><p>For a facility requesting and receiving blood for transfusion.</p><ul><li>Facility license and receiving authority</li><li>Receiving capability and referral facility</li><li>Authorization documents</li></ul><b>Start Requestor Application →</b></button></div><p className="application-support-note">Applications are open to blood banks and requestor facilities. Use synthetic institution details and generic contacts only.</p></div>:<form ref={form} className="application-form" onSubmit={submit}>
 <fieldset className="application-editable-fields" disabled={locked}><header className="application-header"><button type="button" className="text-button" onClick={()=>{reset();setCategory(undefined);}}>← Change application</button><p className="eyebrow">{bank?"Blood Bank application":"Requestor application"}</p><h2>Institution qualification</h2><p>Step {step} of 4 · {steps[step-1]}</p></header>
 <div className="application-steps" aria-label="Application progress">{steps.map((label,index)=><div className={step>=index+1?"active":""} aria-current={step===index+1?"step":undefined} key={label}><span>{index+1}</span><b>{label}</b></div>)}</div>
 {step===1&&<Section title="Facility information" help="Enter synthetic facility information. Fill Up populates all four steps with one sample; you can edit the values before continuing."><div className="application-fields">
 {input("Facility name","institutionDisplayName")}{input("Registered legal name","legalName")}{select("Ownership","ownership",["PRIVATE","GOVERNMENT"])}{select("Facility classification","facilityClassification",["LEVEL_1_HOSPITAL","LEVEL_2_HOSPITAL","LEVEL_3_HOSPITAL","OTHER_LICENSED_HEALTH_FACILITY"])}{input("Complete address","address")}{input("City / Municipality","locality")}{input("Province","province")}{input("Official phone","officialPhone","text","SYN-000-0000")}{input("Official facility email","genericContact","email")}{input("Hospital / Health Facility LTO number","facilityLto")}{input("LTO expiration","facilityLtoExpiration","date")}</div></Section>}
 {step===2&&<><Section title={bank?"Blood Service Facility qualification":"Requestor receiving capability"} help="Complete synthetic qualification details and review the capability declarations yourself. Example licenses and role names do not establish official verification."><div className="application-fields">
 {bank&&select("BSF category","bsfCategory",["BLOOD_BANK","BLOOD_BANK_WITH_ADDITIONAL_FUNCTIONS","BLOOD_CENTER"])}{input(bank?"DOH BSF LTO number":"Blood Station ATO / authorization number","licenseReference")}{input("License / authority expiration","authorityExpiration","date")}{bank&&<>{input("Head of Blood Service Facility reference","facilityHead","text","SYNTH-PERSON-EXAMPLE")}{input("Physician PRC license number","physicianLicense")}</>}{input("Medical technologist reference","technologist","text","SYNTH-PERSON-EXAMPLE")}{input("Medical technologist PRC license","technologistLicense")}{!bank&&input("Referral blood bank / supplying BSF","referralFacility")}</div>
 <div className="qualification-checklist"><strong>Applicant declaration of capability</strong>{[bank?"Blood storage, processing, compatibility testing, issuance and transport procedures are documented.":"Blood storage, compatibility testing, transfusion and hemovigilance procedures are documented.","Required personnel, equipment, power continuity and contingency procedures are available.","The facility agrees to verification against DOH/CHD licensing records."].map((label,index)=><label key={label}><input type="checkbox" required checked={declarations[index]} onChange={event=>{setDeclarations(old=>old.map((value,i)=>i===index?event.target.checked:value));setMessage("");}}/><span>{label}</span></label>)}</div></Section><Section title="Application reason" help="Use a short synthetic application reason without personal or clinical information."><div className="application-fields application-fields-single"><label>Application reason<textarea aria-label="Application reason" aria-invalid={Boolean(errors.applicationReason)} required rows={3} value={fields.applicationReason??""} onChange={event=>update("applicationReason",event.target.value)}/></label></div></Section></>}
 {step===3&&<Section title="Facility Account applicant" help="Use synthetic role-holder references only; real names and employee identifiers are not collected. The applicant password is for application status; institution credentials are provisioned separately on activation. Fill Up generates a fresh password and matching confirmation."><div className="application-fields">{input("Applicant reference (synthetic)","applicantReference","text","SYNTH-PERSON-EXAMPLE")}{select("Official position","officialPosition",[bank?"BLOOD_BANK_HEAD":"FACILITY_ADMINISTRATOR"])}{input("Facility Account email","accountEmail","email")}{input("Applicant password","password","password")}<label>Confirm password<input aria-label="Confirm password" type="password" autoComplete="off" required minLength={12} maxLength={128} value={confirmation} onChange={event=>{setConfirmation(event.target.value);setMessage("");}}/></label></div></Section>}
 {step===4&&<Section title="Supporting documents & declaration" help="Choose generated synthetic fixtures for each document slot. These examples are not uploaded licensing documents and are not verified. Fill Up attaches the matching fixture references."><div className="document-preview-grid">{documentDefinitions(bank).map(({title,slot,fixtureId,required})=><div key={title} className="application-document-card"><div className="application-document-heading"><span className="application-document-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h6"/></svg></span><span className="application-document-requirement">{required?"Required":"Optional"}</span></div><strong>{title}</strong><div className="application-document-file">{documents[slot]?<small className="application-document-name">{documents[slot].fixtureId+".txt"}</small>:<small>No sample attached</small>}</div><div className="application-document-actions"><button className="button compact" type="button" aria-label={(documents[slot]?"Replace":"Attach")+" synthetic fixture: "+title} onClick={()=>setDocuments(old=>({...old,[slot]:{slot,fixtureId}}))}>{documents[slot]?"Replace fixture":"Attach synthetic fixture"}</button>{documents[slot]&&<button className="text-button application-document-remove" type="button" aria-label={"Remove synthetic fixture: "+title} onClick={()=>setDocuments(old=>{const next={...old};delete next[slot];return next;})}>Remove</button>}{documents[slot]&&<a className="text-button" href={"/api/v2/onboarding/document-fixtures/"+encodeURIComponent(fixtureId)} target="_blank" rel="noreferrer">View</a>}</div></div>)}</div><label className="declaration-preview"><input type="checkbox" required checked={attested} onChange={event=>setAttested(event.target.checked)}/><span>I confirm these application details are synthetic and contain no personal or clinical information.</span></label></Section>}
 </fieldset>
 {step===4&&!ready&&<p id="application-submission-status" className="application-support-note" role="status">Public application submission is awaiting the updated application service.</p>}
 {sample&&<p className="application-fill-notice">Sample facility · Instance {sample.instance}</p>}
 {cooldown>0&&<p role="status">Try again in {cooldown} seconds.</p>}
 {Object.entries(errors).filter(([,value])=>value).length>0&&<p role="alert">{Object.entries(errors).filter(([,value])=>value).map(([key,value])=>humanizeCode(key)+": "+value).join(" ")}</p>}
 {fillNotice&&<p className="application-fill-notice" role="status">{fillNotice}</p>}
 {message&&<p className="auth-error" role="alert">{message}</p>}
 <footer className="application-footer">{step>1?<button className="button compact" type="button" disabled={locked} onClick={()=>{setMessage("");setStep(value=>value-1);}}>Previous</button>:<span/>}<div className="application-footer-actions"><button className="button compact" type="button" disabled={locked||cooldown>0} onClick={()=>void fill()}>{filling?"Filling…":"Fill Up"}</button>{step<4?<button className="button primary compact" type="button" disabled={locked} onClick={next}>Continue</button>:<button className="button primary compact" type="submit" disabled={!ready||!attested||busy||cooldown>0} aria-describedby={!ready?"application-submission-status":undefined}>{busy?"Submitting…":frozen?"Retry submission":"Submit for PRC review"}</button>}</div></footer>
 </form>}
 {success&&<p className="application-result" role="status">{success}<strong className="mono">{applicationId}</strong></p>}
 <ApplicantStatus initialReference={applicationId}/>
 </div>;
}
function ApplicantStatus({initialReference}:{initialReference:string}){
 const[reference,setReference]=useState(initialReference),[password,setPassword]=useState(""),[application,setApplication]=useState<{applicationId:string;status:string;version:number}>(),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 const active=useRef(true);useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 const detail=useLiveData<unknown>(application?"/api/v2/onboarding/applicant/application":null);
 const readStatus=()=>retryAfterContextChange(()=>requestJson<{applicationId:string;status:string;version:number}>("/api/v2/onboarding/applicant/status"),()=>active.current);
 useEffect(()=>{setReference(initialReference);},[initialReference]);
 async function login(event:FormEvent){event.preventDefault();setBusy(true);setMessage("");try{await requestJson("/api/v2/onboarding/applicant/session",{method:"POST",body:JSON.stringify({applicationId:reference,password})});setPassword("");setApplication(await readStatus());}catch(reason){setApplication(undefined);setMessage(reason instanceof Error?reason.message:"Status unavailable.");}finally{setBusy(false);}}
 async function withdraw(){if(!application)return;setBusy(true);const keys=newMutationKeys();try{await requestJson("/api/v2/onboarding/applicant/withdraw",{method:"POST",headers:{"Idempotency-Key":keys.idempotencyKey},body:JSON.stringify({expectedVersion:application.version,correlationId:keys.correlationId,reasonCode:"SYNTHETIC_WITHDRAWAL"})});setApplication(await readStatus());}catch(reason){setMessage(reason instanceof Error?reason.message:"Withdrawal failed.");}finally{setBusy(false);}}
 return <details className="application-status-panel"><summary>Check an existing application</summary><form className="auth-form" onSubmit={event=>void login(event)}><label>Application reference<input value={reference} onChange={event=>{setApplication(undefined);setReference(event.target.value);}} required/></label><label>Applicant password<input type="password" autoComplete="off" value={password} onChange={event=>setPassword(event.target.value)} required/></label><button className="button compact" disabled={busy}>Check status</button></form>{application&&<div className="application-status-result"><p>{application.status} · Version {application.version}</p>{["SUBMITTED","UNDER_REVIEW"].includes(application.status)&&<button className="button compact" disabled={busy} onClick={()=>void withdraw()}>Withdraw application</button>}<button className="button compact" onClick={()=>{setApplication(undefined);setPassword("");void requestJson("/api/v2/onboarding/applicant/session",{method:"DELETE"});}}>End applicant session</button></div>}{application&&detail.data!==undefined&&<ApplicationDetails value={detail.data}/>}
 {message&&<p className="auth-error" role="status">{message}</p>}</details>;
}
