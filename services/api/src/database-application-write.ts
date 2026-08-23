import type { Pool, PoolClient } from "pg";
import type {
  AlertAcknowledgementInput,
  AlertAcknowledgementResult,
  ApplicationWriteRepository,
  TransferRequestCommand,
  TransferRequestResult,
} from "./application-write.js";
import { ApiFailure, WorkerFailure } from "./errors.js";
import type { TransferLedger } from "./fabric.js";

type Row = Record<string, unknown>;

export class PostgresApplicationWriteRepository implements ApplicationWriteRepository {
  constructor(private readonly pool: Pool, private readonly transferLedger: TransferLedger) {}

  private async transaction<T>(action: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const value = await action(client);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async acknowledgeAlert(input: AlertAcknowledgementInput): Promise<AlertAcknowledgementResult | null> {
    return this.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [input.idempotencyKey]);
      const existing = await client.query<Row>(
        "SELECT alert_id,payload_sha256,acknowledged_at FROM app.alert_acknowledgement_commands WHERE idempotency_key=$1",
        [input.idempotencyKey],
      );
      if (existing.rows[0]) {
        if (String(existing.rows[0].payload_sha256) !== input.payloadSha256) {
          throw new ApiFailure(409, "ALERT_IDEMPOTENCY_CONFLICT", "Idempotency key was used for a different acknowledgement.");
        }
        return {
          alertId: String(existing.rows[0].alert_id),
          acknowledgedAt: new Date(String(existing.rows[0].acknowledged_at)).toISOString(),
          replayed: true,
          classification: "SIMULATION_ONLY",
        };
      }

      const target = await client.query(
        "SELECT alert_id FROM app.alerts WHERE alert_id=$1 AND institution_id=$2 AND status='OPEN' FOR UPDATE",
        [input.alertId, input.institutionId],
      );
      if (!target.rows[0]) return null;

      await client.query(
        "INSERT INTO app.alert_acknowledgements(alert_id,user_id,acknowledged_at,correlation_id) VALUES($1,$2,$3,$4) ON CONFLICT(alert_id,user_id) DO NOTHING",
        [input.alertId, input.userId, input.acknowledgedAt.toISOString(), input.correlationId],
      );
      const acknowledgement = await client.query<Row>(
        "SELECT acknowledged_at FROM app.alert_acknowledgements WHERE alert_id=$1 AND user_id=$2",
        [input.alertId, input.userId],
      );
      const acknowledgedAt = new Date(String(acknowledgement.rows[0].acknowledged_at)).toISOString();

      await client.query(
        "INSERT INTO app.alert_acknowledgement_commands(idempotency_key,payload_sha256,alert_id,user_id,correlation_id,acknowledged_at,classification) VALUES($1,$2,$3,$4,$5,$6,'SIMULATION_ONLY')",
        [input.idempotencyKey, input.payloadSha256, input.alertId, input.userId, input.correlationId, acknowledgedAt],
      );
      await client.query(
        "INSERT INTO app.audit_events(audit_event_id,institution_id,actor_user_id,action_code,target_type,target_id,outcome,correlation_id,event_time,classification) VALUES($1,$2,$3,'ALERT_ACKNOWLEDGED','ALERT',$4,'SUCCEEDED',$5,$6,'SIMULATION_ONLY')",
        [input.auditEventId, input.institutionId, input.userId, input.alertId, input.correlationId, input.acknowledgedAt.toISOString()],
      );
      return { alertId: input.alertId, acknowledgedAt, replayed: false, classification: "SIMULATION_ONLY" };
    });
  }

  async submitTransferRequest(input: TransferRequestCommand): Promise<TransferRequestResult> {
    return this.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [input.idempotencyKey]);
      const existing = await client.query<Row>(
        "SELECT transfer_id,payload_sha256,status,ledger_version,ledger_transaction_id,projected_at FROM app.transfer_requests WHERE idempotency_key=$1",
        [input.idempotencyKey],
      );
      if (existing.rows[0]) {
        if (String(existing.rows[0].payload_sha256) !== input.payloadSha256) {
          throw new ApiFailure(409, "TRANSFER_IDEMPOTENCY_CONFLICT", "Idempotency key was used for a different transfer request.");
        }
        return {
          transferId: String(existing.rows[0].transfer_id), status: "PENDING",
          ledgerVersion: Number(existing.rows[0].ledger_version), ledgerTransactionId: String(existing.rows[0].ledger_transaction_id),
          projectedAt: new Date(String(existing.rows[0].projected_at)).toISOString(), replayed: true, classification: "SIMULATION_ONLY",
        };
      }

      let ledger;
      try {
        ledger = await this.transferLedger.submitRequest({
          transferId: input.transferId, sourceInstitutionId: "INST_MEDIATRIX", destinationInstitutionId: input.destinationInstitutionId,
          bloodType: input.bloodType, component: input.component, quantity: input.quantity, urgency: input.urgency,
          requestTime: input.requestTime, actorUserId: input.actorUserId, eventTime: input.eventTime,
          correlationId: input.correlationId, idempotencyKey: input.idempotencyKey,
          policyVersion: "SYNTHETIC_TRANSFER_V1", inventoryPolicyVersion: "SYNTHETIC_INVENTORY_V1",
        });
      } catch (error) {
        if (!(error instanceof WorkerFailure)) throw error;
        if (error.retryable) throw new ApiFailure(503, "FABRIC_GATEWAY_UNAVAILABLE", "The ledger is unavailable; retry with the same idempotency key.");
        const status = error.code === "TRF_NOT_AUTHORIZED" ? 403 : error.code.includes("CONFLICT") || error.code === "TRF_DUPLICATE" ? 409 : 400;
        throw new ApiFailure(status, error.code, "The transfer request was rejected by the authoritative ledger policy.");
      }
      const asset = ledger.asset;
      const projectedAt = new Date().toISOString();
      await client.query(
        `INSERT INTO app.transfer_requests(transfer_id,idempotency_key,payload_sha256,source_institution_id,destination_institution_id,blood_type,component,quantity,urgency,request_time,status,reason_code,actor_user_id,policy_version,inventory_policy_version,recommendation_digest,ledger_version,ledger_transaction_id,correlation_id,projected_at,classification)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PENDING',NULL,$11,$12,$13,NULL,$14,$15,$16,$17,'SIMULATION_ONLY')`,
        [asset.transferId,input.idempotencyKey,input.payloadSha256,asset.sourceInstitutionId,asset.destinationInstitutionId,asset.bloodType,asset.component,asset.quantity,asset.urgency,asset.requestTime,asset.actorUserId,asset.policyVersion,asset.inventoryPolicyVersion,asset.version,asset.lastTransactionId,asset.correlationId,projectedAt],
      );
      await client.query(
        `INSERT INTO app.transfer_events(event_id,transfer_id,from_status,to_status,actor_user_id,actor_institution_id,event_time,reason_code,idempotency_key,correlation_id,ledger_transaction_id,ledger_version,classification)
         VALUES($1,$2,NULL,'PENDING',$3,$4,$5,NULL,$6,$7,$8,$9,'SIMULATION_ONLY')`,
        [input.transferEventId,asset.transferId,asset.actorUserId,asset.destinationInstitutionId,asset.createdAt,input.idempotencyKey,asset.correlationId,asset.lastTransactionId,asset.version],
      );
      await client.query(
        `INSERT INTO app.audit_events(audit_event_id,institution_id,actor_user_id,action_code,target_type,target_id,outcome,correlation_id,ledger_transaction_id,event_time,classification)
         VALUES($1,$2,$3,'TRANSFER_REQUESTED','TRANSFER',$4,'SUCCEEDED',$5,$6,$7,'SIMULATION_ONLY')`,
        [input.auditEventId,asset.destinationInstitutionId,asset.actorUserId,asset.transferId,asset.correlationId,asset.lastTransactionId,asset.createdAt],
      );
      return { transferId: asset.transferId, status: "PENDING", ledgerVersion: asset.version, ledgerTransactionId: asset.lastTransactionId, projectedAt, replayed: ledger.ledgerReplayed, classification: "SIMULATION_ONLY" };
    });
  }
}
