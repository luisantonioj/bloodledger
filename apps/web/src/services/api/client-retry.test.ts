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
