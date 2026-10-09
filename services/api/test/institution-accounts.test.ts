import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { accountPolicy, primaryPrincipal, operatorPrincipal, type OperatorProfile } from "../src/institution-access.js";
import { allowedOperatorAction } from "../src/operator-verification.js";
import { selectCorePolicy } from "../src/persistent-development-policy.js";
import type { CredentialRecord } from "../src/session.js";

for (const entry of accountPolicy.accounts) {
  test(`FR-12 ${entry.category} institution login provides scoped reads without mutation authority`, () => {
    const principal=primaryPrincipal({...entry,userId:entry.accountId,displayName:"Synthetic Account",institutionDisplayName:"Synthetic Institution",institutionCategory:entry.category==="PRC"||entry.category==="DOH"?"REGULATOR":"HOSPITAL",accountCategory:entry.category,roleId:entry.readRoleId,operators:[],saltHex:randomBytes(16).toString("hex"),verifierHex:randomBytes(64).toString("hex")} as CredentialRecord);
    assert.equal(principal.accountId,entry.accountId);
    assert.equal(principal.verificationRequired,true);
    for(const capability of ["inventory:write","transfers:write","alerts:acknowledge"])assert.equal(principal.permissions.includes(capability as typeof principal.permissions[number]),false);
    if(entry.category==="DOH")assert.deepEqual(principal.administrativeCapabilities,[]);
  });
}
test("FR-12 / BR-SEC-04 PIN roles never union technologist and approval privileges",()=>{
  const account=primaryPrincipal({userId:"USR_ACCOUNT_MEDIATRIX",institutionId:"INST_MEDIATRIX",roleId:"ROLE-02",accountCategory:"BLOOD_BANK",operators:[],username:"bloodbank@mmc.bloodledger",displayName:"Synthetic Account",institutionDisplayName:"Synthetic Mediatrix",institutionCategory:"HOSPITAL",saltHex:"0".repeat(32),verifierHex:"0".repeat(128)} as CredentialRecord);
  const tech:OperatorProfile={operatorId:"USR_SYNTH_REVIEW_ROLE01",roleId:"ROLE-01",capabilityProfile:"ROLE",version:1};
  const admin:OperatorProfile={...tech,operatorId:"USR_SYNTH_REVIEW_ROLE02",roleId:"ROLE-02"};
  assert.equal(allowedOperatorAction(account,tech,"POST /api/v2/inbound-captures"),true);
  assert.equal(allowedOperatorAction(account,tech,"POST /api/v2/reservations"),false);
  assert.equal(allowedOperatorAction(account,admin,"POST /api/v2/reservations"),true);
  const principal=operatorPrincipal(account,tech);
  assert.equal(selectCorePolicy(principal,"V2.1"),"SYNTHETIC_INSTITUTION_CORE_V1");
  assert.throws(()=>selectCorePolicy({...principal,institutionId:"INST_SYNTH_MEDIX"},"V2.1"),/Institution|Operator/);
  assert.throws(()=>selectCorePolicy(principal,"V2"),/V2.1/);
});
test("FR-16 PRC reviewer cannot select hospital actions",()=>{
  const reviewer:OperatorProfile={operatorId:"USR_OP_655989F204F82E3BE56E4A6E95F4A625",roleId:"ROLE-04",capabilityProfile:"PRC_REVIEWER",version:1};
  const account={accountCategory:"PRC"} as Parameters<typeof allowedOperatorAction>[0];
  assert.equal(allowedOperatorAction(account,reviewer,"POST /api/v2/onboarding/invitations"),true);
  assert.equal(allowedOperatorAction(account,reviewer,"POST /api/v2/reservations"),false);
  assert.equal(allowedOperatorAction({...account,accountCategory:"DOH"},reviewer,"POST /api/v2/onboarding/invitations"),false);
});
