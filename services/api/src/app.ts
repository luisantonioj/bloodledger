import { timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import fastifyStatic from "@fastify/static";
import fastifyJwt from "@fastify/jwt";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { ApiFailure } from "./errors.js";
import { validateCaptureInput } from "./capture-policy.js";
import type { ApiConfig } from "./config.js";
import type { ScanRepository } from "./repository.js";
import type { Principal } from "./types.js";
import { bindingDigest, deriveVerifier, randomBinding, randomSessionId, verifyPassword, type CredentialRecord, type SessionClaims, type SessionRepository, type WebPrincipal } from "./session.js";
import { isRoleId, permissionsFor, permits, WEB_ACCESS_POLICY_VERSION } from "./web-access.js";
import type { ApplicationReadRepository } from "./application-read.js";

const IDEMPOTENCY_PATTERN = /^IDEM_[A-Z0-9_-]{1,59}$/;
const EVENT_PATTERN = /^SCAN_[0-9A-F]{32}$/;

function equalSecret(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function manilaDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function validBusinessDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const ROLE_NAMES = { "ROLE-01": "Medical Technologist", "ROLE-02": "Hospital Administrator", "ROLE-03": "Secondary Hospital User", "ROLE-04": "DOH/PRC Regulatory Viewer", "ROLE-05": "System Administrator", "ROLE-06": "Institution Account Administrator" } as const;
function webPrincipal(record: CredentialRecord): WebPrincipal {
  if (!isRoleId(record.roleId)) throw new ApiFailure(403, "AUTH_SCOPE_FORBIDDEN", "Session role is not recognized.");
  const validScope = (["ROLE-01","ROLE-02"] as const).includes(record.roleId as "ROLE-01"|"ROLE-02")
    ? record.institutionId === "INST_MEDIATRIX" && record.institutionCategory === "HOSPITAL"
    : record.roleId === "ROLE-03" ? record.institutionId !== "INST_MEDIATRIX" && record.institutionCategory === "HOSPITAL"
    : record.roleId === "ROLE-04" ? record.institutionCategory === "REGULATOR"
    : record.roleId === "ROLE-05" ? record.institutionCategory === "SYSTEM"
    : record.institutionCategory === "HOSPITAL";
  if (!validScope) throw new ApiFailure(403, "AUTH_SCOPE_FORBIDDEN", "Session role and institution scope are not permitted.");
  return { userId: record.userId, displayName: record.displayName, institutionId: record.institutionId, institutionDisplayName: record.institutionDisplayName, institutionCategory: record.institutionCategory, roleId: record.roleId, roleDisplayName: ROLE_NAMES[record.roleId], permissions: permissionsFor(record.roleId), classification: "SIMULATION_ONLY" };
}
function cookieValue(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) { const [key, ...value] = part.trim().split("="); if (key === name) return value.join("="); }
  return null;
}
function sessionCookie(token: string, secure: boolean): string {
  return `bloodledger_session=${token}; Path=/; Max-Age=900; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
}
function clearSessionCookie(secure: boolean): string {
  return `bloodledger_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${secure ? "; Secure" : ""}`;
}
function requireSameOrigin(request: FastifyRequest, origin: string): void {
  if (request.headers.origin !== origin) throw new ApiFailure(403, "ORIGIN_FORBIDDEN", "Request origin is not permitted.");
}

function principalFrom(request: FastifyRequest, expectedOperatorId: string): Principal {
  const principal = request.user as Partial<Principal>;
  if (
    principal.actorUserId !== expectedOperatorId ||
    principal.institutionId !== "INST_MEDIATRIX" ||
    principal.role !== "INVENTORY_OPERATOR"
  ) {
    throw new ApiFailure(403, "AUTH_SCOPE_FORBIDDEN", "Session is outside the approved synthetic scope.");
  }
  return principal as Principal;
}

export async function buildApp(
  repository: ScanRepository,
  config: ApiConfig,
  clock: () => Date = () => new Date(),
  sessions?: SessionRepository,
  applicationReads?: ApplicationReadRepository,
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, bodyLimit: 32 * 1024 });
  await app.register(fastifyJwt, { secret: config.jwtSecret, sign: { expiresIn: "15m" } });

  app.setErrorHandler((error, request, reply) => {
    const correlationId = `CORR_API_${request.id.replaceAll("-", "").toUpperCase()}`;
    if (error instanceof ApiFailure) {
      void reply.status(error.statusCode).send({ error: { code: error.code, message: error.message, correlationId } });
      return;
    }
    const frameworkError = error as { statusCode?: number; code?: string };
    if (frameworkError.statusCode === 401 || frameworkError.code?.startsWith("FST_JWT")) {
      void reply.status(401).send({ error: { code: "AUTH_REQUIRED", message: "A valid session is required.", correlationId } });
      return;
    }
    request.log.error({ err: error, correlationId }, "request failed");
    void reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "The request could not be completed.", correlationId } });
  });

  const authenticate = async (request: FastifyRequest): Promise<void> => {
    await request.jwtVerify();
    principalFrom(request, config.operatorId);
  };

  app.post("/api/v1/simulation/session", async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    const keys = body && typeof body === "object" ? Object.keys(body).sort() : [];
    if (
      keys.length !== 2 || keys[0] !== "credential" || keys[1] !== "operatorId" ||
      typeof body?.operatorId !== "string" || typeof body.credential !== "string" ||
      !equalSecret(body.operatorId, config.operatorId) || !equalSecret(body.credential, config.operatorCredential)
    ) {
      throw new ApiFailure(401, "AUTH_FAILED", "Synthetic credentials were not accepted.");
    }
    const principal: Principal = {
      actorUserId: config.operatorId,
      institutionId: "INST_MEDIATRIX",
      role: "INVENTORY_OPERATOR",
    };
    const token = await reply.jwtSign(principal);
    return { token, tokenType: "Bearer", expiresInSeconds: 900, classification: "SIMULATION_ONLY" };
  });

  if (sessions) {
    const webOrigin = config.webOrigin ?? "http://127.0.0.1:5174";
    const localOrigin = /^http:\/\/(127\.0\.0\.1|localhost)(?::[0-9]+)?$/.test(webOrigin);
    const secureCookie = config.webCookieSecure ?? !localOrigin;
    if (!secureCookie && !localOrigin) throw new Error("WEB_COOKIE_SECURE may be disabled only for isolated localhost development");
    const restore = async (request: FastifyRequest): Promise<{ claims: SessionClaims; principal: WebPrincipal }> => {
      const token = cookieValue(request.headers.cookie, "bloodledger_session");
      if (!token) throw new ApiFailure(401, "AUTH_REQUIRED", "A valid session is required.");
      let claims: SessionClaims;
      try { claims = app.jwt.verify<SessionClaims>(token); } catch { throw new ApiFailure(401, "AUTH_REQUIRED", "A valid session is required."); }
      if (claims.policyVersion !== WEB_ACCESS_POLICY_VERSION || !isRoleId(claims.roleId)) throw new ApiFailure(401, "AUTH_REQUIRED", "A valid session is required.");
      const record = await sessions.restoreSession(claims.sessionId, bindingDigest(claims.binding), clock());
      if (!record || record.userId !== claims.userId || record.institutionId !== claims.institutionId || record.roleId !== claims.roleId) throw new ApiFailure(401, "AUTH_REQUIRED", "A valid session is required.");
      return { claims, principal: webPrincipal(record) };
    };
    app.post("/api/v1/auth/session", async (request, reply) => {
      requireSameOrigin(request, webOrigin);
      const body = request.body as Record<string, unknown> | null;
      const keys = body && typeof body === "object" ? Object.keys(body).sort() : [];
      if (keys.join(",") !== "password,username" || typeof body?.username !== "string" || typeof body.password !== "string" || !/^synth_[a-z0-9_]{3,57}$/.test(body.username) || body.password.length < 12 || body.password.length > 128) throw new ApiFailure(401, "AUTH_FAILED", "Credentials were not accepted.");
      const record = await sessions.findCredential(body.username);
      if (!record) { await deriveVerifier(body.password, "0".repeat(32)); throw new ApiFailure(401, "AUTH_FAILED", "Credentials were not accepted."); }
      if (!await verifyPassword(body.password, record)) throw new ApiFailure(401, "AUTH_FAILED", "Credentials were not accepted.");
      const principal = webPrincipal(record);
      const issuedAt = clock(); const expiresAt = new Date(issuedAt.getTime() + 900_000); const sessionId = randomSessionId(); const binding = randomBinding();
      await sessions.createSession({ sessionId, userId: record.userId, tokenDigest: bindingDigest(binding), issuedAt, expiresAt });
      const claims: SessionClaims = { userId: record.userId, institutionId: record.institutionId, roleId: record.roleId, sessionId, binding, policyVersion: WEB_ACCESS_POLICY_VERSION };
      const token = app.jwt.sign(claims, { expiresIn: 900 });
      return reply.header("set-cookie", sessionCookie(token, secureCookie)).send({ principal });
    });
    app.get("/api/v1/auth/session", async (request) => ({ principal: (await restore(request)).principal }));
    app.delete("/api/v1/auth/session", async (request, reply) => {
      requireSameOrigin(request, webOrigin);
      try { const active = await restore(request); await sessions.revokeSession(active.claims.sessionId, clock()); } catch (error) { if (!(error instanceof ApiFailure) || error.statusCode !== 401) throw error; }
      return reply.header("set-cookie", clearSessionCookie(secureCookie)).status(204).send();
    });
    if (applicationReads) {
      app.get("/api/v1/dashboard", async (request) => {
        const { principal } = await restore(request);
        const regulatory = permits(principal.roleId, "dashboard:regulatory");
        const operational = permits(principal.roleId, "dashboard:operational");
        if (!regulatory && !operational) return { composition:"ADMINISTRATIVE", scope:"PRINCIPAL", inventory:[], pendingScans:[], lastSuccessfulProjectionAt:null, classification:"SIMULATION_ONLY" };
        const cityWide = regulatory || principal.roleId === "ROLE-03";
        const institutionScope = cityWide ? undefined : principal.institutionId;
        const inventory = await applicationReads.listInventoryAggregates(institutionScope);
        const pendingScans = await applicationReads.listPendingScans(institutionScope);
        const timestamps = inventory.map(item => item.lastProjectedAt).sort();
        return { composition:regulatory?"REGULATORY":"OPERATIONAL", scope:cityWide?"CITY_AGGREGATE":"INSTITUTION", inventory, pendingScans, lastSuccessfulProjectionAt:timestamps.at(-1)??null, classification:"SIMULATION_ONLY" };
      });
      app.get("/api/v1/inventory", async (request) => {
        const { principal } = await restore(request);
        if (!permits(principal.roleId, "inventory:read")) throw new ApiFailure(403,"AUTH_SCOPE_FORBIDDEN","Inventory access is not permitted.");
        if (principal.roleId === "ROLE-04") return { scope:"CITY_AGGREGATE", aggregates:await applicationReads.listInventoryAggregates(), units:[], classification:"SIMULATION_ONLY" };
        return { scope:"INSTITUTION", aggregates:[], units:await applicationReads.listInventoryUnits(principal.institutionId), classification:"SIMULATION_ONLY" };
      });
      app.get("/api/v1/alerts", async (request) => {
        const { principal } = await restore(request);
        if (!permits(principal.roleId, "alerts:read")) throw new ApiFailure(403,"AUTH_SCOPE_FORBIDDEN","Alert access is not permitted.");
        if (principal.roleId === "ROLE-04") return { scope:"CITY_AGGREGATE", alerts:[], aggregates:await applicationReads.listAlertAggregates(), classification:"SIMULATION_ONLY" };
        return { scope:"INSTITUTION", alerts:await applicationReads.listAlerts(principal.institutionId,principal.userId), aggregates:[], classification:"SIMULATION_ONLY" };
      });
      app.get("/api/v1/transfers", async (request) => {
        const { principal } = await restore(request);
        if (!permits(principal.roleId, "transfers:read")) throw new ApiFailure(403,"AUTH_SCOPE_FORBIDDEN","Transfer access is not permitted.");
        if (principal.roleId === "ROLE-04") return { scope:"CITY_AGGREGATE", transfers:await applicationReads.listTransfers(), classification:"SIMULATION_ONLY" };
        if (principal.roleId === "ROLE-03") return { scope:"DESTINATION_INSTITUTION", transfers:await applicationReads.listTransfers(principal.institutionId,"DESTINATION"), classification:"SIMULATION_ONLY" };
        return { scope:"SOURCE_INSTITUTION", transfers:await applicationReads.listTransfers(principal.institutionId,"SOURCE"), classification:"SIMULATION_ONLY" };
      });
    }
  }

  app.post("/api/v1/scan-events", { preHandler: authenticate }, async (request, reply) => {
    const idempotencyHeader = request.headers["idempotency-key"];
    if (typeof idempotencyHeader !== "string" || !IDEMPOTENCY_PATTERN.test(idempotencyHeader)) {
      throw new ApiFailure(400, "INVALID_IDEMPOTENCY_KEY", "A valid Idempotency-Key header is required.");
    }
    const principal = principalFrom(request, config.operatorId);
    const capture = validateCaptureInput(request.body);
    const receivedAt = clock();
    if (
      new Date(capture.capturedAt).getTime() > receivedAt.getTime() + 60_000 ||
      new Date(capture.confirmedAt).getTime() > receivedAt.getTime() + 60_000
    ) {
      throw new ApiFailure(400, "INVALID_CAPTURE_TIME", "Capture timestamp is too far in the future.");
    }
    const accepted = await repository.acceptScan(principal, idempotencyHeader, capture, receivedAt);
    return reply.status(202).send({
      eventId: accepted.event.eventId,
      correlationId: accepted.event.correlationId,
      status: accepted.event.status,
      receivedAt: accepted.event.receivedAt,
      replayed: accepted.replayed,
    });
  });

  app.get<{ Params: { eventId: string } }>("/api/v1/scan-events/:eventId", { preHandler: authenticate }, async (request) => {
    if (!EVENT_PATTERN.test(request.params.eventId)) {
      throw new ApiFailure(400, "INVALID_EVENT_ID", "Scan event ID is invalid.");
    }
    const principal = principalFrom(request, config.operatorId);
    const event = await repository.findScan(request.params.eventId, principal.institutionId);
    if (!event) throw new ApiFailure(404, "SCAN_EVENT_NOT_FOUND", "Scan event was not found.");
    return {
      eventId: event.eventId,
      correlationId: event.correlationId,
      status: event.status,
      attemptCount: event.attemptCount,
      safeErrorCode: event.safeErrorCode,
      ledgerTransactionId: event.ledgerTransactionId,
      receivedAt: event.receivedAt,
      classification: event.classification,
    };
  });

  app.get<{ Querystring: { businessDate?: string } }>("/api/v1/demand-forecasts", { preHandler: authenticate }, async (request) => {
    const requestedDate = request.query.businessDate;
    if (typeof requestedDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate) || !validBusinessDate(requestedDate)) {
      throw new ApiFailure(400, "INVALID_BUSINESS_DATE", "businessDate must be YYYY-MM-DD.");
    }
    const principal = principalFrom(request, config.operatorId);
    const forecasts = await repository.listForecasts(principal.institutionId, requestedDate);
    const status = forecasts.length === 0 ? "UNAVAILABLE" : forecasts.some((item) => item.stale) ? "STALE" : "CURRENT";
    return { businessDate: requestedDate, status, forecasts };
  });

  app.get("/healthz", async (_request, reply) => {
    const database = await repository.health().catch(() => false);
    const forecasts = database
      ? await repository.listForecasts("INST_MEDIATRIX", manilaDate(clock())).catch(() => [])
      : [];
    const forecastReadiness = forecasts.length === 0
      ? "UNAVAILABLE"
      : forecasts.some((forecast) => forecast.stale) ? "STALE" : "CURRENT";
    const healthy = database;
    return reply.status(healthy ? 200 : 503).send({
      status: healthy ? "READY" : "DEGRADED",
      api: "READY",
      database: database ? "READY" : "UNAVAILABLE",
      workerFabric: config.workerConfigured ? "CONFIGURED" : "DISABLED",
      forecastReadiness,
      classification: "SIMULATION_ONLY",
    });
  });

  if (config.captureDist && existsSync(config.captureDist)) {
    await app.register(fastifyStatic, { root: config.captureDist, wildcard: false });
    app.get("/*", (_request, reply) => reply.sendFile("index.html"));
  }

  return app;
}
