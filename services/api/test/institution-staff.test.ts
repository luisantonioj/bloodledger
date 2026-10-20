import test from "node:test";
import assert from "node:assert/strict";
import {parseStaffCreation} from "../src/institution-staff.js";
import {allowedOperatorAction} from "../src/operator-verification.js";
import type {WebPrincipal} from "../src/session.js";
const body={jobTitle:"  Laboratory lead  ",institutionId:"INST_MEDIATRIX",accessProfile:"ROLE",permissionSet:"ROLE-01",pin:"12345678",expectedVersion:1,correlationId:"CORR_"+"A".repeat(32)};
test("PA-STAFF-01 separates free-text titles from category-limited permission sets",()=>{
 assert.equal(parseStaffCreation(body,"BLOOD_BANK").jobTitle,"Laboratory lead");
 for(const role of ["ROLE-01","ROLE-02"])assert.equal(parseStaffCreation({...body,permissionSet:role},"BLOOD_BANK").roleId,role);
 assert.equal(parseStaffCreation({...body,permissionSet:"ROLE-03"},"REQUESTOR").roleId,"ROLE-03");
 assert.equal(parseStaffCreation({...body,accessProfile:"INSTITUTION_ADMIN",permissionSet:null},"REQUESTOR").roleId,"ROLE-06");
 for(const value of [{...body,jobTitle:" "},{...body,permissionSet:"ROLE-05"},{...body,jobTitle:"x".repeat(81)},{...body,extra:true},{...body,accessProfile:"INSTITUTION_ADMIN"}])assert.throws(()=>parseStaffCreation(value,"BLOOD_BANK"));
 assert.throws(()=>parseStaffCreation(body,"REQUESTOR"));
});
test("PA-STAFF-01 staff changes require institutional administrators and exclude PRC/DOH",()=>{
 const administrator={operatorId:"OP_TEST",roleId:"ROLE-06",capabilityProfile:"INSTITUTION_ADMIN",version:1} as const;
 const operation="POST /api/v2/staff/USR_STAFF_"+"A".repeat(32)+"/restore";
 for(const category of ["BLOOD_BANK","REQUESTOR"]){const p={accountCategory:category} as WebPrincipal;assert(allowedOperatorAction(p,administrator,operation));assert(allowedOperatorAction(p,administrator,"POST /api/v2/staff"));assert(!allowedOperatorAction(p,{...administrator,roleId:"ROLE-02",capabilityProfile:"ROLE"},operation));}
 for(const category of ["PRC","DOH"])assert(!allowedOperatorAction({accountCategory:category} as WebPrincipal,administrator,operation));
});
