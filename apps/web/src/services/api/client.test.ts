import { afterEach, describe, expect, it, vi } from "vitest";
import { requestJson } from "./client";

afterEach(() => vi.unstubAllGlobals());

describe("same-origin API client", () => {
  it("adds controlled JSON headers and same-origin credentials", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok:true }), { status:200, headers:{ "Content-Type":"application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(requestJson<{ ok:boolean }>("/api/v1/test", { method:"POST", body:"{}", headers:{ "Idempotency-Key":"IDEM_TEST" } })).resolves.toEqual({ ok:true });
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/test", expect.objectContaining({ credentials:"same-origin", headers:expect.objectContaining({ Accept:"application/json", "Content-Type":"application/json", "Idempotency-Key":"IDEM_TEST" }) }));
  });

  it("uses the safe API error message and falls back when no envelope exists", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error:{ message:"Safe failure." } }), { status:409, headers:{ "Content-Type":"application/json" } }))
      .mockResolvedValueOnce(new Response("", { status:503 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(requestJson("/api/v1/test")).rejects.toThrow("Safe failure.");
    await expect(requestJson("/api/v1/test", {}, "Service unavailable.")).rejects.toThrow("Service unavailable.");
  });
});
