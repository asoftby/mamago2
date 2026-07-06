/**
 * Shared SSH + `mysql --defaults-extra-file` plumbing for talking to the
 * live WordPress database. This is the one place that opens a connection —
 * `WordPressRepository` never does (see WordPressRepository.ts), and every
 * caller (the inspect CLI, the preview CLI, and eventually a future commit
 * step) is expected to build its executor through here instead of
 * re-implementing SSH/mysql wiring.
 *
 * Safety principles carried over from the original
 * scripts/migration-inspect-wordpress-db.ts implementation, preserved
 * verbatim:
 * - No SSH password support — key/agent auth only, `BatchMode=yes`.
 * - The MySQL password never appears as a `-p...` argv on either host: it
 *   is piped over the SSH session's stdin as `[client]` config content,
 *   written remotely into a `mktemp` file created under `umask 177`
 *   (0600 from the instant it exists), consumed via
 *   `mysql --defaults-extra-file=...`, and removed via a shell `trap`.
 * - Hosts are masked in every error/log message.
 * - On SSH failure, no automatic password-prompt fallback is attempted —
 *   the manual command a human can run themselves is surfaced instead.
 */
import { spawn } from "node:child_process";

import type { WordPressQueryExecutor } from "./WordPressRepository";
import type { WordPressDbConfig } from "./types";

const REQUIRED_ENV_KEYS = [
  "WP_SSH_HOST",
  "WP_SSH_USER",
  "WP_DB_NAME",
  "WP_DB_USER",
  "WP_DB_PASSWORD",
] as const;

export function readWordPressDbConfigFromEnv(env: NodeJS.ProcessEnv): WordPressDbConfig {
  const missing = REQUIRED_ENV_KEYS.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }

  return {
    sshHost: env.WP_SSH_HOST!,
    sshUser: env.WP_SSH_USER!,
    dbName: env.WP_DB_NAME!,
    dbUser: env.WP_DB_USER!,
    dbPassword: env.WP_DB_PASSWORD!,
    tablePrefix: env.WP_DB_TABLE_PREFIX,
  };
}

export function maskHost(host: string): string {
  const parts = host.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.**`;
  }
  return host.length <= 4 ? "***" : `${host.slice(0, 2)}***${host.slice(-2)}`;
}

const LOCALHOST_NAMES = new Set(["localhost", "127.0.0.1"]);

export function isLocalHost(host: string): boolean {
  return LOCALHOST_NAMES.has(host);
}

/** Throws unless the host is localhost or the caller explicitly opted into remote read-only access. */
export function assertRemoteAccessAllowed(
  config: WordPressDbConfig,
  allowRemoteReadonly: boolean,
): void {
  if (!isLocalHost(config.sshHost) && !allowRemoteReadonly) {
    throw new Error(
      `WP_SSH_HOST (${maskHost(config.sshHost)}) is not localhost. Pass --allow-remote-readonly to confirm you intend to run read-only queries against a remote host.`,
    );
  }
}

/** `[client]` config file content for `mysql --defaults-extra-file`. */
export function buildMysqlClientConfig(
  config: Pick<WordPressDbConfig, "dbUser" | "dbPassword" | "dbName">,
): string {
  const escape = (value: string) => value.replace(/"/g, '\\"');
  return [
    "[client]",
    `user="${escape(config.dbUser)}"`,
    `password="${escape(config.dbPassword)}"`,
    `database="${escape(config.dbName)}"`,
    "host=127.0.0.1",
    "port=3306",
    "protocol=TCP",
    "",
  ].join("\n");
}

/** The remote shell script text for a single already-fully-substituted SQL statement. Contains no secrets. */
export function buildRemoteScript(sql: string): string {
  return [
    "set -euo pipefail",
    "umask 177",
    'CNF="$(mktemp)"',
    'trap \'rm -f "$CNF"\' EXIT',
    'cat > "$CNF"',
    `mysql --defaults-extra-file="$CNF" -e "${sql.replace(/"/g, '\\"')}"`,
  ].join("\n");
}

/** Full `ssh` argv, for tests to assert the password never appears there. */
export function buildSshArgs(config: WordPressDbConfig, remoteScript: string): string[] {
  return [
    "-o",
    "BatchMode=yes",
    "-o",
    "ConnectTimeout=15",
    `${config.sshUser}@${config.sshHost}`,
    remoteScript,
  ];
}

export function buildManualFallbackMessage(config: WordPressDbConfig, remoteScript: string): string {
  return [
    "",
    "Automatic run failed: SSH batch-mode (key/agent) auth did not succeed.",
    "This never falls back to a password prompt on purpose. Run it yourself in your own " +
      "terminal, where an interactive SSH password prompt (if needed) works normally.",
    "The remote script below is safe to read/copy — it contains no secrets, only the " +
      "read-only SQL and the mktemp/umask/trap plumbing.",
    "",
    "Remote script (pass as the ssh command argument, not via stdin):",
    "",
    remoteScript,
    "",
    "Pipe the mysql client config via stdin (values from your own shell env, never printed " +
      "here), keeping the script itself as the ssh command argument — do not combine both " +
      "through the same stdin stream:",
    "",
    '  printf \'[client]\\nuser="%s"\\npassword="%s"\\ndatabase="%s"\\nhost=127.0.0.1\\nport=3306\\nprotocol=TCP\\n\' \\',
    '    "$WP_DB_USER" "$WP_DB_PASSWORD" "$WP_DB_NAME" \\',
    `    | ssh ${config.sshUser}@${config.sshHost} "$(cat <<'REMOTE_SCRIPT'`,
    remoteScript,
    'REMOTE_SCRIPT\n)"',
    "",
  ].join("\n");
}

/**
 * Runs one already-built remote shell script (see `buildRemoteScript`) over
 * SSH and returns raw stdout. One SSH round trip per call — no batching of
 * unrelated queries into a single connection.
 */
export function runSshMysqlCommand(config: WordPressDbConfig, remoteScript: string): Promise<string> {
  const cnfContent = buildMysqlClientConfig(config);
  const args = buildSshArgs(config, remoteScript);

  return new Promise((resolve, reject) => {
    const child = spawn("ssh", args, { stdio: ["pipe", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`ssh exited with code ${code}: ${stderr.trim()}`));
      }
    });

    child.stdin.on("error", () => {
      /* EPIPE if ssh already failed — surfaced via the close handler instead */
    });
    child.stdin.write(cnfContent);
    child.stdin.end();
  });
}

// ---------------------------------------------------------------------------
// Parameter binding — the classic `mysql -e` CLI has no native placeholder
// binding, so bound `?` params are substituted into literal, escaped SQL
// text ourselves before the statement ever leaves this process. Callers
// (sql.ts) never interpolate values themselves; this is the one place that
// turns a bound param into SQL text.
// ---------------------------------------------------------------------------

function escapeMysqlStringLiteral(value: string): string {
  return value.replace(/[\0\n\r\b\t\x1a\\'"]/g, (char) => {
    switch (char) {
      case "\0":
        return "\\0";
      case "\n":
        return "\\n";
      case "\r":
        return "\\r";
      case "\b":
        return "\\b";
      case "\t":
        return "\\t";
      case "\x1a":
        return "\\Z";
      case "\\":
        return "\\\\";
      case "'":
        return "\\'";
      case '"':
        return '\\"';
      default:
        return char;
    }
  });
}

function formatSqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Refusing to bind non-finite number param: ${value}`);
    }
    return String(value);
  }
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${escapeMysqlStringLiteral(String(value))}'`;
}

/** Substitutes `?` placeholders (in order) with escaped literal SQL values. */
export function bindQueryParams(sql: string, params: readonly unknown[] = []): string {
  let index = 0;
  const bound = sql.replace(/\?/g, () => {
    if (index >= params.length) {
      throw new Error(`Not enough parameters for query: expected more than ${params.length}`);
    }
    return formatSqlLiteral(params[index++]);
  });

  if (index !== params.length) {
    throw new Error(`Too many parameters for query: ${params.length} given, ${index} used`);
  }

  return bound;
}

// ---------------------------------------------------------------------------
// Tabular output parsing — a single `mysql -e "<one query>"` call (when
// stdout isn't a tty, which is always true here) prints one header line
// followed by one tab-separated line per row. `NULL` is MySQL's literal
// text for SQL NULL. A small fixed allowlist of column names that this
// module's own SQL builders (sql.ts) are known to project as numeric is
// coerced to `number`; every other column stays a string, matching the
// WordPress*Row types in types.ts.
// ---------------------------------------------------------------------------

const NUMERIC_COLUMNS = new Set([
  "ID",
  "id",
  "post_author",
  "post_parent",
  "meta_id",
  "post_id",
  "term_id",
  "priority",
  "header_code",
  "hits",
  "lat",
  "lng",
]);

function coerceCell(column: string, raw: string): unknown {
  if (raw === "NULL") return null;
  if (NUMERIC_COLUMNS.has(column)) {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : raw;
  }
  return raw;
}

export function parseTabularRows<T>(raw: string): T[] {
  const lines = raw.split("\n").filter((line) => line.length > 0);
  if (lines.length === 0) return [];

  const header = lines[0].split("\t");
  return lines.slice(1).map((line) => {
    const values = line.split("\t");
    const row: Record<string, unknown> = {};
    header.forEach((column, i) => {
      row[column] = coerceCell(column, values[i] ?? "NULL");
    });
    return row as T;
  });
}

/**
 * Builds a `WordPressQueryExecutor` backed by SSH + `mysql
 * --defaults-extra-file`. One query, one SSH round trip. On failure, the
 * rejection message includes the manual-fallback instructions (no secrets)
 * so a human can re-run the exact query by hand.
 */
export function createWordPressSshMysqlExecutor(config: WordPressDbConfig): WordPressQueryExecutor {
  return async <T>(query: string, params: readonly unknown[] = []): Promise<T[]> => {
    const boundSql = bindQueryParams(query, params);
    const remoteScript = buildRemoteScript(boundSql);

    let stdout: string;
    try {
      stdout = await runSshMysqlCommand(config, remoteScript);
    } catch (error) {
      const original = error instanceof Error ? error.message : String(error);
      throw new Error(`${original}\n${buildManualFallbackMessage(config, remoteScript)}`);
    }

    return parseTabularRows<T>(stdout);
  };
}
