import {useState} from "react";
import type {Principal} from "../../auth/permissions";
import {V2_BLOOD_TYPES,V2_COMPONENT_TYPES} from "../../services/api/v2";
import {formatBloodType} from "../../components/ui/display";
import {componentLabel,facilityLabel,type TransferRow} from "../transfers/requester-transfer-data";
export interface ManualReceiptDraft {unitId:string;bloodType:string;component:string;collected:string;expires:string;facility:string;purpose:string;}
export function ManualReceiptEntry({initial,incoming,principal,onPreview,facilityOptions,facilityFieldLabel="Source Facility",purposePlaceholder="e.g. Blood unit receipt"}:{initial?:ManualReceiptDraft;incoming:TransferRow[];principal:Principal;onPreview:(value:ManualReceiptDraft)=>void;facilityOptions?:string[];facilityFieldLabel?:string;purposePlaceholder?:string}){
 const [draft,setDraft]=useState<ManualReceiptDraft>(initial??{unitId:"",bloodType:"O_POSITIVE",component:"PACKED_RED_BLOOD_CELLS",collected:"",expires:"",facility:"",purpose:""});
 function changed(key:keyof ManualReceiptDraft,value:string){setDraft(old=>({...old,[key]:value}));}
 const facilities=facilityOptions??[...new Set(incoming.map(row=>row.request.source_institution_id))];
 return <form className="receipt-manual-form" aria-label="Manual blood unit entry" onSubmit={event=>{event.preventDefault();onPreview({...draft,unitId:draft.unitId.trim()});}}>
 <div className="receipt-manual-fields">
 <label>Unit ID<input required value={draft.unitId} maxLength={100} placeholder="Enter ISBT-128 unit ID" onChange={e=>changed("unitId",e.target.value)}/></label>
 <label>Blood Type<span className="requester-select"><select aria-label="Blood Type" value={draft.bloodType} onChange={e=>changed("bloodType",e.target.value)}>{V2_BLOOD_TYPES.map(value=><option key={value} value={value}>{formatBloodType(value)}</option>)}</select></span></label>
 <label>Component<span className="requester-select"><select aria-label="Component" value={draft.component} onChange={e=>changed("component",e.target.value)}>{V2_COMPONENT_TYPES.map(value=><option key={value} value={value}>{componentLabel(value)}</option>)}</select></span></label>
 <label>Collection Date<input type="date" value={draft.collected} onChange={e=>changed("collected",e.target.value)}/></label>
 <label>Expiration Date<input type="date" required min={draft.collected||undefined} value={draft.expires} onChange={e=>changed("expires",e.target.value)}/></label>
 <label>{facilityFieldLabel}<span className="requester-select"><select aria-label={facilityFieldLabel} value={draft.facility} onChange={e=>changed("facility",e.target.value)}><option value="">{facilities.length?"Select facility":"No facilities available"}</option>{facilities.map(id=><option key={id} value={id}>{facilityLabel(id,principal)}</option>)}</select></span></label>
 <label>Purpose<input maxLength={200} value={draft.purpose} placeholder={purposePlaceholder} onChange={e=>changed("purpose",e.target.value)}/></label>
 <p className="receipt-preview-note">Local preview only. These details are not saved or submitted.</p>
 </div><footer><button className="button primary compact" type="submit" disabled={!draft.unitId.trim()||!draft.expires}>Preview Entry</button></footer>
 </form>;
}
