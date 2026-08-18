export interface ApiConfig {
  port: number;
  host: string;
  jwtSecret: string;
  operatorId: string;
  operatorCredential: string;
  captureDist?: string;
  workerConfigured: boolean;
}

export function readApiConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  const jwtSecret = environment.SPRINT4_JWT_SECRET ?? "";
  const operatorCredential = environment.SPRINT4_OPERATOR_CREDENTIAL ?? "";
  const operatorId = environment.SPRINT4_OPERATOR_ID ?? "USR_SYNTH_CAPTURE";
  if (jwtSecret.length < 32) throw new Error("SPRINT4_JWT_SECRET must contain at least 32 characters");
  if (operatorCredential.length < 12) throw new Error("SPRINT4_OPERATOR_CREDENTIAL must contain at least 12 characters");
  if (!/^USR_[A-Z0-9_-]{1,48}$/.test(operatorId)) throw new Error("SPRINT4_OPERATOR_ID is invalid");
  return {
    port: Number(environment.API_PORT ?? "3000"),
    host: environment.API_HOST ?? "127.0.0.1",
    jwtSecret,
    operatorId,
    operatorCredential,
    captureDist: environment.CAPTURE_PWA_DIST,
    workerConfigured: environment.FABRIC_SYNC_ENABLED === "true",
  };
}
