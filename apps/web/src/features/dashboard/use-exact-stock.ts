import {useEffect,useState} from "react";
import {useValidatedRead} from "../../hooks/use-validated-read";
import {stockClassificationPolicy} from "./stock-classification";
import {parseDashboardStockCounts} from "../../services/api/panel-revisions";
export function useExactStock(institutionId:string|undefined){
 const [now,setNow]=useState(Date.now);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 const state=useValidatedRead(institutionId?"/api/v2/dashboard/stock-counts":null,value=>parseDashboardStockCounts(value,institutionId!));
 useEffect(()=>{const refresh=()=>state.manual();window.addEventListener("bloodledger:command-committed",refresh);window.addEventListener("bloodledger:dashboard-refresh",refresh);return()=>{window.removeEventListener("bloodledger:command-committed",refresh);window.removeEventListener("bloodledger:dashboard-refresh",refresh);};},[state.manual]);
 const age=state.data?now-Date.parse(state.data.evaluatedAt):Infinity;
 return {...state,fresh:!state.error&&age>=-1000&&age<=stockClassificationPolicy.maxReadAgeMs};
}
