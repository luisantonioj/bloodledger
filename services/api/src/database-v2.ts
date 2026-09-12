import type { Pool } from "pg";
import { decryptDonationNumber, type DonationKeyring } from "./donation-crypto.js";

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
  donationNumber: string | null;
  policyVersion: string;
  classification: "SIMULATION_ONLY";
}

export interface V2ProjectionReader {
  listComponents(institutionId: string, roleId: string): Promise<V2ComponentProjection[]>;
  getComponent(componentId: string, institutionId: string, roleId: string): Promise<V2ComponentProjection | null>;
}

type Row = Record<string, unknown>;

function mapRow(row: Row, keyring: DonationKeyring | undefined, roleId: string): V2ComponentProjection {
  let donationNumber: string | null = null;
  if (["ROLE-01", "ROLE-02"].includes(roleId) && keyring) {
    donationNumber = decryptDonationNumber({ ciphertext: String(row.donation_number_ciphertext), nonce: String(row.donation_number_nonce), authTag: String(row.donation_number_auth_tag), encryptionKeyVersion: String(row.donation_number_key_version) }, keyring);
  }
  return { componentId: String(row.component_id), donationId: String(row.donation_id), issuerInstitutionId: String(row.issuer_institution_id), componentType: String(row.component_type), bloodType: String(row.blood_type), collectedAt: new Date(String(row.collected_at)).toISOString(), expiresAt: new Date(String(row.expires_at)).toISOString(), institutionId: String(row.institution_id), inventoryStatus: String(row.inventory_status), reservationId: row.reservation_id === null || row.reservation_id === undefined ? null : String(row.reservation_id), donationNumber, policyVersion: String(row.policy_version), classification: "SIMULATION_ONLY" };
}

export class PostgresV2ProjectionReader implements V2ProjectionReader {
  constructor(private readonly pool: Pool, private readonly keyring?: DonationKeyring) {}
  private query = `SELECT c.component_id,c.donation_id,c.issuer_institution_id,c.component_type,c.blood_type,c.collected_at,c.expires_at,c.institution_id,c.inventory_status,c.reservation_id,c.policy_version,d.donation_number_ciphertext,d.donation_number_nonce,d.donation_number_auth_tag,d.donation_number_key_version FROM app.v2_components c JOIN app.v2_donations d ON d.donation_id=c.donation_id WHERE c.institution_id=$1`;
  async listComponents(institutionId: string, roleId: string): Promise<V2ComponentProjection[]> { const result = await this.pool.query<Row>(`${this.query} ORDER BY c.expires_at,c.component_id`, [institutionId]); return result.rows.map((row) => mapRow(row, this.keyring, roleId)); }
  async getComponent(componentId: string, institutionId: string, roleId: string): Promise<V2ComponentProjection | null> { const result = await this.pool.query<Row>(`${this.query} AND c.component_id=$2`, [institutionId, componentId]); return result.rows[0] ? mapRow(result.rows[0], this.keyring, roleId) : null; }
}
