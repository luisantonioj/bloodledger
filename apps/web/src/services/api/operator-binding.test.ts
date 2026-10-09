import {afterEach,describe,expect,it,vi} from "vitest";
import {requestJson,setCommandVerifier} from "./client";
afterEach(()=>{setCommandVerifier();vi.unstubAllGlobals();});
describe("PA-ACCOUNT-01 bound commands and session changes",()=>{
  it("binds the original action, body and idempotency key before sending V2.1",async()=>{
    const verifier=vi.fn(async()=>"VFY_SYNTHETIC");setCommandVerifier(verifier);
    const fetchMock=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify({ok:true})));vi.stubGlobal("fetch",fetchMock);
    await requestJson("/api/v2/local-releases",{method:"POST",headers:{"Idempotency-Key":"IDEM_TEST","X-BloodLedger-Contract-Version":"V2"},body:JSON.stringify({quantity:1})});
    expect(verifier).toHaveBeenCalledWith({action:"POST /api/v2/local-releases",payload:{quantity:1},idempotencyKey:"IDEM_TEST"});
    const headers=new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get("Operator-Verification")).toBe("VFY_SYNTHETIC");expect(headers.get("X-BloodLedger-Contract-Version")).toBe("V2.1");expect(headers.get("Idempotency-Key")).toBe("IDEM_TEST");
  });
  it("never sends a pending verification after logout or account switch",async()=>{
    let finish!: (id:string)=>void;setCommandVerifier(()=>new Promise(resolve=>{finish=resolve;}));
    const fetchMock=vi.fn();vi.stubGlobal("fetch",fetchMock);
    const pending=requestJson("/api/v2/transfers",{method:"POST",headers:{"Idempotency-Key":"IDEM_TEST"},body:"{}"});
    setCommandVerifier();finish("VFY_SYNTHETIC");await expect(pending).rejects.toThrow("session changed");expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not end a new account session when an old request returns 401",async()=>{
    let finish!: (response:Response)=>void;
    const dispatchEvent=vi.fn();vi.stubGlobal("window",{dispatchEvent});
    vi.stubGlobal("fetch",vi.fn(()=>new Promise(resolve=>{finish=resolve;})));
    const pending=requestJson("/api/v2/dashboard");
    setCommandVerifier(async()=>"VFY_NEW_SESSION");
    finish(new Response(JSON.stringify({error:{message:"Expired"}}),{status:401}));
    await expect(pending).rejects.toThrow("Expired");expect(dispatchEvent).not.toHaveBeenCalled();
  });
});
