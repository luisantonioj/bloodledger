import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { buildApp } from "../src/app.js";
import type { ApiConfig } from "../src/config.js";
import { bindingDigest, deriveVerifier, type CredentialRecord, type SessionRepository } from "../src/session.js";
import { MemoryRepository } from "./test-support.js";

const origin = "http://127.0.0.1:5174";
const config: ApiConfig = { host:"127.0.0.1", port:3000, jwtSecret:"sprint5-test-secret-that-is-not-deployed", operatorId:"USR_SYNTH_CAPTURE", operatorCredential:"synthetic-test-credential", workerConfigured:false, webOrigin:origin, webCookieSecure:false };
class MemorySessions implements SessionRepository {
  record!: CredentialRecord; active = new Map<string,{userId:string;digest:string;expiresAt:Date;revoked:boolean}>();
  async findCredential(username:string){return username===this.record.username?this.record:null}
  async createSession(input:{sessionId:string;userId:string;tokenDigest:string;issuedAt:Date;expiresAt:Date}){this.active.set(input.sessionId,{userId:input.userId,digest:input.tokenDigest,expiresAt:input.expiresAt,revoked:false})}
  async restoreSession(sessionId:string,tokenDigest:string,now:Date){const session=this.active.get(sessionId);return session&&!session.revoked&&session.digest===tokenDigest&&session.expiresAt>now&&session.userId===this.record.userId?this.record:null}
  async revokeSession(sessionId:string){const session=this.active.get(sessionId);if(session)session.revoked=true}
}
async function fixture(){const password=randomBytes(24).toString("base64url"),sessions=new MemorySessions(),saltHex=randomBytes(16).toString("hex");sessions.record={userId:"USR_SYNTH_WEB_01",username:"synth_operator_01",displayName:"Synthetic Operator 01",institutionId:"INST_MEDIATRIX",institutionDisplayName:"Synthetic Mediatrix 01",institutionCategory:"HOSPITAL",roleId:"ROLE-01",saltHex,verifierHex:await deriveVerifier(password,saltHex)};const app=await buildApp(new MemoryRepository(),config,()=>new Date(),sessions);return{app,password}}
const cookie=(response:{headers:Record<string,unknown>})=>String(response.headers["set-cookie"]).split(";")[0];

test("S5-05 creates an HttpOnly strict session and returns only a safe principal",async()=>{const{app,password}=await fixture();const response=await app.inject({method:"POST",url:"/api/v1/auth/session",headers:{origin},payload:{username:"synth_operator_01",password}});assert.equal(response.statusCode,200);assert.match(String(response.headers["set-cookie"]),/HttpOnly; SameSite=Strict/);assert.doesNotMatch(response.body,/verifier|salt|token|sessionId/);assert.equal(response.json().principal.roleId,"ROLE-01");assert.equal(response.json().principal.permissions.includes("inventory:write"),true);await app.close()});

test("S5-05 rejects invalid credentials, unknown fields, and wrong origins safely",async()=>{const{app,password}=await fixture(),wrong=randomBytes(24).toString("base64url");for(const request of [{headers:{origin},payload:{username:"synth_operator_01",password:wrong}},{headers:{origin},payload:{username:"synth_operator_01",password,roleId:"ROLE-04"}},{headers:{origin:"http://untrusted.invalid"},payload:{username:"synth_operator_01",password}}]){const response=await app.inject({method:"POST",url:"/api/v1/auth/session",...request});assert.ok([401,403].includes(response.statusCode));assert.doesNotMatch(response.body,new RegExp(`${wrong}|${password}`))}await app.close()});

test("S5-05 restores then revokes a session idempotently",async()=>{const{app,password}=await fixture();const login=await app.inject({method:"POST",url:"/api/v1/auth/session",headers:{origin},payload:{username:"synth_operator_01",password}});const activeCookie=cookie(login);assert.equal((await app.inject({method:"GET",url:"/api/v1/auth/session",headers:{cookie:activeCookie}})).statusCode,200);const logout=await app.inject({method:"DELETE",url:"/api/v1/auth/session",headers:{origin,cookie:activeCookie}});assert.equal(logout.statusCode,204);assert.match(String(logout.headers["set-cookie"]),/Max-Age=0/);assert.equal((await app.inject({method:"GET",url:"/api/v1/auth/session",headers:{cookie:activeCookie}})).statusCode,401);assert.equal((await app.inject({method:"DELETE",url:"/api/v1/auth/session",headers:{origin,cookie:activeCookie}})).statusCode,204);await app.close()});

test("session binding digests do not store the binding",()=>{const value=randomBytes(24).toString("hex");assert.equal(bindingDigest(value),bindingDigest(value));assert.notEqual(bindingDigest(value),value)});
