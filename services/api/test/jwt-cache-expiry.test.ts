// FR-12 / NFR-01: a cached authenticated token must not outlive exp, even without iat.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createSigner, createVerifier } from "fast-jwt";

test("FR-12: cached JWT without issued-at rejects replay after expiry", () => {
  const key = randomBytes(32);
  const sign = createSigner({ key, algorithm: "HS256", noTimestamp: true });
  const verify = createVerifier({ key, algorithms: ["HS256"], cache: true, cacheTTL: 60_000 });
  const originalNow = Date.now;
  const start = 1_700_000_000_000;
  const expiresAt = Math.floor(start / 1000) + 1;
  try {
    Date.now = () => start;
    const token = sign({ sub: "USR_SYNTH_CACHE_TEST", exp: expiresAt });
    assert.equal(verify(token).sub, "USR_SYNTH_CACHE_TEST");
    Date.now = () => expiresAt * 1000 + 1;
    assert.throws(() => verify(token), { code: "FAST_JWT_EXPIRED" });
  } finally {
    Date.now = originalNow;
  }
});
