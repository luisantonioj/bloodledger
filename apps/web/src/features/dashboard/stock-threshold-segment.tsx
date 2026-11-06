import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { StockSegment } from "./stock-classification";

export function StockThresholdSegment({ segment, total, product,exact,stockBand,countSummary,empty=false }: {segment: StockSegment; total: number; product: string;exact?:[string,number][];stockBand?:string;countSummary?:string;empty?:boolean}) {
  const id = useId();
  const [anchor, setAnchor] = useState<HTMLButtonElement>();
  const tooltip = useRef<HTMLSpanElement>(null);
  const label = segment.band === "unknown" ? "Unclassified" : segment.band[0].toUpperCase()+segment.band.slice(1);
  const heading = countSummary ?? (exact ? "Demo band " + stockBand : label);

  useLayoutEffect(() => {
    const bubble = tooltip.current;
    if (!anchor || !bubble) return;
    const bar = anchor.closest(".inventory-overview-fill") ?? anchor;
    const gap = 10;
    const margin = 8;
    const clamp = (value: number, limit: number) => Math.max(margin, Math.min(value, limit - margin));

    const placeTooltip = () => {
      const barBounds = bar.getBoundingClientRect();
      const { offsetWidth: width, offsetHeight: height } = bubble;
      const above = barBounds.top - height - gap;
      const right = barBounds.right + gap;
      const left = barBounds.left - width - gap;
      const beside = right + width <= window.innerWidth - margin ? right : left >= margin ? left : null;
      const centered = barBounds.left + (barBounds.width - width) / 2;
      const fitsAbove = above >= margin;
      const x = fitsAbove ? centered : beside ?? centered;
      const y = fitsAbove ? above : beside === null ? barBounds.bottom + gap : barBounds.top;
      bubble.style.left = `${clamp(x, window.innerWidth - width)}px`;
      bubble.style.top = `${clamp(y, window.innerHeight - height)}px`;
    };

    placeTooltip();
    const resizeObserver = new ResizeObserver(placeTooltip);
    resizeObserver.observe(bar);
    resizeObserver.observe(bubble);
    window.addEventListener("resize", placeTooltip);
    window.addEventListener("scroll", placeTooltip, true);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", placeTooltip);
      window.removeEventListener("scroll", placeTooltip, true);
    };
  }, [anchor]);
  return <>
    <button type="button" className={`stock-threshold-segment segment-${segment.band}${empty?" zero-stock-inspect":""}`} style={{bottom:`${segment.start/total*100}%`,height:`${(segment.end-segment.start)/total*100}%`}}
      data-start={segment.start} data-end={segment.end}
      aria-label={exact?`${product} — ${countSummary ?? "demo band " + stockBand}; ${exact.map(([key,value])=>key+": "+value).join("; ")}`:`${product} — ${label}: ${segment.range} units. ${segment.explanation}`}
      aria-describedby={anchor ? id : undefined}
      onMouseEnter={event=>setAnchor(event.currentTarget)} onMouseLeave={event=>{if(document.activeElement!==event.currentTarget)setAnchor(undefined);}}
      onFocus={event=>setAnchor(event.currentTarget)} onBlur={()=>setAnchor(undefined)}
      onClick={event=>setAnchor(event.currentTarget)} onKeyDown={event=>{if(event.key==="Escape"){setAnchor(undefined);event.stopPropagation();}}}/>
    {anchor && createPortal(<span ref={tooltip} id={id} role="tooltip" className="stock-threshold-tooltip">
      <strong>{product} · {heading}</strong>
      {exact&&<span className="exact-stock-tooltip-counts">{exact.map(([key,value])=><span key={key}>{key}: <b>{value}</b></span>)}</span>}
      {!countSummary&&<><span className="stock-threshold-range-row"><span>{segment.range} units</span>{segment.band === "surplus" && <span>Surplus: {segment.end-segment.start} units</span>}</span><small>{segment.explanation}</small></>}
    </span>,document.body)}
  </>;
}
