import {scopedScenario,provenance} from './scenario-v3.mjs';
// BL-TST-01 / FR-03/09/11/12/14: synthetic presentation, never operational evidence.
import { readFileSync } from 'node:fs';
import { ROLE_IDS, permissionsFor } from '../../../services/api/src/web-access.ts';
export const permissions = Object.fromEntries(ROLE_IDS.map(role => [role, [...permissionsFor(role)]]));
export const roleNames = ['Mediatrix blood bank','Blood bank administrator','Metro Lipa requester','PRC Lipa chapter','DOH regulatory office','Institution administrator'];
const classification = 'SIMULATION_ONLY';
const recommendationEligibility = 'DISABLED_UNAPPROVED_POLICY';
const bloodTypes = ['A_POSITIVE','A_NEGATIVE','B_POSITIVE','B_NEGATIVE','AB_POSITIVE','AB_NEGATIVE','O_POSITIVE','O_NEGATIVE'];
const componentTypes = ['WHOLE_BLOOD','PACKED_RED_BLOOD_CELLS','FRESH_FROZEN_PLASMA','PLATELETS','CRYOPRECIPITATE'];
// Public account policy only: no passwords, login requests or operational data.
const labels = {INST_MEDIATRIX:'Mary Mediatrix Medical Center',INST_SYNTH_MEDIX:'Lipa Medix Medical Center',INST_SYNTH_NLVILLA:'N.L. Villa Memorial Medical Center',INST_SYNTH_METROLIPA:'Metro Lipa Medical Center',INST_SYNTH_PRC:'PRC Lipa City Chapter',INST_SYNTH_DOH:'DOH-CHD CALABARZON'};
export const reviewAccounts = JSON.parse(readFileSync(new URL('../../../services/api/policy/institution-accounts-v1.json',import.meta.url),'utf8')).accounts.map(a=>({accountId:a.accountId,institutionId:a.institutionId,category:a.category,roleId:a.readRoleId,label:labels[a.institutionId]}));
export function principal(roleId, accountId = reviewAccounts[0].accountId) {
  const a=reviewAccounts.find(a=>a.accountId===accountId)??reviewAccounts[0];
  const base={operatorId:'OP_SAMPLE_'+a.institutionId,roleId:a.roleId,capabilityProfile:'ROLE',version:1,actionCapabilities:a.category==='REQUESTOR'?['transfer:request','transfer:receive','transfer:cancel']:a.category==='BLOOD_BANK'?['inventory:capture','transfer:request','transfer:prepare','transfer:dispatch','transfer:transit']:[]};
  const operators=a.category==='DOH'?[base]:[base,{operatorId:'OP_SAMPLE_ADMIN_'+a.institutionId,roleId:'ROLE-06',capabilityProfile:a.category==='PRC'?'PRC_REVIEWER':'INSTITUTION_ADMIN',version:1,actionCapabilities:['institution:profile','operator:create-administrator','operator:reset-pin','operator:revoke']}];
  return {accountId:a.accountId,userId:a.accountId,displayName:a.label,institutionId:a.institutionId,institutionDisplayName:a.label,roleId:a.roleId,roleDisplayName:'Institution account',accountCategory:a.category,accountState:'ACTIVE',verificationRequired:true,operators,administrativeCapabilities:a.category==='PRC'?['onboarding:read','onboarding:review']:[],permissions:[...new Set([...permissions[a.roleId],...(['BLOOD_BANK','REQUESTOR'].includes(a.category)?['consortium:read']:[])])].filter(p=>!['inventory:write','transfers:write','alerts:acknowledge'].includes(p)),classification};
}
export function fixture(url, roleId, state = 'populated', accountId) {
  const user = principal(roleId, accountId), institutionId = user.institutionId;
  roleId = user.roleId;
  const now = new Date().toISOString();
  const day = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const date = url.searchParams.get('businessDate') ?? day;
  const previous = new Date(date+'T00:00:00.000Z'); previous.setUTCDate(previous.getUTCDate()-1);
  const asOfDate = previous.toISOString().slice(0,10), generatedAt = asOfDate+'T12:00:00.000Z';
  const empty = state === 'empty', regulatory = roleId === 'ROLE-04', admin = ['ROLE-05','ROLE-06'].includes(roleId);
  const scenario=scopedScenario(user,empty),inventory=scenario.inventory,components=scenario.components;
  const alerts = empty ? [] : ['EXPIRED','SYNC_CONFLICT','EXPIRED'].map((alertType,i)=>({alertId:'ALERT_SYNTH_REVIEW_'+i,alertType,severity:i===1?'CRITICAL':'WARNING',unitId:'UNIT_SYNTH_REVIEW_'+i,bloodType:bloodTypes[i],component:componentTypes[i],expiresAt:new Date(Date.now()+86400000*(i+1)).toISOString(),evaluatedAt:now,status:i===2?'CLOSED':'OPEN',acknowledged:true}));
  const aggregates = alerts.map(a=>({institutionDisplayName:user.institutionDisplayName,alertType:a.alertType,severity:a.severity,status:a.status,count:2,lastEvaluatedAt:now}));
  const transfers = empty ? [] : ['PENDING','APPROVED','IN_TRANSIT','DELAYED','RECEIVED','COMPROMISED'].map((status,i)=>({transferId:'TR_SYNTH_REVIEW_'+i,sourceInstitutionId:roleId==='ROLE-03'?'INST_MEDIATRIX':institutionId,destinationInstitutionId:roleId==='ROLE-03'?institutionId:'INST_SYNTH_SECONDARY',bloodType:bloodTypes[i],component:componentTypes[i%4],quantity:i+1,urgency:i%2?'URGENT':'ROUTINE',requestTime:now,status,reasonCode:null,recommendationDigest:null,ledgerVersion:i+1,projectedAt:now,dispatchEvidenceRecorded:i>1,receiptEvidenceRecorded:i>3}));
  const summary = transfers.map(t=>({status:t.status,transferCount:1,unitCount:t.quantity}));
  const path = url.pathname;
  if(path==='/api/v2/dashboard')return fixture(new URL('/api/v1/dashboard',url),roleId,state,accountId);
  if(path==='/api/v2/alerts')return {scope:regulatory?'CITY_AGGREGATE':'INSTITUTION',alerts:[],aggregates:[],classification,fixtureProvenance:provenance};
  if(path==='/api/v2/audit')return {scope:regulatory?'CITY_AGGREGATE':'INSTITUTION',events:[],classification,fixtureProvenance:provenance};
  if(path==='/api/v2/transfers')return {scope:'INSTITUTION',classification,requests:scenario.requests,reservations:scenario.reservations.map(r=>({reservation_id:r.reservationId,transfer_id:r.transferId,local_release_id:r.localReleaseId,purpose:r.purpose,status:r.status,version:r.version})),timeline:[],fixtureProvenance:provenance};
  if(path.startsWith('/api/v2/components/'))return components.find(c=>c.componentId===path.split('/').at(-1));
  if(path.startsWith('/api/v2/reservations/'))return scenario.reservations.find(r=>r.reservationId===path.split('/').at(-1));
  if(path.startsWith('/api/v2/historical-snapshots')){
    const snapshot={fixtureProvenance:{classification:'SIMULATION_ONLY',dataSource:'HISTORICAL_LAYOUT_SAMPLE_200',excludedFromOperationalTotals:true},snapshot_id:'HSNAP_PREVIEW_HISTORICAL_ONLY',source_business_date:'2026-10-07',source_institution_id:'SYNTHETIC_VISUAL_SOURCE',status:'COMPLETED',expected_units:200,verified_units:200,workbook_sha256:'0'.repeat(64),manifest_sha256:'0'.repeat(64)};
    if(path==='/api/v2/historical-snapshots')return {classification,snapshots:empty?[]:[snapshot]};
    const counts=['A_POSITIVE','B_POSITIVE','O_POSITIVE','AB_POSITIVE'].flatMap(blood_type=>componentTypes.map(component_type=>({series_key:blood_type+':'+component_type,blood_type,component_type,available_units:8,reserved_units:2,closing_units:10})));
    const offset=Number(url.searchParams.get('cursor')??0),limit=Number(url.searchParams.get('limit')??50);
    return {classification,snapshot,counts,units:Array.from({length:empty?0:Math.min(limit,200-offset)},(_,i)=>({component_id:'HIST_PREVIEW_SEPARATE_'+(offset+i),snapshot_status:(offset+i)%5?'AVAILABLE':'RESERVED',allocation_group_id:null,ledger_transaction_id:null,block_number:null,validation_status:'SAMPLE_ONLY',committed_at:now})),nextCursor:offset+limit<200?String(offset+limit):null};
  }
  if(path==='/api/v2/onboarding/institutions')return {institutions:reviewAccounts.map(a=>({institution_id:a.institutionId,display_name:a.label,account_category:a.category,status:'ACTIVE',version:1})),classification};
  if(path==='/api/v2/onboarding/applications')return {applications:[],classification};
  if(path.startsWith('/api/v2/onboarding/institutions/'))return {institution:{institution_id:institutionId,display_name:user.institutionDisplayName,account_category:user.accountCategory,status:'ACTIVE',version:1,username:'SAMPLE_REVIEW_ACCOUNT'},operators:user.operators.map(o=>({operator_id:o.operatorId,role_id:o.roleId,capability_profile:o.capabilityProfile,status:'ACTIVE',version:o.version})),classification};
  if(path==='/api/v2/reports/doh-census')return {scope:regulatory?'REGULATORY_AGGREGATE':'INSTITUTION',snapshots:[],nextCursor:null,displayPolicyVersion:'DOH_CENSUS_COLUMN_ORDER_V1',displayBloodTypeOrder:['O_POSITIVE','A_POSITIVE','B_POSITIVE','AB_POSITIVE','O_NEGATIVE','A_NEGATIVE','B_NEGATIVE','AB_NEGATIVE'],totalColumn:'CALCULATED',exportAvailable:false,reportAvailability:'EXPORT_DISABLED_PENDING_FORMAT',classification};
  if(path==='/api/v1/auth/session') return {principal:user};
  if(path==='/api/v1/dashboard') return {composition:admin?'ADMINISTRATIVE':regulatory?'REGULATORY':'OPERATIONAL',scope:admin?'PRINCIPAL':regulatory||roleId==='ROLE-03'?'CITY_AGGREGATE':'INSTITUTION',inventory,pendingScans:[],lastSuccessfulProjectionAt:empty?null:scenario.t0,classification,fixtureProvenance:provenance};
  if(path==='/api/v2/components') return {scope:'INSTITUTION',components,classification};
  if(path==='/api/v2/reports/inbound-intake') return {scope:'INSTITUTION',statuses:{},includedInventoryStatuses:['COMMITTED'],excludedFromInventory:['QUEUED','FAILED','CONFLICT'],classification};
  if(path==='/api/v1/alerts') return {scope:regulatory?'CITY_AGGREGATE':'INSTITUTION',alerts:regulatory?[]:alerts,aggregates:regulatory?aggregates:[],classification};
  if(path==='/api/v1/transfers') return {scope:regulatory?'CITY_AGGREGATE':roleId==='ROLE-03'?'DESTINATION_INSTITUTION':'SOURCE_INSTITUTION',transfers,classification};
  if(path.startsWith('/api/v1/transfers/')) {
    const transfer=transfers.find(t=>t.transferId===path.split('/').at(-1));
    if(transfer)return {transfer,selectedUnitIds:['UNIT_SYNTH_REVIEW_01'],timeline:[{eventId:'EV_SYNTH_REVIEW',fromStatus:null,toStatus:transfer.status,eventTime:now,reasonCode:null,ledgerTransactionId:'SYNTHETIC_VISUAL_REFERENCE',ledgerVersion:transfer.ledgerVersion,correlationId:'CORR_SYNTH_REVIEW'}],explanations:[],selectionPolicy:'FEFO',recommendationEligibility,automaticApproval:false,classification};
  }
  if(path==='/api/v1/consortium') return {scope:'CITY_AGGREGATE',fixtureProvenance:provenance,inventory:scopedScenario({...user,accountCategory:'PRC'},empty).inventory,alerts:aggregates,transferSummary:summary,lastSuccessfulProjectionAt:empty?null:now,classification};
  if(path==='/api/v1/audit') return {scope:regulatory?'CITY_AGGREGATE':'INSTITUTION',events:empty?[]:['INBOUND_CAPTURE','TRANSFER_DISPATCH','ACCESS_DENIED'].map((actionCode,i)=>({auditEventId:'AUD_SYNTH_REVIEW_'+i,institutionDisplayName:user.institutionDisplayName,actionCode,targetType:i?'TRANSFER':'COMPONENT',outcome:i===2?'REJECTED':'COMMITTED',safeErrorCode:i===2?'FORBIDDEN':null,correlationId:'CORR_SYNTH_REVIEW_'+i,ledgerTransactionId:i===2?null:'SYNTHETIC_VISUAL_REFERENCE_'+i,eventTime:now})),classification};
  if(path==='/api/v1/reports/inventory')return {reportType:'CITY_INVENTORY_SUMMARY',scope:'CITY_AGGREGATE',generatedAt:now,inventory,alerts:aggregates,transferSummary:summary,disclaimer:'Synthetic visual fixtures only; no ledger, forecast calculation or official filing.',classification};
  if(path==='/api/v1/demand-forecasts') {
    // Explicit layout fixture coverage, never inferred from operational stock totals.
    const forecastUnavailable = empty || institutionId !== 'INST_MEDIATRIX';
    const datasetVersion=url.searchParams.get('datasetVersion')??'SYNTHETIC_FORECAST_V4_RUNTIME_V1';
    const v5=datasetVersion==='SYNTHETIC_FORECAST_V5_RUNTIME_V1',modelVersion=v5?'bloodledger-v5-series-mean-1.0.0':'bloodledger-weighted-average-7-1.0.0',runId='FRUN_SYNTH_REVIEW';
    const forecasts=forecastUnavailable?[]:['A_POSITIVE','B_POSITIVE','O_POSITIVE','AB_POSITIVE'].flatMap((bloodType,i)=>componentTypes.map((component,j)=>({forecastId:'FC_'+(i*5+j).toString(16).toUpperCase().padStart(40,'0'),runKey:'RUN_KEY_SYNTH_REVIEW',runId,institutionId,bloodType,component,horizonDate:date,asOfDate,pointForecast:j+0.25,lowerForecast:null,upperForecast:null,uncertaintyStatus:'UNCERTAINTY_UNAVAILABLE',uncertaintyNote:'UI fixture value; not model inference.',datasetVersion,modelVersion,forecastStatus:'AVAILABLE',classification,recommendationEligibility,generatedAt,stale:false})));
    return {businessDate:date,status:forecastUnavailable?'UNAVAILABLE':'CURRENT',datasetVersion,modelVersion:forecastUnavailable?null:modelVersion,asOfDate:forecastUnavailable?null:asOfDate,horizonDate:forecastUnavailable?null:date,forecastStatus:forecastUnavailable?'UNAVAILABLE':'AVAILABLE',unavailableReason:forecastUnavailable?'NO_FORECAST_AVAILABLE':null,runId:forecastUnavailable?null:runId,generatedAt:forecastUnavailable?null:generatedAt,lineage:v5&&!forecastUnavailable?{trainingCutoffDate:'2025-06-30',modelSha256:'a'.repeat(64)}:null,trainingCutoffDate:v5&&!forecastUnavailable?'2025-06-30':null,classification,recommendationEligibility,forecasts};
  }
  const snapshotUnavailable = empty || date !== day || institutionId !== 'INST_MEDIATRIX';
  if(path==='/api/v2/analytics/inventory-evidence')return {schemaVersion:'BLOODLEDGER_INVENTORY_EVIDENCE_V1',institutionId,businessDate:date,evaluatedAt:now,evaluationDate:day,status:snapshotUnavailable?'UNAVAILABLE':'CURRENT',unavailableReason:snapshotUnavailable?'ML_SNAPSHOT_UNAVAILABLE':null,classification,recommendationEligibility,snapshot:snapshotUnavailable?null:{snapshotId:'CENSUS_PREVIEW_MEDIATRIX_V3',institutionId,snapshotKind:'INTERNAL_ML',schemaVersion:'BLOODLEDGER_ML_INVENTORY_SNAPSHOT_V1',reportPolicyVersion:'INTERVIEW_ML_INVENTORY_SNAPSHOT_V1',timezone:'Asia/Manila',scheduledFor:now,capturedAt:now,sourceProjectionDigest:'a'.repeat(64),projectionWatermark:1,coverage:'COMPLETE',expectedSeries:40,persistedSeries:40,classification,groups:componentTypes.map(componentType=>({componentType,bloodTypes:bloodTypes.map((bloodType,i)=>({bloodType,availableCount:scenario.inventory.find(r=>r.component===componentType&&r.bloodType===bloodType&&r.inventoryStatus==='AVAILABLE')?.confirmedCount??0,reservedCount:scenario.inventory.find(r=>r.component===componentType&&r.bloodType===bloodType&&r.inventoryStatus==='RESERVED')?.confirmedCount??0,forecastEligibleAvailableCount:scenario.inventory.find(r=>r.component===componentType&&r.bloodType===bloodType&&r.inventoryStatus==='AVAILABLE')?.confirmedCount??0,reportableCount:scenario.inventory.filter(r=>r.component===componentType&&r.bloodType===bloodType).reduce((sum,r)=>sum+r.confirmedCount,0)}))}))}};
}
