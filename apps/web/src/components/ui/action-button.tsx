import {Children,useId,useLayoutEffect,useRef,useState,type ButtonHTMLAttributes} from "react";
import {createPortal} from "react-dom";
type ActionButtonProps=ButtonHTMLAttributes<HTMLButtonElement>&{unavailableReason:string};
// Native disabled actions remain inert. The separate accessible trigger only explains them.
export function ActionButton({unavailableReason,disabled,...props}:ActionButtonProps){
 return disabled?<UnavailableAction {...props} reason={unavailableReason}/>:<button {...props}/>;
}
function UnavailableAction({reason,children,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{reason:string}){
 const id=useId(),anchor=useRef<HTMLButtonElement>(null),tooltip=useRef<HTMLDivElement>(null);
 const [open,setOpen]=useState(false),[position,setPosition]=useState({left:12,top:12});
 const label=(props["aria-label"]??Children.toArray(children).filter(child=>typeof child==="string"||typeof child==="number").join(" ").trim())||"Action";
 useLayoutEffect(()=>{
  if(!open||!anchor.current||!tooltip.current)return;
  const rect=anchor.current.getBoundingClientRect(),width=tooltip.current.offsetWidth,height=tooltip.current.offsetHeight;
  setPosition({left:Math.max(12,Math.min(rect.left,innerWidth-width-12)),top:rect.bottom+8+height<innerHeight?rect.bottom+8:Math.max(12,rect.top-height-8)});
  const dismiss=(event:Event)=>{if(event.type!=="pointerdown"||!anchor.current?.contains(event.target as Node)&&!tooltip.current?.contains(event.target as Node))setOpen(false);};
  document.addEventListener("pointerdown",dismiss);window.addEventListener("resize",dismiss);window.addEventListener("scroll",dismiss,true);
  return()=>{document.removeEventListener("pointerdown",dismiss);window.removeEventListener("resize",dismiss);window.removeEventListener("scroll",dismiss,true);};
 },[open]);
 return <span className="unavailable-action" onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>{if(document.activeElement!==anchor.current)setOpen(false);}}>
  <button {...props} disabled aria-hidden="true" tabIndex={-1}>{children}</button>
  <button ref={anchor} type="button" className="unavailable-action-trigger" aria-label={label+" unavailable"} aria-disabled="true" aria-describedby={open?id:undefined} onFocus={()=>setOpen(true)} onBlur={()=>setOpen(false)} onClick={event=>{event.preventDefault();event.stopPropagation();setOpen(true);}} onKeyDown={event=>{if(event.key==="Escape"){event.preventDefault();event.stopPropagation();setOpen(false);}}}/>
  {open&&createPortal(<div ref={tooltip} id={id} role="tooltip" className="unavailable-action-tooltip" style={position}><strong>{label}</strong><span>{reason}</span></div>,document.body)}
 </span>;
}
