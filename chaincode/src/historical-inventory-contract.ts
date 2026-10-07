import { Context, Contract, Info, Returns, Transaction } from "fabric-contract-api";
import { canonical, HISTORICAL_ACTOR, type HistoricalManifest, type HistoricalUnit, validateHistoricalManifest } from "./historical-model";
interface Snapshot { snapshotId: string; manifest: HistoricalManifest; status: "INCOMPLETE" | "COMPLETE"; expectedUnits: number; registeredUnits: number; reviewReference: string; operatorUserId: string; transactionId: string; committedAt: string; }
interface Unit extends HistoricalUnit { snapshotId: string; transactionId: string; committedAt: string; classification: "SIMULATION_ONLY"; provenance: "CONSTRUCTED_AGGREGATE_REPRESENTATION"; }
@Info({ title: "HistoricalInventoryContract", description: "Constructed historical synthetic snapshot excluded from operational inventory" })
export class HistoricalInventoryContract extends Contract {
  constructor() { super("HistoricalInventoryContract"); }
  private authorize(ctx: Context, actor?: unknown): void {
    const id=ctx.clientIdentity;
    if(id.getMSPID()!=="MediatrixMSP"||id.getAttributeValue("hf.EnrollmentID")!=="api-gateway"||id.getAttributeValue("hf.Type")!=="client"||id.getAttributeValue("bloodledger.role")!=="API_GATEWAY"||id.getAttributeValue("bloodledger.institution_id")!=="INST_MEDIATRIX"||(actor!==undefined&&actor!==HISTORICAL_ACTOR)) throw new Error("HISTORICAL_NOT_AUTHORIZED");
  }
  private input(text: string, fields: string[]): Record<string,unknown> {
    const value=JSON.parse(text) as Record<string,unknown>;
    if(!value||Array.isArray(value)||Object.keys(value).sort().join(",")!==fields.sort().join(",")) throw new Error("HISTORICAL_INPUT_INVALID");
    return value;
  }
  private snapshotKey(id: unknown): string { if(typeof id!=="string"||!/^HSNAP_[A-F0-9]{40}$/.test(id)) throw new Error("HISTORICAL_ID_INVALID"); return `historical-inventory:snapshot:${id}`; }
  private unitKey(snapshotId: string,id: unknown): string { if(typeof id!=="string"||!/^HCOMP_[A-F0-9]{40}$/.test(id)) throw new Error("HISTORICAL_ID_INVALID"); return `historical-inventory:unit:${snapshotId}:${id}`; }
  private timestamp(ctx: Context): string { const timestamp=ctx.stub.getTxTimestamp(); return new Date(Number(timestamp.seconds.toString())*1000+Math.floor(timestamp.nanos/1_000_000)).toISOString(); }
  private async read(ctx: Context,id: unknown): Promise<Snapshot> { const bytes=await ctx.stub.getState(this.snapshotKey(id)); if(!bytes.length) throw new Error("HISTORICAL_SNAPSHOT_NOT_FOUND"); return JSON.parse(bytes.toString()) as Snapshot; }
  @Transaction()
  @Returns("string")
  async BeginSnapshot(ctx: Context,text: string): Promise<string> {
    const input=this.input(text,["manifest","actorUserId","reviewReference","approvedManifestSha256"]); this.authorize(ctx,input.actorUserId);
    const manifest=validateHistoricalManifest(input.manifest);
    if(input.approvedManifestSha256!==manifest.manifestSha256||typeof input.reviewReference!=="string"||input.reviewReference.trim().length<1||input.reviewReference.length>512) throw new Error("HISTORICAL_REVIEW_REQUIRED");
    const key=this.snapshotKey(manifest.snapshotId), stored=await ctx.stub.getState(key);
    if(stored.length) { const prior=JSON.parse(stored.toString()) as Snapshot; if(prior.manifest.manifestSha256!==manifest.manifestSha256||prior.reviewReference!==input.reviewReference) throw new Error("HISTORICAL_MANIFEST_CONFLICT"); return canonical(prior); }
    const asset: Snapshot={snapshotId:manifest.snapshotId,manifest,status:"INCOMPLETE",expectedUnits:manifest.units.length,registeredUnits:0,reviewReference:input.reviewReference,operatorUserId:String(input.actorUserId),transactionId:ctx.stub.getTxID(),committedAt:this.timestamp(ctx)};
    await ctx.stub.putState(key,Buffer.from(canonical(asset))); return canonical(asset);
  }
  @Transaction()
  @Returns("string")
  async RegisterUnit(ctx: Context,text: string): Promise<string> {
    const input=this.input(text,["snapshotId","componentId","actorUserId"]); this.authorize(ctx,input.actorUserId);
    const snapshot=await this.read(ctx,input.snapshotId),unit=snapshot.manifest.units.find(u=>u.componentId===input.componentId);
    if(!unit) throw new Error("HISTORICAL_MEMBER_INVALID");
    const key=this.unitKey(snapshot.snapshotId,unit.componentId), prior=await ctx.stub.getState(key);
    if(prior.length) return prior.toString();
    if(snapshot.status!=="INCOMPLETE") throw new Error("HISTORICAL_SNAPSHOT_FROZEN");
    const asset: Unit={...unit,snapshotId:snapshot.snapshotId,transactionId:ctx.stub.getTxID(),committedAt:this.timestamp(ctx),classification:"SIMULATION_ONLY",provenance:"CONSTRUCTED_AGGREGATE_REPRESENTATION"};
    await ctx.stub.putState(key,Buffer.from(canonical(asset)));
    snapshot.registeredUnits++; await ctx.stub.putState(this.snapshotKey(snapshot.snapshotId),Buffer.from(canonical(snapshot)));
    return canonical(asset);
  }
  @Transaction()
  @Returns("string")
  async FinalizeSnapshot(ctx: Context,text: string): Promise<string> {
    const input=this.input(text,["snapshotId","actorUserId"]); this.authorize(ctx,input.actorUserId);
    const snapshot=await this.read(ctx,input.snapshotId); if(snapshot.status==="COMPLETE") return canonical(snapshot);
    const manifest=validateHistoricalManifest(snapshot.manifest);
    if(snapshot.registeredUnits!==manifest.units.length) throw new Error("HISTORICAL_MEMBERSHIP_INCOMPLETE");
    for(const expected of manifest.units) {
      const bytes=await ctx.stub.getState(this.unitKey(snapshot.snapshotId,expected.componentId));
      if(!bytes.length) throw new Error("HISTORICAL_MEMBERSHIP_INCOMPLETE");
      const unit=JSON.parse(bytes.toString()) as Unit;
      for(const key of Object.keys(expected) as (keyof HistoricalUnit)[]) if(canonical(unit[key])!==canonical(expected[key])) throw new Error("HISTORICAL_MEMBER_CONFLICT");
    }
    snapshot.status="COMPLETE"; snapshot.transactionId=ctx.stub.getTxID(); snapshot.committedAt=this.timestamp(ctx);
    await ctx.stub.putState(this.snapshotKey(snapshot.snapshotId),Buffer.from(canonical(snapshot))); return canonical(snapshot);
  }
  @Transaction(false)
  @Returns("string")
  async ReadSnapshot(ctx: Context,id: string): Promise<string> { this.authorize(ctx); return canonical(await this.read(ctx,id)); }
  @Transaction(false)
  @Returns("string")
  async ReadUnit(ctx: Context,snapshotId: string,componentId: string): Promise<string> { this.authorize(ctx); this.snapshotKey(snapshotId); const bytes=await ctx.stub.getState(this.unitKey(snapshotId,componentId)); if(!bytes.length) throw new Error("HISTORICAL_UNIT_NOT_FOUND"); return bytes.toString(); }
}
