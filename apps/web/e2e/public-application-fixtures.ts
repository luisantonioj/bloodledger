import policy from "../../../services/api/policy/synthetic-public-application-v1.json" with {type:"json"};
export type Category="BLOOD_BANK"|"REQUESTOR";
export function catalog(category:Category){return {catalogVersion:policy.catalogVersion,classification:"SIMULATION_ONLY",eligibleCount:5,samples:policy.samples.filter(sample=>sample.category===category).map(sample=>({sampleId:sample.sampleId,category:sample.category,displayName:sample.facility.displayName,availability:"ELIGIBLE"}))};}
export function selection(category:Category,index=0,instance=1,repeated=false){
 const sample=policy.samples.filter(sample=>sample.category===category)[index];
 const {facilityLicenseValidityDays,...facility}=sample.facility,{authorityValidityDays,...qualification}=sample.qualification;
 const date=(days:number)=>new Date(Date.now()+8*3600000+days*86400000).toISOString().slice(0,10);
 return {catalogVersion:policy.catalogVersion,category,eligibleCount:5,status:"SELECTED",classification:"SIMULATION_ONLY",repeated,sample:{catalogVersion:policy.catalogVersion,sampleId:sample.sampleId,instance},fill:{category,facility:{...facility,facilityLicenseExpiresOn:date(facilityLicenseValidityDays)},qualification:{...qualification,authorityExpiresOn:date(authorityValidityDays)},primaryAccount:{applicantPosition:sample.primaryAccount.applicantPosition,applicantReference:sample.primaryAccount.applicantReference,requestedLoginEmail:`${sample.primaryAccount.loginLocalPart}@${sample.primaryAccount.loginDomainBase}${instance>1?'-i'+instance:''}.bloodledger`},documents:policy.documentSlots[category].map(({slot,fixtureId})=>({slot,fixtureId}))},notFilled:["primaryAccount.password","qualification.capabilityDeclarations","declaration"]};
}
export const result=(category:Category,sample:unknown,replayed=false)=>({applicationId:"ONB_"+"A".repeat(40),schemaVersion:"PUBLIC_APPLICATION_V1",status:"SUBMITTED",version:1,category,sample,classification:"SIMULATION_ONLY",...(replayed?{replayed:true}:{})});
