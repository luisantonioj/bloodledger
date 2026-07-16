import { Context, Contract, Info, Returns, Transaction } from "fabric-contract-api";

const PROBE_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const AUTHORIZED_MSP_ID = "MediatrixMSP";
const AUTHORIZED_ENROLLMENT_ID = "mediatrix-admin";
const AUTHORIZED_IDENTITY_TYPE = "admin";

export interface HealthProbe {
  probeId: string;
  status: "OK";
}

@Info({ title: "HealthContract", description: "Disposable Sprint 1 infrastructure health contract" })
export class HealthContract extends Contract {
  public constructor() {
    super("HealthContract");
  }

  @Transaction()
  @Returns("string")
  public async RecordProbe(ctx: Context, probeId: string): Promise<string> {
    this.assertAuthorizedSubmitter(ctx);
    this.assertValidProbeId(probeId);

    const key = this.stateKey(probeId);
    const existing = await ctx.stub.getState(key);
    if (existing.length > 0) {
      return this.readStoredProbe(existing, probeId);
    }

    const result: HealthProbe = { probeId, status: "OK" };
    const serialized = JSON.stringify(result);
    await ctx.stub.putState(key, Buffer.from(serialized, "utf8"));
    ctx.stub.setEvent("HealthProbeRecorded", Buffer.from(probeId, "utf8"));
    return serialized;
  }

  @Transaction(false)
  @Returns("string")
  public async ReadProbe(ctx: Context, probeId: string): Promise<string> {
    this.assertValidProbeId(probeId);
    const stored = await ctx.stub.getState(this.stateKey(probeId));
    if (stored.length === 0) {
      throw new Error("HEALTH_PROBE_NOT_FOUND");
    }
    return this.readStoredProbe(stored, probeId);
  }

  private assertAuthorizedSubmitter(ctx: Context): void {
    const identity = ctx.clientIdentity;
    if (
      identity.getMSPID() !== AUTHORIZED_MSP_ID ||
      identity.getAttributeValue("hf.EnrollmentID") !== AUTHORIZED_ENROLLMENT_ID ||
      identity.getAttributeValue("hf.Type") !== AUTHORIZED_IDENTITY_TYPE
    ) {
      throw new Error("HEALTH_PROBE_FORBIDDEN");
    }
  }

  private assertValidProbeId(probeId: string): void {
    if (typeof probeId !== "string" || !PROBE_ID_PATTERN.test(probeId)) {
      throw new Error("HEALTH_PROBE_INVALID_ID");
    }
  }

  private stateKey(probeId: string): string {
    return `health:${probeId}`;
  }

  private readStoredProbe(stored: Uint8Array, expectedProbeId: string): string {
    const serialized = Buffer.from(stored).toString("utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(serialized);
    } catch {
      throw new Error("HEALTH_PROBE_STATE_INVALID");
    }
    if (
      typeof parsed !== "object" || parsed === null ||
      Object.keys(parsed).length !== 2 ||
      (parsed as HealthProbe).probeId !== expectedProbeId ||
      (parsed as HealthProbe).status !== "OK"
    ) {
      throw new Error("HEALTH_PROBE_STATE_INVALID");
    }
    return JSON.stringify({ probeId: expectedProbeId, status: "OK" });
  }
}
