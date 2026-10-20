import assert from "node:assert/strict";
import test from "node:test";
import { operatorPinLength, validOperatorPin } from "../src/operator-pin-policy.js";
test("PIN policy preserves old hosts and allows only exact six-digit opt-in",()=>{
 const six={BLOODLEDGER_OPERATOR_PIN_POLICY_VERSION:"SYNTHETIC_OPERATOR_PIN_6_V1"};
 assert.equal(operatorPinLength({}),8);assert.equal(operatorPinLength(six),6);
 assert(validOperatorPin("12345678",{}));assert(!validOperatorPin("123456",{}));
 assert(validOperatorPin("001234",six));
 for(const pin of ["1234","12345","1234567","12345678","12a456","12345 ",123456,null])assert(!validOperatorPin(pin,six));
 assert.throws(()=>operatorPinLength({BLOODLEDGER_OPERATOR_PIN_POLICY_VERSION:"UNKNOWN"}),/POLICY_UNSUPPORTED/);
});
