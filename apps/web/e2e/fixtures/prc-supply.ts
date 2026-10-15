export const prcId = (letter = "A") => "PRCSR_" + letter.repeat(40);
export const prcFixture = {
  requestId: prcId(), requestingInstitution: {institutionId:"INST_MEDIATRIX",displayName:"Synthetic bank"},
  bloodType:"A_POSITIVE", componentType:"CRYOPRECIPITATE", requestedQuantity:5, fulfilledQuantity:null,
  urgency:"URGENT", requiredBy:"2026-10-16T00:00:00.000Z", status:"SUBMITTED", prcReference:null,
  referenceProvenance:null, declineReason:null, submittedAt:"2026-10-15T00:00:00.000Z", acknowledgedAt:null, closedAt:null,
  version:1, ledger:{status:"NOT_APPLICABLE"}, policyVersion:"SYNTHETIC_PRC_SUPPLY_V1", classification:"SIMULATION_ONLY",
};
export const prcHistory = {action:"PRC_SUPPLY_SUBMIT",priorStatus:null,resultingStatus:"SUBMITTED",reasonCode:null,actor:{reference:"OP_SYNTH",institutionId:"INST_MEDIATRIX",displayName:"Synthetic operator"},recordedAt:"2026-10-15T00:00:00.000Z"};
export const prcPage = (rows:unknown[] = [prcFixture], nextCursor:string|null = null, scope="INSTITUTION") => ({scope,rows,nextCursor,policyVersion:"SYNTHETIC_PRC_SUPPLY_V1",classification:"SIMULATION_ONLY"});
