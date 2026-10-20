import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError, requestJson, retryAfterContextChange, setCommandVerifier } from "./client";

afterEach(() => { setCommandVerifier(); vi.unstubAllGlobals(); });

const contextChanged = () => new ApiRequestError(401, "The account session changed.", "AUTH_CONTEXT_CHANGED");

describe("retryAfterContextChange", () => {
  it("retries a read once when a verifier install changed the session epoch mid-flight", async () => {
    // Mirrors institution login: the first inventory read is in flight when the verifier is installed.
    let release!: () => void;
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => { release = () => resolve(new Response(JSON.stringify({ attempt: 1 }), { status: 200 })); }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ attempt: 2 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const pending = retryAfterContextChange(() => requestJson<{ attempt: number }>("/api/v2/components"));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    setCommandVerifier(async () => "VFY_SYNTHETIC");
    release();
    await expect(pending).resolves.toEqual({ attempt: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry when the caller is no longer current", async () => {
    const read = vi.fn().mockRejectedValue(contextChanged());
    await expect(retryAfterContextChange(read, () => false)).rejects.toMatchObject({ code: "AUTH_CONTEXT_CHANGED" });
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("retries only once and never retries other failures", async () => {
    const twice = vi.fn().mockRejectedValue(contextChanged());
    await expect(retryAfterContextChange(twice)).rejects.toMatchObject({ code: "AUTH_CONTEXT_CHANGED" });
    expect(twice).toHaveBeenCalledTimes(2);
    const ended = vi.fn().mockRejectedValue(new ApiRequestError(401, "Authentication required.", "AUTH_REQUIRED"));
    await expect(retryAfterContextChange(ended)).rejects.toMatchObject({ status: 401, code: "AUTH_REQUIRED" });
    expect(ended).toHaveBeenCalledTimes(1);
  });
});

// FR-12: denial from an old response must not revoke a newer session or become a retry.
it("preserves a real server 401 even when the verifier changed during the read", async () => {
  const target = new EventTarget(), ended = vi.fn();
  target.addEventListener("bloodledger:session-ended", ended);
  vi.stubGlobal("window", target);
  let release!: () => void;
  const fetchMock = vi.fn(() => new Promise<Response>(resolve => {
    release = () => resolve(new Response(JSON.stringify({error:{code:"AUTH_REQUIRED",message:"Authentication required."}}),{status:401}));
  }));
  vi.stubGlobal("fetch", fetchMock);
  const pending = retryAfterContextChange(() => requestJson("/api/v2/components"), () => true);
  const rejected = expect(pending).rejects.toMatchObject({status:401,code:"AUTH_REQUIRED"});
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  setCommandVerifier(async () => "VFY_SYNTHETIC");
  release();
  await rejected;
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(ended).not.toHaveBeenCalled();
});

it("keeps a genuine current-session 401 fatal and does not retry it", async () => {
  const target = new EventTarget(), ended = vi.fn();
  target.addEventListener("bloodledger:session-ended", ended);
  vi.stubGlobal("window", target);
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{code:"AUTH_REQUIRED"}}),{status:401}));
  vi.stubGlobal("fetch", fetchMock);
  await expect(retryAfterContextChange(() => requestJson("/api/v2/components"), () => true)).rejects.toMatchObject({status:401,code:"AUTH_REQUIRED"});
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(ended).toHaveBeenCalledTimes(1);
});

it("does not restart a read after its caller becomes inactive mid-flight", async () => {
  let active = true, reject!: (reason: unknown) => void;
  const read = vi.fn(() => new Promise<never>((_, fail) => { reject = fail; }));
  const pending = retryAfterContextChange(read, () => active);
  const rejected = expect(pending).rejects.toMatchObject({code:"AUTH_CONTEXT_CHANGED"});
  active = false;
  reject(contextChanged());
  await rejected;
  expect(read).toHaveBeenCalledTimes(1);
});

it("does not add retries to a POST command when context changes in flight", async () => {
  setCommandVerifier();
  let release!: () => void;
  const fetchMock = vi.fn(() => new Promise<Response>(resolve => { release = () => resolve(new Response(JSON.stringify({accepted:true}),{status:202})); }));
  vi.stubGlobal("fetch", fetchMock);
  const pending = requestJson("/api/v2/transfers",{method:"POST",headers:{"Idempotency-Key":"IDEM_SYNTHETIC_TEST"},body:JSON.stringify({correlationId:"CORR_SYNTHETIC_TEST"})});
  const rejected = expect(pending).rejects.toMatchObject({code:"AUTH_CONTEXT_CHANGED"});
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  setCommandVerifier(async () => "VFY_SYNTHETIC");
  release();
  await rejected;
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

// PA-STAFF-01: the approved second PIN-reset step is narrowly scoped.
it("uses a staff reset approval only for the exact reset route, without skipping other PIN verification",async()=>{
 const verify=vi.fn().mockResolvedValue("VFY_STAFF_TEST");setCommandVerifier(verify);
 vi.stubGlobal("fetch",vi.fn().mockImplementation(()=>Promise.resolve(new Response(JSON.stringify({classification:"SIMULATION_ONLY"}),{status:200}))));
 const init={method:"POST",headers:{"Idempotency-Key":"IDEM_STAFF_TEST","Staff-Reset-Approval":"SPA_"+"B".repeat(40)},body:JSON.stringify({expectedVersion:1,correlationId:"CORR_"+"A".repeat(32),pin:"123456"})};
 await requestJson("/api/v2/staff/USR_STAFF_TEST/reset-pin",init);expect(verify).not.toHaveBeenCalled();
 await requestJson("/api/v2/staff/USR_STAFF_TEST/revoke",init);expect(verify).toHaveBeenCalledTimes(1);
 await requestJson("/api/v2/staff/USR_STAFF_TEST/reset-pin",{...init,headers:{"Idempotency-Key":"IDEM_STAFF_TEST"}});expect(verify).toHaveBeenCalledTimes(2);
});
