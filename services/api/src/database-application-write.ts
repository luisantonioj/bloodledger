import type { Pool, PoolClient } from "pg";
import type {
  AlertAcknowledgementInput,
  AlertAcknowledgementResult,
  ApplicationWriteRepository,
} from "./application-write.js";
import { ApiFailure } from "./errors.js";

type Row = Record<string, unknown>;

export class PostgresApplicationWriteRepository implements ApplicationWriteRepository {
  constructor(private readonly pool: Pool) {}

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
}
