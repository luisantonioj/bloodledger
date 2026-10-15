import {useEffect,useState} from "react";
import {retryAfterContextChange} from "../../services/api/client";
import {readV2Components,type V2ComponentsResponse,parseComponentsResponse,V2_BLOOD_TYPES,V2_COMPONENT_TYPES} from "../../services/api/v2";

// A current inventory read is not a captured report or a verification outcome.
export function currentComplianceStock(value:unknown,institutionId:string,now=Date.now()){
  const response=parseComponentsResponse(value),seen=new Set<string>();
  if(!Number.isFinite(now))throw Error("Current stock unavailable.");
  const groups=V2_COMPONENT_TYPES.map(componentType=>({componentType,bloodTypes:V2_BLOOD_TYPES.map(bloodType=>({bloodType,availableCount:0,reservedCount:0,reportableCount:0}))}));
  let labelExpiredPendingEvaluation=0;
  for(const row of response.components){
    if(row.institutionId!==institutionId||seen.has(row.componentId)||!Number.isFinite(Date.parse(row.expiresAt)))throw Error("Current inventory is incomplete or outside your institution.");
    seen.add(row.componentId);
    if(!["AVAILABLE","RESERVED"].includes(row.inventoryStatus))continue;
    if(row.expiryState==="LABEL_EXPIRED_PENDING_EVALUATION"){labelExpiredPendingEvaluation++;continue;}
    if(row.expiryState!=="CURRENT"||Date.parse(row.expiresAt)<=now)continue;
    const cell=groups.find(group=>group.componentType===row.componentType)!.bloodTypes.find(cell=>cell.bloodType===row.bloodType)!;
    if(row.inventoryStatus==="AVAILABLE")cell.availableCount++;else cell.reservedCount++;
    cell.reportableCount++;
  }
  return {groups,total:groups.reduce((sum,group)=>sum+group.bloodTypes.reduce((sum,row)=>sum+row.reportableCount,0),0),labelExpiredPendingEvaluation};
}


export function useCurrentComplianceStock(institutionId:string|undefined,revision:number){
  const [state,setState]=useState<{institutionId:string;response:V2ComponentsResponse;at:number}>(),[error,setError]=useState(""),[busy,setBusy]=useState(false),[now,setNow]=useState(Date.now);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{
    if(!institutionId){setState(undefined);setError("");return;}
    let closed=false,sequence=0;
    async function read(){const current=++sequence;setBusy(true);try{
      const response=await retryAfterContextChange(()=>readV2Components("V2.1"),()=>!closed&&current===sequence),at=Date.now();
      currentComplianceStock(response,institutionId!,at);
      if(!closed&&current===sequence){setState({institutionId:institutionId!,response,at});setNow(at);setError("");}
    }catch{if(!closed&&current===sequence){setState(undefined);setError("Current inventory could not be verified.");}}
    finally{if(!closed&&current===sequence)setBusy(false);}}
    const visible=()=>{if(!document.hidden)void read();};void read();const timer=setInterval(visible,30000);document.addEventListener("visibilitychange",visible);
    return()=>{closed=true;clearInterval(timer);document.removeEventListener("visibilitychange",visible);};
  },[institutionId,revision]);
  let data:ReturnType<typeof currentComplianceStock>|undefined;
  if(state&&state.institutionId===institutionId&&now>=state.at&&now-state.at<=60000)try{data=currentComplianceStock(state.response,institutionId!,now);}catch{}
  return {data,busy,error:(error||state&&!data)?"Current inventory could not be verified.":""};
}
