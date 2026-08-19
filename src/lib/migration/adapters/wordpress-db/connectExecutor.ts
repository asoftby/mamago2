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
  const encodedSql = Buffer.from(sql, "utf8").toString("base64");
  return [
    "set -euo pipefail",
    "umask 177",
    'CNF="$(mktemp)"',
    'trap \'rm -f "$CNF"\' EXIT',
    'cat > "$CNF"',
    `printf '%s' '${encodedSql}' | base64 --decode | mysql --defaults-extra-file="$CNF"`,
  ].join("\n");
}

/**
 * OpenSSH connection multiplexing — the first call in a run pays for one
 * real TCP+KEX+banner+auth handshake and opens a background control
 * socket; every subsequent call (this adapter makes several per
 * discovery — posts, postmeta, terms, place index, each its own
 * `runSshMysqlCommand` today) reuses that already-authenticated
 * connection as a lightweight multiplexed channel instead of repeating
 * the full handshake. This is what actually fixes repeated
 * "Connection timed out during banner exchange" failures under frequent
 * new connections — it isn't a workaround layered on top, it removes the
 * repeated-handshake load that was straining the remote sshd.
 *
 * `%C` is OpenSSH's own hash token (local host + remote host + port +
 * user) — used instead of hand-building a path from `config` so the
 * socket path is guaranteed unique per real connection target, and —
 * since it's derived only from host/user, never from `dbPassword` — never
 * contains anything secret. `%C` is a full 40-char SHA1 hex digest, *not*
 * truncated by OpenSSH, so the surrounding path still has to stay short:
 * Unix domain socket paths are capped at 104 bytes (macOS) / 108 (Linux).
 * `os.tmpdir()` was tried first and hit this exact limit on macOS — its
 * per-user temp dir (`/var/folders/<xx>/<random>/T/`) alone is already
 * ~45+ bytes, leaving no room for a 40-char hash plus a filename. `/tmp`
 * directly is short, stable, and available on both platforms this project
 * targets (macOS dev, Linux CI/deploy), which is why real-world OpenSSH
 * `ControlPath` examples almost always hardcode it rather than compute a
 * tmpdir.
 */
const SSH_CONTROL_PATH = "/tmp/phx-wp-%C";
const SSH_CONTROL_PERSIST = "60s";

/** Full `ssh` argv, for tests to assert the password never appears there. */
export function buildSshArgs(config: WordPressDbConfig, remoteScript: string): string[] {
  return [
    "-o",
    "BatchMode=yes",
    "-o",
    "ConnectTimeout=15",
    "-o",
    "ControlMaster=auto",
    "-o",
    `ControlPath=${SSH_CONTROL_PATH}`,
    "-o",
    `ControlPersist=${SSH_CONTROL_PERSIST}`,
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
/**
 * A multi-byte UTF-8 character (e.g. any Cyrillic letter) can be split
 * across two separate stream `"data"` chunks — decoding each chunk with
 * `Buffer.toString()` independently corrupts the split character into the
 * U+FFFD replacement character, silently mangling any sufficiently large
 * response and making `sourceHash` (computed from this same output)
 * nondeterministic between runs. Concatenating the raw bytes first and
 * decoding exactly once avoids splitting any multi-byte sequence.
 */
export function concatBuffersToUtf8(chunks: readonly Buffer[]): string {
  return Buffer.concat(chunks).toString("utf8");
}

export function runSshMysqlCommand(config: WordPressDbConfig, remoteScript: string): Promise<string> {
  const cnfContent = buildMysqlClientConfig(config);
  const args = buildSshArgs(config, remoteScript);

  return new Promise((resolve, reject) => {
    const child = spawn("ssh", args, { stdio: ["pipe", "pipe", "pipe"] });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    child.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk) => stderrChunks.push(chunk));
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolve(concatBuffersToUtf8(stdoutChunks));
      } else {
        reject(new Error(`ssh exited with code ${code}: ${concatBuffersToUtf8(stderrChunks).trim()}`));
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

/**
 * Reverses MySQL's tab-separated batch-mode output escaping. When `mysql`
 * writes to a non-tty (this executor always does — one query per SSH round
 * trip, output is always piped), it escapes NUL, backslash, tab, newline,
 * and carriage return inside cell values with a leading backslash so the
 * real tab/newline bytes that separate columns/rows stay unambiguous.
 * `parseTabularRows` already splits correctly on those real bytes (an
 * escaped `\n` inside a value is two literal characters, not a newline
 * byte, so it never breaks line-splitting) — but until this ran, the
 * escaped-inside-a-value sequences themselves were never converted back:
 * every downstream consumer saw the literal two characters `\` `n` instead
 * of a line break. Confirmed on live data: 97/97 imported RouteStop notes
 * had literal `\n` in place of real line breaks.
 */
export function unescapeMysqlBatchValue(value: string): string {
  return value.replace(/\\(.)/g, (match, char: string) => {
    switch (char) {
      case "0":
        return "\0";
      case "n":
        return "\n";
      case "t":
        return "\t";
      case "r":
        return "\r";
      case "\\":
        return "\\";
      default:
        return match;
    }
  });
}

function coerceCell(column: string, raw: string): unknown {
  if (raw === "NULL") return null;
  const unescaped = unescapeMysqlBatchValue(raw);
  if (NUMERIC_COLUMNS.has(column)) {
    const parsed = Number(unescaped);
    return Number.isFinite(parsed) ? parsed : unescaped;
  }
  return unescaped;
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

// ---------------------------------------------------------------------------
// Bounded retry — read-only WP queries only, and only for the specific SSH
// banner-exchange/connection-timeout signature that motivated this (see
// PR33). An auth failure or a mysql/SQL error is not transient — retrying
// either would just repeat the same failure slower, so both still fail on
// the first attempt, same as before. mamaGo write-side (Prisma) calls are
// never wrapped in this — this module has no idea they exist.
// ---------------------------------------------------------------------------

const DEFAULT_MAX_SSH_ATTEMPTS = 3;
const DEFAULT_SSH_RETRY_DELAY_MS = 500;

export interface SshRetryOptions {
  maxAttempts?: number;
  /** Base delay; attempt N waits `delayMs * N`. Tests pass `0` to stay fast. */
  delayMs?: number;
}

/** Matches only the specific failure `runSshMysqlCommand` surfaces for a stalled/rejected handshake — not auth failures, not mysql/SQL errors. */
function isBannerExchangeTimeout(message: string): boolean {
  return /banner exchange/i.test(message) || /connection timed out/i.test(message);
}

/**
 * Retries `attempt()` up to `maxAttempts` times, but only when the thrown
 * error's message matches `isBannerExchangeTimeout` — every other failure
 * (wrong key, rejected auth, a real SQL error) propagates immediately on
 * the first attempt, exactly as before this PR. Exported standalone (not
 * baked into `runSshMysqlCommand`) specifically so it's unit-testable with
 * a fake `attempt()` — no real SSH process needed to prove the retry
 * boundary is correct.
 */
export async function withSshBannerTimeoutRetry<T>(
  attempt: () => Promise<T>,
  options: SshRetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_SSH_ATTEMPTS;
  const delayMs = options.delayMs ?? DEFAULT_SSH_RETRY_DELAY_MS;

  let lastError = new Error("withSshBannerTimeoutRetry: attempt() was never called");
  for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber++) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const isLastAttempt = attemptNumber === maxAttempts;
      if (!isBannerExchangeTimeout(lastError.message) || isLastAttempt) {
        throw lastError;
      }
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attemptNumber));
      }
    }
  }
  throw lastError;
}

/**
 * Builds a `WordPressQueryExecutor` backed by SSH + `mysql
 * --defaults-extra-file`. One query, one SSH round trip (now multiplexed —
 * see `buildSshArgs`'s `ControlMaster`/`ControlPersist` — so "one round
 * trip" no longer means "one full handshake" after the first call). On
 * failure, the rejection message includes the manual-fallback instructions
 * (no secrets) so a human can re-run the exact query by hand. A banner-
 * exchange/connection-timeout failure specifically gets a bounded retry
 * first (`withSshBannerTimeoutRetry`) before that fallback message is ever
 * shown.
 */
export function createWordPressSshMysqlExecutor(config: WordPressDbConfig): WordPressQueryExecutor {
  return async <T>(query: string, params: readonly unknown[] = []): Promise<T[]> => {
    const boundSql = bindQueryParams(query, params);
    const remoteScript = buildRemoteScript(boundSql);

    let stdout: string;
    try {
      stdout = await withSshBannerTimeoutRetry(() => runSshMysqlCommand(config, remoteScript));
    } catch (error) {
      const original = error instanceof Error ? error.message : String(error);
      throw new Error(`${original}\n${buildManualFallbackMessage(config, remoteScript)}`);
    }

    return parseTabularRows<T>(stdout);
  };
}
