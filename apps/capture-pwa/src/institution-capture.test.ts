import {afterEach,describe,expect,it,vi} from "vitest";
import {issuerForDonationNumber} from "./capture-policy";
import {submitInboundCapture} from "./api-client";
import type {InboundOcrCapture} from "./types";
afterEach(()=>vi.unstubAllGlobals());
describe("ADR-037 synthetic bank issuer identity",()=>{
  it("preserves issuer separately from receiving custody",()=>{
    expect(issuerForDonationNumber("MM26-10-0001")).toBe("INST_MEDIATRIX");
    expect(issuerForDonationNumber("SYNMEDIX-2026-0001")).toBe("INST_SYNTH_MEDIX");
    expect(issuerForDonationNumber("SYNNLVILLA-2026-0001")).toBe("INST_SYNTH_NLVILLA");
    expect(()=>issuerForDonationNumber("UNREVIEWED-2026-0001")).toThrow("INBOUND_DONATION_NUMBER_INVALID");
  });
  it("does not submit a capture after the session ends during operator verification",async()=>{
    const fetchMock=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify({verificationId:"VFY_SYNTHETIC"})));
    vi.stubGlobal("fetch",fetchMock);
    const capture={donationNumber:"MM26-10-0001"} as InboundOcrCapture;
    await expect(submitInboundCapture("IDEM_TEST",capture,"V2.1",{operatorId:"OP_SYNTHETIC",pin:"00000000"},()=>false)).rejects.toMatchObject({code:"AUTH_SESSION_REVOKED"});
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v2/auth/operator-verifications");
  });
});
