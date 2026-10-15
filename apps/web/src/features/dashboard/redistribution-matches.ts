import { useEffect, useState } from "react";
import { retryAfterContextChange } from "../../services/api/client";
import { readCoordination, seriesQuery, type BroaRedistributionView, type SourceSurplusView } from "../../services/api/coordination";
import { manilaBusinessDate } from "../../services/api/forecast";
import { V2_BLOOD_TYPES, V2_COMPONENT_TYPES } from "../../services/api/v2";

export function validRedistribution(data: BroaRedistributionView, institutionId: string, bloodType: string, component: string, quantity: number) {
  if (data.schemaVersion !== "BROA_REDISTRIBUTION_VIEW_V1" || data.institutionId !== institutionId || data.bloodType !== bloodType || data.componentType !== component || data.gate.requiredQuantity !== quantity || !["AVAILABLE","UNAVAILABLE"].includes(data.status)) throw Error("Ranking does not match the selection");
  if (!data.ranked.every((row,index) => row && row.rank === index + 1 && typeof row.destinationInstitutionId === "string" && row.destinationInstitutionId !== institutionId && Number.isFinite(row.score) && [row.urgency,row.stockShortage,row.distanceKm,row.normalized?.urgency,row.normalized?.stockShortage,row.normalized?.distancePenalty,row.contributions?.urgency,row.contributions?.stockShortage,row.contributions?.distancePenalty].every(value => Number.isFinite(value) && value >= 0)) || new Set(data.ranked.map(row => row.destinationInstitutionId)).size !== data.ranked.length) throw Error("Ranking invalid");
  return data;
}
export const eligibleRedistribution = (data: BroaRedistributionView) => data.status === "AVAILABLE" && data.gate.eligible === true && typeof data.gate.surplusQuantity === "number" && data.gate.surplusQuantity >= data.gate.requiredQuantity && data.ranked.length > 0;

export function useRedistributionMatches(institutionId: string, automatic: boolean, bloodType: string, component: string, quantity: number | null) {
  const [revision,setRevision] = useState(0);
  const [result,setResult] = useState<{key:string; data:BroaRedistributionView[]; error?:string; reason?:string; partial?:boolean}>();
  const key=JSON.stringify([institutionId,automatic,bloodType,component,quantity,revision]);
  useEffect(()=>{
    const controller=new AbortController();setResult(undefined);
    if(quantity===null)return()=>controller.abort();
    async function read<T extends BroaRedistributionView|SourceSurplusView>(path:string):Promise<T>{
      return retryAfterContextChange(() => readCoordination<T>(path,institutionId,controller.signal), () => !controller.signal.aborted);
    }
    async function run(){
      const ranking=async(blood:string,product:string)=>validRedistribution(await read<BroaRedistributionView>("/api/v2/coordination/redistribution?"+seriesQuery(blood,product)+"&requiredQuantity="+quantity),institutionId,blood,product,quantity!);
      if(!automatic)return {key,data:[await ranking(bloodType,component)]};
      const source=await read<SourceSurplusView>("/api/v2/analytics/source-surplus?businessDate="+manilaBusinessDate());
      if(source.businessDate!==manilaBusinessDate())throw Error("Surplus date mismatch");
      if(source.status!=="CURRENT")return {key,data:[],reason:source.unavailableReason??"SOURCE_SURPLUS_UNAVAILABLE"};
      const series=source.series.filter(row=>row.status==="AVAILABLE" && typeof row.surplusQuantity==="number" && row.surplusQuantity>=quantity! && V2_BLOOD_TYPES.some(value=>value===row.bloodType) && V2_COMPONENT_TYPES.some(value=>value===row.componentType));
      const unique=[...new Map(series.map(row=>[row.bloodType+"|"+row.componentType,row])).values()];
      const results:BroaRedistributionView[]=[];let cursor=0,failed=false;
      // Bound concurrency; each series keeps its own backend ranking and surplus gate.
      await Promise.all(Array.from({length:Math.min(3,unique.length)},async()=>{while(cursor<unique.length&&!controller.signal.aborted){const row=unique[cursor++];try{results.push(await ranking(row.bloodType!,row.componentType!));}catch{failed=true;}}}));
      if(failed && results.length===0)throw Error("No series could be checked");
      results.sort((a,b)=>V2_BLOOD_TYPES.indexOf(a.bloodType)-V2_BLOOD_TYPES.indexOf(b.bloodType)||V2_COMPONENT_TYPES.indexOf(a.componentType)-V2_COMPONENT_TYPES.indexOf(b.componentType));
      return {key,data:results.filter(eligibleRedistribution),partial:failed,reason:!results.some(eligibleRedistribution)?"NO_ELIGIBLE_MATCHES":undefined};
    }
    void run().then(value=>{if(!controller.signal.aborted)setResult(value);}).catch(()=>{if(!controller.signal.aborted)setResult({key,data:[],error:"Redistribution evidence could not be loaded. Refresh to try again."});});
    return()=>controller.abort();
  },[key]);
  useEffect(()=>{const refresh=()=>{if(!document.hidden)setRevision(value=>value+1);};const timer=setInterval(refresh,60000);document.addEventListener("visibilitychange",refresh);return()=>{clearInterval(timer);document.removeEventListener("visibilitychange",refresh);};},[]);
  const current=result?.key===key?result:undefined;
  return {data:current?.data??[],busy:quantity!==null&&!current,error:current?.error,reason:current?.reason,partial:current?.partial,refresh:()=>setRevision(value=>value+1)};
}
