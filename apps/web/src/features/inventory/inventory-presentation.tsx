import type { V2Component } from "../../services/api/v2";
import { humanizeCode } from "../../components/ui/display";

const manilaDate = new Intl.DateTimeFormat("en", {timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit"});
export function inventoryExpiryDate(value:string) {
  if(!Number.isFinite(Date.parse(value)))return "Unavailable";
  const parts=manilaDate.formatToParts(new Date(value));
  return ["year","month","day"].map(type=>parts.find(part=>part.type===type)?.value).join("-");
}
// Mockup-only visual bands; not the component-specific expiry evaluation policy.
export function inventoryTimeRemaining(expiresAt:string, now=Date.now()) {
  const remaining=Date.parse(expiresAt)-now;
  if(!Number.isFinite(remaining))return {tone:"neutral",label:"Unavailable"};
  if(remaining<=0){const days=Math.floor(-remaining/86400000);return {tone:"expired",label:days===0?"Expired less than a day ago":`Expired ${days} day${days===1?"":"s"} ago`};}
  const days=Math.ceil(remaining/86400000);
  return {tone:days<=3?"critical":days<=7?"warning":"success",label:`${days} day${days===1?"":"s"}`};
}
export function InventoryTimeRemaining({expiresAt}:{expiresAt:string}) {
  const value=inventoryTimeRemaining(expiresAt);
  return <span className={"inventory-chip inventory-chip-"+value.tone} title="Mockup display bands: up to 3 days, 4–7 days, over 7 days. Not a usability determination."><span className="inventory-chip-dot" aria-hidden="true"/>{value.label}</span>;
}
export function InventoryStatus({component}:{component:V2Component}) {
  const expiredLabel=component.expiryState!=="CURRENT"||Date.parse(component.expiresAt)<=Date.now();
  const blocked=expiredLabel&&component.inventoryStatus==="AVAILABLE";
  const tone=blocked?"expired":component.inventoryStatus==="AVAILABLE"?"success":component.inventoryStatus==="RESERVED"?"warning":component.inventoryStatus==="EXPIRED"?"expired":["QUARANTINED","DISCARDED","RECONCILIATION_HOLD"].includes(component.inventoryStatus)?"critical":"neutral";
  const label=blocked?component.expiryState==="EXPIRED"?"Expired":"Expiry evaluation pending":humanizeCode(component.inventoryStatus).toLowerCase().replace(/^./,char=>char.toUpperCase());
  return <span className={"inventory-chip inventory-chip-"+tone} title={blocked?"Label expired; not usable. Recorded inventory state: "+component.inventoryStatus:component.inventoryStatus}><span className="inventory-chip-dot" aria-hidden="true"/>{label}</span>;
}
