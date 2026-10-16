import {CENSUS_ORDER,type CensusSnapshot} from "../../services/api/census-index";
import {V2_COMPONENT_TYPES} from "../../services/api/v2";
import {parseComplianceStock} from "./compliance-stock";
import {componentLabel} from "../transfers/requester-transfer-data";
import {formatBloodType} from "../../components/ui/display";

export function checkpointRecord(rows:CensusSnapshot[],institutionId:string,date:string,hour:"09"|"16",now=Date.now()){
  const matches=rows.filter(row=>{
    if(row.institutionId!==institutionId||Date.parse(row.scheduledFor)>now||Date.parse(row.capturedAt)>now||Date.parse(row.capturedAt)<Date.parse(row.scheduledFor))return false;
    const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(new Date(row.scheduledFor)).map(p=>[p.type,p.value]));
    return `${parts.year}-${parts.month}-${parts.day}`===date&&parts.hour===hour&&parts.minute==="00"&&parts.second==="00";
  });
  return {record:matches.length===1?matches[0]:undefined,ambiguous:matches.length>1};
}
export function checkpointClipboard(value:unknown,selected:CensusSnapshot){
  const groups=parseComplianceStock(value,selected);
  if(groups.length!==V2_COMPONENT_TYPES.length||V2_COMPONENT_TYPES.some(type=>!groups.some(group=>group.componentType===type)))throw Error("All five components are required to copy this checkpoint.");
  const rows=CENSUS_ORDER.map(type=>{
    const counts=V2_COMPONENT_TYPES.map(component=>groups.find(group=>group.componentType===component)!.bloodTypes.find(row=>row.bloodType===type)!.reportableCount);
    const total=counts.reduce((sum,count)=>sum+count,0);if(!Number.isSafeInteger(total))throw Error("Report total is invalid.");
    return [formatBloodType(type),...counts.map(String),String(total)].join("\t");
  });
  return [["Blood type",...V2_COMPONENT_TYPES.map(componentLabel),"Total"].join("\t"),...rows].join("\r\n")+"\r\n";
}

// Retain the last saved morning/afternoon record across midnight until a newer
// reached checkpoint for that slot is published. Never use a future record.
export function latestCheckpointRecord(rows:CensusSnapshot[],institutionId:string,hour:"09"|"16",now=Date.now()){
  const candidates=rows.filter(row=>{
    if(row.institutionId!==institutionId||Date.parse(row.scheduledFor)>now||Date.parse(row.capturedAt)>now||Date.parse(row.capturedAt)<Date.parse(row.scheduledFor))return false;
    const parts=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(new Date(row.scheduledFor)).map(p=>[p.type,p.value]));
    return parts.hour===hour&&parts.minute==="00"&&parts.second==="00";
  }).sort((a,b)=>Date.parse(b.scheduledFor)-Date.parse(a.scheduledFor));
  const latest=candidates[0];
  const ambiguous=Boolean(latest&&candidates.filter(row=>Date.parse(row.scheduledFor)===Date.parse(latest.scheduledFor)).length>1);
  return {record:ambiguous?undefined:latest,ambiguous};
}
