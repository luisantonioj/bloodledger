import {randomBytes,createHmac} from "node:crypto";
import type {Pool,PoolClient} from "pg";
import type {FastifyInstance,FastifyRequest} from "fastify";
import {ApiFailure} from "./errors.js";
import {identityTransaction,lockActiveOperator} from "./operator-verification.js";
import {operatorPrincipal} from "./institution-access.js";
import {deriveVerifier,type WebPrincipal} from "./session.js";
import {sha256} from "./hash.js";
import {validOperatorPin} from "./operator-pin-policy.js";

type Row=Record<string,unknown>;
export const STAFF_POLICY="SYNTHETIC_INSTITUTION_STAFF_V1";
export const staffRoleSets={BLOOD_BANK:["ROLE-01","ROLE-02"],REQUESTOR:["ROLE-03"]} as const;
const fail=(code:string,status=409):never=>{throw new ApiFailure(status,code,"The staff change was not accepted. Refresh staff details and review the action.");};
export function parseStaffCreation(value:unknown,category:string):Row&{jobTitle:string;roleId:string}{
 if(!value||typeof value!=="object"||Array.isArray(value))fail("STAFF_INPUT_INVALID",400);
 const b=value as Row;
 if(Object.keys(b).sort().join(",")!=="accessProfile,correlationId,expectedVersion,institutionId,jobTitle,permissionSet,pin")fail("STAFF_INPUT_INVALID",400);
 if(typeof b.jobTitle!=="string"||!b.jobTitle.trim()||b.jobTitle.trim().length>80||/[\x00-\x1f\x7f]/.test(b.jobTitle))fail("STAFF_JOB_TITLE_INVALID",400);
 if(typeof b.pin!=="string"||!validOperatorPin(b.pin))fail("STAFF_PIN_INVALID",400);
 const role=b.accessProfile==="INSTITUTION_ADMIN"&&b.permissionSet===null?"ROLE-06":b.accessProfile==="ROLE"&&(staffRoleSets[category as keyof typeof staffRoleSets] as readonly unknown[]|undefined)?.includes(b.permissionSet)?String(b.permissionSet):null;
 if(!role)fail("STAFF_PERMISSION_SET_INVALID",400);
 return {...b,jobTitle:String(b.jobTitle).trim(),roleId:String(role)};
}
function common(body:Row,keys:string[]){if(!body||Object.keys(body).sort().join(",")!==keys.sort().join(",")||!Number.isSafeInteger(body.expectedVersion)||Number(body.expectedVersion)<1||!/^CORR_[0-9A-F]{32}$/.test(String(body.correlationId)))fail("STAFF_INPUT_INVALID",400);}
function admin(principal:WebPrincipal){if(!["BLOOD_BANK","REQUESTOR"].includes(String(principal.accountCategory))||!principal.operatorId||!principal.administrativeCapabilities?.includes("operators:manage"))fail("STAFF_NOT_AUTHORIZED",403);}

export class InstitutionStaff {
 constructor(readonly pool:Pool,private readonly auditKey:string){}
 private secretDigest(pin:string){return createHmac("sha256",this.auditKey).update(pin).digest("hex");}
 async audit(client:PoolClient,p:WebPrincipal,action:string,id:string,body:Row,key:string,now:Date,run:()=>Promise<Row>){
  admin(p);if(!/^IDEM_[A-Z0-9_-]{1,59}$/.test(key))fail("INVALID_IDEMPOTENCY_KEY",400);
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[p.userId+":"+key]);await lockActiveOperator(client,p);
  const digest=sha256({action,id,body}),prior=(await client.query<Row>("SELECT payload_sha256,result FROM app.account_audit WHERE actor_id=$1 AND idempotency_key=$2",[p.userId,key])).rows[0];
  if(prior){if(prior.payload_sha256!==digest)fail("STAFF_IDEMPOTENCY_CONFLICT");return prior.result as Row;}
  const result=await run();
  await client.query("INSERT INTO app.account_audit(audit_id,actor_id,actor_institution_id,subject_id,action,reason_code,correlation_id,idempotency_key,payload_sha256,result,created_at) VALUES($1,$2,$3,$4,$5,'INSTITUTION_REQUEST',$6,$7,$8,$9,$10)",["AUD_"+randomBytes(20).toString("hex").toUpperCase(),p.userId,p.institutionId,id,action,body.correlationId,key,digest,result,now]);return result;
 }
 async target(c:PoolClient,p:WebPrincipal,id:string,version:unknown){
  const o=(await c.query<Row>("SELECT * FROM app.institution_operators WHERE operator_id=$1 AND institution_id=$2 FOR UPDATE",[id,p.institutionId])).rows[0];if(!o)fail("STAFF_NOT_FOUND",404);if(Number(o.version)!==version)fail("STAFF_VERSION_CONFLICT");return o;
 }
 async create(p:WebPrincipal,value:unknown,key:string,now:Date){
  admin(p);const body=parseStaffCreation(value,String(p.accountCategory));common(value as Row,["accessProfile","correlationId","expectedVersion","institutionId","jobTitle","permissionSet","pin"]);
  if(body.institutionId!==p.institutionId)fail("STAFF_NOT_AUTHORIZED",403);
  return identityTransaction(this.pool,c=>this.audit(c,p,"STAFF_CREATE",p.institutionId,{...body,pin:undefined,pinDigest:this.secretDigest(String(body.pin))},key,now,async()=>{
   const inst=(await c.query<Row>("SELECT version,status FROM app.institutions WHERE institution_id=$1 FOR UPDATE",[p.institutionId])).rows[0];if(inst?.status!=="ACTIVE"||Number(inst.version)!==body.expectedVersion)fail("STAFF_VERSION_CONFLICT");
   const id="USR_STAFF_"+randomBytes(16).toString("hex").toUpperCase(),salt=randomBytes(16).toString("hex"),credential=randomBytes(32).toString("hex");
   await c.query("INSERT INTO app.application_users(user_id,username,display_name,institution_id,password_algorithm,password_salt,password_verifier,status,account_kind) VALUES($1,$2,'Synthetic Institution Operator',$3,'SCRYPT_V1',$4,$5,'ACTIVE','OPERATOR')",[id,"synth_staff_"+id.slice(10).toLowerCase(),p.institutionId,salt,await deriveVerifier(credential,salt)]);
   await c.query("INSERT INTO app.user_role_assignments(user_id,role_id,policy_version) VALUES($1,$2,'SYNTHETIC_WEB_ACCESS_V1')",[id,body.roleId]);
   await c.query("INSERT INTO app.institution_operators(operator_id,account_id,institution_id,role_id,capability_profile,status,pin_salt,pin_verifier,job_title) VALUES($1,$2,$3,$4,$5,'ACTIVE',$6,$7,$8)",[id,p.accountId,p.institutionId,body.roleId,body.accessProfile,salt,await deriveVerifier(String(body.pin),salt),body.jobTitle]);
   await c.query("UPDATE app.institutions SET version=version+1 WHERE institution_id=$1",[p.institutionId]);
   return {operatorId:id,status:"ACTIVE",version:1,institutionVersion:Number(body.expectedVersion)+1,roleId:body.roleId,jobTitle:body.jobTitle,capabilityProfile:body.accessProfile,classification:"SIMULATION_ONLY"};
  }));
 }
 async change(p:WebPrincipal,id:string,action:"revoke"|"restore"|"reset-pin",body:Row,key:string,now:Date){
  admin(p);common(body,action==="reset-pin"?["correlationId","expectedVersion","pin"]:["correlationId","expectedVersion"]);
  if(action==="reset-pin"&&(typeof body.pin!=="string"||!validOperatorPin(body.pin)))fail("STAFF_PIN_INVALID",400);
  return identityTransaction(this.pool,c=>this.audit(c,p,"STAFF_"+action.replaceAll("-","_").toUpperCase(),id,{...body,pin:undefined,...(action==="reset-pin"?{pinDigest:this.secretDigest(String(body.pin))}:{})},key,now,async()=>{
   const o=await this.target(c,p,id,body.expectedVersion);
   if(!["ACTIVE","REVOKED"].includes(String(o.status)))fail("STAFF_TRANSITION_INVALID");
   if(action==="revoke"){
    if(o.status!=="ACTIVE")fail("STAFF_TRANSITION_INVALID");
    await this.protectLast(c,p.institutionId,o);
    await c.query("UPDATE app.institution_operators SET status='REVOKED',version=version+1 WHERE operator_id=$1",[id]);
   }else if(action==="restore"){
    if(o.status!=="REVOKED")fail("STAFF_TRANSITION_INVALID");
    await c.query("UPDATE app.institution_operators SET status='ACTIVE',version=version+1,failed_attempts=0,locked_until=NULL WHERE operator_id=$1",[id]);
   }else{
    const salt=randomBytes(16).toString("hex");await c.query("UPDATE app.institution_operators SET pin_salt=$2,pin_verifier=$3,version=version+1,failed_attempts=0,locked_until=NULL WHERE operator_id=$1",[id,salt,await deriveVerifier(String(body.pin),salt)]);
   }
   await c.query("UPDATE app.operator_verifications SET revoked_at=COALESCE(revoked_at,$2) WHERE operator_id=$1",[id,now]);
   // Refresh authorization rosters without silently reviving any old session.
   if(action!=="restore")await c.query("UPDATE app.application_sessions SET revoked_at=COALESCE(revoked_at,$2),safe_revocation_reason=COALESCE(safe_revocation_reason,'SECURITY_REVOCATION') WHERE user_id=$1 AND session_id<>$3",[o.account_id,now,p.verificationSessionId]);
   return {operatorId:id,status:action==="revoke"?"REVOKED":action==="restore"?"ACTIVE":o.status,version:Number(o.version)+1,classification:"SIMULATION_ONLY"};
  }));
 }
 async protectLast(c:PoolClient,institution:string,o:Row){if(o.capability_profile==="INSTITUTION_ADMIN"&&Number((await c.query("SELECT count(*) AS n FROM app.institution_operators WHERE institution_id=$1 AND capability_profile='INSTITUTION_ADMIN' AND status='ACTIVE'",[institution])).rows[0].n)<=1)fail("STAFF_LAST_ADMINISTRATOR");}
 async approveReset(p:WebPrincipal,id:string,body:Row,key:string,now:Date){
  admin(p);common(body,["expectedVersion","correlationId"]);
  return identityTransaction(this.pool,async c=>{
   await lockActiveOperator(c,p);await this.target(c,p,id,body.expectedVersion);
   if(!/^IDEM_[A-Z0-9_-]{1,59}$/.test(key))fail("INVALID_IDEMPOTENCY_KEY",400);
   const token="SPA_"+createHmac("sha256",this.auditKey).update(p.userId+":"+key).digest("hex").slice(0,40).toUpperCase();
   const prior=(await c.query<Row>("SELECT * FROM app.staff_pin_reset_approvals WHERE approval_id=$1",[token])).rows[0];
   if(prior){if(prior.subject_id!==id||Number(prior.subject_version)!==body.expectedVersion||prior.session_id!==p.verificationSessionId||prior.request_sha256!==sha256(body))fail("STAFF_IDEMPOTENCY_CONFLICT");return {approvalId:token,expiresAt:new Date(prior.expires_at as string | Date).toISOString(),classification:"SIMULATION_ONLY"};}
   await c.query("INSERT INTO app.staff_pin_reset_approvals(approval_id,actor_id,account_id,institution_id,session_id,operator_version,subject_id,subject_version,request_sha256,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",[token,p.userId,p.accountId,p.institutionId,p.verificationSessionId,p.operatorVersion,id,body.expectedVersion,sha256(body),new Date(now.getTime()+120000)]);
   return {approvalId:token,expiresAt:new Date(now.getTime()+120000).toISOString(),classification:"SIMULATION_ONLY"};
  });
 }
 // Called by the shared pre-handler only for the final, approved PIN reset.
 async consumeReset(account:WebPrincipal,sessionId:string,id:string,token:unknown,body:Row,key:unknown,now:Date):Promise<WebPrincipal>{
  common(body,["correlationId","expectedVersion","pin"]);if(typeof body.pin!=="string"||!validOperatorPin(body.pin)||typeof key!=="string"||!/^IDEM_[A-Z0-9_-]{1,59}$/.test(key))fail("STAFF_PIN_INVALID",400);
  return identityTransaction(this.pool,async c=>{
   const a=(await c.query<Row>("SELECT * FROM app.staff_pin_reset_approvals WHERE approval_id=$1 FOR UPDATE",[token])).rows[0];
   if(!a||a.account_id!==account.accountId||a.session_id!==sessionId||a.institution_id!==account.institutionId||a.subject_id!==id||Number(a.subject_version)!==body.expectedVersion)fail("STAFF_APPROVAL_INVALID",403);
   const digest=sha256(body);if(a.consumed_key){if(a.consumed_key!==key||a.consumed_sha256!==digest)fail("STAFF_APPROVAL_INVALID",403);}else if(new Date(a.expires_at as string | Date)<=now)fail("STAFF_APPROVAL_EXPIRED",403);
   const o=(await c.query<Row>("SELECT role_id,capability_profile,version FROM app.institution_operators WHERE operator_id=$1 AND account_id=$2 AND status='ACTIVE' FOR UPDATE",[a.actor_id,a.account_id])).rows[0];
   if(!o||o.capability_profile!=="INSTITUTION_ADMIN")fail("STAFF_APPROVAL_INVALID",403);
   if(Number(o.version)!==Number(a.operator_version)){
    const completed=(await c.query<Row>("SELECT payload_sha256 FROM app.account_audit WHERE actor_id=$1 AND idempotency_key=$2 AND action='STAFF_RESET_PIN'",[a.actor_id,key])).rows[0];
    const expected=sha256({action:"STAFF_RESET_PIN",id,body:{...body,pin:undefined,pinDigest:this.secretDigest(String(body.pin))}});
    if(!a.consumed_key||!completed||completed.payload_sha256!==expected)fail("STAFF_APPROVAL_INVALID",403);
   }
   await c.query("UPDATE app.staff_pin_reset_approvals SET consumed_key=$2,consumed_sha256=$3 WHERE approval_id=$1",[token,key,digest]);
   return {...operatorPrincipal(account,{operatorId:String(a.actor_id),roleId:o.role_id as "ROLE-06",capabilityProfile:"INSTITUTION_ADMIN",version:Number(o.version)}),operatorVersion:Number(o.version),verificationSessionId:sessionId};
  });
 }
}
export function registerInstitutionStaff(app:FastifyInstance,pool:Pool,restore:(r:FastifyRequest)=>Promise<{principal:WebPrincipal}>,clock:()=>Date,auditKey:string){
 const service=new InstitutionStaff(pool,auditKey);
 app.post("/api/v2/staff",async r=>service.create((await restore(r)).principal,r.body,String(r.headers["idempotency-key"]??""),clock()));
 app.post<{Params:{id:string}}>("/api/v2/staff/:id/reset-pin-approval",async r=>service.approveReset((await restore(r)).principal,r.params.id,r.body as Row,String(r.headers["idempotency-key"]??""),clock()));
 for(const action of ["revoke","restore","reset-pin"] as const)app.post<{Params:{id:string}}>("/api/v2/staff/:id/"+action,async r=>service.change((await restore(r)).principal,r.params.id,action,r.body as Row,String(r.headers["idempotency-key"]??""),clock()));
}
