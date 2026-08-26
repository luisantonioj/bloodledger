import { useCallback, useEffect, useRef, useState } from "react";
import { requestJson } from "../services/api/client";
import { pollingDelay } from "./polling";

export function useLiveData<T>(endpoint:string|null) {
  const [data,setData] = useState<T>();
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  const [retry,setRetry] = useState(0);
  const activeEndpoint=useRef(endpoint);
  const manual = useCallback(() => setRetry(value => value + 1), []);
  useEffect(() => {
    if(activeEndpoint.current!==endpoint){activeEndpoint.current=endpoint;setData(undefined)}
    setError("");
    if (!endpoint) return;
    let timer:ReturnType<typeof globalThis.setTimeout>|undefined;
    let failures=0, closed=false, attempt=0;
    let controller:AbortController|undefined;
    const run=async()=>{
      if(closed||document.hidden)return;
      const current=++attempt;
      controller?.abort(); controller=new AbortController(); setBusy(true);
      try { setData(await requestJson<T>(endpoint,{signal:controller.signal},"The data service is unavailable.")); setError(""); failures=0; }
      catch(reason) { if(!controller.signal.aborted){ failures++; setError(reason instanceof Error?reason.message:"The data service is unavailable."); } }
      finally { if(!closed&&current===attempt){ setBusy(false); timer=globalThis.setTimeout(()=>void run(),pollingDelay(failures)); } }
    };
    const visible=()=>{ globalThis.clearTimeout(timer); if(!document.hidden)void run(); };
    document.addEventListener("visibilitychange",visible); void run();
    return()=>{ closed=true; controller?.abort(); globalThis.clearTimeout(timer); document.removeEventListener("visibilitychange",visible); };
  },[endpoint,retry]);
  return { data,error,busy,manual };
}
