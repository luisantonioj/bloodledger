import { randomBytes } from "node:crypto";
import type { Pool } from "pg";
import type { FastifyInstance,FastifyRequest } from "fastify";
import { ApiFailure } from "./errors.js";
import { sha256 } from "./hash.js";
import { deriveVerifier,type WebPrincipal } from "./session.js";
import { identityTransaction, lockActiveOperator } from "./operator-verification.js";

type Row=Record<string,unknown>;
export function registerAccountAdministration(app:FastifyInstance,pool:Pool,restore:(r:FastifyRequest)=>Promise<{principal:WebPrincipal}>,clock:()=>Date):void{
  app.get("/api/v2/onboarding/institutions",async r=>{
    const {principal}=await restore(r);
    if(principal.accountCategory!=="PRC"||!principal.administrativeCapabilities?.includes("onboarding:read"))throw new ApiFailure(403,"ONB_NOT_AUTHORIZED","Institution directory requires PRC administrative access.");
    const rows=await pool.query("SELECT i.institution_id,i.display_name,i.account_category,i.status,i.version,u.user_id AS account_id,u.username FROM app.institutions i LEFT JOIN app.application_users u ON u.institution_id=i.institution_id AND u.account_kind='PRIMARY' AND u.status IN ('ACTIVE','SUSPENDED') WHERE i.account_model='INSTITUTION_V1' ORDER BY i.institution_id");
    return {scope:"ADMINISTRATIVE",institutions:rows.rows,classification:"SIMULATION_ONLY"};
  });
  app.get<{Params:{id:string}}>("/api/v2/onboarding/institutions/:id",async r=>{
    const {principal}=await restore(r);
    if(principal.institutionId!==r.params.id && (principal.accountCategory!=="PRC"||!principal.administrativeCapabilities?.includes("onboarding:read")))throw new ApiFailure(403,"ONB_NOT_AUTHORIZED","Institution profile is outside the account scope.");
    const rows=await pool.query("SELECT institution_id,display_name,account_category,status,version FROM app.institutions WHERE institution_id=$1 AND account_model='INSTITUTION_V1'",[r.params.id]);
    if(!rows.rows[0])throw new ApiFailure(404,"ONB_NOT_FOUND","Institution profile not found.");
    const operators=await pool.query("SELECT operator_id,role_id,capability_profile,status,version FROM app.institution_operators WHERE institution_id=$1 ORDER BY operator_id",[r.params.id]);
    return {institution:rows.rows[0],operators:operators.rows,scope:"INSTITUTION",classification:"SIMULATION_ONLY"};
  });
  app.post<{Params:{id:string}}>("/api/v2/onboarding/institutions/:id/profile",async r=>{
    const {principal}=await restore(r),body=r.body as Row,id=r.params.id;
    if(!principal.operatorId||!principal.administrativeCapabilities?.includes("institution:manage")&&!(principal.accountCategory==="PRC"&&principal.administrativeCapabilities?.includes("onboarding:write")))throw new ApiFailure(403,"ONB_NOT_AUTHORIZED","Profile administration is not permitted.");
    if(principal.accountCategory!=="PRC"&&principal.institutionId!==id)throw new ApiFailure(403,"ONB_NOT_AUTHORIZED","Profile is outside the institution scope.");
    if(!body||Object.keys(body).sort().join(",")!=="correlationId,displayName,expectedVersion"||typeof body.displayName!=="string"||!/^Synthetic [A-Za-z0-9 -]{1,86}$/.test(body.displayName)||!Number.isSafeInteger(body.expectedVersion)||!/^CORR_[0-9A-F]{32}$/.test(String(body.correlationId)))throw new ApiFailure(400,"ONB_APPLICATION_INVALID","Profile input is invalid.");
    const key=String(r.headers["idempotency-key"]??"");
    if(!/^IDEM_[A-Z0-9_-]{1,59}$/.test(key))throw new ApiFailure(400,"INVALID_IDEMPOTENCY_KEY","An idempotency key is required.");
    return identityTransaction(pool,async client=>{
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`${principal.userId}:${key}`]);
      await lockActiveOperator(client,principal);
      const digest=sha256({id,body}),prior=await client.query<Row>("SELECT payload_sha256,result FROM app.account_audit WHERE actor_id=$1 AND idempotency_key=$2",[principal.userId,key]);
      if(prior.rows[0]){if(prior.rows[0].payload_sha256!==digest)throw new ApiFailure(409,"ONB_APPLICATION_CONFLICT","Profile replay conflicts.");return prior.rows[0].result;}
      const rows=await client.query<Row>("SELECT status,version FROM app.institutions WHERE institution_id=$1 FOR UPDATE",[id]);
      if(!rows.rows[0]||Number(rows.rows[0].version)!==body.expectedVersion)throw new ApiFailure(409,"ONB_VERSION_CONFLICT","Institution version is stale.");
      await client.query("UPDATE app.institutions SET display_name=$2,version=version+1 WHERE institution_id=$1",[id,body.displayName]);
      const result={institutionId:id,status:rows.rows[0].status,version:Number(body.expectedVersion)+1,classification:"SIMULATION_ONLY"};
      await client.query("INSERT INTO app.account_audit(audit_id,actor_id,actor_institution_id,subject_id,action,correlation_id,idempotency_key,payload_sha256,result,created_at) VALUES($1,$2,$3,$4,'UPDATE_PROFILE',$5,$6,$7,$8,$9)",["AUD_"+randomBytes(20).toString("hex").toUpperCase(),principal.userId,principal.institutionId,id,body.correlationId,key,digest,result,clock()]);return result;
    });
  });
  app.post("/api/v2/onboarding/operators",async r=>{
    const {principal}=await restore(r),body=r.body as Row;
    if(!principal.operatorId||!principal.administrativeCapabilities?.includes("operators:manage"))throw new ApiFailure(403,"ONB_NOT_AUTHORIZED","Operator administration is not permitted.");
    if(!body||Object.keys(body).sort().join(",")!=="correlationId,expectedVersion,institutionId,pin"||!Number.isSafeInteger(body.expectedVersion)||typeof body.pin!=="string"||!/^[0-9]{8}$/.test(body.pin)||!/^CORR_[0-9A-F]{32}$/.test(String(body.correlationId)))throw new ApiFailure(400,"OPERATOR_INPUT_INVALID","Operator input is invalid.");
    if(principal.accountCategory!=="PRC"&&principal.institutionId!==body.institutionId)throw new ApiFailure(403,"ONB_NOT_AUTHORIZED","Operator is outside the institution scope.");
    const key=String(r.headers["idempotency-key"]??"");if(!/^IDEM_[A-Z0-9_-]{1,59}$/.test(key))throw new ApiFailure(400,"INVALID_IDEMPOTENCY_KEY","An idempotency key is required.");
    return identityTransaction(pool,async client=>{
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`${principal.userId}:${key}`]);
      await lockActiveOperator(client,principal);
      const digest=sha256({institutionId:body.institutionId,expectedVersion:body.expectedVersion,correlationId:body.correlationId}),prior=await client.query<Row>("SELECT payload_sha256,result FROM app.account_audit WHERE actor_id=$1 AND idempotency_key=$2",[principal.userId,key]);
      if(prior.rows[0]){if(prior.rows[0].payload_sha256!==digest)throw new ApiFailure(409,"ONB_APPLICATION_CONFLICT","Operator replay conflicts.");return prior.rows[0].result;}
      const inst=await client.query<Row>("SELECT status,version,account_category FROM app.institutions WHERE institution_id=$1 FOR UPDATE",[body.institutionId]);
      if(!inst.rows[0]||Number(inst.rows[0].version)!==body.expectedVersion)throw new ApiFailure(409,"ONB_VERSION_CONFLICT","Institution version is stale.");
      if(!["BLOOD_BANK","REQUESTOR"].includes(String(inst.rows[0].account_category)))throw new ApiFailure(403,"ONB_NOT_AUTHORIZED","Regulatory authority cannot be assigned through operator administration.");
      if(inst.rows[0].status!=="ACTIVE")throw new ApiFailure(403,"ONB_INSTITUTION_NOT_ACTIVE","Institution is not active.");
      const account=await client.query<Row>("SELECT user_id FROM app.application_users WHERE institution_id=$1 AND account_kind='PRIMARY' AND status='ACTIVE'",[body.institutionId]);
      if(!account.rows[0])throw new ApiFailure(403,"ONB_INSTITUTION_NOT_ACTIVE","Primary account is not active.");
      const id="USR_OP_"+randomBytes(20).toString("hex").toUpperCase(),salt=randomBytes(16).toString("hex");
      await client.query("INSERT INTO app.application_users(user_id,username,display_name,institution_id,password_algorithm,password_salt,password_verifier,status,account_kind) VALUES($1,$2,'Synthetic Institution Operator',$3,'SCRYPT_V1',$4,$5,'ACTIVE','OPERATOR')",[id,"synth_op_"+id.slice(7).toLowerCase(),body.institutionId,salt,await deriveVerifier(randomBytes(32).toString("hex"),salt)]);
      await client.query("INSERT INTO app.user_role_assignments(user_id,role_id,policy_version) VALUES($1,'ROLE-06','SYNTHETIC_WEB_ACCESS_V1')",[id]);
      await client.query("INSERT INTO app.institution_operators(operator_id,account_id,institution_id,role_id,capability_profile,status,pin_salt,pin_verifier) VALUES($1,$2,$3,'ROLE-06','INSTITUTION_ADMIN','ACTIVE',$4,$5)",[id,account.rows[0].user_id,body.institutionId,salt,await deriveVerifier(body.pin as string,salt)]);
      await client.query("UPDATE app.institutions SET version=version+1 WHERE institution_id=$1",[body.institutionId]);
      const result={operatorId:id,status:"ACTIVE",roleId:"ROLE-06",version:1,institutionVersion:Number(body.expectedVersion)+1,classification:"SIMULATION_ONLY"};
      await client.query("INSERT INTO app.account_audit(audit_id,actor_id,actor_institution_id,subject_id,action,correlation_id,idempotency_key,payload_sha256,result,created_at) VALUES($1,$2,$3,$4,'CREATE_OPERATOR',$5,$6,$7,$8,$9)",["AUD_"+randomBytes(20).toString("hex").toUpperCase(),principal.userId,principal.institutionId,id,body.correlationId,key,digest,result,clock()]);return result;
    });
  });
  app.post<{Params:{id:string}}>("/api/v2/onboarding/institutions/:id/account",async r=>{
    const {principal}=await restore(r),body=r.body as Row,id=r.params.id;
    if(principal.accountCategory!=="PRC"||!principal.operatorId||!principal.administrativeCapabilities?.includes("onboarding:write")||id===principal.institutionId)throw new ApiFailure(403,"ONB_NOT_AUTHORIZED","Account administration is not permitted.");
    if(!body||Object.keys(body).sort().join(",")!=="correlationId,expectedVersion,loginEmail,password"||!Number.isSafeInteger(body.expectedVersion)||typeof body.password!=="string"||body.password.length<12||body.password.length>128||typeof body.loginEmail!=="string"||!/^(bloodbank|facility)@[a-z0-9.-]+[.]bloodledger$/.test(body.loginEmail)||!/^CORR_[0-9A-F]{32}$/.test(String(body.correlationId)))throw new ApiFailure(400,"ONB_APPLICATION_INVALID","Account input is invalid.");
    const key=String(r.headers["idempotency-key"]??"");if(!/^IDEM_[A-Z0-9_-]{1,59}$/.test(key))throw new ApiFailure(400,"INVALID_IDEMPOTENCY_KEY","An idempotency key is required.");
    return identityTransaction(pool,async client=>{
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`${principal.userId}:${key}`]);
      await lockActiveOperator(client,principal);
      const digest=sha256({id,body}),prior=await client.query<Row>("SELECT payload_sha256,result FROM app.account_audit WHERE actor_id=$1 AND idempotency_key=$2",[principal.userId,key]);
      if(prior.rows[0]){if(prior.rows[0].payload_sha256!==digest)throw new ApiFailure(409,"ONB_APPLICATION_CONFLICT","Account replay conflicts.");return prior.rows[0].result;}
      const inst=await client.query<Row>("SELECT status,version,account_category FROM app.institutions WHERE institution_id=$1 FOR UPDATE",[id]);
      if(!inst.rows[0]||Number(inst.rows[0].version)!==body.expectedVersion)throw new ApiFailure(409,"ONB_VERSION_CONFLICT","Institution version is stale.");
      if(inst.rows[0].status!=="ACTIVE"||!["BLOOD_BANK","REQUESTOR"].includes(String(inst.rows[0].account_category)))throw new ApiFailure(403,"ONB_NOT_AUTHORIZED","Account target is not eligible.");
      const old=await client.query<Row>("SELECT user_id,username FROM app.application_users WHERE institution_id=$1 AND account_kind='PRIMARY' AND status='ACTIVE' FOR UPDATE",[id]);
      if(!old.rows[0])throw new ApiFailure(409,"ONB_TRANSITION_INVALID","No primary account to replace.");
      const accountId=String(old.rows[0].user_id),salt=randomBytes(16).toString("hex");
      let next=accountId;
      if(body.loginEmail===old.rows[0].username){
        await client.query("UPDATE app.application_users SET password_salt=$2,password_verifier=$3,credential_version=credential_version+1 WHERE user_id=$1",[accountId,salt,await deriveVerifier(body.password as string,salt)]);
      }else{
        next="USR_ACCOUNT_"+randomBytes(16).toString("hex").toUpperCase();
        await client.query("UPDATE app.application_users SET status='RETIRED',account_kind='RETIRED',credential_version=credential_version+1 WHERE user_id=$1",[accountId]);
        await client.query("INSERT INTO app.application_users(user_id,username,display_name,institution_id,password_algorithm,password_salt,password_verifier,status,account_kind) VALUES($1,$2,'Synthetic Institution Account',$3,'SCRYPT_V1',$4,$5,'ACTIVE','PRIMARY')",[next,body.loginEmail,id,salt,await deriveVerifier(body.password as string,salt)]);
        await client.query("INSERT INTO app.user_role_assignments(user_id,role_id,policy_version) SELECT $1,role_id,policy_version FROM app.user_role_assignments WHERE user_id=$2",[next,accountId]);
        await client.query("UPDATE app.institution_operators SET account_id=$2,version=version+1 WHERE account_id=$1",[accountId,next]);
      }
      await client.query("UPDATE app.institutions SET version=version+1 WHERE institution_id=$1",[id]);
      await client.query("UPDATE app.application_sessions SET revoked_at=COALESCE(revoked_at,$2),safe_revocation_reason=COALESCE(safe_revocation_reason,'SECURITY_REVOCATION') WHERE user_id=$1",[accountId,clock()]);
      await client.query("UPDATE app.operator_verifications SET revoked_at=COALESCE(revoked_at,$2) WHERE account_id=$1",[accountId,clock()]);
      const result={accountId:next,retainedAccountId:accountId,institutionId:id,version:Number(body.expectedVersion)+1,classification:"SIMULATION_ONLY"};
      await client.query("INSERT INTO app.account_audit(audit_id,actor_id,actor_institution_id,subject_id,action,correlation_id,idempotency_key,payload_sha256,result,created_at) VALUES($1,$2,$3,$4,'REPLACE_ACCOUNT',$5,$6,$7,$8,$9)",["AUD_"+randomBytes(20).toString("hex").toUpperCase(),principal.userId,principal.institutionId,id,body.correlationId,key,digest,result,clock()]);return result;
    });
  });

}
