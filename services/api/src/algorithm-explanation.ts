import type { AlgorithmExplanationView } from "./application-read.js";

type Row = Record<string, unknown>;
const record=(value:unknown):Record<string,unknown>|null=>typeof value==="object"&&value!==null&&!Array.isArray(value)?value as Record<string,unknown>:null;
const finite=(value:unknown):number|null=>typeof value==="number"&&Number.isFinite(value)?value:null;
const text=(value:unknown):string|null=>typeof value==="string"?value:null;
const HASH=/^[0-9a-f]{64}$/;const RUN=/^ARUN_[0-9A-F]{32}$/;const UNIT=/^UNIT_[A-Z0-9_-]{1,56}$/;

function factors(item:Record<string,unknown>,algorithm:"RPS"|"BROA"){
  if(algorithm==="RPS"){
    const values=[["urgency",item.urgencyNormalized,item.urgencyContribution],["wait",item.waitNormalized,item.waitContribution]] as const;
    return values.map(([name,normalized,contribution])=>({name,normalized:finite(normalized),contribution:finite(contribution)}));
  }
  const normalized=record(item.normalized),contributions=record(item.contributions);
  if(!normalized||!contributions)return[];
  const names=["urgency","stockShortage","mlSurplus","distancePenalty"] as const;
  return names.map(name=>({name,normalized:finite(normalized[name]),contribution:finite(contributions[name])}));
}

export function safeAlgorithmExplanation(row:Row,transferId:string,destinationInstitutionId:string,includeSelectedUnit:boolean):AlgorithmExplanationView|null {
  const algorithm=text(row.algorithm_name);
  if(algorithm!=="RPS"&&algorithm!=="BROA")return null;
  const evidence=record(row.evidence),ranked=evidence?.ranked;
  if(!evidence||!Array.isArray(ranked))return null;
  const item=ranked.map(record).find(entry=>entry!==null&&(algorithm==="RPS"?entry.requestId===transferId:entry.institutionId===destinationInstitutionId));
  if(!item)return null;
  const score=finite(item.score),entries=factors(item,algorithm);
  if(score===null||entries.length===0||entries.some(entry=>entry.normalized===null||entry.contribution===null))return null;
  const runId=text(row.run_id),algorithmVersion=text(row.algorithm_version),evaluationTime=row.evaluation_time instanceof Date?row.evaluation_time.toISOString():text(row.evaluation_time),inputSha256=text(row.input_sha256),configSha256=text(row.config_sha256),recommendationDigest=text(row.recommendation_digest);
  if(!runId||!RUN.test(runId)||algorithmVersion!=="SYNTHETIC_OPTIMIZATION_V1"||!evaluationTime||!inputSha256||!HASH.test(inputSha256)||!configSha256||!HASH.test(configSha256)||(recommendationDigest!==null&&!HASH.test(recommendationDigest))||row.recommendation_eligibility!=="DISABLED_UNAPPROVED_POLICY")return null;
  const trigger=algorithm==="BROA"&&["NEAR_EXPIRY","FORECAST_SURPLUS"].includes(String(evidence.trigger))?String(evidence.trigger):null;
  const selected=text(evidence.selectedUnitId);
  return {runId,algorithm,algorithmVersion,recommendationEligibility:"DISABLED_UNAPPROVED_POLICY",evaluationTime,inputSha256,configSha256,recommendationDigest,score,factors:entries.map(entry=>({name:entry.name,normalized:entry.normalized as number,contribution:entry.contribution as number})),trigger,selectedUnitId:algorithm==="BROA"&&includeSelectedUnit&&selected!==null&&UNIT.test(selected)?selected:null,automaticApproval:false,classification:"SIMULATION_ONLY"};
}
