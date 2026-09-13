export interface MutationKeys { idempotencyKey:string; correlationId:string }

export function newMutationKeys(uuid:()=>string=()=>crypto.randomUUID()):MutationKeys {
  const suffix=uuid().replaceAll("-","").toUpperCase();
  if(!/^[0-9A-F]{32}$/.test(suffix))throw new Error("A cryptographically generated UUID is required.");
  return { idempotencyKey:"IDEM_WEB_"+suffix, correlationId:"CORR_"+suffix };
}
