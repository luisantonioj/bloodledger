import {can,type Principal} from "../../auth/permissions";
import {useLiveData} from "../../hooks/use-live-data";
import type {Audit} from "../../services/api/types";
import {AuditView} from "./audit-view";
import {permittedActivity,requesterActivity} from "./activity-export";
export function AuditPage({principal}:{principal:Principal}){
 const requester=requesterActivity(principal);
 const endpoint=requester?(can(principal,"transfers:read")?"/api/v2/transfers":null):can(principal,"audit:read")?(principal.accountId?"/api/v2/audit":"/api/v1/audit"):null;
 const state=useLiveData<unknown>(endpoint);
 let data:Audit={scope:principal.roleId==="ROLE-04"?"CITY_AGGREGATE":"INSTITUTION",events:[],classification:"SIMULATION_ONLY"},ready=false,error=state.error;
 if(state.data){try{data=permittedActivity(state.data,principal);ready=true;}catch(reason){error=reason instanceof Error?reason.message:"Activity history unavailable.";}}
 const notice=error?<div className="requester-transfer-notice" role="status"><div className="requester-notice-copy"><strong>{ready?"Activity could not refresh":"Activity history unavailable"}</strong><p>{error}</p>{ready&&<p>Showing the last loaded records.</p>}</div></div>:undefined;
 return <div className="page activity-history-page"><AuditView ready={ready} data={data} principal={principal} busy={state.busy} onRefresh={state.manual} notice={notice}/></div>;
}
