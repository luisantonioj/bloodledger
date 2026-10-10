import { describe, expect, it } from "vitest";
import { retainedReceipt, TERMINAL_RETENTION_MS } from "./receipt-retention";
import type { StoredCommandReceipt } from "./types";
const time = Date.parse("2026-10-10T00:00:00Z");
const queued = {commandId:"CMD_SYNTH",accountId:"ACC_SYNTH",operatorId:"OP_SYNTH",institutionId:"INST_SYNTH",resourceId:"CAP_SYNTH",statusUrl:"/api/v2/commands/CMD_SYNTH",status:"QUEUED",acceptedAt:"2026-10-08T00:00:00Z",correlationId:"CORR_SYNTH"} as StoredCommandReceipt;
describe("issue36 / NFR05 receipt retention and scoped identity", () => {
  it("keeps pending evidence beyond 24h and starts terminal retention at observation", () => {
    expect(retainedReceipt(queued, undefined, time)).not.toHaveProperty("terminalObservedAt");
    expect(retainedReceipt({...queued,status:"COMMITTED"}, queued, time)).toHaveProperty("terminalObservedAt",new Date(time).toISOString());
  });
  it("never renews the terminal clock, regresses status or recreates an expired receipt", () => {
    const terminal = retainedReceipt({...queued,status:"COMMITTED"}, queued, time);
    expect(retainedReceipt(queued, terminal, time+100)).toMatchObject({status:"COMMITTED",terminalObservedAt:new Date(time).toISOString()});
    const expired = retainedReceipt(queued, terminal, time+TERMINAL_RETENTION_MS);
    expect(expired).toEqual({commandId:queued.commandId,accountId:queued.accountId,institutionId:queued.institutionId,expired:true});
    expect(retainedReceipt({...queued,status:"COMMITTED"}, expired, time+2*TERMINAL_RETENTION_MS)).toEqual(expired);
  });
  it.each([{accountId:"ACC_OTHER"},{institutionId:"INST_OTHER"},{operatorId:"OP_OTHER"},{resourceId:"CAP_OTHER"},{correlationId:"CORR_OTHER"}])("rejects changed ownership/command identity %j", patch => expect(() => retainedReceipt({...queued,...patch}, queued, time)).toThrow("CAPTURE_RECEIPT_IDENTITY_MISMATCH"));
});
