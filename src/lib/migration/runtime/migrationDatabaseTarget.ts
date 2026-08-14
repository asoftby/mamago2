/**
 * Fail-closed DATABASE_URL gate for Phoenix user/content importers.
 *
 * LOCAL golden remains the default: only `localhost|127.0.0.1:5433/mamago2`.
 * PROD is identified by the database name `prodmamago` (the SSH tunnel may
 * appear as `127.0.0.1:<ephemeral-port>/prodmamago`), never by guessing a
 * host. Every other target — including DEV `devmamago` — is refused.
 *
 * Writes to PROD additionally require `--confirm-production`,
 * `--confirm-writes`, and `--acknowledge-prod-user-import`. Activation
 * email must stay disabled. The guard never logs the URL.
 */

export const LOCAL_GOLDEN_DATABASE_NAME = "mamago2";
export const LOCAL_GOLDEN_PORT = "5433";
export const PROD_DATABASE_NAME = "prodmamago";
export const DEV_DATABASE_NAME = "devmamago";

export type MigrationDatabaseTargetKind = "LOCAL_GOLDEN" | "PROD" | "UNKNOWN";

export interface ParsedMigrationDatabaseUrl {
  hostname: string;
  port: string;
  database: string;
}

export interface AssertMigrationDatabaseTargetInput {
  databaseUrl: string | undefined;
  confirmProduction?: boolean;
  confirmWrites?: boolean;
  acknowledgeProdUserImport?: boolean;
  /** When provided, must equal the URL pathname database name. */
  currentDatabase?: string | null;
  env?: Record<string, string | undefined>;
  /**
   * User-importer production writes need the extra acknowledgement flag.
   * Content importers that only need host/db identity can set this false.
   */
  requireProdUserAcknowledgement?: boolean;
}

export class MigrationDatabaseTargetError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = "MigrationDatabaseTargetError";
    this.code = code;
  }
}

export function parseMigrationDatabaseUrl(raw: string): ParsedMigrationDatabaseUrl {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new MigrationDatabaseTargetError("DATABASE_URL_INVALID", "DATABASE_URL is invalid.");
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, "")).split("/")[0] ?? "";
  return {
    hostname: url.hostname,
    port: url.port || "5432",
    database,
  };
}

export function classifyMigrationDatabaseTarget(parsed: ParsedMigrationDatabaseUrl): MigrationDatabaseTargetKind {
  const host = parsed.hostname.toLowerCase();
  const isLoopback = host === "localhost" || host === "127.0.0.1";
  if (
    isLoopback &&
    parsed.port === LOCAL_GOLDEN_PORT &&
    parsed.database === LOCAL_GOLDEN_DATABASE_NAME
  ) {
    return "LOCAL_GOLDEN";
  }
  if (parsed.database === PROD_DATABASE_NAME) {
    return "PROD";
  }
  return "UNKNOWN";
}

export function assertMigrationDatabaseTarget(input: AssertMigrationDatabaseTargetInput): MigrationDatabaseTargetKind {
  if (!input.databaseUrl) {
    throw new MigrationDatabaseTargetError("DATABASE_URL_REQUIRED", "DATABASE_URL is required.");
  }

  const parsed = parseMigrationDatabaseUrl(input.databaseUrl);
  const kind = classifyMigrationDatabaseTarget(parsed);
  const env = input.env ?? (process.env as Record<string, string | undefined>);
  const requireAck = input.requireProdUserAcknowledgement !== false;

  if (kind === "UNKNOWN") {
    if (parsed.database === DEV_DATABASE_NAME) {
      throw new MigrationDatabaseTargetError(
        "DEV_DATABASE_REFUSED",
        "DEV database is not an allowed Phoenix user-import target.",
      );
    }
    throw new MigrationDatabaseTargetError(
      "LOCAL_DB_GATE_FAILED",
      "only localhost:5433/mamago2 is allowed without explicit production confirmation.",
    );
  }

  if (kind === "LOCAL_GOLDEN") {
    if (input.currentDatabase && input.currentDatabase !== LOCAL_GOLDEN_DATABASE_NAME) {
      throw new MigrationDatabaseTargetError(
        "DATABASE_FINGERPRINT_MISMATCH",
        "Connected database name does not match the URL database name.",
      );
    }
    return kind;
  }

  // PROD
  if (!input.confirmProduction) {
    throw new MigrationDatabaseTargetError(
      "PRODUCTION_CONFIRMATION_REQUIRED",
      "Production database target requires --confirm-production.",
    );
  }
  if (input.currentDatabase && input.currentDatabase !== PROD_DATABASE_NAME) {
    throw new MigrationDatabaseTargetError(
      "DATABASE_FINGERPRINT_MISMATCH",
      "Connected database name does not match prodmamago.",
    );
  }
  if (env.MIGRATED_USER_ACTIVATION_EMAIL_ENABLED === "true") {
    throw new MigrationDatabaseTargetError(
      "EMAIL_GATE_OPEN",
      "activation delivery must stay disabled during Phoenix user import.",
    );
  }
  if (input.confirmWrites) {
    if (requireAck && !input.acknowledgeProdUserImport) {
      throw new MigrationDatabaseTargetError(
        "PROD_USER_IMPORT_ACK_REQUIRED",
        "Production user writes require --acknowledge-prod-user-import.",
      );
    }
  }
  return kind;
}

/** Backward-compatible LOCAL-only wrapper used by existing helper scripts. */
export function assertLocalDatabaseUrl(raw: string | undefined): void {
  assertMigrationDatabaseTarget({
    databaseUrl: raw,
    confirmProduction: false,
    confirmWrites: false,
    requireProdUserAcknowledgement: false,
  });
}
