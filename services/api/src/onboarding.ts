import { registerAccountAdministration } from "./account-administration.js";
import { randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { ApiFailure } from "./errors.js";
import { sha256 } from "./hash.js";
import { deriveVerifier, verifyPassword, type WebPrincipal } from "./session.js";
import { identityTransaction, lockActiveOperator } from "./operator-verification.js";

type Row = Record<string, unknown>;
const fail = (code: string, status = 409): never => { throw new ApiFailure(status, code, "The onboarding action was not accepted."); };
function object(value: unknown, keys: string[]): Row {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join(",") !== [...keys,...((value as Row).reasonCode === "OTHER"?["safeExplanation"]:[])].sort().join(",")) fail("ONB_APPLICATION_INVALID", 400);
  return value as Row;
}
function safe(value: unknown, max = 96): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9 _.-]+$/.test(value) || value.length < 1 || value.length > max) fail("ONB_APPLICATION_INVALID", 400);
  return value as string;
}
function reason(body: Row): string {
  if (typeof body.reasonCode !== "string" || !["INCOMPLETE_EVIDENCE","VERIFICATION_FAILED","INELIGIBLE_CATEGORY","DUPLICATE_APPLICATION","OUT_OF_SCOPE","OTHER","SECURITY_HOLD","GOVERNANCE_HOLD","INSTITUTION_REQUEST","ELIGIBILITY_LAPSED","REVIEW_COMPLETE","APPLICANT_WITHDRAWAL","CREDENTIAL_RESET","OPERATOR_REVOKED"].includes(body.reasonCode)) fail("ONB_REASON_REQUIRED",400);
  if (body.reasonCode === "OTHER") safe(body.safeExplanation,96);
  return body.reasonCode as string;
}
export class PostgresOnboarding {
  constructor(readonly pool: Pool) {}
  private reviewer(principal: WebPrincipal): void {
    if (principal.accountCategory !== "PRC" || !principal.operatorId || !principal.administrativeCapabilities?.includes("onboarding:write")) fail("ONB_NOT_AUTHORIZED",403);
  }
  private async audited(client: PoolClient, principal: WebPrincipal, action: string, subjectId: string, body: Row, idem: string, now: Date, run: () => Promise<Row>): Promise<Row> {
    if (!/^IDEM_[A-Z0-9_-]{1,59}$/.test(idem) || typeof body.correlationId !== "string" || !/^CORR_[0-9A-F]{32}$/.test(body.correlationId)) fail("ONB_APPLICATION_INVALID",400);
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`onboarding:${principal.userId}:${idem}`]);
    const digest=sha256({action,subjectId,body});
    const prior=await client.query<Row>("SELECT payload_sha256,result FROM app.account_audit WHERE actor_id=$1 AND idempotency_key=$2",[principal.userId,idem]);
    if(prior.rows[0]) { if(prior.rows[0].payload_sha256!==digest)fail("ONB_APPLICATION_CONFLICT"); return prior.rows[0].result as Row; }
    await lockActiveOperator(client,principal);
    const result=await run();
    await client.query("INSERT INTO app.account_audit(audit_id,actor_id,actor_institution_id,subject_id,action,prior_status,resulting_status,reason_code,correlation_id,idempotency_key,payload_sha256,result,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",["AUD_"+sha256({actor:principal.userId,idem}).slice(0,40).toUpperCase(),principal.userId,principal.institutionId||null,subjectId,action,result.priorStatus??null,result.status??null,body.reasonCode??null,body.correlationId,idem,digest,result,now]);
    return result;
  }
  async invitation(principal: WebPrincipal, body: Row, idem: string, now: Date): Promise<Row> {
    this.reviewer(principal); object(body,["category","correlationId"]);
    if(!["BLOOD_BANK","REQUESTOR"].includes(String(body.category)))fail("ONB_APPLICATION_INVALID",400);
    const token=randomBytes(32).toString("hex"),id="INV_"+sha256({actor:principal.userId,idem}).slice(0,40).toUpperCase(); let created=false;
    const result=await identityTransaction(this.pool, client=>this.audited(client,principal,"ISSUE_INVITATION",id,body,idem,now,async()=>{
      await client.query("INSERT INTO app.onboarding_invitations(invitation_id,token_digest,category,status,issued_by,expires_at,created_at) VALUES($1,$2,$3,'ISSUED',$4,$5,$6)",[id,sha256(token),body.category,principal.userId,new Date(now.getTime()+86_400_000),now]); created=true;
      return {invitationId:id,status:"ISSUED",expiresAt:new Date(now.getTime()+86_400_000).toISOString(),classification:"SIMULATION_ONLY"};
    }));
    return {...result,invitationSecret:created?token:null};
  }
  async submit(value: unknown, idem: string, now: Date): Promise<Row> {
    const body=object(value,["invitationSecret","password","institutionDisplayName","category","locality","genericContact","licenseReference","applicationReason","attested","correlationId"]);
    if(!/^IDEM_[A-Z0-9_-]{1,59}$/.test(idem)||typeof body.password!=="string"||body.password.length<12||body.password.length>128||typeof body.invitationSecret!=="string"||!/^[0-9a-f]{64}$/.test(body.invitationSecret)||body.attested!==true||!/^CORR_[0-9A-F]{32}$/.test(String(body.correlationId)))fail("ONB_APPLICATION_INVALID",400);
    const name=safe(body.institutionDisplayName);if(!/^Synthetic [A-Za-z0-9 -]{1,86}$/.test(name))fail("ONB_APPLICATION_INVALID",400);
    const detail={institutionDisplayName:name,locality:safe(body.locality),genericContact:String(body.genericContact),licenseReference:safe(body.licenseReference),applicationReason:safe(body.applicationReason),attested:true};
    if(!/^(office|admin|contact|bloodbank|facility)@[a-z0-9.-]+[.]bloodledger$/.test(detail.genericContact))fail("ONB_APPLICATION_INVALID",400);
    const matchDigest=sha256({name:name.toLowerCase(),category:body.category});
    const digest=sha256({...detail,category:body.category,invitationDigest:sha256(body.invitationSecret),correlationId:body.correlationId});
    return identityTransaction(this.pool,async client=>{
      const invitation=await client.query<Row>("SELECT * FROM app.onboarding_invitations WHERE token_digest=$1 FOR UPDATE",[sha256(body.invitationSecret)]);
      const inv=invitation.rows[0];if(!inv)fail("ONB_INVITATION_INVALID",400);
      const prior=await client.query<Row>("SELECT * FROM app.onboarding_applications WHERE idempotency_key=$1 OR invitation_id=$2",[idem,inv.invitation_id]);
      if(prior.rows[0]){
        const row=prior.rows[0];if(row.payload_sha256!==digest||row.idempotency_key!==idem||!await verifyPassword(body.password as string,{saltHex:String(row.password_salt),verifierHex:String(row.password_verifier)} as Parameters<typeof verifyPassword>[1]))fail("ONB_APPLICATION_CONFLICT");
        return {applicationId:row.application_id,status:row.status,version:row.version,classification:"SIMULATION_ONLY"};
      }
      if(inv.status!=="ISSUED"||new Date(String(inv.expires_at))<=now||inv.category!==body.category)fail("ONB_INVITATION_INVALID",400);
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[sha256({name:name.toLowerCase(),category:body.category,locality:detail.locality.toLowerCase(),reference:detail.licenseReference})]);
      const duplicate=await client.query("SELECT 1 FROM app.onboarding_applications WHERE match_digest=$1 AND status NOT IN ('REJECTED','WITHDRAWN')",[matchDigest]);
      if(duplicate.rows.length)fail("ONB_APPLICATION_CONFLICT");
      const previous=await client.query<Row>("SELECT application_id FROM app.onboarding_applications WHERE match_digest=$1 ORDER BY created_at DESC LIMIT 1",[matchDigest]);
      const id="ONB_"+randomBytes(20).toString("hex").toUpperCase(),applicantId="USR_APPLICANT_"+randomBytes(16).toString("hex").toUpperCase(),salt=randomBytes(16).toString("hex");
      await client.query("INSERT INTO app.onboarding_applications(application_id,invitation_id,applicant_id,password_salt,password_verifier,category,status,detail,created_at,idempotency_key,payload_sha256,match_digest,previous_application_id) VALUES($1,$2,$3,$4,$5,$6,'SUBMITTED',$7,$8,$9,$10,$11,$12)",[id,inv.invitation_id,applicantId,salt,await deriveVerifier(body.password as string,salt),body.category,detail,now,idem,digest,matchDigest,previous.rows[0]?.application_id??null]);
      await client.query("UPDATE app.onboarding_invitations SET status='CONSUMED',consumed_at=$2 WHERE invitation_id=$1",[inv.invitation_id,now]);
      await this.audited(client,{userId:applicantId,institutionId:""} as WebPrincipal,"SUBMIT_APPLICATION",id,{correlationId:body.correlationId},idem,now,async()=>({applicationId:id,status:"SUBMITTED",version:1,classification:"SIMULATION_ONLY"}));
      return {applicationId:id,status:"SUBMITTED",version:1,classification:"SIMULATION_ONLY"};
    });
  }
  async applicantLogin(value: unknown, now: Date): Promise<string> {
    const body=object(value,["applicationId","password"]);
    if(typeof body.password!=="string"||body.password.length<12||body.password.length>128)fail("AUTH_FAILED",401);
    const rows=await this.pool.query<Row>("SELECT * FROM app.onboarding_applications WHERE application_id=$1 AND (purge_after IS NULL OR purge_after>$2)",[body.applicationId,now]);
    const row=rows.rows[0];
    if(!row){await deriveVerifier(body.password as string,"0".repeat(32));fail("AUTH_FAILED",401);}
    if(!await verifyPassword(body.password as string,{saltHex:String(row.password_salt),verifierHex:String(row.password_verifier)} as Parameters<typeof verifyPassword>[1]))fail("AUTH_FAILED",401);
    const token=randomBytes(32).toString("hex");
    await this.pool.query("INSERT INTO app.onboarding_applicant_sessions(token_digest,application_id,expires_at) VALUES($1,$2,$3)",[sha256(token),body.applicationId,new Date(now.getTime()+900_000)]);return token;
  }
  async applicant(token: string|undefined,now:Date):Promise<Row>{
    if(!token)fail("AUTH_REQUIRED",401);
    const rows=await this.pool.query<Row>("SELECT a.* FROM app.onboarding_applicant_sessions s JOIN app.onboarding_applications a USING(application_id) WHERE s.token_digest=$1 AND s.revoked_at IS NULL AND s.expires_at>$2 AND (a.purge_after IS NULL OR a.purge_after>$2)",[sha256(token),now]);
    if(!rows.rows[0])fail("AUTH_REQUIRED",401);return rows.rows[0];
  }
  async applications(principal:WebPrincipal):Promise<Row[]>{
    if(principal.accountCategory!=="PRC"||!principal.administrativeCapabilities?.includes("onboarding:read"))fail("ONB_NOT_AUTHORIZED",403);
    const rows=await this.pool.query<Row>("SELECT application_id,category,institution_id,status,version,CASE WHEN purge_after<=CURRENT_TIMESTAMP THEN NULL ELSE detail END detail,created_at,closed_at FROM app.onboarding_applications ORDER BY created_at,application_id");return rows.rows;
  }
  async decision(principal:WebPrincipal,id:string,action:string,body:Row,idem:string,now:Date):Promise<Row>{
    this.reviewer(principal);
    const fields=action==="review"?["expectedVersion","correlationId","verificationReference","verificationOutcome"]:action==="activate"?["expectedVersion","correlationId","reasonCode","loginEmail","password","operatorPin"]:["expectedVersion","correlationId","reasonCode"];
    object(body,fields);if(!Number.isSafeInteger(body.expectedVersion))fail("ONB_VERSION_CONFLICT");
    if(action!=="review")reason(body);
    // Never include credentials in the administrative audit/idempotency payload.
    const auditBody={...body};delete auditBody.password;delete auditBody.operatorPin;
    return identityTransaction(this.pool,client=>this.audited(client,principal,action.toUpperCase(),id,auditBody,idem,now,async()=>{
      const rows=await client.query<Row>("SELECT * FROM app.onboarding_applications WHERE application_id=$1 FOR UPDATE",[id]);const app=rows.rows[0];if(!app)fail("ONB_NOT_FOUND",404);
      if(app.applicant_id===principal.userId||app.institution_id===principal.institutionId)fail("ONB_SELF_APPROVAL_FORBIDDEN",403);
      if(Number(app.version)!==body.expectedVersion)fail("ONB_VERSION_CONFLICT");
      const detail=app.detail as Row|null;
      if(detail&&String(detail.institutionDisplayName).toLowerCase().includes("prc"))fail("ONB_SELF_APPROVAL_FORBIDDEN",403);
      const transitions:Record<string,[string,string]>={review:["SUBMITTED","UNDER_REVIEW"],approve:["UNDER_REVIEW","APPROVED"],reject:["UNDER_REVIEW","REJECTED"],activate:["APPROVED","APPROVED"]};
      const change=transitions[action];if(!change||app.status!==change[0])fail("ONB_TRANSITION_INVALID");
      if(action==="review"){
        if(body.verificationOutcome!=="CONFIRMED")fail("ONB_APPLICATION_INVALID",400);
        await client.query("UPDATE app.onboarding_applications SET verification=$2,reviewed_by=$3 WHERE application_id=$1",[id,{type:"MANUAL_GENERIC_CONTACT",outcome:"CONFIRMED",reference:safe(body.verificationReference),reviewedAt:now.toISOString()},principal.userId]);
      }
      if(action==="approve"&&!app.verification)fail("ONB_TRANSITION_INVALID");
      if(action==="activate"){
        if(typeof body.operatorPin!=="string"||! /^[0-9]{8}$/.test(body.operatorPin)||app.institution_id||!detail||typeof body.loginEmail!=="string"||!/^(bloodbank|facility)@[a-z0-9.-]+[.]bloodledger$/.test(body.loginEmail)||typeof body.password!=="string"||body.password.length<12||body.password.length>128)fail("ONB_APPLICATION_INVALID",400);
        const inst="INST_ONB_"+sha256(id).slice(0,32).toUpperCase(),account="USR_ACCOUNT_"+sha256(id).slice(0,32).toUpperCase(),salt=randomBytes(16).toString("hex");
        await client.query("INSERT INTO app.institutions(institution_id,display_name,category,status,account_model,account_category) VALUES($1,$2,'HOSPITAL','ACTIVE','INSTITUTION_V1',$3)",[inst,detail!.institutionDisplayName,app.category]);
        await client.query("INSERT INTO app.application_users(user_id,username,display_name,institution_id,password_algorithm,password_salt,password_verifier,status,account_kind) VALUES($1,$2,'Synthetic Institution Account',$3,'SCRYPT_V1',$4,$5,'ACTIVE','PRIMARY')",[account,body.loginEmail,inst,salt,await deriveVerifier(body.password as string,salt)]);
        await client.query("INSERT INTO app.user_role_assignments(user_id,role_id,policy_version) VALUES($1,'ROLE-06','SYNTHETIC_WEB_ACCESS_V1')",[account]);
        const op="USR_OP_"+sha256(id).slice(0,32).toUpperCase(),opSalt=randomBytes(16).toString("hex"),opPassword=randomBytes(32).toString("hex");
        await client.query("INSERT INTO app.application_users(user_id,username,display_name,institution_id,password_algorithm,password_salt,password_verifier,status,account_kind) VALUES($1,$2,'Synthetic Institution Operator',$3,'SCRYPT_V1',$4,$5,'ACTIVE','OPERATOR')",[op,"synth_op_"+sha256(id).slice(0,32),inst,opSalt,await deriveVerifier(opPassword,opSalt)]);
        await client.query("INSERT INTO app.user_role_assignments(user_id,role_id,policy_version) VALUES($1,'ROLE-06','SYNTHETIC_WEB_ACCESS_V1')",[op]);
        await client.query("INSERT INTO app.institution_operators(operator_id,account_id,institution_id,role_id,capability_profile,status,pin_salt,pin_verifier) VALUES($1,$2,$3,'ROLE-06','INSTITUTION_ADMIN','ACTIVE',$4,$5)",[op,account,inst,opSalt,await deriveVerifier(body.operatorPin as string,opSalt)]);
        await client.query("UPDATE app.onboarding_applications SET institution_id=$2 WHERE application_id=$1",[id,inst]);
      }
      const closed=["approve","reject"].includes(action);
      await client.query("UPDATE app.onboarding_applications SET status=$2,version=version+1,closed_at=CASE WHEN $3 THEN $4 ELSE closed_at END,purge_after=CASE WHEN $3 THEN $4::timestamptz+interval '30 days' ELSE purge_after END WHERE application_id=$1",[id,change[1],closed,now]);
      return {applicationId:id,priorStatus:app.status,status:change[1],version:Number(app.version)+1,classification:"SIMULATION_ONLY"};
    }));
  }
  async withdraw(applicant:Row,body:Row,idem:string,now:Date):Promise<Row>{
    object(body,["expectedVersion","correlationId","reasonCode"]);reason(body);
    return identityTransaction(this.pool,client=>this.audited(client,{userId:String(applicant.applicant_id),institutionId:""} as WebPrincipal,"WITHDRAW",String(applicant.application_id),body,idem,now,async()=>{
      const rows=await client.query<Row>("SELECT status,version FROM app.onboarding_applications WHERE application_id=$1 FOR UPDATE",[applicant.application_id]);const current=rows.rows[0];
      if(Number(current.version)!==body.expectedVersion)fail("ONB_VERSION_CONFLICT");if(!["SUBMITTED","UNDER_REVIEW"].includes(String(current.status)))fail("ONB_TRANSITION_INVALID");
      await client.query("UPDATE app.onboarding_applications SET status='WITHDRAWN',version=version+1,closed_at=$2,purge_after=$2::timestamptz+interval '30 days' WHERE application_id=$1",[applicant.application_id,now]);
      return {applicationId:applicant.application_id,priorStatus:current.status,status:"WITHDRAWN",version:Number(current.version)+1,classification:"SIMULATION_ONLY"};
    }));
  }
  async institution(principal:WebPrincipal,id:string,action:string,body:Row,idem:string,now:Date):Promise<Row>{
    this.reviewer(principal);object(body,["expectedVersion","correlationId","reasonCode"]);reason(body);
    if(id===principal.institutionId)fail("ONB_SELF_APPROVAL_FORBIDDEN",403);
    return identityTransaction(this.pool,client=>this.audited(client,principal,action.toUpperCase(),id,body,idem,now,async()=>{
      const rows=await client.query<Row>("SELECT status,version,account_category FROM app.institutions WHERE institution_id=$1 FOR UPDATE",[id]);const inst=rows.rows[0];
      if(!inst)fail("ONB_NOT_FOUND",404);if(!["BLOOD_BANK","REQUESTOR"].includes(String(inst.account_category)))fail("ONB_NOT_AUTHORIZED",403);
      if(Number(inst.version)!==body.expectedVersion)fail("ONB_VERSION_CONFLICT");
      const expected=action==="suspend"?"ACTIVE":"SUSPENDED",status=action==="suspend"?"SUSPENDED":"ACTIVE";
      if(inst.status!==expected)fail("ONB_TRANSITION_INVALID");
      if(action==="suspend"){
        const pending=await client.query(`SELECT 1 FROM app.v2_commands WHERE (actor_institution_id=$1 OR payload->>'sourceInstitutionId'=$1 OR payload->>'destinationInstitutionId'=$1 OR payload->>'reservationId' IN (SELECT reservation_id FROM app.v2_reservations WHERE institution_id=$1)) AND status NOT IN ('COMMITTED','REJECTED') UNION ALL SELECT 1 FROM app.v2_transfer_requests WHERE (source_institution_id=$1 OR destination_institution_id=$1) AND status NOT IN ('REJECTED','CANCELLED','RECEIVED','COMPROMISED') UNION ALL SELECT 1 FROM app.v2_reservations WHERE (institution_id=$1 OR transfer_id IN (SELECT transfer_id FROM app.v2_transfer_requests WHERE destination_institution_id=$1)) AND status NOT IN ('RELEASED','CANCELLED','COMPROMISED','RECEIVED') UNION ALL SELECT 1 FROM app.transfer_requests WHERE (source_institution_id=$1 OR destination_institution_id=$1) AND status NOT IN ('REJECTED','CANCELLED','RECEIVED','COMPROMISED') UNION ALL SELECT 1 FROM app.scan_events WHERE institution_id=$1 AND status<>'COMMITTED' LIMIT 1`,[id]);
        if(pending.rows.length)fail("ONB_ACTIVE_TRANSFER_BLOCKS_SUSPENSION");
      }
      await client.query("UPDATE app.institutions SET status=$2,version=version+1 WHERE institution_id=$1",[id,status]);
      await client.query("UPDATE app.application_sessions s SET revoked_at=COALESCE(revoked_at,$2),safe_revocation_reason=COALESCE(safe_revocation_reason,'SECURITY_REVOCATION') FROM app.application_users u WHERE s.user_id=u.user_id AND u.institution_id=$1",[id,now]);
      await client.query("UPDATE app.operator_verifications SET revoked_at=COALESCE(revoked_at,$2) WHERE institution_id=$1",[id,now]);
      return {institutionId:id,priorStatus:inst.status,status,version:Number(inst.version)+1,classification:"SIMULATION_ONLY"};
    }));
  }
  async operator(principal:WebPrincipal,id:string,action:string,body:Row,idem:string,now:Date):Promise<Row>{
    if(!principal.operatorId||!principal.administrativeCapabilities?.includes("operators:manage"))fail("ONB_NOT_AUTHORIZED",403);
    object(body,action==="reset-pin"?["expectedVersion","correlationId","reasonCode","pin"]:["expectedVersion","correlationId","reasonCode"]);reason(body);
    if(action==="reset-pin"&&(typeof body.pin!=="string"||!/^[0-9]{8}$/.test(body.pin)))fail("OPERATOR_INPUT_INVALID",400);
    const auditBody={...body};delete auditBody.pin;
    return identityTransaction(this.pool,client=>this.audited(client,principal,action.toUpperCase(),id,auditBody,idem,now,async()=>{
      const rows=await client.query<Row>("SELECT * FROM app.institution_operators WHERE operator_id=$1 FOR UPDATE",[id]);const operator=rows.rows[0];if(!operator)fail("ONB_NOT_FOUND",404);
      if(principal.accountCategory!=="PRC"&&operator.institution_id!==principal.institutionId)fail("ONB_NOT_AUTHORIZED",403);
      if(principal.accountCategory==="PRC"&&operator.institution_id===principal.institutionId&&id!==principal.userId)fail("ONB_NOT_AUTHORIZED",403);
      if(Number(operator.version)!==body.expectedVersion)fail("ONB_VERSION_CONFLICT");
      if(operator.status!=="ACTIVE")fail("ONB_TRANSITION_INVALID");
      if(action==="reset-pin"){
        const salt=randomBytes(16).toString("hex");await client.query("UPDATE app.institution_operators SET pin_salt=$2,pin_verifier=$3,version=version+1,failed_attempts=0,locked_until=NULL WHERE operator_id=$1",[id,salt,await deriveVerifier(body.pin as string,salt)]);
      }else await client.query("UPDATE app.institution_operators SET status='REVOKED',version=version+1 WHERE operator_id=$1",[id]);
      await client.query("UPDATE app.operator_verifications SET revoked_at=COALESCE(revoked_at,$2) WHERE operator_id=$1",[id,now]);
      await client.query("UPDATE app.application_sessions SET revoked_at=COALESCE(revoked_at,$2),safe_revocation_reason=COALESCE(safe_revocation_reason,'SECURITY_REVOCATION') WHERE user_id=$1",[operator.account_id,now]);
      return {operatorId:id,status:action==="revoke"?"REVOKED":"ACTIVE",version:Number(operator.version)+1,classification:"SIMULATION_ONLY"};
    }));
  }
}
export function registerOnboardingRoutes(app:FastifyInstance,service:PostgresOnboarding,restore:(request:FastifyRequest)=>Promise<{principal:WebPrincipal}>,origin:string,clock:()=>Date,secure:boolean):void{
  registerAccountAdministration(app,service.pool,restore,clock);
  const sameOrigin=(r:FastifyRequest)=>{if(r.headers.origin!==origin)fail("ORIGIN_FORBIDDEN",403);};
  const idem=(r:FastifyRequest)=>String(r.headers["idempotency-key"]??"");
  const token=(r:FastifyRequest)=>r.headers.cookie?.split(";").map(p=>p.trim()).find(p=>p.startsWith("bloodledger_applicant="))?.slice("bloodledger_applicant=".length);
  app.post("/api/v2/onboarding/invitations",async r=>service.invitation((await restore(r)).principal,r.body as Row,idem(r),clock()));
  app.post("/api/v2/onboarding/applications",async r=>{sameOrigin(r);return service.submit(r.body,idem(r),clock());});
  app.get("/api/v2/onboarding/applications",async r=>({applications:await service.applications((await restore(r)).principal),classification:"SIMULATION_ONLY"}));
  app.post("/api/v2/onboarding/applicant/session",async(r,reply)=>{sameOrigin(r);const value=await service.applicantLogin(r.body,clock());return reply.header("set-cookie",`bloodledger_applicant=${value}; Path=/api/v2/onboarding/applicant; Max-Age=900; HttpOnly; SameSite=Strict${secure?"; Secure":""}`).send({classification:"SIMULATION_ONLY"});});
  app.delete("/api/v2/onboarding/applicant/session",async(r,reply)=>{sameOrigin(r);if(token(r))await service.pool.query("UPDATE app.onboarding_applicant_sessions SET revoked_at=COALESCE(revoked_at,$2) WHERE token_digest=$1",[sha256(token(r)),clock()]);return reply.header("set-cookie",`bloodledger_applicant=; Path=/api/v2/onboarding/applicant; Max-Age=0; HttpOnly; SameSite=Strict${secure?"; Secure":""}`).status(204).send();});
  app.get("/api/v2/onboarding/applicant/status",async r=>{const a=await service.applicant(token(r),clock());return {applicationId:a.application_id,status:a.status,version:a.version,classification:"SIMULATION_ONLY"};});
  app.post("/api/v2/onboarding/applicant/withdraw",async r=>{sameOrigin(r);return service.withdraw(await service.applicant(token(r),clock()),r.body as Row,idem(r),clock());});
  app.post<{Params:{id:string;action:string}}>("/api/v2/onboarding/applications/:id/:action",async r=>service.decision((await restore(r)).principal,r.params.id,r.params.action,r.body as Row,idem(r),clock()));
  app.post<{Params:{id:string;action:string}}>("/api/v2/onboarding/institutions/:id/:action",async r=>{if(!["suspend","reactivate"].includes(r.params.action))fail("ONB_TRANSITION_INVALID");return service.institution((await restore(r)).principal,r.params.id,r.params.action,r.body as Row,idem(r),clock());});
  app.post<{Params:{id:string;action:string}}>("/api/v2/onboarding/operators/:id/:action",async r=>{if(!["reset-pin","revoke"].includes(r.params.action))fail("ONB_TRANSITION_INVALID");return service.operator((await restore(r)).principal,r.params.id,r.params.action,r.body as Row,idem(r),clock());});
}
