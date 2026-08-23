import type { Pool, PoolClient } from "pg";
import type {
  AlertAcknowledgementInput,
  AlertAcknowledgementResult,
  ApplicationWriteRepository,
  TransferApprovalCommand,
  TransferApprovalResult,
  TransferCancellationCommand,
  TransferCancellationResult,
  TransferDispatchCommand,
  TransferDispatchResult,
  TransferDelayCommand,
  TransferDelayResult,
  TransferReceiptCommand,
  TransferReceiptResult,
  TransferTransitCommand,
  TransferTransitResult,
  TransferRequestCommand,
  TransferRequestResult,
  TransferRejectionCommand,
  TransferRejectionResult,
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
      const projectedAt = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString();
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

  async approveTransfer(input: TransferApprovalCommand): Promise<TransferApprovalResult | null> {
    return this.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [input.idempotencyKey]);
      const existing = await client.query<Row>(
        `SELECT e.transfer_id,e.to_status,e.actor_user_id,e.event_time,e.correlation_id,e.ledger_transaction_id,e.ledger_version,r.projected_at
         FROM app.transfer_events e JOIN app.transfer_requests r ON r.transfer_id=e.transfer_id WHERE e.idempotency_key=$1`,
        [input.idempotencyKey],
      );
      if (existing.rows[0]) {
        const row = existing.rows[0];
        const exact = String(row.transfer_id) === input.transferId && String(row.to_status) === "APPROVED" &&
          String(row.actor_user_id) === input.actorUserId && new Date(String(row.event_time)).toISOString() === input.eventTime &&
          String(row.correlation_id) === input.correlationId && Number(row.ledger_version) === input.expectedVersion + 1;
        if (!exact) throw new ApiFailure(409, "TRANSFER_IDEMPOTENCY_CONFLICT", "Idempotency key was used for a different transfer transition.");
        const selected = await client.query<Row>(
          "SELECT unit_id FROM app.transfer_selected_units WHERE transfer_id=$1 ORDER BY fefo_position",
          [input.transferId],
        );
        return {
          transferId: input.transferId, status: "APPROVED", selectedUnitIds: selected.rows.map((item) => String(item.unit_id)),
          ledgerVersion: Number(row.ledger_version), ledgerTransactionId: String(row.ledger_transaction_id),
          projectedAt: new Date(String(row.projected_at)).toISOString(), replayed: true, classification: "SIMULATION_ONLY",
        };
      }

      const target = await client.query<Row>(
        `SELECT transfer_id,blood_type,component,quantity,status,ledger_version FROM app.transfer_requests
         WHERE transfer_id=$1 AND source_institution_id=$2 FOR UPDATE`,
        [input.transferId, input.sourceInstitutionId],
      );
      if (!target.rows[0]) return null;
      const transfer = target.rows[0];
      if (String(transfer.status) !== "PENDING") {
        throw new ApiFailure(409, "TRANSFER_STATE_CONFLICT", "Only a pending transfer request can be approved.");
      }
      if (Number(transfer.ledger_version) !== input.expectedVersion) {
        throw new ApiFailure(409, "TRANSFER_VERSION_CONFLICT", "The transfer changed; refresh before retrying.");
      }
      const eligible = await client.query<Row>(
        `SELECT unit_id FROM app.inventory_projection
         WHERE institution_id=$1 AND blood_type=$2 AND component=$3 AND inventory_status='AVAILABLE'
           AND policy_version='SYNTHETIC_INVENTORY_V1' AND expires_at>$4
         ORDER BY expires_at,unit_id LIMIT $5 FOR UPDATE`,
        [input.sourceInstitutionId, transfer.blood_type, transfer.component, input.eventTime, transfer.quantity],
      );
      const selectedUnitIds = eligible.rows.map((row) => String(row.unit_id));
      if (selectedUnitIds.length !== Number(transfer.quantity)) {
        throw new ApiFailure(409, "TRF_INSUFFICIENT_STOCK", "Insufficient eligible ledger-projected stock is available for approval.");
      }

      let ledger;
      try {
        ledger = await this.transferLedger.approveTransfer({
          transferId: input.transferId, selectedUnitIds, actorUserId: input.actorUserId,
          eventTime: input.eventTime, expectedVersion: input.expectedVersion, correlationId: input.correlationId,
          idempotencyKey: input.idempotencyKey, policyVersion: "SYNTHETIC_TRANSFER_V1",
          inventoryPolicyVersion: "SYNTHETIC_INVENTORY_V1",
        });
      } catch (error) {
        if (!(error instanceof WorkerFailure)) throw error;
        if (error.retryable) throw new ApiFailure(503, "FABRIC_GATEWAY_UNAVAILABLE", "The ledger is unavailable; retry with the same idempotency key.");
        const conflictCodes = ["TRF_STATE_INVALID","TRF_TRANSITION_INVALID","TRF_FEFO_VIOLATION","TRF_INSUFFICIENT_STOCK","TRF_UNIT_NOT_FOUND"];
        const status = error.code === "TRF_NOT_AUTHORIZED" ? 403 : error.code.includes("CONFLICT") || conflictCodes.includes(error.code) ? 409 : 400;
        throw new ApiFailure(status, error.code, "The transfer approval was rejected by the authoritative ledger policy.");
      }

      const asset = ledger.asset;
      const projectedAt = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString();
      await client.query(
        `UPDATE app.transfer_requests SET status='APPROVED',reason_code=NULL,actor_user_id=$2,ledger_version=$3,
         ledger_transaction_id=$4,correlation_id=$5,projected_at=$6 WHERE transfer_id=$1`,
        [asset.transferId,input.actorUserId,asset.version,asset.lastTransactionId,asset.correlationId,projectedAt],
      );
      for (const [index,unitId] of asset.selectedUnitIds.entries()) {
        await client.query(
          "INSERT INTO app.transfer_selected_units(transfer_id,unit_id,fefo_position) VALUES($1,$2,$3)",
          [asset.transferId,unitId,index+1],
        );
      }
      const inventory = await client.query(
        `UPDATE app.inventory_projection SET inventory_status='RESERVED',ledger_version=ledger_version+1,
         ledger_transaction_id=$2,correlation_id=$3,projected_at=$4 WHERE unit_id=ANY($1::varchar[])`,
        [asset.selectedUnitIds,asset.lastTransactionId,asset.correlationId,projectedAt],
      );
      if (inventory.rowCount !== asset.selectedUnitIds.length) {
        throw new ApiFailure(503, "PROJECTION_RECONCILIATION_FAILED", "Ledger approval committed but projection reconciliation requires retry with the same idempotency key.");
      }
      await client.query(
        `INSERT INTO app.transfer_events(event_id,transfer_id,from_status,to_status,actor_user_id,actor_institution_id,event_time,reason_code,idempotency_key,correlation_id,ledger_transaction_id,ledger_version,classification)
         VALUES($1,$2,'PENDING','APPROVED',$3,$4,$5,NULL,$6,$7,$8,$9,'SIMULATION_ONLY')`,
        [input.transferEventId,asset.transferId,input.actorUserId,input.sourceInstitutionId,input.eventTime,input.idempotencyKey,input.correlationId,asset.lastTransactionId,asset.version],
      );
      await client.query(
        `INSERT INTO app.audit_events(audit_event_id,institution_id,actor_user_id,action_code,target_type,target_id,outcome,correlation_id,ledger_transaction_id,event_time,classification)
         VALUES($1,$2,$3,'TRANSFER_APPROVED','TRANSFER',$4,'SUCCEEDED',$5,$6,$7,'SIMULATION_ONLY')`,
        [input.auditEventId,input.sourceInstitutionId,input.actorUserId,asset.transferId,input.correlationId,asset.lastTransactionId,input.eventTime],
      );
      return {
        transferId: asset.transferId, status: "APPROVED", selectedUnitIds: asset.selectedUnitIds,
        ledgerVersion: asset.version, ledgerTransactionId: asset.lastTransactionId,
        projectedAt, replayed: ledger.ledgerReplayed, classification: "SIMULATION_ONLY",
      };
    });
  }

  async markTransferDelayed(input: TransferDelayCommand): Promise<TransferDelayResult | null> {
    return this.transaction(async(client)=>{
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[input.idempotencyKey]);
      const existing=await client.query<Row>("SELECT e.transfer_id,e.to_status,e.actor_user_id,e.actor_institution_id,e.event_time,e.reason_code,e.correlation_id,e.ledger_transaction_id,e.ledger_version,r.projected_at FROM app.transfer_events e JOIN app.transfer_requests r ON r.transfer_id=e.transfer_id WHERE e.idempotency_key=$1",[input.idempotencyKey]);
      if(existing.rows[0]){
        const row=existing.rows[0],exact=String(row.transfer_id)===input.transferId&&String(row.to_status)==="DELAYED"&&String(row.actor_user_id)===input.actorUserId&&String(row.actor_institution_id)===input.actorInstitutionId&&new Date(String(row.event_time)).toISOString()===input.eventTime&&String(row.reason_code)===input.reasonCode&&String(row.correlation_id)===input.correlationId&&Number(row.ledger_version)===input.expectedVersion+1;
        if(!exact)throw new ApiFailure(409,"TRANSFER_IDEMPOTENCY_CONFLICT","Idempotency key was used for a different transfer transition.");
        return{transferId:input.transferId,status:"DELAYED",reasonCode:"ROUTE_DELAY",ledgerVersion:Number(row.ledger_version),ledgerTransactionId:String(row.ledger_transaction_id),projectedAt:new Date(String(row.projected_at)).toISOString(),replayed:true,classification:"SIMULATION_ONLY"};
      }
      const target=await client.query<Row>("SELECT transfer_id,status,ledger_version FROM app.transfer_requests WHERE transfer_id=$1 AND ((destination_institution_id=$2 AND $3='ROLE-03') OR (source_institution_id=$2 AND $3 IN ('ROLE-01','ROLE-02'))) FOR UPDATE",[input.transferId,input.actorInstitutionId,input.actorRoleId]);
      if(!target.rows[0])return null;
      if(String(target.rows[0].status)!=="IN_TRANSIT")throw new ApiFailure(409,"TRANSFER_STATE_CONFLICT","Only an in-transit transfer can be marked delayed.");
      if(Number(target.rows[0].ledger_version)!==input.expectedVersion)throw new ApiFailure(409,"TRANSFER_VERSION_CONFLICT","The transfer changed; refresh before retrying.");
      let ledger;
      try{ledger=await this.transferLedger.markDelayed({transferId:input.transferId,actorUserId:input.actorUserId,eventTime:input.eventTime,expectedVersion:input.expectedVersion,correlationId:input.correlationId,idempotencyKey:input.idempotencyKey,policyVersion:"SYNTHETIC_TRANSFER_V1",reasonCode:"ROUTE_DELAY"});}
      catch(error){if(!(error instanceof WorkerFailure))throw error;if(error.retryable)throw new ApiFailure(503,"FABRIC_GATEWAY_UNAVAILABLE","The ledger is unavailable; retry with the same idempotency key.");const status=error.code==="TRF_NOT_AUTHORIZED"?403:error.code.includes("CONFLICT")||["TRF_STATE_INVALID","TRF_TRANSITION_INVALID"].includes(error.code)?409:400;throw new ApiFailure(status,error.code,"The transfer delay transition was rejected by the authoritative ledger policy.");}
      const asset=ledger.asset,projectedAt=new Date(Math.floor(Date.now()/1000)*1000).toISOString();
      await client.query("UPDATE app.transfer_requests SET status='DELAYED',reason_code=$2,actor_user_id=$3,ledger_version=$4,ledger_transaction_id=$5,correlation_id=$6,projected_at=$7 WHERE transfer_id=$1",[asset.transferId,input.reasonCode,input.actorUserId,asset.version,asset.lastTransactionId,asset.correlationId,projectedAt]);
      await client.query("INSERT INTO app.transfer_events(event_id,transfer_id,from_status,to_status,actor_user_id,actor_institution_id,event_time,reason_code,idempotency_key,correlation_id,ledger_transaction_id,ledger_version,classification) VALUES($1,$2,'IN_TRANSIT','DELAYED',$3,$4,$5,$6,$7,$8,$9,$10,'SIMULATION_ONLY')",[input.transferEventId,asset.transferId,input.actorUserId,input.actorInstitutionId,input.eventTime,input.reasonCode,input.idempotencyKey,input.correlationId,asset.lastTransactionId,asset.version]);
      await client.query("INSERT INTO app.audit_events(audit_event_id,institution_id,actor_user_id,action_code,target_type,target_id,outcome,correlation_id,ledger_transaction_id,event_time,classification) VALUES($1,$2,$3,'TRANSFER_DELAYED','TRANSFER',$4,'SUCCEEDED',$5,$6,$7,'SIMULATION_ONLY')",[input.auditEventId,input.actorInstitutionId,input.actorUserId,asset.transferId,input.correlationId,asset.lastTransactionId,input.eventTime]);
      return{transferId:asset.transferId,status:"DELAYED",reasonCode:"ROUTE_DELAY",ledgerVersion:asset.version,ledgerTransactionId:asset.lastTransactionId,projectedAt,replayed:ledger.ledgerReplayed,classification:"SIMULATION_ONLY"};
    });
  }

  async recordTransferReceipt(input: TransferReceiptCommand): Promise<TransferReceiptResult | null> {
    return this.transaction(async(client)=>{
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[input.idempotencyKey]);
      const existing=await client.query<Row>("SELECT e.transfer_id,e.from_status,e.to_status,e.actor_user_id,e.actor_institution_id,e.event_time,e.correlation_id,e.ledger_transaction_id,e.ledger_version,r.projected_at,l.evidence_id,l.evidence_digest,l.captured_at,l.capture_source,l.facility_matched,l.fallback,l.policy_version FROM app.transfer_events e JOIN app.transfer_requests r ON r.transfer_id=e.transfer_id LEFT JOIN app.location_evidence l ON l.evidence_id=r.receipt_evidence_id WHERE e.idempotency_key=$1",[input.idempotencyKey]);
      if(existing.rows[0]){
        const row=existing.rows[0],evidence=input.locationEvidence;
        const exact=String(row.transfer_id)===input.transferId&&String(row.to_status)==="RECEIVED"&&String(row.actor_user_id)===input.actorUserId&&String(row.actor_institution_id)===input.destinationInstitutionId&&new Date(String(row.event_time)).toISOString()===input.eventTime&&String(row.correlation_id)===input.correlationId&&Number(row.ledger_version)===input.expectedVersion+1&&String(row.evidence_id)===evidence.evidenceId&&String(row.evidence_digest)===evidence.evidenceDigest;
        if(!exact)throw new ApiFailure(409,"TRANSFER_IDEMPOTENCY_CONFLICT","Idempotency key was used for a different transfer transition.");
        const selected=await client.query<Row>("SELECT unit_id FROM app.transfer_selected_units WHERE transfer_id=$1 ORDER BY fefo_position",[input.transferId]);
        return{transferId:input.transferId,status:"RECEIVED",receivedUnitIds:selected.rows.map(item=>String(item.unit_id)),locationEvidence:{evidenceId:String(row.evidence_id),capturedAt:new Date(String(row.captured_at)).toISOString(),source:String(row.capture_source) as "DEVICE"|"FACILITY_FALLBACK",facilityMatched:Boolean(row.facility_matched),fallback:Boolean(row.fallback),policyVersion:"SYNTHETIC_LOCATION_V1"},ledgerVersion:Number(row.ledger_version),ledgerTransactionId:String(row.ledger_transaction_id),projectedAt:new Date(String(row.projected_at)).toISOString(),replayed:true,classification:"SIMULATION_ONLY"};
      }
      const target=await client.query<Row>("SELECT transfer_id,status,ledger_version FROM app.transfer_requests WHERE transfer_id=$1 AND destination_institution_id=$2 FOR UPDATE",[input.transferId,input.destinationInstitutionId]);
      if(!target.rows[0])return null;
      const fromStatus=String(target.rows[0].status);
      if(!["IN_TRANSIT","DELAYED"].includes(fromStatus))throw new ApiFailure(409,"TRANSFER_STATE_CONFLICT","Only an in-transit or delayed transfer can be received.");
      if(Number(target.rows[0].ledger_version)!==input.expectedVersion)throw new ApiFailure(409,"TRANSFER_VERSION_CONFLICT","The transfer changed; refresh before retrying.");
      const selected=await client.query<Row>("SELECT unit_id FROM app.transfer_selected_units WHERE transfer_id=$1 ORDER BY fefo_position",[input.transferId]),receivedUnitIds=selected.rows.map(row=>String(row.unit_id));
      if(receivedUnitIds.length===0)throw new ApiFailure(409,"TRANSFER_STATE_CONFLICT","The transfer has no selected units to receive.");
      let ledger;
      try{ledger=await this.transferLedger.recordReceipt({transferId:input.transferId,actorUserId:input.actorUserId,eventTime:input.eventTime,expectedVersion:input.expectedVersion,correlationId:input.correlationId,idempotencyKey:input.idempotencyKey,policyVersion:"SYNTHETIC_TRANSFER_V1",locationEvidence:{evidenceId:input.locationEvidence.evidenceId,evidenceDigest:input.locationEvidence.evidenceDigest,phase:"RECEIPT",capturedAt:input.locationEvidence.capturedAt,source:input.locationEvidence.source,facilityMatched:input.locationEvidence.facilityMatched,fallback:input.locationEvidence.fallback,policyVersion:"SYNTHETIC_LOCATION_V1"}});}
      catch(error){if(!(error instanceof WorkerFailure))throw error;if(error.retryable)throw new ApiFailure(503,"FABRIC_GATEWAY_UNAVAILABLE","The ledger is unavailable; retry with the same idempotency key.");const status=error.code==="TRF_NOT_AUTHORIZED"?403:error.code.includes("CONFLICT")||["TRF_STATE_INVALID","TRF_TRANSITION_INVALID","TRF_UNIT_STATE_INVALID"].includes(error.code)?409:400;throw new ApiFailure(status,error.code,"The transfer receipt was rejected by the authoritative ledger policy.");}
      const asset=ledger.asset,exactUnits=asset.selectedUnitIds.length===receivedUnitIds.length&&asset.selectedUnitIds.every((unitId,index)=>unitId===receivedUnitIds[index]),evidence=input.locationEvidence;
      if(!exactUnits)throw new ApiFailure(503,"PROJECTION_RECONCILIATION_FAILED","Ledger receipt committed but selected-unit reconciliation requires retry with the same idempotency key.");
      const projectedAt=new Date(Math.floor(Date.now()/1000)*1000).toISOString();
      await client.query("INSERT INTO app.location_evidence(evidence_id,evidence_digest,institution_id,phase,latitude,longitude,accuracy_metres,captured_at,capture_source,facility_matched,fallback,fallback_reason,policy_version,classification,delete_after) VALUES($1,$2,$3,'RECEIPT',$4,$5,$6,$7,$8,$9,$10,$11,'SYNTHETIC_LOCATION_V1','SYNTHETIC_DATA',$12)",[evidence.evidenceId,evidence.evidenceDigest,evidence.institutionId,evidence.latitude,evidence.longitude,evidence.accuracyMetres,evidence.capturedAt,evidence.source,evidence.facilityMatched,evidence.fallback,evidence.fallbackReason,evidence.deleteAfter]);
      await client.query("UPDATE app.transfer_requests SET status='RECEIVED',receipt_evidence_id=$2,actor_user_id=$3,ledger_version=$4,ledger_transaction_id=$5,correlation_id=$6,projected_at=$7 WHERE transfer_id=$1",[asset.transferId,evidence.evidenceId,input.actorUserId,asset.version,asset.lastTransactionId,asset.correlationId,projectedAt]);
      const inventory=await client.query("UPDATE app.inventory_projection SET inventory_status='RECEIVED',ledger_version=ledger_version+1,ledger_transaction_id=$2,correlation_id=$3,projected_at=$4 WHERE unit_id=ANY($1::varchar[]) AND inventory_status='IN_TRANSIT'",[receivedUnitIds,asset.lastTransactionId,asset.correlationId,projectedAt]);
      if(inventory.rowCount!==receivedUnitIds.length)throw new ApiFailure(503,"PROJECTION_RECONCILIATION_FAILED","Ledger receipt committed but inventory projection reconciliation requires retry with the same idempotency key.");
      await client.query("INSERT INTO app.transfer_events(event_id,transfer_id,from_status,to_status,actor_user_id,actor_institution_id,event_time,reason_code,idempotency_key,correlation_id,ledger_transaction_id,ledger_version,classification) VALUES($1,$2,$3,'RECEIVED',$4,$5,$6,NULL,$7,$8,$9,$10,'SIMULATION_ONLY')",[input.transferEventId,asset.transferId,fromStatus,input.actorUserId,input.destinationInstitutionId,input.eventTime,input.idempotencyKey,input.correlationId,asset.lastTransactionId,asset.version]);
      await client.query("INSERT INTO app.audit_events(audit_event_id,institution_id,actor_user_id,action_code,target_type,target_id,outcome,correlation_id,ledger_transaction_id,event_time,classification) VALUES($1,$2,$3,'TRANSFER_RECEIVED','TRANSFER',$4,'SUCCEEDED',$5,$6,$7,'SIMULATION_ONLY')",[input.auditEventId,input.destinationInstitutionId,input.actorUserId,asset.transferId,input.correlationId,asset.lastTransactionId,input.eventTime]);
      return{transferId:asset.transferId,status:"RECEIVED",receivedUnitIds,locationEvidence:{evidenceId:evidence.evidenceId,capturedAt:evidence.capturedAt,source:evidence.source,facilityMatched:evidence.facilityMatched,fallback:evidence.fallback,policyVersion:"SYNTHETIC_LOCATION_V1"},ledgerVersion:asset.version,ledgerTransactionId:asset.lastTransactionId,projectedAt,replayed:ledger.ledgerReplayed,classification:"SIMULATION_ONLY"};
    });
  }

  async startTransferTransit(input: TransferTransitCommand): Promise<TransferTransitResult | null> {
    return this.transaction(async(client)=>{
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[input.idempotencyKey]);
      const existing=await client.query<Row>(`SELECT e.transfer_id,e.to_status,e.actor_user_id,e.actor_institution_id,e.event_time,e.correlation_id,e.ledger_transaction_id,e.ledger_version,r.projected_at FROM app.transfer_events e JOIN app.transfer_requests r ON r.transfer_id=e.transfer_id WHERE e.idempotency_key=$1`,[input.idempotencyKey]);
      if(existing.rows[0]){
        const row=existing.rows[0],exact=String(row.transfer_id)===input.transferId&&String(row.to_status)==="IN_TRANSIT"&&String(row.actor_user_id)===input.actorUserId&&String(row.actor_institution_id)===input.sourceInstitutionId&&new Date(String(row.event_time)).toISOString()===input.eventTime&&String(row.correlation_id)===input.correlationId&&Number(row.ledger_version)===input.expectedVersion+1;
        if(!exact)throw new ApiFailure(409,"TRANSFER_IDEMPOTENCY_CONFLICT","Idempotency key was used for a different transfer transition.");
        const selected=await client.query<Row>("SELECT unit_id FROM app.transfer_selected_units WHERE transfer_id=$1 ORDER BY fefo_position",[input.transferId]);
        return{transferId:input.transferId,status:"IN_TRANSIT",inTransitUnitIds:selected.rows.map(item=>String(item.unit_id)),ledgerVersion:Number(row.ledger_version),ledgerTransactionId:String(row.ledger_transaction_id),projectedAt:new Date(String(row.projected_at)).toISOString(),replayed:true,classification:"SIMULATION_ONLY"};
      }
      const target=await client.query<Row>("SELECT transfer_id,status,ledger_version FROM app.transfer_requests WHERE transfer_id=$1 AND source_institution_id=$2 FOR UPDATE",[input.transferId,input.sourceInstitutionId]);
      if(!target.rows[0])return null;
      if(String(target.rows[0].status)!=="DISPATCHED")throw new ApiFailure(409,"TRANSFER_STATE_CONFLICT","Only a dispatched transfer can enter transit.");
      if(Number(target.rows[0].ledger_version)!==input.expectedVersion)throw new ApiFailure(409,"TRANSFER_VERSION_CONFLICT","The transfer changed; refresh before retrying.");
      const selected=await client.query<Row>("SELECT unit_id FROM app.transfer_selected_units WHERE transfer_id=$1 ORDER BY fefo_position",[input.transferId]),inTransitUnitIds=selected.rows.map(row=>String(row.unit_id));
      if(inTransitUnitIds.length===0)throw new ApiFailure(409,"TRANSFER_STATE_CONFLICT","The dispatched transfer has no selected units.");
      let ledger;
      try{ledger=await this.transferLedger.startTransit({transferId:input.transferId,actorUserId:input.actorUserId,eventTime:input.eventTime,expectedVersion:input.expectedVersion,correlationId:input.correlationId,idempotencyKey:input.idempotencyKey,policyVersion:"SYNTHETIC_TRANSFER_V1"});}
      catch(error){if(!(error instanceof WorkerFailure))throw error;if(error.retryable)throw new ApiFailure(503,"FABRIC_GATEWAY_UNAVAILABLE","The ledger is unavailable; retry with the same idempotency key.");const status=error.code==="TRF_NOT_AUTHORIZED"?403:error.code.includes("CONFLICT")||["TRF_STATE_INVALID","TRF_TRANSITION_INVALID","TRF_UNIT_STATE_INVALID"].includes(error.code)?409:400;throw new ApiFailure(status,error.code,"The transfer transit transition was rejected by the authoritative ledger policy.");}
      const asset=ledger.asset,exactUnits=asset.selectedUnitIds.length===inTransitUnitIds.length&&asset.selectedUnitIds.every((unitId,index)=>unitId===inTransitUnitIds[index]);
      if(!exactUnits)throw new ApiFailure(503,"PROJECTION_RECONCILIATION_FAILED","Ledger transit committed but selected-unit reconciliation requires retry with the same idempotency key.");
      const projectedAt=new Date(Math.floor(Date.now()/1000)*1000).toISOString();
      await client.query(`UPDATE app.transfer_requests SET status='IN_TRANSIT',actor_user_id=$2,ledger_version=$3,ledger_transaction_id=$4,correlation_id=$5,projected_at=$6 WHERE transfer_id=$1`,[asset.transferId,input.actorUserId,asset.version,asset.lastTransactionId,asset.correlationId,projectedAt]);
      const inventory=await client.query(`UPDATE app.inventory_projection SET inventory_status='IN_TRANSIT',ledger_version=ledger_version+1,ledger_transaction_id=$2,correlation_id=$3,projected_at=$4 WHERE unit_id=ANY($1::varchar[]) AND inventory_status='DISPATCHED'`,[inTransitUnitIds,asset.lastTransactionId,asset.correlationId,projectedAt]);
      if(inventory.rowCount!==inTransitUnitIds.length)throw new ApiFailure(503,"PROJECTION_RECONCILIATION_FAILED","Ledger transit committed but inventory projection reconciliation requires retry with the same idempotency key.");
      await client.query(`INSERT INTO app.transfer_events(event_id,transfer_id,from_status,to_status,actor_user_id,actor_institution_id,event_time,reason_code,idempotency_key,correlation_id,ledger_transaction_id,ledger_version,classification) VALUES($1,$2,'DISPATCHED','IN_TRANSIT',$3,$4,$5,NULL,$6,$7,$8,$9,'SIMULATION_ONLY')`,[input.transferEventId,asset.transferId,input.actorUserId,input.sourceInstitutionId,input.eventTime,input.idempotencyKey,input.correlationId,asset.lastTransactionId,asset.version]);
      await client.query(`INSERT INTO app.audit_events(audit_event_id,institution_id,actor_user_id,action_code,target_type,target_id,outcome,correlation_id,ledger_transaction_id,event_time,classification) VALUES($1,$2,$3,'TRANSFER_TRANSIT_STARTED','TRANSFER',$4,'SUCCEEDED',$5,$6,$7,'SIMULATION_ONLY')`,[input.auditEventId,input.sourceInstitutionId,input.actorUserId,asset.transferId,input.correlationId,asset.lastTransactionId,input.eventTime]);
      return{transferId:asset.transferId,status:"IN_TRANSIT",inTransitUnitIds,ledgerVersion:asset.version,ledgerTransactionId:asset.lastTransactionId,projectedAt,replayed:ledger.ledgerReplayed,classification:"SIMULATION_ONLY"};
    });
  }

  async dispatchTransfer(input: TransferDispatchCommand): Promise<TransferDispatchResult | null> {
    return this.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [input.idempotencyKey]);
      const existing=await client.query<Row>(
        `SELECT e.transfer_id,e.to_status,e.actor_user_id,e.actor_institution_id,e.event_time,e.correlation_id,e.ledger_transaction_id,e.ledger_version,r.projected_at,
                l.evidence_id,l.evidence_digest,l.captured_at,l.capture_source,l.facility_matched,l.fallback,l.policy_version
         FROM app.transfer_events e JOIN app.transfer_requests r ON r.transfer_id=e.transfer_id
         LEFT JOIN app.location_evidence l ON l.evidence_id=r.dispatch_evidence_id WHERE e.idempotency_key=$1`,
        [input.idempotencyKey],
      );
      if(existing.rows[0]){
        const row=existing.rows[0],evidence=input.locationEvidence;
        const exact=String(row.transfer_id)===input.transferId&&String(row.to_status)==="DISPATCHED"&&
          String(row.actor_user_id)===input.actorUserId&&String(row.actor_institution_id)===input.sourceInstitutionId&&
          new Date(String(row.event_time)).toISOString()===input.eventTime&&String(row.correlation_id)===input.correlationId&&
          Number(row.ledger_version)===input.expectedVersion+1&&String(row.evidence_id)===evidence.evidenceId&&
          String(row.evidence_digest)===evidence.evidenceDigest;
        if(!exact)throw new ApiFailure(409,"TRANSFER_IDEMPOTENCY_CONFLICT","Idempotency key was used for a different transfer transition.");
        const selected=await client.query<Row>("SELECT unit_id FROM app.transfer_selected_units WHERE transfer_id=$1 ORDER BY fefo_position",[input.transferId]);
        return{transferId:input.transferId,status:"DISPATCHED",dispatchedUnitIds:selected.rows.map(item=>String(item.unit_id)),locationEvidence:{evidenceId:String(row.evidence_id),capturedAt:new Date(String(row.captured_at)).toISOString(),source:String(row.capture_source) as "DEVICE"|"FACILITY_FALLBACK",facilityMatched:Boolean(row.facility_matched),fallback:Boolean(row.fallback),policyVersion:"SYNTHETIC_LOCATION_V1"},ledgerVersion:Number(row.ledger_version),ledgerTransactionId:String(row.ledger_transaction_id),projectedAt:new Date(String(row.projected_at)).toISOString(),replayed:true,classification:"SIMULATION_ONLY"};
      }
      const target=await client.query<Row>("SELECT transfer_id,status,ledger_version FROM app.transfer_requests WHERE transfer_id=$1 AND source_institution_id=$2 FOR UPDATE",[input.transferId,input.sourceInstitutionId]);
      if(!target.rows[0])return null;
      if(String(target.rows[0].status)!=="APPROVED")throw new ApiFailure(409,"TRANSFER_STATE_CONFLICT","Only an approved transfer can be dispatched.");
      if(Number(target.rows[0].ledger_version)!==input.expectedVersion)throw new ApiFailure(409,"TRANSFER_VERSION_CONFLICT","The transfer changed; refresh before retrying.");
      const selected=await client.query<Row>("SELECT unit_id FROM app.transfer_selected_units WHERE transfer_id=$1 ORDER BY fefo_position",[input.transferId]);
      const dispatchedUnitIds=selected.rows.map(row=>String(row.unit_id));
      if(dispatchedUnitIds.length===0)throw new ApiFailure(409,"TRANSFER_STATE_CONFLICT","The approved transfer has no reserved units.");
      const evidence=input.locationEvidence;
      await client.query(
        `INSERT INTO app.location_evidence(evidence_id,evidence_digest,institution_id,phase,latitude,longitude,accuracy_metres,capture_source,fallback_reason,captured_at,facility_matched,fallback,policy_version,classification,delete_after)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [evidence.evidenceId,evidence.evidenceDigest,evidence.institutionId,evidence.phase,evidence.latitude,evidence.longitude,evidence.accuracyMetres,evidence.source,evidence.fallbackReason,evidence.capturedAt,evidence.facilityMatched,evidence.fallback,evidence.policyVersion,evidence.classification,evidence.deleteAfter],
      );
      let ledger;
      try{ledger=await this.transferLedger.dispatchTransfer({transferId:input.transferId,actorUserId:input.actorUserId,eventTime:input.eventTime,expectedVersion:input.expectedVersion,correlationId:input.correlationId,idempotencyKey:input.idempotencyKey,policyVersion:"SYNTHETIC_TRANSFER_V1",locationEvidence:{evidenceId:evidence.evidenceId,evidenceDigest:evidence.evidenceDigest,phase:"DISPATCH",capturedAt:evidence.capturedAt,source:evidence.source,facilityMatched:evidence.facilityMatched,fallback:evidence.fallback,policyVersion:evidence.policyVersion}});}
      catch(error){if(!(error instanceof WorkerFailure))throw error;if(error.retryable)throw new ApiFailure(503,"FABRIC_GATEWAY_UNAVAILABLE","The ledger is unavailable; retry with the same idempotency key.");const status=error.code==="TRF_NOT_AUTHORIZED"?403:error.code.includes("CONFLICT")||["TRF_STATE_INVALID","TRF_TRANSITION_INVALID","TRF_UNIT_STATE_INVALID"].includes(error.code)?409:400;throw new ApiFailure(status,error.code,"The transfer dispatch was rejected by the authoritative ledger policy.");}
      const asset=ledger.asset;
      const exactUnits=asset.selectedUnitIds.length===dispatchedUnitIds.length&&asset.selectedUnitIds.every((unitId,index)=>unitId===dispatchedUnitIds[index]);
      if(!exactUnits)throw new ApiFailure(503,"PROJECTION_RECONCILIATION_FAILED","Ledger dispatch committed but selected-unit reconciliation requires retry with the same idempotency key.");
      const projectedAt=new Date(Math.floor(Date.now()/1000)*1000).toISOString();
      await client.query(`UPDATE app.transfer_requests SET status='DISPATCHED',dispatch_evidence_id=$2,actor_user_id=$3,ledger_version=$4,ledger_transaction_id=$5,correlation_id=$6,projected_at=$7 WHERE transfer_id=$1`,[asset.transferId,evidence.evidenceId,input.actorUserId,asset.version,asset.lastTransactionId,asset.correlationId,projectedAt]);
      const inventory=await client.query(`UPDATE app.inventory_projection SET inventory_status='DISPATCHED',ledger_version=ledger_version+1,ledger_transaction_id=$2,correlation_id=$3,projected_at=$4 WHERE unit_id=ANY($1::varchar[]) AND inventory_status='RESERVED'`,[dispatchedUnitIds,asset.lastTransactionId,asset.correlationId,projectedAt]);
      if(inventory.rowCount!==dispatchedUnitIds.length)throw new ApiFailure(503,"PROJECTION_RECONCILIATION_FAILED","Ledger dispatch committed but inventory projection reconciliation requires retry with the same idempotency key.");
      await client.query(`INSERT INTO app.transfer_events(event_id,transfer_id,from_status,to_status,actor_user_id,actor_institution_id,event_time,reason_code,idempotency_key,correlation_id,ledger_transaction_id,ledger_version,classification) VALUES($1,$2,'APPROVED','DISPATCHED',$3,$4,$5,NULL,$6,$7,$8,$9,'SIMULATION_ONLY')`,[input.transferEventId,asset.transferId,input.actorUserId,input.sourceInstitutionId,input.eventTime,input.idempotencyKey,input.correlationId,asset.lastTransactionId,asset.version]);
      await client.query(`INSERT INTO app.audit_events(audit_event_id,institution_id,actor_user_id,action_code,target_type,target_id,outcome,correlation_id,ledger_transaction_id,event_time,classification) VALUES($1,$2,$3,'TRANSFER_DISPATCHED','TRANSFER',$4,'SUCCEEDED',$5,$6,$7,'SIMULATION_ONLY')`,[input.auditEventId,input.sourceInstitutionId,input.actorUserId,asset.transferId,input.correlationId,asset.lastTransactionId,input.eventTime]);
      return{transferId:asset.transferId,status:"DISPATCHED",dispatchedUnitIds,locationEvidence:{evidenceId:evidence.evidenceId,capturedAt:evidence.capturedAt,source:evidence.source,facilityMatched:evidence.facilityMatched,fallback:evidence.fallback,policyVersion:evidence.policyVersion},ledgerVersion:asset.version,ledgerTransactionId:asset.lastTransactionId,projectedAt,replayed:ledger.ledgerReplayed,classification:"SIMULATION_ONLY"};
    });
  }

  async cancelTransfer(input: TransferCancellationCommand): Promise<TransferCancellationResult | null> {
    return this.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [input.idempotencyKey]);
      const existing = await client.query<Row>(
        `SELECT e.transfer_id,e.from_status,e.to_status,e.actor_user_id,e.actor_institution_id,e.event_time,e.reason_code,e.correlation_id,e.ledger_transaction_id,e.ledger_version,r.projected_at
         FROM app.transfer_events e JOIN app.transfer_requests r ON r.transfer_id=e.transfer_id WHERE e.idempotency_key=$1`,
        [input.idempotencyKey],
      );
      if (existing.rows[0]) {
        const row=existing.rows[0];
        const exact=String(row.transfer_id)===input.transferId&&String(row.to_status)==="CANCELLED"&&
          String(row.actor_user_id)===input.actorUserId&&String(row.actor_institution_id)===input.actorInstitutionId&&
          new Date(String(row.event_time)).toISOString()===input.eventTime&&String(row.reason_code)===input.reasonCode&&
          String(row.correlation_id)===input.correlationId&&Number(row.ledger_version)===input.expectedVersion+1;
        if(!exact)throw new ApiFailure(409,"TRANSFER_IDEMPOTENCY_CONFLICT","Idempotency key was used for a different transfer transition.");
        const selected=String(row.from_status)==="APPROVED"?await client.query<Row>("SELECT unit_id FROM app.transfer_selected_units WHERE transfer_id=$1 ORDER BY fefo_position",[input.transferId]):{rows:[]};
        return{transferId:input.transferId,status:"CANCELLED",reasonCode:input.reasonCode,releasedUnitIds:selected.rows.map(item=>String(item.unit_id)),ledgerVersion:Number(row.ledger_version),ledgerTransactionId:String(row.ledger_transaction_id),projectedAt:new Date(String(row.projected_at)).toISOString(),replayed:true,classification:"SIMULATION_ONLY"};
      }
      const target=await client.query<Row>(
        `SELECT transfer_id,status,ledger_version FROM app.transfer_requests WHERE transfer_id=$1 AND
         (($3='ROLE-02' AND source_institution_id=$2) OR ($3='ROLE-03' AND destination_institution_id=$2)) FOR UPDATE`,
        [input.transferId,input.actorInstitutionId,input.actorRoleId],
      );
      if(!target.rows[0])return null;
      const fromStatus=String(target.rows[0].status);
      const allowed=input.actorRoleId==="ROLE-02"?["PENDING","APPROVED"]:["PENDING"];
      if(!allowed.includes(fromStatus))throw new ApiFailure(409,"TRANSFER_STATE_CONFLICT","The transfer cannot be cancelled from its current state by this role.");
      if(Number(target.rows[0].ledger_version)!==input.expectedVersion)throw new ApiFailure(409,"TRANSFER_VERSION_CONFLICT","The transfer changed; refresh before retrying.");
      const selected=fromStatus==="APPROVED"?await client.query<Row>("SELECT unit_id FROM app.transfer_selected_units WHERE transfer_id=$1 ORDER BY fefo_position",[input.transferId]):{rows:[]};
      const releasedUnitIds=selected.rows.map(row=>String(row.unit_id));
      let ledger;
      try{ledger=await this.transferLedger.cancelTransfer({transferId:input.transferId,actorUserId:input.actorUserId,eventTime:input.eventTime,expectedVersion:input.expectedVersion,correlationId:input.correlationId,idempotencyKey:input.idempotencyKey,policyVersion:"SYNTHETIC_TRANSFER_V1",reasonCode:input.reasonCode});}
      catch(error){if(!(error instanceof WorkerFailure))throw error;if(error.retryable)throw new ApiFailure(503,"FABRIC_GATEWAY_UNAVAILABLE","The ledger is unavailable; retry with the same idempotency key.");const status=error.code==="TRF_NOT_AUTHORIZED"?403:error.code.includes("CONFLICT")||["TRF_STATE_INVALID","TRF_TRANSITION_INVALID","TRF_UNIT_STATE_INVALID"].includes(error.code)?409:400;throw new ApiFailure(status,error.code,"The transfer cancellation was rejected by the authoritative ledger policy.");}
      const asset=ledger.asset,projectedAt=new Date(Math.floor(Date.now()/1000)*1000).toISOString();
      await client.query(`UPDATE app.transfer_requests SET status='CANCELLED',reason_code=$2,actor_user_id=$3,ledger_version=$4,ledger_transaction_id=$5,correlation_id=$6,projected_at=$7 WHERE transfer_id=$1`,[asset.transferId,input.reasonCode,input.actorUserId,asset.version,asset.lastTransactionId,asset.correlationId,projectedAt]);
      if(releasedUnitIds.length>0){const inventory=await client.query(`UPDATE app.inventory_projection SET inventory_status='AVAILABLE',ledger_version=ledger_version+1,ledger_transaction_id=$2,correlation_id=$3,projected_at=$4 WHERE unit_id=ANY($1::varchar[]) AND inventory_status='RESERVED'`,[releasedUnitIds,asset.lastTransactionId,asset.correlationId,projectedAt]);if(inventory.rowCount!==releasedUnitIds.length)throw new ApiFailure(503,"PROJECTION_RECONCILIATION_FAILED","Ledger cancellation committed but projection reconciliation requires retry with the same idempotency key.");}
      await client.query(`INSERT INTO app.transfer_events(event_id,transfer_id,from_status,to_status,actor_user_id,actor_institution_id,event_time,reason_code,idempotency_key,correlation_id,ledger_transaction_id,ledger_version,classification) VALUES($1,$2,$3,'CANCELLED',$4,$5,$6,$7,$8,$9,$10,$11,'SIMULATION_ONLY')`,[input.transferEventId,asset.transferId,fromStatus,input.actorUserId,input.actorInstitutionId,input.eventTime,input.reasonCode,input.idempotencyKey,input.correlationId,asset.lastTransactionId,asset.version]);
      await client.query(`INSERT INTO app.audit_events(audit_event_id,institution_id,actor_user_id,action_code,target_type,target_id,outcome,correlation_id,ledger_transaction_id,event_time,classification) VALUES($1,$2,$3,'TRANSFER_CANCELLED','TRANSFER',$4,'SUCCEEDED',$5,$6,$7,'SIMULATION_ONLY')`,[input.auditEventId,input.actorInstitutionId,input.actorUserId,asset.transferId,input.correlationId,asset.lastTransactionId,input.eventTime]);
      return{transferId:asset.transferId,status:"CANCELLED",reasonCode:input.reasonCode,releasedUnitIds,ledgerVersion:asset.version,ledgerTransactionId:asset.lastTransactionId,projectedAt,replayed:ledger.ledgerReplayed,classification:"SIMULATION_ONLY"};
    });
  }

  async rejectTransfer(input: TransferRejectionCommand): Promise<TransferRejectionResult | null> {
    return this.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [input.idempotencyKey]);
      const existing = await client.query<Row>(
        `SELECT e.transfer_id,e.actor_user_id,e.event_time,e.reason_code,e.correlation_id,e.ledger_transaction_id,e.ledger_version,r.projected_at
         FROM app.transfer_events e JOIN app.transfer_requests r ON r.transfer_id=e.transfer_id WHERE e.idempotency_key=$1`,
        [input.idempotencyKey],
      );
      if (existing.rows[0]) {
        const row = existing.rows[0];
        const exact = String(row.transfer_id) === input.transferId && String(row.actor_user_id) === input.actorUserId &&
          new Date(String(row.event_time)).toISOString() === input.eventTime && String(row.reason_code) === input.reasonCode &&
          String(row.correlation_id) === input.correlationId && Number(row.ledger_version) === input.expectedVersion + 1;
        if (!exact) throw new ApiFailure(409, "TRANSFER_IDEMPOTENCY_CONFLICT", "Idempotency key was used for a different transfer transition.");
        return {
          transferId: input.transferId, status: "REJECTED", reasonCode: input.reasonCode,
          ledgerVersion: Number(row.ledger_version), ledgerTransactionId: String(row.ledger_transaction_id),
          projectedAt: new Date(String(row.projected_at)).toISOString(), replayed: true, classification: "SIMULATION_ONLY",
        };
      }

      const target = await client.query<Row>(
        `SELECT transfer_id,status,ledger_version FROM app.transfer_requests
         WHERE transfer_id=$1 AND source_institution_id=$2 FOR UPDATE`,
        [input.transferId, input.sourceInstitutionId],
      );
      if (!target.rows[0]) return null;
      if (String(target.rows[0].status) !== "PENDING") {
        throw new ApiFailure(409, "TRANSFER_STATE_CONFLICT", "Only a pending transfer request can be rejected.");
      }
      if (Number(target.rows[0].ledger_version) !== input.expectedVersion) {
        throw new ApiFailure(409, "TRANSFER_VERSION_CONFLICT", "The transfer changed; refresh before retrying.");
      }

      let ledger;
      try {
        ledger = await this.transferLedger.rejectTransfer({
          transferId: input.transferId, actorUserId: input.actorUserId, eventTime: input.eventTime,
          expectedVersion: input.expectedVersion, correlationId: input.correlationId,
          idempotencyKey: input.idempotencyKey, policyVersion: "SYNTHETIC_TRANSFER_V1", reasonCode: input.reasonCode,
        });
      } catch (error) {
        if (!(error instanceof WorkerFailure)) throw error;
        if (error.retryable) throw new ApiFailure(503, "FABRIC_GATEWAY_UNAVAILABLE", "The ledger is unavailable; retry with the same idempotency key.");
        const status = error.code === "TRF_NOT_AUTHORIZED" ? 403 : error.code.includes("CONFLICT") || error.code === "TRF_STATE_INVALID" ? 409 : 400;
        throw new ApiFailure(status, error.code, "The transfer rejection was rejected by the authoritative ledger policy.");
      }
      const asset = ledger.asset;
      const projectedAt = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString();
      await client.query(
        `UPDATE app.transfer_requests SET status='REJECTED',reason_code=$2,actor_user_id=$3,ledger_version=$4,
         ledger_transaction_id=$5,correlation_id=$6,projected_at=$7 WHERE transfer_id=$1`,
        [asset.transferId, input.reasonCode, input.actorUserId, asset.version, asset.lastTransactionId, asset.correlationId, projectedAt],
      );
      await client.query(
        `INSERT INTO app.transfer_events(event_id,transfer_id,from_status,to_status,actor_user_id,actor_institution_id,event_time,reason_code,idempotency_key,correlation_id,ledger_transaction_id,ledger_version,classification)
         VALUES($1,$2,'PENDING','REJECTED',$3,$4,$5,$6,$7,$8,$9,$10,'SIMULATION_ONLY')`,
        [input.transferEventId,asset.transferId,input.actorUserId,input.sourceInstitutionId,input.eventTime,input.reasonCode,input.idempotencyKey,input.correlationId,asset.lastTransactionId,asset.version],
      );
      await client.query(
        `INSERT INTO app.audit_events(audit_event_id,institution_id,actor_user_id,action_code,target_type,target_id,outcome,correlation_id,ledger_transaction_id,event_time,classification)
         VALUES($1,$2,$3,'TRANSFER_REJECTED','TRANSFER',$4,'SUCCEEDED',$5,$6,$7,'SIMULATION_ONLY')`,
        [input.auditEventId,input.sourceInstitutionId,input.actorUserId,asset.transferId,input.correlationId,asset.lastTransactionId,input.eventTime],
      );
      return {
        transferId: asset.transferId, status: "REJECTED", reasonCode: input.reasonCode,
        ledgerVersion: asset.version, ledgerTransactionId: asset.lastTransactionId,
        projectedAt, replayed: ledger.ledgerReplayed, classification: "SIMULATION_ONLY",
      };
    });
  }
}
