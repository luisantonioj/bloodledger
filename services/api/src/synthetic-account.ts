import { randomBytes } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { deriveVerifier, verifyPassword, type CredentialRecord } from "./session.js";
import { isRoleId, type RoleId } from "./web-access.js";

export type InstitutionCategory = "HOSPITAL" | "REGULATOR" | "SYSTEM";

export interface SyntheticAccountInput {
  institutionId: string;
  institutionDisplayName: string;
  institutionCategory: InstitutionCategory;
  userId: string;
  username: string;
  userDisplayName: string;
  roleId: RoleId;
  password: string;
}

export interface ProvisionedSyntheticAccount {
  created: boolean;
  institutionId: string;
  userId: string;
  username: string;
  roleId: RoleId;
  classification: "SIMULATION_ONLY";
}

type Row = Record<string, unknown>;

function validateInput(input: SyntheticAccountInput): void {
  if (!/^INST_[A-Z0-9_-]{1,59}$/.test(input.institutionId)) throw new Error("Synthetic institution ID is invalid.");
  if (!/^Synthetic [A-Za-z0-9 -]{1,86}$/.test(input.institutionDisplayName)) throw new Error("Synthetic institution display name is invalid.");
  if (!["HOSPITAL", "REGULATOR", "SYSTEM"].includes(input.institutionCategory)) throw new Error("Synthetic institution category is invalid.");
  if (!/^USR_[A-Z0-9_-]{1,48}$/.test(input.userId)) throw new Error("Synthetic user ID is invalid.");
  if (!/^synth_[a-z0-9_]{3,57}$/.test(input.username)) throw new Error("Synthetic username is invalid.");
  if (!/^Synthetic [A-Za-z0-9 -]{1,86}$/.test(input.userDisplayName)) throw new Error("Synthetic user display name is invalid.");
  if (!isRoleId(input.roleId)) throw new Error("Synthetic role is invalid.");
  if (input.password.length < 12 || input.password.length > 128) throw new Error("Synthetic password must contain 12 to 128 characters.");

  const validScope = (["ROLE-01", "ROLE-02"] as RoleId[]).includes(input.roleId)
    ? input.institutionId === "INST_MEDIATRIX" && input.institutionCategory === "HOSPITAL"
    : input.roleId === "ROLE-03"
      ? input.institutionId !== "INST_MEDIATRIX" && input.institutionCategory === "HOSPITAL"
      : input.roleId === "ROLE-04"
        ? input.institutionCategory === "REGULATOR"
        : input.roleId === "ROLE-05"
          ? input.institutionCategory === "SYSTEM"
          : input.institutionCategory === "HOSPITAL";
  if (!validScope) throw new Error("Synthetic role and institution scope are incompatible.");
}

async function transaction<T>(pool: Pool, action: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await action(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function provisionSyntheticAccount(pool: Pool, input: SyntheticAccountInput): Promise<ProvisionedSyntheticAccount> {
  validateInput(input);
  return transaction(pool, async (client) => {
    await client.query(
      `INSERT INTO app.institutions(institution_id,display_name,category,status,classification)
       VALUES($1,$2,$3,'ACTIVE','SIMULATION_ONLY') ON CONFLICT (institution_id) DO NOTHING`,
      [input.institutionId, input.institutionDisplayName, input.institutionCategory],
    );
    const institution = await client.query<Row>(
      "SELECT display_name,category,status,classification FROM app.institutions WHERE institution_id=$1 FOR UPDATE",
      [input.institutionId],
    );
    const institutionRow = institution.rows[0];
    if (!institutionRow || institutionRow.display_name !== input.institutionDisplayName || institutionRow.category !== input.institutionCategory || institutionRow.status !== "ACTIVE" || institutionRow.classification !== "SIMULATION_ONLY") {
      throw new Error("Synthetic institution already exists with conflicting metadata.");
    }

    const existing = await client.query<Row>(
      "SELECT user_id,username,display_name,institution_id,password_salt,password_verifier,status,classification FROM app.application_users WHERE user_id=$1 OR username=$2 FOR UPDATE",
      [input.userId, input.username],
    );
    let created = false;
    if (existing.rows.length === 0) {
      const saltHex = randomBytes(16).toString("hex");
      const verifierHex = await deriveVerifier(input.password, saltHex);
      await client.query(
        `INSERT INTO app.application_users(user_id,username,display_name,institution_id,password_algorithm,password_salt,password_verifier,status,classification)
         VALUES($1,$2,$3,$4,'SCRYPT_V1',$5,$6,'ACTIVE','SIMULATION_ONLY')`,
        [input.userId, input.username, input.userDisplayName, input.institutionId, saltHex, verifierHex],
      );
      created = true;
    } else {
      if (existing.rows.length !== 1) throw new Error("Synthetic user ID or username conflicts with another account.");
      const row = existing.rows[0];
      if (row.user_id !== input.userId || row.username !== input.username || row.display_name !== input.userDisplayName || row.institution_id !== input.institutionId || row.status !== "ACTIVE" || row.classification !== "SIMULATION_ONLY") {
        throw new Error("Synthetic account already exists with conflicting metadata.");
      }
      const credential: CredentialRecord = {
        userId: input.userId,
        username: input.username,
        displayName: input.userDisplayName,
        institutionId: input.institutionId,
        institutionDisplayName: input.institutionDisplayName,
        institutionCategory: input.institutionCategory,
        roleId: input.roleId,
        saltHex: String(row.password_salt),
        verifierHex: String(row.password_verifier),
      };
      if (!await verifyPassword(input.password, credential)) throw new Error("Synthetic account already exists with a different credential.");
    }

    await client.query(
      `INSERT INTO app.user_role_assignments(user_id,role_id,policy_version)
       VALUES($1,$2,'SYNTHETIC_WEB_ACCESS_V1') ON CONFLICT (user_id) DO NOTHING`,
      [input.userId, input.roleId],
    );
    const assignment = await client.query<Row>("SELECT role_id,policy_version FROM app.user_role_assignments WHERE user_id=$1", [input.userId]);
    if (assignment.rows[0]?.role_id !== input.roleId || assignment.rows[0]?.policy_version !== "SYNTHETIC_WEB_ACCESS_V1") {
      throw new Error("Synthetic account already has a conflicting role assignment.");
    }
    return { created, institutionId: input.institutionId, userId: input.userId, username: input.username, roleId: input.roleId, classification: "SIMULATION_ONLY" };
  });
}
