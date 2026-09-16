import type { Pool } from "pg";
import type { V2Command } from "./v2-command.js";
import type { V2LedgerSubmitter } from "./v2-worker.js";

export interface V2ComponentProjection {
  componentId: string;
  donationId: string;
  issuerInstitutionId: string;
  componentType: string;
  bloodType: string;
  collectedAt: string;
  expiresAt: string;
  institutionId: string;
  inventoryStatus: string;
  reservationId: string | null;
  reservationVersion: number | null;
  inventoryVersion: number;
  policyVersion: string;
  classification: "SIMULATION_ONLY";
}

export interface V2ProjectionReader {
  listComponents(institutionId: string, roleId: string): Promise<V2ComponentProjection[]>;
  getComponent(componentId: string, institutionId: string, roleId: string): Promise<V2ComponentProjection | null>;
  findComponentByIdentity(issuerInstitutionId: string, donationNumberLookupHmac: string, componentType: string): Promise<Pick<V2ComponentProjection, "componentId" | "donationId" | "institutionId" | "inventoryStatus" | "reservationId" | "reservationVersion" | "inventoryVersion"> | null>;
  recordInboundCapture?(captureId: string, payload: Record<string, unknown>, acceptedAt: string): Promise<void>;
  listInboundIntake?(institutionId?: string): Promise<Record<string, number>>;
}

type Row = Record<string, unknown>;

function mapRow(row: Row): V2ComponentProjection {
  return { componentId: String(row.component_id), donationId: String(row.donation_id), issuerInstitutionId: String(row.issuer_institution_id), componentType: String(row.component_type), bloodType: String(row.blood_type), collectedAt: new Date(String(row.collected_at)).toISOString(), expiresAt: new Date(String(row.expires_at)).toISOString(), institutionId: String(row.institution_id), inventoryStatus: String(row.inventory_status), reservationId: row.reservation_id === null || row.reservation_id === undefined ? null : String(row.reservation_id), reservationVersion: row.reservation_version === null || row.reservation_version === undefined ? null : Number(row.reservation_version), inventoryVersion: Number(row.ledger_version), policyVersion: String(row.policy_version), classification: "SIMULATION_ONLY" };
}

export class PostgresV2ProjectionReader implements V2ProjectionReader {
  constructor(private readonly pool: Pool) {}
  private query = `SELECT c.component_id,c.donation_id,c.issuer_institution_id,c.component_type,c.blood_type,c.collected_at,c.expires_at,c.institution_id,c.inventory_status,c.reservation_id,c.ledger_version,c.policy_version,r.version AS reservation_version FROM app.v2_components c LEFT JOIN app.v2_reservations r ON r.reservation_id=c.reservation_id WHERE c.institution_id=$1`;
  async listComponents(institutionId: string, _roleId: string): Promise<V2ComponentProjection[]> { const result = await this.pool.query<Row>(`${this.query} ORDER BY c.expires_at,c.component_id`, [institutionId]); return result.rows.map((row) => mapRow(row)); }
  async getComponent(componentId: string, institutionId: string, _roleId: string): Promise<V2ComponentProjection | null> { const result = await this.pool.query<Row>(`${this.query} AND c.component_id=$2`, [institutionId, componentId]); return result.rows[0] ? mapRow(result.rows[0]) : null; }
  async findComponentByIdentity(issuerInstitutionId: string, donationNumberLookupHmac: string, componentType: string) {
    const result = await this.pool.query<Row>(`SELECT c.component_id,c.donation_id,c.institution_id,c.inventory_status,c.reservation_id,c.ledger_version,r.version AS reservation_version FROM app.v2_components c LEFT JOIN app.v2_reservations r ON r.reservation_id=c.reservation_id WHERE c.issuer_institution_id=$1 AND c.donation_number_lookup_hmac=$2 AND c.component_type=$3`, [issuerInstitutionId, donationNumberLookupHmac, componentType]);
    if (!result.rows[0]) return null;
    const row = result.rows[0];
    return { componentId: String(row.component_id), donationId: String(row.donation_id), institutionId: String(row.institution_id), inventoryStatus: String(row.inventory_status), reservationId: row.reservation_id == null ? null : String(row.reservation_id), reservationVersion: row.reservation_version == null ? null : Number(row.reservation_version), inventoryVersion: Number(row.ledger_version) };
  }

  async recordInboundCapture(captureId: string, payload: Record<string, unknown>, acceptedAt: string): Promise<void> {
    await this.pool.query(`INSERT INTO app.v2_inbound_captures(capture_id,issuer_institution_id,custody_institution_id,donation_number_lookup_hmac,component_type,blood_type,capture_method,capture_policy_version,blood_type_evidence_source,component_evidence_source,ocr_engine,ocr_engine_version,donation_number_confidence,blood_type_confidence,collected_at,expires_at,captured_at,confirmed_at,event_time,status,resolution,correlation_id,classification,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,'OCR','INBOUND_OCR_V1',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'QUEUED','REGISTERED',$18,'SIMULATION_ONLY',$19,$19) ON CONFLICT(capture_id) DO NOTHING`, [captureId, payload.issuerInstitutionId, payload.custodyInstitutionId, payload.donationNoLookupHmac, payload.componentType, payload.bloodType, payload.bloodTypeEvidenceSource, payload.componentEvidenceSource, payload.ocrEngine, payload.ocrEngineVersion, payload.donationNumberConfidence, payload.bloodTypeConfidence, payload.collectedAt, payload.expiresAt, payload.capturedAt, payload.confirmedAt, payload.eventTime, payload.correlationId, acceptedAt]);
  }

  async listInboundIntake(institutionId?: string): Promise<Record<string, number>> {
    const result = await this.pool.query<Row>(`SELECT status,COUNT(*)::int AS count FROM app.v2_inbound_captures ${institutionId ? "WHERE custody_institution_id=$1" : ""} GROUP BY status`, institutionId ? [institutionId] : []);
    return Object.fromEntries(result.rows.map((row) => [String(row.status), Number(row.count)]));
  }
}

export class PostgresV2Projector implements Pick<V2LedgerSubmitter, "project"> {
  constructor(private readonly pool: Pool) {}
  async project(command: V2Command): Promise<void> {
    if (command.operation === "SUBMIT_TRANSFER") return;
    if (!["REGISTER_COMPONENT", "REGISTER_INBOUND_COMPONENT", "RECEIVE_INBOUND_COMPONENT", "RESERVE_COMPONENTS", "RESERVE_LOCAL_RELEASE", "PREPARE_RESERVATION", "DISPATCH_RESERVATION", "START_RESERVATION_TRANSIT", "RECEIVE_RESERVATION", "COMPLETE_LOCAL_RELEASE", "CANCEL_RESERVATION", "PLACE_RECONCILIATION_HOLD", "RESOLVE_RECONCILIATION_HOLD", "EVALUATE_COMPONENT_EXPIRY", "COMPROMISE_RESERVATION", "APPROVE", "PREPARE", "DISPATCH", "TRANSIT", "RECEIPT", "DELAY", "COMPROMISE", "CANCEL", "REJECT"].includes(command.operation)) throw new Error("V2_PROJECTION_OPERATION_UNSUPPORTED");
    const payload = command.payload;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const componentId = typeof payload.componentId === "string" ? payload.componentId : undefined;
      const reservationId = typeof payload.reservationId === "string" ? payload.reservationId : undefined;
      if (componentId) {
        const marker = await client.query("SELECT 1 FROM app.v2_components WHERE component_id=$1 AND last_projection_command_id=$2", [componentId, command.commandId]);
        if (marker.rowCount) { await client.query("COMMIT"); return; }
      }
      if (reservationId) {
        const marker = await client.query("SELECT 1 FROM app.v2_reservations WHERE reservation_id=$1 AND last_projection_command_id=$2", [reservationId, command.commandId]);
        if (marker.rowCount) { await client.query("COMMIT"); return; }
      }
      if (["REGISTER_COMPONENT", "REGISTER_INBOUND_COMPONENT"].includes(command.operation)) {
        if (command.operation === "REGISTER_INBOUND_COMPONENT") {
          await client.query(`INSERT INTO app.v2_inbound_captures(capture_id,issuer_institution_id,custody_institution_id,donation_number_lookup_hmac,component_type,blood_type,capture_method,capture_policy_version,blood_type_evidence_source,component_evidence_source,ocr_engine,ocr_engine_version,donation_number_confidence,blood_type_confidence,collected_at,expires_at,captured_at,confirmed_at,event_time,status,resolution,correlation_id,classification,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,'OCR','INBOUND_OCR_V1',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'COMMITTED','REGISTERED',$18,'SIMULATION_ONLY',$19,$19) ON CONFLICT(capture_id) DO NOTHING`, [payload.captureId, payload.issuerInstitutionId, payload.custodyInstitutionId, payload.donationNoLookupHmac, payload.componentType, payload.bloodType, payload.bloodTypeEvidenceSource, payload.componentEvidenceSource, payload.ocrEngine, payload.ocrEngineVersion, payload.donationNumberConfidence, payload.bloodTypeConfidence, payload.collectedAt, payload.expiresAt, payload.capturedAt, payload.confirmedAt, payload.eventTime, command.correlationId, command.acceptedAt]);
        }
        await client.query(`INSERT INTO app.v2_donations(donation_id,issuer_institution_id,donation_number_ciphertext,donation_number_nonce,donation_number_auth_tag,donation_number_key_version,donation_number_lookup_hmac,created_by_user_id,created_at,updated_at,classification) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,'SIMULATION_ONLY') ON CONFLICT(donation_id) DO UPDATE SET updated_at=EXCLUDED.updated_at`, [payload.donationId, payload.issuerInstitutionId, payload.donationNoCiphertext, payload.donationNoNonce, payload.donationNoAuthTag, payload.donationNoEncryptionKeyVersion, payload.donationNoLookupHmac, command.actorUserId, command.acceptedAt]);
        await client.query(`INSERT INTO app.v2_components(component_id,donation_id,issuer_institution_id,donation_number_lookup_hmac,component_type,blood_type,collected_at,expires_at,institution_id,inventory_status,ledger_version,ledger_transaction_id,correlation_id,policy_version,created_at,updated_at,classification,inbound_capture_id,capture_method,blood_type_evidence_source,component_evidence_source,last_projection_command_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'AVAILABLE',1,$10,$11,$12,$13,$13,'SIMULATION_ONLY',$14,'OCR',$15,$16,$17) ON CONFLICT(component_id) DO UPDATE SET last_projection_command_id=EXCLUDED.last_projection_command_id`, [payload.componentId, payload.donationId, payload.issuerInstitutionId, payload.donationNoLookupHmac, payload.componentType, payload.bloodType, payload.collectedAt, payload.expiresAt, payload.custodyInstitutionId ?? payload.issuerInstitutionId, command.ledgerTransactionId, command.correlationId, payload.policyVersion ?? "INTERVIEW_DERIVED_CORE_V2", command.acceptedAt, payload.captureId ?? null, payload.bloodTypeEvidenceSource ?? null, payload.componentEvidenceSource ?? null, command.commandId]);
        if (command.operation === "REGISTER_INBOUND_COMPONENT" && payload.captureId) await client.query("UPDATE app.v2_inbound_captures SET component_id=$2,command_id=$3,status='COMMITTED',resolution='REGISTERED',updated_at=$4 WHERE capture_id=$1", [payload.captureId, payload.componentId, command.commandId, command.acceptedAt]);
        await client.query("COMMIT");
        return;
      }
      if (command.operation === "RECEIVE_INBOUND_COMPONENT") {
        const received = await client.query("UPDATE app.v2_components SET inventory_status='RECEIVED',institution_id=$2,ledger_transaction_id=$3,last_projection_command_id=$4,updated_at=$5,ledger_version=ledger_version+1 WHERE reservation_id=$1 AND inventory_status='IN_TRANSIT'", [reservationId, command.actorInstitutionId, command.ledgerTransactionId, command.commandId, command.acceptedAt]);
        if (!received.rowCount) throw new Error("V2_PROJECTION_STATE_CONFLICT");
        const reservation = await client.query("UPDATE app.v2_reservations SET status='RECEIVED',last_projection_command_id=$2,updated_at=$3,version=version+1 WHERE reservation_id=$1 AND status='IN_TRANSIT'", [reservationId, command.commandId, command.acceptedAt]);
        if (!reservation.rowCount) throw new Error("V2_PROJECTION_STATE_CONFLICT");
        await client.query("COMMIT"); return;
      }
      if (["RESERVE_COMPONENTS", "RESERVE_LOCAL_RELEASE"].includes(command.operation)) {
        const selected = Array.isArray(payload.selectedComponentIds) ? payload.selectedComponentIds.filter((value): value is string => typeof value === "string") : [];
        if (!reservationId || selected.length === 0) throw new Error("V2_PROJECTION_INPUT_INVALID");
        const purpose = command.operation === "RESERVE_LOCAL_RELEASE" ? "LOCAL_RELEASE" : String(payload.purpose ?? "TRANSFER");
        if (purpose !== "TRANSFER" && purpose !== "LOCAL_RELEASE") throw new Error("V2_PROJECTION_INPUT_INVALID");
        const transferId = purpose === "TRANSFER" ? String(payload.transferId ?? command.resourceId) : null;
        const localReleaseId = purpose === "LOCAL_RELEASE" ? String(payload.localReleaseId ?? command.resourceId) : null;
        await client.query("INSERT INTO app.v2_reservations(reservation_id,purpose,transfer_id,local_release_id,institution_id,status,correlation_id,version,classification,last_projection_command_id) VALUES($1,$2,$3,$4,$5,'RESERVED',$6,1,'SIMULATION_ONLY',$7) ON CONFLICT(reservation_id) DO NOTHING", [reservationId, purpose, transferId, localReleaseId, command.actorInstitutionId, command.correlationId, command.commandId]);
        const expectedVersions = Array.isArray(payload.expectedComponentVersions) ? payload.expectedComponentVersions : [];
        for (const [index, selectedId] of selected.entries()) {
          const expected = Number(expectedVersions[index]);
          const versionClause = Number.isSafeInteger(expected) ? " AND ledger_version=$7" : "";
          const params: unknown[] = [selectedId, purpose, reservationId, command.ledgerTransactionId, command.commandId, command.acceptedAt];
          if (Number.isSafeInteger(expected)) params.push(expected);
          const updated = await client.query(`UPDATE app.v2_components SET inventory_status='RESERVED',reservation_purpose=$2,reservation_id=$3,ledger_transaction_id=$4,last_projection_command_id=$5,updated_at=$6,ledger_version=ledger_version+1 WHERE component_id=$1 AND inventory_status='AVAILABLE'${versionClause}`, params);
          if (!updated.rowCount) throw new Error("V2_PROJECTION_STATE_CONFLICT");
        }
        await client.query("COMMIT"); return;
      }
      const componentState: Record<string, { status: string; clearReservation?: boolean }> = {
        PREPARE_RESERVATION: { status: "RESERVED" }, PREPARE: { status: "RESERVED" },
        DISPATCH_RESERVATION: { status: "DISPATCHED" }, DISPATCH: { status: "DISPATCHED" },
        START_RESERVATION_TRANSIT: { status: "IN_TRANSIT" }, TRANSIT: { status: "IN_TRANSIT" },
        RECEIVE_RESERVATION: { status: "RECEIVED" }, RECEIPT: { status: "RECEIVED" },
        COMPLETE_LOCAL_RELEASE: { status: "RELEASED", clearReservation: true },
        CANCEL_RESERVATION: { status: "AVAILABLE", clearReservation: true }, CANCEL: { status: "AVAILABLE", clearReservation: true }, REJECT: { status: "AVAILABLE", clearReservation: true },
        COMPROMISE_RESERVATION: { status: "COMPROMISED", clearReservation: true }, COMPROMISE: { status: "COMPROMISED", clearReservation: true },
        EVALUATE_COMPONENT_EXPIRY: { status: "EXPIRED", clearReservation: true },
        PLACE_RECONCILIATION_HOLD: { status: "RECONCILIATION_HOLD" },
        RESOLVE_RECONCILIATION_HOLD: { status: String(payload.resolutionCode ?? "").includes("RESERVED") ? "RESERVED" : "AVAILABLE" },
        RESERVE_COMPONENTS: { status: "RESERVED" }, RESERVE_LOCAL_RELEASE: { status: "RESERVED" },
        APPROVE: { status: "RESERVED" }, DELAY: { status: "IN_TRANSIT" },
      };
      const state = componentState[command.operation];
      if (!state) throw new Error("V2_PROJECTION_OPERATION_UNSUPPORTED");
      const clear = state.clearReservation ? ",reservation_id=NULL,reservation_purpose=NULL,release_prepared_at=NULL,release_prepared_by=NULL" : "";
      const where = componentId ? "component_id=$1" : "reservation_id=$1";
      const version = payload.expectedVersion === undefined ? null : Number(payload.expectedVersion);
      const params: unknown[] = [componentId ?? reservationId, state.status, command.ledgerTransactionId, command.commandId, command.acceptedAt];
      const preparing = command.operation === "PREPARE_RESERVATION" || command.operation === "PREPARE";
      const preparation = preparing ? ",release_prepared_at=$6,release_prepared_by=$7" : "";
      if (preparing) params.push(payload.preparedAt ?? command.acceptedAt, command.actorUserId);
      const componentVersionClause = componentId && version !== null && Number.isSafeInteger(version) ? ` AND ledger_version=$${params.length + 1}` : "";
      if (componentVersionClause) params.push(version);
      if (reservationId && version !== null && Number.isSafeInteger(version)) {
        const reservation = await client.query("SELECT version FROM app.v2_reservations WHERE reservation_id=$1 FOR UPDATE", [reservationId]);
        if (!reservation.rows[0] || Number(reservation.rows[0].version) !== version) throw new Error("V2_PROJECTION_STATE_CONFLICT");
      }
      const updated = await client.query(`UPDATE app.v2_components SET inventory_status=$2${clear}${preparation},ledger_transaction_id=$3,last_projection_command_id=$4,updated_at=$5 WHERE ${where}${componentVersionClause}`, params);
      if (updated.rowCount === 0) throw new Error("V2_PROJECTION_STATE_CONFLICT");
      if (reservationId) {
        const reservationStatus: Record<string, string> = { PREPARE_RESERVATION: "PREPARED", PREPARE: "PREPARED", DISPATCH_RESERVATION: "DISPATCHED", DISPATCH: "DISPATCHED", START_RESERVATION_TRANSIT: "IN_TRANSIT", TRANSIT: "IN_TRANSIT", RECEIVE_RESERVATION: "RECEIVED", RECEIPT: "RECEIVED", COMPLETE_LOCAL_RELEASE: "RELEASED", CANCEL_RESERVATION: "CANCELLED", CANCEL: "CANCELLED", REJECT: "CANCELLED", COMPROMISE_RESERVATION: "COMPROMISED", COMPROMISE: "COMPROMISED", RESERVE_COMPONENTS: "RESERVED", RESERVE_LOCAL_RELEASE: "RESERVED", APPROVE: "RESERVED", DELAY: "IN_TRANSIT" };
        const nextStatus = reservationStatus[command.operation];
        if (nextStatus) await client.query("UPDATE app.v2_reservations SET status=$2,last_projection_command_id=$3,updated_at=$4,version=version+1 WHERE reservation_id=$1", [reservationId, nextStatus, command.commandId, command.acceptedAt]);
      }
      if (command.operation === "PLACE_RECONCILIATION_HOLD" || command.operation === "RESOLVE_RECONCILIATION_HOLD") {
        if (command.operation === "PLACE_RECONCILIATION_HOLD") {
          await client.query("INSERT INTO app.v2_reconciliation_cases(case_id,component_id,observed_status,previous_status,status,opened_by,institution_id,opened_at,expected_component_version,correlation_id,classification) VALUES($1,$2,$3,$4,'OPEN',$5,$6,$7,$8,$9,'SIMULATION_ONLY') ON CONFLICT(case_id) DO NOTHING", [payload.caseId, componentId, payload.observedStatus ?? "STATUS_MISMATCH", payload.previousStatus ?? "AVAILABLE", command.actorUserId, command.actorInstitutionId, command.acceptedAt, version ?? 1, command.correlationId]);
        } else {
          await client.query("UPDATE app.v2_reconciliation_cases SET status='RESOLVED',resolved_by=$2,resolved_at=$3,resolution_code=$4 WHERE case_id=$1 AND status='OPEN'", [payload.caseId, command.actorUserId, command.acceptedAt, payload.resolutionCode ?? null]);
        }
      }
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
}
