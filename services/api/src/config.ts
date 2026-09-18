export interface ApiConfig {
  port: number;
  host: string;
  jwtSecret: string;
  operatorId: string;
  operatorCredential: string;
  captureDist?: string;
  webDist?: string;
  workerConfigured: boolean;
  webOrigin?: string;
  webCookieSecure?: boolean;
  activeWriteApiVersion?: "v1" | "v2";
  v2EncryptionKeysConfigured?: boolean;
  activeForecastDatasetVersion?: ForecastDatasetVersion;
}

export const FORECAST_DATASET_VERSIONS = [
  "SYNTHETIC_FORECAST_V1",
  "SYNTHETIC_FORECAST_V4_RUNTIME_V1",
] as const;
export type ForecastDatasetVersion = (typeof FORECAST_DATASET_VERSIONS)[number];

export function readApiConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  const jwtSecret = environment.SPRINT4_JWT_SECRET ?? "";
  const operatorCredential = environment.SPRINT4_OPERATOR_CREDENTIAL ?? "";
  const operatorId = environment.SPRINT4_OPERATOR_ID ?? "USR_SYNTH_CAPTURE";
  if (jwtSecret.length < 32) throw new Error("SPRINT4_JWT_SECRET must contain at least 32 characters");
  if (operatorCredential.length < 12) throw new Error("SPRINT4_OPERATOR_CREDENTIAL must contain at least 12 characters");
  if (!/^USR_[A-Z0-9_-]{1,48}$/.test(operatorId)) throw new Error("SPRINT4_OPERATOR_ID is invalid");
  const activeForecastDatasetVersion = environment.BLOODLEDGER_ACTIVE_FORECAST_DATASET_VERSION ?? "SYNTHETIC_FORECAST_V4_RUNTIME_V1";
  if (!(FORECAST_DATASET_VERSIONS as readonly string[]).includes(activeForecastDatasetVersion)) {
    throw new Error("BLOODLEDGER_ACTIVE_FORECAST_DATASET_VERSION is not allowlisted");
  }
  return {
    port: Number(environment.API_PORT ?? "3000"),
    host: environment.API_HOST ?? "127.0.0.1",
    jwtSecret,
    operatorId,
    operatorCredential,
    captureDist: environment.CAPTURE_PWA_DIST,
    webDist: environment.WEB_DIST,
    workerConfigured: environment.FABRIC_SYNC_ENABLED === "true",
    webOrigin: environment.WEB_ORIGIN ?? "http://127.0.0.1:5174",
    webCookieSecure: environment.WEB_COOKIE_SECURE === undefined ? undefined : environment.WEB_COOKIE_SECURE === "true",
    activeWriteApiVersion: environment.BLOODLEDGER_ACTIVE_WRITE_API_VERSION === "v2" ? "v2" : "v1",
    v2EncryptionKeysConfigured: Boolean(environment.BLOODLEDGER_DONATION_ENCRYPTION_KEY && environment.BLOODLEDGER_DONATION_LOOKUP_KEY),
    activeForecastDatasetVersion: activeForecastDatasetVersion as ForecastDatasetVersion,
  };
}
