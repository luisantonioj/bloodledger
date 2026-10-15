import { readCoordination, type SourceSurplusView } from "../../services/api/coordination";
import { manilaBusinessDate } from "../../services/api/forecast";
import { sourceSurplusQuantity } from "./surplus-quantity";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import type { StockSegment } from "./stock-classification";

export function StockThresholdSegment({ segment, total, product, institutionId, bloodType, componentType, eligible }: {segment: StockSegment; total: number; product: string; institutionId?: string; bloodType: string; componentType: string; eligible: number | null}) {
  const id = useId();
  const [position, setPosition] = useState<{left:number;top:number}>();
  const [estimate, setEstimate] = useState<{quantity:number|null;fetchedAt:number}>();
  const date = manilaBusinessDate(), openSurplus = Boolean(position) && segment.band === "surplus";
  useEffect(()=>{
    setEstimate(undefined);
    if(!openSurplus || !institutionId || eligible === null) return;
    const controller = new AbortController();let sequence=0;
    const read=async()=>{const current=++sequence;try{
      const data=await readCoordination<SourceSurplusView>("/api/v2/analytics/source-surplus?"+new URLSearchParams({businessDate:date}),institutionId,controller.signal);
      if(!controller.signal.aborted&&current===sequence)setEstimate({quantity:sourceSurplusQuantity(data,institutionId,bloodType,componentType,eligible),fetchedAt:Date.now()});
    }catch{if(!controller.signal.aborted&&current===sequence)setEstimate({quantity:null,fetchedAt:Date.now()});}};
    void read();const timer=setInterval(()=>void read(),30000);
    return()=>{controller.abort();clearInterval(timer);};
  },[openSurplus,institutionId,bloodType,componentType,eligible,date]);
  const quantity = estimate && Date.now()-estimate.fetchedAt<=60000 ? estimate.quantity : null;
  const label = segment.band === "unknown" ? "Unclassified" : segment.band[0].toUpperCase()+segment.band.slice(1);
  function show(element: HTMLButtonElement) {
    const box = element.getBoundingClientRect();
    setPosition({left:Math.max(8,Math.min(window.innerWidth-288,box.left+box.width/2-136)),top:Math.max(8,box.top-(segment.band === "surplus" ? 190 : 100))});
  }
  return <>
    <button type="button" className={`stock-threshold-segment segment-${segment.band}`} style={{bottom:`${segment.start/total*100}%`,height:`${(segment.end-segment.start)/total*100}%`}}
      data-start={segment.start} data-end={segment.end}
      aria-label={`${product} — ${label}: ${segment.range} units. ${segment.explanation}`}
      aria-describedby={position ? id : undefined}
      onMouseEnter={event=>show(event.currentTarget)} onMouseLeave={event=>{if(document.activeElement!==event.currentTarget)setPosition(undefined);}}
      onFocus={event=>show(event.currentTarget)} onBlur={()=>setPosition(undefined)}
      onClick={event=>show(event.currentTarget)} onKeyDown={event=>{if(event.key==="Escape"){setPosition(undefined);event.stopPropagation();}}}/>
    {position && createPortal(<span id={id} role="tooltip" className="stock-threshold-tooltip" style={position}><strong>{product} · {label}</strong><span>{segment.range} units</span><small>{segment.explanation}</small>{segment.band === "surplus" && <><span>{segment.end-segment.start} eligible units above the stock band.</span><span>{quantity === null ? "Redistribution estimate unavailable." : `Forecast-based source surplus: ${quantity} units.`}</span><small>Human approval and current transfer checks required.</small></>}</span>,document.body)}
  </>;
}
