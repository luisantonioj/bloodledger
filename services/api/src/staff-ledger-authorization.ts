import {createHash} from "node:crypto";
import type {PoolClient} from "pg";
import type {V2Command} from "./v2-command.js";
import {WorkerFailure} from "./errors.js";

// Called while staff/institution rows are locked through endorsement+commit.
export async function staffLedgerAuthorization(client:PoolClient,command:V2Command,payload:Record<string,unknown>){
 if(!/^USR_STAFF_[0-9A-F]{32}$/.test(command.actorUserId))return undefined;
 const row=(await client.query("SELECT o.role_id,o.capability_profile,o.version,o.status,i.account_category,i.status AS institution_status,u.status AS account_status FROM app.institution_operators o JOIN app.institutions i ON i.institution_id=o.institution_id JOIN app.application_users u ON u.user_id=o.account_id WHERE o.operator_id=$1 AND o.institution_id=$2 FOR SHARE OF i,o,u",[command.actorUserId,command.actorInstitutionId])).rows[0];
 if(!row||row.status!=="ACTIVE"||row.institution_status!=="ACTIVE"||row.account_status!=="ACTIVE"||row.capability_profile!=="ROLE"||!(["BLOOD_BANK"].includes(String(row.account_category))?["ROLE-01","ROLE-02"]:["REQUESTOR"].includes(String(row.account_category))?["ROLE-03"]:[]).includes(String(row.role_id))||payload.actorUserId!==command.actorUserId||payload.policyVersion!=="SYNTHETIC_INSTITUTION_CORE_V1")throw new WorkerFailure("STAFF_LEDGER_NOT_AUTHORIZED",false);
 return {institution_staff_v1:Buffer.from(JSON.stringify({actorUserId:command.actorUserId,institutionId:command.actorInstitutionId,role:String(row.role_id).replace("-","_"),operatorVersion:Number(row.version),payloadSha256:createHash("sha256").update(JSON.stringify(payload)).digest("hex"),policyVersion:"SYNTHETIC_INSTITUTION_STAFF_V1"}))};
}
