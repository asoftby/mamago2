import { createHash } from "node:crypto";

import type {
  PhoenixEnvironment,
  PhoenixEnvironmentContext,
  SafeDatabaseFingerprint,
} from "./types";

export interface LoadPhoenixEnvironmentInput {
  environment: PhoenixEnvironment;
  confirmProduction: boolean;
  env?: NodeJS.ProcessEnv;
  currentDatabase?: (databaseUrl: string) => Promise<{ currentDatabase: string; schema: string }>;
}

function normalizedEnvironment(value: string | undefined): PhoenixEnvironment | null {
  const token = value?.trim().toUpperCase();
  if (token === "LOCAL" || token === "DEV" || token === "PROD") return token;
  if (token === "DEVELOPMENT" || token === "STAGING" || token === "PREVIEW") return "DEV";
  if (token === "PRODUCTION") return "PROD";
  return null;
}

function safeDatabaseUrl(raw: string): URL {
  try {
    return new URL(raw);
  } catch {
    throw new Error("DATABASE_URL is invalid.");
  }
}

export async function loadPhoenixEnvironment(
  input: LoadPhoenixEnvironmentInput,
): Promise<PhoenixEnvironmentContext> {
  const env = input.env ?? process.env;
  const appEnvironment = normalizedEnvironment(env.APP_ENV);
  const databaseEnvironment = normalizedEnvironment(env.PHOENIX_DATABASE_ENV);
  const storageEnvironment = normalizedEnvironment(env.PHOENIX_STORAGE_ENV);

  if (input.environment === "PROD" && !input.confirmProduction) {
    throw new Error("PRODUCTION_CONFIRMATION_REQUIRED");
  }
  if (appEnvironment !== input.environment) {
    throw new Error(`APP_ENV_MISMATCH: expected ${input.environment}, got ${appEnvironment ?? "UNSET"}.`);
  }
  if (databaseEnvironment !== input.environment) {
    throw new Error(`DATABASE_ENV_MISMATCH: expected ${input.environment}, got ${databaseEnvironment ?? "UNSET"}.`);
  }
  if (storageEnvironment !== input.environment) {
    throw new Error(`STORAGE_ENV_MISMATCH: expected ${input.environment}, got ${storageEnvironment ?? "UNSET"}.`);
  }
  if (env.MIGRATED_USER_ACTIVATION_EMAIL_ENABLED === "true") {
    throw new Error("EMAIL_GATE_OPEN: activation delivery must stay disabled during Phoenix content migration.");
  }
  if (input.environment !== "PROD" && env.SITE_INDEXING_ENABLED === "true") {
    throw new Error("INDEXING_GATE_OPEN: non-production Phoenix target must not be indexable.");
  }
  if (
    input.environment === "PROD" &&
    (env.SITE_INDEXING_ENABLED !== "true" || env.SITE_NOINDEX_FORCE === "true")
  ) {
    throw new Error("PRODUCTION_INDEXING_GATE_MISMATCH");
  }

  const rawDatabaseUrl = env.DATABASE_URL;
  if (!rawDatabaseUrl) throw new Error("DATABASE_URL is required.");
  const url = safeDatabaseUrl(rawDatabaseUrl);
  const queried = input.currentDatabase
    ? await input.currentDatabase(rawDatabaseUrl)
    : { currentDatabase: url.pathname.replace(/^\//, ""), schema: url.searchParams.get("schema") ?? "public" };

  const database: SafeDatabaseFingerprint = {
    environment: input.environment,
    host: url.hostname,
    port: url.port || "5432",
    database: url.pathname.replace(/^\//, ""),
    schema: queried.schema,
    currentDatabase: queried.currentDatabase,
  };
  if (!database.database || database.database !== database.currentDatabase) {
    throw new Error("DATABASE_FINGERPRINT_MISMATCH");
  }

  const storageLocation = env.PHOENIX_STORAGE_LOCATION;
  const storageProvider = env.PHOENIX_STORAGE_PROVIDER;
  if (!storageLocation || !storageProvider) throw new Error("Storage fingerprint configuration is required.");

  return {
    environment: input.environment,
    database,
    storage: {
      environment: input.environment,
      provider: storageProvider,
      locationHash: createHash("sha256").update(storageLocation).digest("hex"),
    },
  };
}
