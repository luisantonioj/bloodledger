// SIMULATION_ONLY: public twenty-series counts and V3 technical offsets only.
// Never reads private artifacts or operational stores; no ledger transaction references.
export const provenance = {classification:'SIMULATION_ONLY',dataSource:'PUBLIC_V3_DESIGN_FIXTURE',scenario:'SYNTHETIC_OPERATIONAL_STOCK_522_V3',countsSource:'docs/handoffs/BUNO-OPERATIONAL-STOCK-522-EVIDENCE.md',generatorSource:'scripts/operational-scenario/scenario.py',datePolicy:'SYNTHETIC_522_DATES_V3',negativeRhCoverage:'SOURCE_UNKNOWN; VERIFIED_ZERO_RECORDS_IN_THIS_FIXTURE_ONLY',excludesHistorical:true,excludesRetainedBaseline:true};
export const scenarioCounts = [
  {
    "bloodType": "A_POSITIVE",
    "componentType": "WHOLE_BLOOD",
    "available": 4,
    "reserved": 0,
    "closing": 4
  },
  {
    "bloodType": "A_POSITIVE",
    "componentType": "PACKED_RED_BLOOD_CELLS",
    "available": 37,
    "reserved": 1,
    "closing": 38
  },
  {
    "bloodType": "A_POSITIVE",
    "componentType": "FRESH_FROZEN_PLASMA",
    "available": 56,
    "reserved": 3,
    "closing": 59
  },
  {
    "bloodType": "A_POSITIVE",
    "componentType": "PLATELETS",
    "available": 11,
    "reserved": 1,
    "closing": 12
  },
  {
    "bloodType": "A_POSITIVE",
    "componentType": "CRYOPRECIPITATE",
    "available": 21,
    "reserved": 1,
    "closing": 22
  },
  {
    "bloodType": "B_POSITIVE",
    "componentType": "WHOLE_BLOOD",
    "available": 5,
    "reserved": 0,
    "closing": 5
  },
  {
    "bloodType": "B_POSITIVE",
    "componentType": "PACKED_RED_BLOOD_CELLS",
    "available": 38,
    "reserved": 6,
    "closing": 44
  },
  {
    "bloodType": "B_POSITIVE",
    "componentType": "FRESH_FROZEN_PLASMA",
    "available": 58,
    "reserved": 4,
    "closing": 62
  },
  {
    "bloodType": "B_POSITIVE",
    "componentType": "PLATELETS",
    "available": 25,
    "reserved": 2,
    "closing": 27
  },
  {
    "bloodType": "B_POSITIVE",
    "componentType": "CRYOPRECIPITATE",
    "available": 19,
    "reserved": 2,
    "closing": 21
  },
  {
    "bloodType": "O_POSITIVE",
    "componentType": "WHOLE_BLOOD",
    "available": 7,
    "reserved": 0,
    "closing": 7
  },
  {
    "bloodType": "O_POSITIVE",
    "componentType": "PACKED_RED_BLOOD_CELLS",
    "available": 16,
    "reserved": 1,
    "closing": 17
  },
  {
    "bloodType": "O_POSITIVE",
    "componentType": "FRESH_FROZEN_PLASMA",
    "available": 58,
    "reserved": 5,
    "closing": 63
  },
  {
    "bloodType": "O_POSITIVE",
    "componentType": "PLATELETS",
    "available": 16,
    "reserved": 2,
    "closing": 18
  },
  {
    "bloodType": "O_POSITIVE",
    "componentType": "CRYOPRECIPITATE",
    "available": 22,
    "reserved": 2,
    "closing": 24
  },
  {
    "bloodType": "AB_POSITIVE",
    "componentType": "WHOLE_BLOOD",
    "available": 8,
    "reserved": 0,
    "closing": 8
  },
  {
    "bloodType": "AB_POSITIVE",
    "componentType": "PACKED_RED_BLOOD_CELLS",
    "available": 26,
    "reserved": 2,
    "closing": 28
  },
  {
    "bloodType": "AB_POSITIVE",
    "componentType": "FRESH_FROZEN_PLASMA",
    "available": 36,
    "reserved": 4,
    "closing": 40
  },
  {
    "bloodType": "AB_POSITIVE",
    "componentType": "PLATELETS",
    "available": 0,
    "reserved": 0,
    "closing": 0
  },
  {
    "bloodType": "AB_POSITIVE",
    "componentType": "CRYOPRECIPITATE",
    "available": 23,
    "reserved": 0,
    "closing": 23
  }
];
const t0='2026-10-11T15:30:00Z';
const at=hours=>new Date(Date.parse(t0)+hours*3600000).toISOString();
const hours={WHOLE_BLOOD:120,PACKED_RED_BLOOD_CELLS:144,FRESH_FROZEN_PLASMA:168,PLATELETS:96,CRYOPRECIPITATE:192};
export const scenarioComponents=[],scenarioReservations=[],scenarioRequests=[];
let sequence=0,reservedCount=0;
for(const row of scenarioCounts){
 const buckets={TRANSFER:[],LOCAL_RELEASE:[]};
 for(let index=0;index<row.closing;index++){
  const reserved=index<row.reserved,purpose=reserved?(reservedCount++%2===0?'TRANSFER':'LOCAL_RELEASE'):null;
  const id=String(++sequence).padStart(4,'0');
  const unit={componentId:'COMP_PREVIEW_V3_'+id,donationId:'DON_PREVIEW_V3_'+id,issuerInstitutionId:'INST_MEDIATRIX',institutionId:'INST_MEDIATRIX',bloodType:row.bloodType,componentType:row.componentType,collectedAt:at(-24),expiresAt:at(purpose==='TRANSFER'?48:purpose==='LOCAL_RELEASE'?49:hours[row.componentType]),inventoryStatus:reserved?'RESERVED':'AVAILABLE',expiryState:'CURRENT',inventoryVersion:reserved?2:1,reservationId:null,reservationVersion:reserved?1:null,policyVersion:'INTERVIEW_DERIVED_CORE_V2',classification:'SIMULATION_ONLY',fixtureProvenance:provenance};
  scenarioComponents.push(unit);if(purpose)buckets[purpose].push(unit);
 }
 for(const [purpose,members] of Object.entries(buckets)){
  if(!members.length)continue;
  const id=String(scenarioReservations.length+1).padStart(3,'0'),reservationId='RES_PREVIEW_V3_'+id,transferId=purpose==='TRANSFER'?'TRF_PREVIEW_V3_'+id:null,localReleaseId=purpose==='LOCAL_RELEASE'?'LR_PREVIEW_V3_'+id:null;
  for(const m of members)m.reservationId=reservationId;
  scenarioReservations.push({reservationId,purpose,status:'ACTIVE',version:1,sourceInstitutionId:'INST_MEDIATRIX',destinationInstitutionId:transferId?'INST_SYNTH_MEDIX':null,transferId,localReleaseId,preparedAt:null,preparedEvidencePresent:false,updatedAt:t0,components:members.map(m=>({componentId:m.componentId,componentType:m.componentType,inventoryStatus:m.inventoryStatus,inventoryVersion:m.inventoryVersion})),classification:'SIMULATION_ONLY',fixtureProvenance:provenance});
  if(transferId)scenarioRequests.push({transfer_id:transferId,source_institution_id:'INST_MEDIATRIX',destination_institution_id:'INST_SYNTH_MEDIX',blood_type:row.bloodType,component_type:row.componentType,quantity:members.length,urgency:'ROUTINE',status:'APPROVED',ledger_transaction_id:null,fixtureProvenance:provenance});
 }
}
export function scopedScenario(user,empty=false){
 const city=['PRC','DOH','REQUESTOR'].includes(user.accountCategory);
 const components=empty?[]:scenarioComponents.filter(c=>c.institutionId===user.institutionId);
 const reservations=empty?[]:scenarioReservations.filter(r=>[r.sourceInstitutionId,r.destinationInstitutionId].includes(user.institutionId));
 const requests=empty?[]:scenarioRequests.filter(r=>[r.source_institution_id,r.destination_institution_id].includes(user.institutionId));
 const inventory=empty?[]:scenarioCounts.flatMap(r=>['AVAILABLE','RESERVED'].map(status=>({institutionId:'INST_MEDIATRIX',institutionDisplayName:'Mary Mediatrix Medical Center',bloodType:r.bloodType,component:r.componentType,inventoryStatus:status,confirmedCount:city||user.institutionId==='INST_MEDIATRIX'?r[status==='AVAILABLE'?'available':'reserved']:0,lastProjectedAt:t0}))).filter(r=>city||user.institutionId==='INST_MEDIATRIX');
 // Explicit zeros describe this generated fixture, not negative-Rh source coverage.
 if(!empty&&(city||user.institutionId==='INST_MEDIATRIX'))for(const bloodType of ['A_NEGATIVE','B_NEGATIVE','O_NEGATIVE','AB_NEGATIVE'])for(const component of Object.keys(hours))inventory.push({institutionId:'INST_MEDIATRIX',institutionDisplayName:'Mary Mediatrix Medical Center',bloodType,component,inventoryStatus:'AVAILABLE',confirmedCount:0,lastProjectedAt:t0});
 return {components,reservations,requests,inventory,t0,provenance};
}
