import { useId, useState } from "react";
import { createPortal } from "react-dom";
import type { StockSegment } from "./stock-classification";

export function StockThresholdSegment({ segment, total, product }: {segment: StockSegment; total: number; product: string}) {
  const id = useId();
  const [position, setPosition] = useState<{left:number;top:number}>();
  const label = segment.band === "unknown" ? "Unclassified" : segment.band[0].toUpperCase()+segment.band.slice(1);
  function show(element: HTMLButtonElement) {
    const box = element.getBoundingClientRect();
    setPosition({left:Math.max(8,Math.min(window.innerWidth-288,box.left+box.width/2-136)),top:Math.max(8,box.top-100)});
  }
  return <>
    <button type="button" className={`stock-threshold-segment segment-${segment.band}`} style={{bottom:`${segment.start/total*100}%`,height:`${(segment.end-segment.start)/total*100}%`}}
      data-start={segment.start} data-end={segment.end}
      aria-label={`${product} — ${label}: ${segment.range} units. ${segment.explanation}`}
      aria-describedby={position ? id : undefined}
      onMouseEnter={event=>show(event.currentTarget)} onMouseLeave={event=>{if(document.activeElement!==event.currentTarget)setPosition(undefined);}}
      onFocus={event=>show(event.currentTarget)} onBlur={()=>setPosition(undefined)}
      onClick={event=>show(event.currentTarget)} onKeyDown={event=>{if(event.key==="Escape"){setPosition(undefined);event.stopPropagation();}}}/>
    {position && createPortal(<span id={id} role="tooltip" className="stock-threshold-tooltip" style={position}><strong>{product} · {label}</strong><span className="stock-threshold-range-row"><span>{segment.range} units</span>{segment.band === "surplus" && <span>Surplus: {segment.end-segment.start} units</span>}</span><small>{segment.explanation}</small></span>,document.body)}
  </>;
}
