import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildApp } from "../src/app.js";
import type { ApiConfig } from "../src/config.js";
import { MemoryRepository } from "./test-support.js";

test("S5-08 serves web, capture, and API from their required same-origin paths", async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "bloodledger-static-"));
  const webDist = join(fixtureRoot, "web");
  const captureDist = join(fixtureRoot, "capture");
  await Promise.all([
    mkdir(join(webDist, "assets"), { recursive: true }),
    mkdir(join(captureDist, "assets"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(join(webDist, "index.html"), "<html>SPRINT5_WEB</html>"),
    writeFile(join(webDist, "assets", "web.js"), "WEB_ASSET"),
    writeFile(join(captureDist, "index.html"), "<html>SPRINT4_CAPTURE</html>"),
    writeFile(join(captureDist, "assets", "capture.js"), "CAPTURE_ASSET"),
  ]);

  const config: ApiConfig = {
    host: "127.0.0.1",
    port: 3000,
    jwtSecret: "same-origin-test-secret-not-deployed",
    operatorId: "USR_SYNTH_CAPTURE",
    operatorCredential: "synthetic-test-credential",
    workerConfigured: false,
    webDist,
    captureDist,
  };
  const app = await buildApp(new MemoryRepository(), config);
  try {
    assert.match((await app.inject({ method: "GET", url: "/" })).body, /SPRINT5_WEB/);
    assert.match((await app.inject({ method: "GET", url: "/inventory" })).body, /SPRINT5_WEB/);
    assert.match((await app.inject({ method: "GET", url: "/profile" })).body, /SPRINT5_WEB/);
    assert.equal((await app.inject({ method: "GET", url: "/assets/web.js" })).body, "WEB_ASSET");
    assert.match((await app.inject({ method: "GET", url: "/capture/" })).body, /SPRINT4_CAPTURE/);
    assert.match((await app.inject({ method: "GET", url: "/capture/offline" })).body, /SPRINT4_CAPTURE/);
    assert.equal((await app.inject({ method: "GET", url: "/capture/assets/capture.js" })).body, "CAPTURE_ASSET");
    const health = await app.inject({ method: "GET", url: "/healthz" });
    assert.equal(health.statusCode, 200);
    assert.equal(health.json().api, "READY");
    const missingApi = await app.inject({ method: "GET", url: "/api/v1/not-a-route" });
    assert.equal(missingApi.statusCode, 404);
    assert.doesNotMatch(missingApi.body, /SPRINT5_WEB|SPRINT4_CAPTURE/);
  } finally {
    await app.close();
    await rm(fixtureRoot, { recursive: true });
  }
});
