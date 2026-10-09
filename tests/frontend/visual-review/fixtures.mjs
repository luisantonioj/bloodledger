// BL-TST-01 / FR-03/09/11/12/14: synthetic presentation, never operational evidence.
import { ROLE_IDS, permissionsFor } from '../../../services/api/src/web-access.ts';
export const permissions = Object.fromEntries(ROLE_IDS.map(role => [role, [...permissionsFor(role)]]));
export const roleNames = ['Medical Technologist','Hospital Administrator','Secondary Hospital User','DOH/PRC Regulatory Viewer','System Administrator','Institution Account Administrator'];
const classification = 'SIMULATION_ONLY';
const recommendationEligibility = 'DISABLED_UNAPPROVED_POLICY';
const bloodTypes = ['A_POSITIVE','A_NEGATIVE','B_POSITIVE','B_NEGATIVE','AB_POSITIVE','AB_NEGATIVE','O_POSITIVE','O_NEGATIVE'];
const componentTypes = ['WHOLE_BLOOD','PACKED_RED_BLOOD_CELLS','FRESH_FROZEN_PLASMA','PLATELETS','CRYOPRECIPITATE'];
export function principal(roleId) {
  const institutionId = roleId === 'ROLE-03' ? 'INST_SYNTH_SECONDARY' : roleId === 'ROLE-04' ? 'INST_SYNTH_REGULATOR' : roleId === 'ROLE-05' ? 'INST_SYNTH_SYSTEM' : 'INST_MEDIATRIX';
  return { userId: 'USR_SYNTH_REVIEW_'+roleId.slice(-2), displayName: 'Synthetic UI Reviewer', institutionId,
    institutionDisplayName: 'Synthetic visual review '+institutionId.replace('INST_',''), roleId,
    roleDisplayName: roleNames[Number(roleId.slice(-2))-1], permissions: permissions[roleId], classification };
}
export function fixture(url, roleId, state = 'populated') {
  const user = principal(roleId), institutionId = user.institutionId;
  const now = new Date().toISOString();
  const day = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const date = url.searchParams.get('businessDate') ?? day;
  const previous = new Date(date+'T00:00:00.000Z'); previous.setUTCDate(previous.getUTCDate()-1);
  const asOfDate = previous.toISOString().slice(0,10), generatedAt = asOfDate+'T12:00:00.000Z';
  const empty = state === 'empty', regulatory = roleId === 'ROLE-04', admin = ['ROLE-05','ROLE-06'].includes(roleId);
  const inventory = empty || admin ? [] : bloodTypes.flatMap((bloodType,i)=>componentTypes.slice(0,4).map((component,j)=>({ institutionId, institutionDisplayName:user.institutionDisplayName,bloodType,component,inventoryStatus:'AVAILABLE',confirmedCount:(i*3+j)%12,lastProjectedAt:now })));
  const components = empty ? [] : bloodTypes.map((bloodType,i)=>({ componentId:'CMP_SYNTH_REVIEW_'+i,donationId:'DON_SYNTH_REVIEW_'+i,issuerInstitutionId:institutionId,institutionId,bloodType,componentType:componentTypes[i% (url.searchParams.get('contractVersion') === 'V2.1' ? 5 : 4)],collectedAt:asOfDate+'T00:00:00.000Z',expiresAt:new Date(Date.now()+86400000*(i+1)).toISOString(),inventoryStatus:i%3===0?'RESERVED':'AVAILABLE',reservationId:i%3===0?'RES_SYNTH_REVIEW_'+i:null,reservationVersion:i%3===0?1:null,inventoryVersion:1,policyVersion:'INTERVIEW_DERIVED_CORE_V2',classification }));
  const alerts = empty ? [] : ['EXPIRED','SYNC_CONFLICT','EXPIRED'].map((alertType,i)=>({alertId:'ALERT_SYNTH_REVIEW_'+i,alertType,severity:i===1?'CRITICAL':'WARNING',unitId:'UNIT_SYNTH_REVIEW_'+i,bloodType:bloodTypes[i],component:componentTypes[i],expiresAt:new Date(Date.now()+86400000*(i+1)).toISOString(),evaluatedAt:now,status:i===2?'CLOSED':'OPEN',acknowledged:true}));
  const aggregates = alerts.map(a=>({institutionDisplayName:user.institutionDisplayName,alertType:a.alertType,severity:a.severity,status:a.status,count:2,lastEvaluatedAt:now}));
  const transfers = empty ? [] : ['PENDING','APPROVED','IN_TRANSIT','DELAYED','RECEIVED','COMPROMISED'].map((status,i)=>({transferId:'TR_SYNTH_REVIEW_'+i,sourceInstitutionId:roleId==='ROLE-03'?'INST_MEDIATRIX':institutionId,destinationInstitutionId:roleId==='ROLE-03'?institutionId:'INST_SYNTH_SECONDARY',bloodType:bloodTypes[i],component:componentTypes[i%4],quantity:i+1,urgency:i%2?'URGENT':'ROUTINE',requestTime:now,status,reasonCode:null,recommendationDigest:null,ledgerVersion:i+1,projectedAt:now,dispatchEvidenceRecorded:i>1,receiptEvidenceRecorded:i>3}));
  const summary = transfers.map(t=>({status:t.status,transferCount:1,unitCount:t.quantity}));
  const path = url.pathname;
  if(path==='/api/v2/dashboard')return fixture(new URL('/api/v1/dashboard',url),roleId,state);
  if(path==='/api/v2/alerts')return fixture(new URL('/api/v1/alerts',url),roleId,state);
  if(path==='/api/v2/audit')return fixture(new URL('/api/v1/audit',url),roleId,state);
  if(path==='/api/v2/transfers')return {classification,requests:empty?[]:transfers.slice(0,3).map((t,i)=>({transfer_id:t.transferId,destination_institution_id:t.destinationInstitutionId,blood_type:t.bloodType,component_type:t.component,quantity:t.quantity,status:'PENDING',ledger_transaction_id:'SYNTHETIC_VISUAL_REFERENCE_'+i})),reservations:empty?[]:[{reservation_id:'RES_SYNTH_REVIEW_ACTIVE',transfer_id:'TR_SYNTH_REVIEW_0',purpose:'TRANSFER',status:'ACTIVE',version:1},{reservation_id:'RES_SYNTH_REVIEW_TRANSIT',transfer_id:'TR_SYNTH_REVIEW_1',purpose:'TRANSFER',status:'IN_TRANSIT',version:3}],timeline:empty?[]:[{command_id:'CMD_SYNTH_REVIEW',resource_id:'TR_SYNTH_REVIEW_1',operation:'DISPATCH_RESERVATION',status:'COMMITTED',accepted_at:now,ledger_transaction_id:'SYNTHETIC_VISUAL_REFERENCE',block_number:null,validation_status:null}]};
  if(path.startsWith('/api/v2/historical-snapshots')){
    const snapshot={snapshot_id:'HSNAP_SYNTH_VISUAL_REVIEW',source_business_date:'2026-10-07',source_institution_id:'SYNTHETIC_VISUAL_SOURCE',status:'COMPLETED',expected_units:200,verified_units:200,workbook_sha256:'0'.repeat(64),manifest_sha256:'0'.repeat(64)};
    if(path==='/api/v2/historical-snapshots')return {classification,snapshots:empty?[]:[snapshot]};
    const counts=['A_POSITIVE','B_POSITIVE','O_POSITIVE','AB_POSITIVE'].flatMap(blood_type=>componentTypes.map(component_type=>({series_key:blood_type+':'+component_type,blood_type,component_type,available_units:8,reserved_units:2,closing_units:10})));
    const offset=Number(url.searchParams.get('cursor')??0),limit=Number(url.searchParams.get('limit')??50);
    return {classification,snapshot,counts,units:Array.from({length:empty?0:Math.min(limit,200-offset)},(_,i)=>({component_id:'HIST_SYNTH_VISUAL_'+(offset+i),snapshot_status:(offset+i)%5?'AVAILABLE':'RESERVED',allocation_group_id:null,ledger_transaction_id:'SYNTHETIC_VISUAL_REFERENCE_'+(offset+i),block_number:'SAMPLE',validation_status:'SAMPLE_ONLY',committed_at:now})),nextCursor:offset+limit<200?String(offset+limit):null};
  }
  if(path==='/api/v1/auth/session') return {principal:user};
  if(path==='/api/v1/dashboard') return {composition:admin?'ADMINISTRATIVE':regulatory?'REGULATORY':'OPERATIONAL',scope:admin?'PRINCIPAL':regulatory||roleId==='ROLE-03'?'CITY_AGGREGATE':'INSTITUTION',inventory,pendingScans:admin||empty?[]:[{status:'QUEUED',count:3},{status:'CONFLICT',count:1}],lastSuccessfulProjectionAt:empty?null:now,classification};
  if(path==='/api/v2/components') return {scope:'INSTITUTION',components,classification};
  if(path==='/api/v2/reports/inbound-intake') return {scope:'INSTITUTION',statuses:empty?{}:{QUEUED:3,FAILED:1,CONFLICT:1},includedInventoryStatuses:['COMMITTED'],excludedFromInventory:['QUEUED','FAILED','CONFLICT'],classification};
  if(path==='/api/v1/alerts') return {scope:regulatory?'CITY_AGGREGATE':'INSTITUTION',alerts:regulatory?[]:alerts,aggregates:regulatory?aggregates:[],classification};
  if(path==='/api/v1/transfers') return {scope:regulatory?'CITY_AGGREGATE':roleId==='ROLE-03'?'DESTINATION_INSTITUTION':'SOURCE_INSTITUTION',transfers,classification};
  if(path.startsWith('/api/v1/transfers/')) {
    const transfer=transfers.find(t=>t.transferId===path.split('/').at(-1));
    if(transfer)return {transfer,selectedUnitIds:['UNIT_SYNTH_REVIEW_01'],timeline:[{eventId:'EV_SYNTH_REVIEW',fromStatus:null,toStatus:transfer.status,eventTime:now,reasonCode:null,ledgerTransactionId:'SYNTHETIC_VISUAL_REFERENCE',ledgerVersion:transfer.ledgerVersion,correlationId:'CORR_SYNTH_REVIEW'}],explanations:[],selectionPolicy:'FEFO',recommendationEligibility,automaticApproval:false,classification};
  }
  if(path==='/api/v1/consortium') return {scope:'CITY_AGGREGATE',inventory,alerts:aggregates,transferSummary:summary,lastSuccessfulProjectionAt:empty?null:now,classification};
  if(path==='/api/v1/audit') return {scope:regulatory?'CITY_AGGREGATE':'INSTITUTION',events:empty?[]:['INBOUND_CAPTURE','TRANSFER_DISPATCH','ACCESS_DENIED'].map((actionCode,i)=>({auditEventId:'AUD_SYNTH_REVIEW_'+i,institutionDisplayName:user.institutionDisplayName,actionCode,targetType:i?'TRANSFER':'COMPONENT',outcome:i===2?'REJECTED':'COMMITTED',safeErrorCode:i===2?'FORBIDDEN':null,correlationId:'CORR_SYNTH_REVIEW_'+i,ledgerTransactionId:i===2?null:'SYNTHETIC_VISUAL_REFERENCE_'+i,eventTime:now})),classification};
  if(path==='/api/v1/reports/inventory')return {reportType:'CITY_INVENTORY_SUMMARY',scope:'CITY_AGGREGATE',generatedAt:now,inventory,alerts:aggregates,transferSummary:summary,disclaimer:'Synthetic visual fixtures only; no ledger, forecast calculation or official filing.',classification};
  if(path==='/api/v1/demand-forecasts') {
    const datasetVersion=url.searchParams.get('datasetVersion')??'SYNTHETIC_FORECAST_V4_RUNTIME_V1';
    const v5=datasetVersion==='SYNTHETIC_FORECAST_V5_RUNTIME_V1',modelVersion=v5?'bloodledger-v5-series-mean-1.0.0':'bloodledger-weighted-average-7-1.0.0',runId='FRUN_SYNTH_REVIEW';
    const forecasts=empty?[]:['A_POSITIVE','B_POSITIVE','O_POSITIVE','AB_POSITIVE'].flatMap((bloodType,i)=>componentTypes.map((component,j)=>({forecastId:'FC_'+(i*5+j).toString(16).toUpperCase().padStart(40,'0'),runKey:'RUN_KEY_SYNTH_REVIEW',runId,institutionId,bloodType,component,horizonDate:date,asOfDate,pointForecast:j+0.25,lowerForecast:null,upperForecast:null,uncertaintyStatus:'UNCERTAINTY_UNAVAILABLE',uncertaintyNote:'UI fixture value; not model inference.',datasetVersion,modelVersion,forecastStatus:'AVAILABLE',classification,recommendationEligibility,generatedAt,stale:false})));
    return {businessDate:date,status:empty?'UNAVAILABLE':'CURRENT',datasetVersion,modelVersion:empty?null:modelVersion,asOfDate:empty?null:asOfDate,horizonDate:empty?null:date,forecastStatus:empty?'UNAVAILABLE':'AVAILABLE',unavailableReason:empty?'NO_FORECAST_AVAILABLE':null,runId:empty?null:runId,generatedAt:empty?null:generatedAt,lineage:v5&&!empty?{trainingCutoffDate:'2025-06-30',modelSha256:'a'.repeat(64)}:null,trainingCutoffDate:v5&&!empty?'2025-06-30':null,classification,recommendationEligibility,forecasts};
  }
  if(path==='/api/v2/analytics/inventory-evidence')return {schemaVersion:'BLOODLEDGER_INVENTORY_EVIDENCE_V1',institutionId,businessDate:date,evaluatedAt:now,evaluationDate:day,status:empty||date!==day?'UNAVAILABLE':'CURRENT',unavailableReason:empty||date!==day?'ML_SNAPSHOT_UNAVAILABLE':null,classification,recommendationEligibility,snapshot:empty||date!==day?null:{snapshotId:'CENSUS_SYNTH_REVIEW',institutionId,snapshotKind:'INTERNAL_ML',schemaVersion:'BLOODLEDGER_ML_INVENTORY_SNAPSHOT_V1',reportPolicyVersion:'INTERVIEW_ML_INVENTORY_SNAPSHOT_V1',timezone:'Asia/Manila',scheduledFor:now,capturedAt:now,sourceProjectionDigest:'a'.repeat(64),projectionWatermark:1,coverage:'COMPLETE',expectedSeries:40,persistedSeries:40,classification,groups:componentTypes.map(componentType=>({componentType,bloodTypes:bloodTypes.map((bloodType,i)=>({bloodType,availableCount:i,reservedCount:2,forecastEligibleAvailableCount:i,reportableCount:i+2}))}))}};
}
