import {formatManilaDateTime,humanizeCode} from "../../components/ui/display";
import {documentDefinitions} from "../../services/api/public-applications";
export interface RetainedFacilityProfile{facility?:Record<string,string>;qualification?:Record<string,unknown>;documents?:Array<{slot:string;fixtureId:string}>;loginEmail?:string;sample?:unknown}
export interface ApplicationLink{applicationId:string;schemaVersion:string;submittedAt:string;approvedAt:string;activatedAt:string;deregisteredAt:string|null}
export function safeText(value:unknown){return typeof value==="string"&&value?value:undefined;}
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>:{};
export function ApplicationDetails({value}:{value:unknown}){
 const row=record(value),detail=record(row.detail),facility=record(detail.facility),qualification=record(detail.qualification),account=record(detail.primaryAccount),sample=record(detail.sample),verification=record(row.verification),capabilities=record(qualification.capabilityDeclarations),declaration=record(detail.declaration);
 if(!row.detail)return <p className="application-support-note">Application details are unavailable or have reached their retention limit.</p>;
 const sections:Array<[string,Record<string,unknown>,string[]]>=[
  ["Facility",facility,["displayName","legalName","ownership","facilityClassification","streetAddress","city","province","officialPhone","officialEmail","facilityLicenseReference","facilityLicenseExpiresOn"]],
  ["Qualification",qualification,["authorityReference","authorityExpiresOn","bsfCategory","headOfFacilityReference","headOfFacilityLicenseReference","medicalTechnologistReference","medicalTechnologistLicenseReference","referralFacilityName","applicationReason"]],
  ["Requested account",account,["applicantPosition","applicantReference","requestedLoginEmail"]],
 ];
 return <div className="application-read-details">
  <dl className="institution-field-grid">{[["Status",row.status],["Sample",sample.sampleId],["Sample instance",typeof sample.instance==="number"?String(sample.instance):undefined],["Claim status",row.claim_status],["Verification outcome",verification.outcome],["Verification reference",verification.reference]].map(([label,value])=><div key={String(label)}><dt>{String(label)}</dt><dd>{safeText(value)??"Not available"}</dd></div>)}</dl>
  {sections.map(([title,data,keys])=><section className="application-section" key={title}><header className="application-section-heading"><h3>{title}</h3></header><dl className="institution-field-grid">{keys.filter(key=>safeText(data[key])).map(key=><div key={key}><dt>{humanizeCode(key.replace(/([a-z])([A-Z])/g,"$1 $2"))}</dt><dd>{safeText(data[key])}</dd></div>)}</dl></section>)}
  <section className="application-section"><header className="application-section-heading"><h3>Applicant declarations</h3></header><dl className="institution-field-grid">{[["Procedures documented",capabilities.proceduresDocumented],["Personnel, equipment and continuity",capabilities.personnelEquipmentContinuity],["Verification consent",capabilities.verificationConsent],["Synthetic data only",declaration.syntheticDataOnly],["Accuracy attested",declaration.accuracyAttested]].map(([label,value])=><div key={String(label)}><dt>{String(label)}</dt><dd>{value===true?"Confirmed by applicant":value===false?"Not confirmed":"Not recorded"}</dd></div>)}</dl></section>
  <section className="application-section"><header className="application-section-heading"><h3>Synthetic document fixtures</h3></header><div className="application-document-links">{Array.isArray(detail.documents)&&detail.documents.map((entry:unknown)=>{const doc=record(entry),definition=documentDefinitions(row.category==="BLOOD_BANK").find(item=>item.slot===doc.slot&&item.fixtureId===doc.fixtureId);return definition?<a key={definition.slot} href={"/api/v2/onboarding/document-fixtures/"+encodeURIComponent(definition.fixtureId)} target="_blank" rel="noreferrer">{definition.title} · Not verified</a>:null;})}</div></section>
  {safeText(row.submittedAt)&&<p>Submitted {formatManilaDateTime(String(row.submittedAt))}</p>}
 </div>;
}
