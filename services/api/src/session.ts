import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import type { Permission, RoleId } from "./web-access.js";

export interface CredentialRecord { userId:string; username:string; displayName:string; institutionId:string; institutionDisplayName:string; institutionCategory:"HOSPITAL"|"REGULATOR"|"SYSTEM"; roleId:RoleId; saltHex:string; verifierHex:string }
export interface WebPrincipal { userId:string; displayName:string; institutionId:string; institutionDisplayName:string; institutionCategory:"HOSPITAL"|"REGULATOR"|"SYSTEM"; roleId:RoleId; roleDisplayName:string; permissions:readonly Permission[]; classification:"SIMULATION_ONLY" }
export interface SessionClaims { userId:string; institutionId:string; roleId:RoleId; sessionId:string; binding:string; policyVersion:"SYNTHETIC_WEB_ACCESS_V1" }
export interface SessionRepository {
  findCredential(username:string):Promise<CredentialRecord|null>;
  createSession(input:{sessionId:string;userId:string;tokenDigest:string;issuedAt:Date;expiresAt:Date}):Promise<void>;
  restoreSession(sessionId:string,tokenDigest:string,now:Date):Promise<CredentialRecord|null>;
  revokeSession(sessionId:string,now:Date):Promise<void>;
}
export async function deriveVerifier(password:string,saltHex:string):Promise<string>{
  const result = await new Promise<Buffer>((resolve, reject) => scryptCallback(password, Buffer.from(saltHex, "hex"), 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, derived) => error ? reject(error) : resolve(derived as Buffer)));
  return result.toString("hex");
}
export async function verifyPassword(password:string,record:CredentialRecord):Promise<boolean>{
  if(!/^[0-9a-f]{32}$/.test(record.saltHex)||!/^[0-9a-f]{128}$/.test(record.verifierHex))return false;
  const actual=Buffer.from(await deriveVerifier(password,record.saltHex),"hex");
  const expected=Buffer.from(record.verifierHex,"hex");
  return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
export const randomSessionId=()=>`SESS_${randomBytes(20).toString("hex").toUpperCase()}`;
export const randomBinding=()=>randomBytes(32).toString("hex");
export const bindingDigest=(binding:string)=>createHash("sha256").update(binding,"utf8").digest("hex");
