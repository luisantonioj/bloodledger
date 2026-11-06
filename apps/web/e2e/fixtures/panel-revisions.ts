const bloodTypes=["A_POSITIVE","A_NEGATIVE","B_POSITIVE","B_NEGATIVE","AB_POSITIVE","AB_NEGATIVE","O_POSITIVE","O_NEGATIVE"];
const components=["WHOLE_BLOOD","PACKED_RED_BLOOD_CELLS","FRESH_FROZEN_PLASMA","PLATELETS","CRYOPRECIPITATE"];
export function exactStockFixture(institutionId:string,available=7,reserved=2,expiredLabel=4,expired=0){
 const zero={available:0,reserved:0,outgoingInTransit:0,received:0,labelExpiredPendingEvaluation:0,expired:0,onHold:0,compromised:0};
 const rows=bloodTypes.flatMap(bloodType=>components.map(componentType=>({bloodType,componentType,...zero})));Object.assign(rows[0],{available,reserved,labelExpiredPendingEvaluation:expiredLabel,expired});
 return {scope:"INSTITUTION",institutionId,policyVersion:"DASHBOARD_EXACT_STOCK_V1",classification:"SIMULATION_ONLY",evaluatedAt:new Date().toISOString(),lastProjectedAt:new Date().toISOString(),pendingCommands:3,rows,totals:{...zero,available,reserved,labelExpiredPendingEvaluation:expiredLabel,expired,usable:available+reserved}};
}
