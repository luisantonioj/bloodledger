import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { provisionSyntheticAccount, type InstitutionCategory, type SyntheticAccountInput } from "./synthetic-account.js";
import type { RoleId } from "./web-access.js";

const environmentPath = fileURLToPath(new URL("../../../../.env", import.meta.url));
if (existsSync(environmentPath)) process.loadEnvFile(environmentPath);

const required = [
  "POSTGRES_DB", "POSTGRES_MIGRATOR_USER", "POSTGRES_MIGRATOR_PASSWORD",
  "SPRINT5_DEV_INSTITUTION_ID", "SPRINT5_DEV_INSTITUTION_DISPLAY_NAME", "SPRINT5_DEV_INSTITUTION_CATEGORY",
  "SPRINT5_DEV_USER_ID", "SPRINT5_DEV_USERNAME", "SPRINT5_DEV_USER_DISPLAY_NAME", "SPRINT5_DEV_ROLE_ID", "SPRINT5_DEV_PASSWORD",
] as const;
for (const name of required) if (!process.env[name]) throw new Error(`${name} must be set in the untracked environment`);

const input: SyntheticAccountInput = {
  institutionId: process.env.SPRINT5_DEV_INSTITUTION_ID!,
  institutionDisplayName: process.env.SPRINT5_DEV_INSTITUTION_DISPLAY_NAME!,
  institutionCategory: process.env.SPRINT5_DEV_INSTITUTION_CATEGORY as InstitutionCategory,
  userId: process.env.SPRINT5_DEV_USER_ID!,
  username: process.env.SPRINT5_DEV_USERNAME!,
  userDisplayName: process.env.SPRINT5_DEV_USER_DISPLAY_NAME!,
  roleId: process.env.SPRINT5_DEV_ROLE_ID as RoleId,
  password: process.env.SPRINT5_DEV_PASSWORD!,
};
const pool = new Pool({
  host: "127.0.0.1",
  port: Number(process.env.POSTGRES_HOST_PORT ?? "5432"),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_MIGRATOR_USER,
  password: process.env.POSTGRES_MIGRATOR_PASSWORD,
  max: 1,
  application_name: "bloodledger_sprint5_account_provisioner",
});
try {
  const result = await provisionSyntheticAccount(pool, input);
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await pool.end();
}
