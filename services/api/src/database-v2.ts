import type { Pool } from "pg";
import { decryptDonationNumber, type DonationKeyring } from "./donation-crypto.js";
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
  donationNumber: string | null;
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

function mapRow(row: Row, keyring: DonationKeyring | undefined, roleId: string): V2ComponentProjection {
  let donationNumber: string | null = null;
  if (["ROLE-01", "ROLE-02"].includes(roleId) && keyring) {
    donationNumber = decryptDonationNumber({ ciphertext: String(row.donation_number_ciphertext), nonce: String(row.donation_number_nonce), authTag: String(row.donation_number_auth_tag), encryptionKeyVersion: String(row.donation_number_key_version) }, keyring);
  }
  return { componentId: String(row.component_id), donationId: String(row.donation_id), issuerInstitutionId: String(row.issuer_institution_id), componentType: String(row.component_type), bloodType: String(row.blood_type), collectedAt: new Date(String(row.collected_at)).toISOString(), expiresAt: new Date(String(row.expires_at)).toISOString(), institutionId: String(row.institution_id), inventoryStatus: String(row.inventory_status), reservationId: row.reservation_id === null || row.reservation_id === undefined ? null : String(row.reservation_id), reservationVersion: row.reservation_version === null || row.reservation_version === undefined ? null : Number(row.reservation_version), inventoryVersion: Number(row.ledger_version), donationNumber, policyVersion: String(row.policy_version), classification: "SIMULATION_ONLY" };
}

export class PostgresV2ProjectionReader implements V2ProjectionReader {
  constructor(private readonly pool: Pool, private readonly keyring?: DonationKeyring) {}
  private query = `SELECT c.component_id,c.donation_id,c.issuer_institution_id,c.component_type,c.blood_type,c.collected_at,c.expires_at,c.institution_id,c.inventory_status,c.reservation_id,c.ledger_version,c.policy_version,d.donation_number_ciphertext,d.donation_number_nonce,d.donation_number_auth_tag,d.donation_number_key_version,r.version AS reservation_version FROM app.v2_components c JOIN app.v2_donations d ON d.donation_id=c.donation_id LEFT JOIN app.v2_reservations r ON r.reservation_id=c.reservation_id WHERE c.institution_id=$1`;
  async listComponents(institutionId: string, roleId: string): Promise<V2ComponentProjection[]> { const result = await this.pool.query<Row>(`${this.query} ORDER BY c.expires_at,c.component_id`, [institutionId]); return result.rows.map((row) => mapRow(row, this.keyring, roleId)); }
  async getComponent(componentId: string, institutionId: string, roleId: string): Promise<V2ComponentProjection | null> { const result = await this.pool.query<Row>(`${this.query} AND c.component_id=$2`, [institutionId, componentId]); return result.rows[0] ? mapRow(result.rows[0], this.keyring, roleId) : null; }
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
    if (command.operation === "RECEIVE_INBOUND_COMPONENT") {
      const payload = command.payload;
      await this.pool.query("UPDATE app.v2_components SET inventory_status='RECEIVED',institution_id=$2,ledger_transaction_id=$3,updated_at=$4,ledger_version=ledger_version+1 WHERE reservation_id=$1 AND inventory_status='IN_TRANSIT'", [payload.reservationId, command.actorInstitutionId, command.ledgerTransactionId, command.acceptedAt]);
      await this.pool.query("UPDATE app.v2_reservations SET status='RECEIVED',updated_at=$2,version=version+1 WHERE reservation_id=$1 AND status='IN_TRANSIT'", [payload.reservationId, command.acceptedAt]);
      return;
    }
    if (["PREPARE_RESERVATION", "DISPATCH_RESERVATION", "START_RESERVATION_TRANSIT", "RECEIVE_RESERVATION", "COMPLETE_LOCAL_RELEASE", "CANCEL_RESERVATION", "PLACE_RECONCILIATION_HOLD", "RESOLVE_RECONCILIATION_HOLD", "EVALUATE_COMPONENT_EXPIRY", "COMPROMISE_RESERVATION", "APPROVE", "PREPARE", "DISPATCH", "TRANSIT", "RECEIPT", "DELAY", "COMPROMISE", "CANCEL", "REJECT", "RESERVE_LOCAL_RELEASE"].includes(command.operation)) return;
    if (!["REGISTER_COMPONENT", "REGISTER_INBOUND_COMPONENT"].includes(command.operation)) throw new Error("V2_PROJECTION_OPERATION_UNSUPPORTED");
    const payload = command.payload;
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      if (command.operation === "REGISTER_INBOUND_COMPONENT") {
        await client.query(`INSERT INTO app.v2_inbound_captures(capture_id,issuer_institution_id,custody_institution_id,donation_number_lookup_hmac,component_type,blood_type,capture_method,capture_policy_version,blood_type_evidence_source,component_evidence_source,ocr_engine,ocr_engine_version,donation_number_confidence,blood_type_confidence,collected_at,expires_at,captured_at,confirmed_at,event_time,status,resolution,correlation_id,classification,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,'OCR','INBOUND_OCR_V1',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'COMMITTED','REGISTERED',$18,'SIMULATION_ONLY',$19,$19) ON CONFLICT(capture_id) DO NOTHING`, [payload.captureId, payload.issuerInstitutionId, payload.custodyInstitutionId, payload.donationNoLookupHmac, payload.componentType, payload.bloodType, payload.bloodTypeEvidenceSource, payload.componentEvidenceSource, payload.ocrEngine, payload.ocrEngineVersion, payload.donationNumberConfidence, payload.bloodTypeConfidence, payload.collectedAt, payload.expiresAt, payload.capturedAt, payload.confirmedAt, payload.eventTime, command.correlationId, command.acceptedAt]);
      }
      await client.query(`INSERT INTO app.v2_donations(donation_id,issuer_institution_id,donation_number_ciphertext,donation_number_nonce,donation_number_auth_tag,donation_number_key_version,donation_number_lookup_hmac,created_by_user_id,created_at,updated_at,classification) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,'SIMULATION_ONLY') ON CONFLICT(donation_id) DO UPDATE SET updated_at=EXCLUDED.updated_at`, [payload.donationId, payload.issuerInstitutionId, payload.donationNoCiphertext, payload.donationNoNonce, payload.donationNoAuthTag, payload.donationNoEncryptionKeyVersion, payload.donationNoLookupHmac, command.actorUserId, command.acceptedAt]);
      await client.query(`INSERT INTO app.v2_components(component_id,donation_id,issuer_institution_id,donation_number_lookup_hmac,component_type,blood_type,collected_at,expires_at,institution_id,inventory_status,ledger_version,ledger_transaction_id,correlation_id,policy_version,created_at,updated_at,classification,inbound_capture_id,capture_method,blood_type_evidence_source,component_evidence_source) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'AVAILABLE',1,$10,$11,'INTERVIEW_DERIVED_CORE_V2',$12,$12,'SIMULATION_ONLY',$13,'OCR',$14,$15,$16) ON CONFLICT(component_id) DO NOTHING`, [payload.componentId, payload.donationId, payload.issuerInstitutionId, payload.donationNoLookupHmac, payload.componentType, payload.bloodType, payload.collectedAt, payload.expiresAt, payload.custodyInstitutionId ?? payload.issuerInstitutionId, command.ledgerTransactionId, command.correlationId, command.acceptedAt, payload.captureId ?? null, payload.bloodTypeEvidenceSource ?? null, payload.componentEvidenceSource ?? null]);
      if (command.operation === "REGISTER_INBOUND_COMPONENT" && payload.captureId) await client.query("UPDATE app.v2_inbound_captures SET component_id=$2,command_id=$3,status='COMMITTED',resolution='REGISTERED',updated_at=$4 WHERE capture_id=$1", [payload.captureId, payload.componentId, command.commandId, command.acceptedAt]);
      await client.query("COMMIT");
    } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  }
}
