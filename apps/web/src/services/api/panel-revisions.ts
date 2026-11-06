import {choice,integer,invalidRead,nullableTimestamp,object,text,timestamp} from "./contract-validation";
import {V2_BLOOD_TYPES,V2_COMPONENT_TYPES} from "./v2";
export const PARTIAL_REASONS=["INSUFFICIENT_ELIGIBLE_STOCK","LOCAL_RESERVE_PROTECTED","OTHER_OPERATIONAL"] as const;
export const STOCK_STATUS_FIELDS=["available","reserved","outgoingInTransit","received","labelExpiredPendingEvaluation","expired","onHold","compromised"] as const;
export type ExactStatuses=Record<typeof STOCK_STATUS_FIELDS[number],number>;
export type ExactStockRow=ExactStatuses&{bloodType:string;componentType:string};
export type DashboardStockCounts={institutionId:string;evaluatedAt:string;lastProjectedAt:string|null;pendingCommands:number;rows:ExactStockRow[];totals:ExactStatuses&{usable:number}};
export const nonnegative=(value:unknown)=>{if(!Number.isSafeInteger(value)||Number(value)<0)throw invalidRead();return Number(value);};
function statuses(value:unknown):ExactStatuses{const row=object(value);return Object.fromEntries(STOCK_STATUS_FIELDS.map(field=>[field,nonnegative(row[field])])) as ExactStatuses;}
export function parseDashboardStockCounts(value:unknown,institutionId:string):DashboardStockCounts{
 const row=object(value);if(row.policyVersion!=="DASHBOARD_EXACT_STOCK_V1"||row.classification!=="SIMULATION_ONLY"||row.scope!=="INSTITUTION"||row.institutionId!==institutionId||!Array.isArray(row.rows)||row.rows.length!==40)throw invalidRead();
 const expected=V2_BLOOD_TYPES.flatMap(blood=>V2_COMPONENT_TYPES.map(component=>blood+":"+component));
 const rows=row.rows.map((value,index)=>{const item=object(value);if(item.bloodType+":"+item.componentType!==expected[index])throw invalidRead();return {...statuses(item),bloodType:choice(item.bloodType,V2_BLOOD_TYPES),componentType:choice(item.componentType,V2_COMPONENT_TYPES)};});
 const total=object(row.totals),totals={...statuses(total),usable:nonnegative(total.usable)};
 for(const field of STOCK_STATUS_FIELDS)if(rows.reduce((sum,item)=>sum+item[field],0)!==totals[field])throw invalidRead();
 if(totals.usable!==totals.available+totals.reserved)throw invalidRead();
 return {institutionId,evaluatedAt:timestamp(row.evaluatedAt),lastProjectedAt:nullableTimestamp(row.lastProjectedAt),pendingCommands:nonnegative(row.pendingCommands),rows,totals};
}
export type ReceiptDiscrepancy={discrepancyId:string;reservationId:string;reservationVersion:number;status:"OPEN"|"RESOLVED";expectedUnits:number;matchedUnits:number;unmatchedLabels:number;missingUnits:number;recordedAt:string;resolutionCode:"RECOUNT_MATCHED"|"COMPROMISED"|null;resolvedAt:string|null;replayed?:boolean};
export function parseReceiptDiscrepancy(value:unknown,reservationId:string):ReceiptDiscrepancy{
 const row=object(value);if(row.policyVersion!=="RECEIPT_DISCREPANCY_V1"||row.classification!=="SIMULATION_ONLY"||row.reservationId!==reservationId||!/^RDS_[A-F0-9]{40}$/.test(text(row.discrepancyId)))throw invalidRead();
 const status=choice(row.status,["OPEN","RESOLVED"]),expectedUnits=integer(row.expectedUnits),matchedUnits=nonnegative(row.matchedUnits),missingUnits=nonnegative(row.missingUnits),unmatchedLabels=nonnegative(row.unmatchedLabels),resolutionCode=row.resolutionCode===null?null:choice(row.resolutionCode,["RECOUNT_MATCHED","COMPROMISED"]),resolvedAt=nullableTimestamp(row.resolvedAt);
 if(matchedUnits>expectedUnits||missingUnits!==expectedUnits-matchedUnits||(status==="OPEN"?(resolutionCode!==null||resolvedAt!==null):(!resolutionCode||!resolvedAt))||row.replayed!==undefined&&typeof row.replayed!=="boolean")throw invalidRead();
 return {discrepancyId:text(row.discrepancyId),reservationId,reservationVersion:integer(row.reservationVersion),status,expectedUnits,matchedUnits,unmatchedLabels,missingUnits,recordedAt:timestamp(row.recordedAt),resolutionCode,resolvedAt,...(row.replayed===undefined?{}:{replayed:row.replayed})};
}
export function parseApprovalQuantities(value:unknown,memberCount:number){
 const row=object(value),requestedQuantity=row.requestedQuantity===null?null:integer(row.requestedQuantity),approvedQuantity=row.approvedQuantity===null?null:integer(row.approvedQuantity),shortfallQuantity=row.shortfallQuantity===null?null:nonnegative(row.shortfallQuantity);
 const partial=row.partialApproval===null?null:object(row.partialApproval);
 if((approvedQuantity===null)!==(shortfallQuantity===null)||approvedQuantity!==null&&(requestedQuantity===null||approvedQuantity>requestedQuantity||approvedQuantity!==memberCount||shortfallQuantity!==requestedQuantity-approvedQuantity))throw invalidRead();
 const partialApproval=partial?{reasonCode:choice(partial.reasonCode,PARTIAL_REASONS),policyVersion:choice(partial.policyVersion,["SYNTHETIC_PARTIAL_APPROVAL_REASONS_V1"])}:null;
 if(Boolean(partialApproval)!==Boolean(shortfallQuantity&&shortfallQuantity>0))throw invalidRead();
 return {requestedQuantity,approvedQuantity,shortfallQuantity,partialApproval};
}
