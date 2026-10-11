import { useCallback, useEffect, useRef, useState } from "react";
import { ApiRequestError, requestJson } from "../services/api/client";
import { pollingDelay } from "./polling";

export function useLiveData<T>(endpoint:string|null) {
  const [data,setData] = useState<T>();
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(Boolean(endpoint));
  const [retry,setRetry] = useState(0);
  const activeEndpoint=useRef(endpoint);
  const hasData=useRef(false);
  const manual = useCallback(() => setRetry(value => value + 1), []);
  useEffect(() => {
    if(activeEndpoint.current!==endpoint){activeEndpoint.current=endpoint;hasData.current=false;setData(undefined)}
    setError("");
    if (!endpoint) {setBusy(false);return;}
    let timer:ReturnType<typeof globalThis.setTimeout>|undefined;
    let failures=0, closed=false, attempt=0;
    let controller:AbortController|undefined;
    const run=async()=>{
      if(closed||document.hidden)return;
      let quickRetry=false;
      const current=++attempt;
      controller?.abort(); controller=new AbortController(); const signal=controller.signal; setBusy(true);
      try {
        const next=await requestJson<T>(endpoint,{signal},"The data service is unavailable.");
        if(closed||signal.aborted||current!==attempt)return;
        hasData.current=true;setData(next); setError(""); failures=0;
      }
      catch(reason) { if(!closed&&!signal.aborted&&current===attempt){
        failures++;
        const sessionChanged=reason instanceof ApiRequestError && reason.code==="AUTH_CONTEXT_CHANGED";
        if(sessionChanged){hasData.current=false;setData(undefined);setError("");quickRetry=true;}
        else if(!hasData.current && failures===1 && (!(reason instanceof ApiRequestError) || reason.status>=500)){setError("");quickRetry=true;}
        else {
        if(reason instanceof ApiRequestError&&(reason.status===401||reason.status===403))setData(undefined);
        setError(reason instanceof Error?reason.message:"The data service is unavailable.");
        }
      } }
      finally { if(!closed&&current===attempt){ setBusy(quickRetry); timer=globalThis.setTimeout(()=>void run(),quickRetry?250:pollingDelay(failures)); } }
    };
    const visible=()=>{ globalThis.clearTimeout(timer); if(!document.hidden)void run(); };
    document.addEventListener("visibilitychange",visible); void run();
    return()=>{ closed=true; controller?.abort(); globalThis.clearTimeout(timer); document.removeEventListener("visibilitychange",visible); };
  },[endpoint,retry]);
  return { data,error,busy,manual };
}
