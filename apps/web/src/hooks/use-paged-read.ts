import {useEffect,useRef,useState} from "react";
import {ApiRequestError,requestJson,retryAfterContextChange} from "../services/api/client";
import type {ReadPage} from "../services/api/transaction-reads";
export function usePagedRead<T>(endpoint:string|null,parse:(value:unknown)=>ReadPage<T>,rowKey:keyof T,scopeKey:string,onReadError?:(reason:unknown)=>void,headers?:Record<string,string>){
 const [revision,setRevision]=useState(0),[result,setResult]=useState<{key:string;page:ReadPage<T>}>(),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const key=JSON.stringify([endpoint,scopeKey,revision,headers??{}]),active=useRef(""),controller=useRef<AbortController|undefined>(undefined),locked=useRef(false);
 async function read(cursor:string|null,append:boolean){
  if(!endpoint||locked.current)return;locked.current=true;setBusy(true);setError("");const current=key;
  controller.current?.abort();const abort=new AbortController();controller.current=abort;
  try{
   const path=endpoint+(endpoint.includes("?")?"&":"?")+new URLSearchParams({limit:"50",...(cursor?{cursor}:{})});
   const fetch=()=>requestJson<unknown>(path,{signal:abort.signal,headers});
   const raw=await retryAfterContextChange(fetch, () => !abort.signal.aborted && active.current === current);
   const page=parse(raw);if(abort.signal.aborted||active.current!==current)return;
   if(cursor&&page.nextCursor===cursor)throw Error("Repeated cursor");
   const previous=append&&result?.key===current?result.page.rows:[];
   const rows=[...previous,...page.rows];
   if(new Set(rows.map(row=>row[rowKey])).size!==rows.length)throw Error("Overlapping page");
   setResult({key:current,page:{rows,nextCursor:page.nextCursor}});
  }catch(reason){if(!abort.signal.aborted&&active.current===current){onReadError?.(reason);if(reason instanceof ApiRequestError&&[401,403].includes(reason.status))setResult(undefined);setError(reason instanceof ApiRequestError&&reason.status===403?"You are not permitted to view these records.":"Records are unavailable. Refresh to try again.");}}
  finally{if(!abort.signal.aborted&&active.current===current){locked.current=false;setBusy(false);}}
 }
 useEffect(()=>{active.current=key;controller.current?.abort();locked.current=false;setResult(undefined);setError("");if(endpoint)void read(null,false);else setBusy(false);return()=>{controller.current?.abort();locked.current=false;};},[key]);
 const page=result?.key===key?result.page:undefined;
 return {readKey:key,rows:page?.rows??[],ready:Boolean(page),nextCursor:page?.nextCursor,busy,error,refresh:()=>setRevision(value=>value+1),loadMore:()=>{if(page?.nextCursor)void read(page.nextCursor,true);}};
}
