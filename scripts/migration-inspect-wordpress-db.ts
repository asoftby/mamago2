/**
 * Read-only inspection of the live WordPress MySQL database over SSH.
 *
 * This script NEVER imports data, never normalizes, never writes to any
 * database (WordPress or mamaGo), and never persists WordPress content to
 * disk beyond the aggregate/schema-level report requested with `--out`.
 *
 * Run: pnpm migration:inspect:wordpress-db [--allow-remote-readonly] [--out <path>]
 *
 * Required env vars (read from process.env only, never argv, never logged):
 *   WP_SSH_HOST, WP_SSH_USER, WP_DB_NAME, WP_DB_USER, WP_DB_PASSWORD
 *
 * SSH authentication is intentionally NOT handled by this script: it only
 * runs `ssh -o BatchMode=yes`, which succeeds only if ssh-agent/key auth is
 * already configured. There is no WP_SSH_PASSWORD env var and no password
 * prompt handling (no `expect`, no pty juggling) — if BatchMode auth fails,
 * this script prints the exact command for you to run by hand in your own
 * terminal (where an interactive password prompt works normally) instead of
 * attempting anything automatic.
 *
 * The MySQL password never appears as a `-p...` command-line argument on
 * either the local or remote host. It is delivered to the remote host as
 * `[client]` config content piped over the SSH session's stdin, written by
 * the remote shell into a `mktemp` file created under `umask 177` (so it is
 * 0600 from the instant it exists, no chmod race window), consumed via
 * `mysql --defaults-extra-file=...`, and removed via a shell `trap` on exit.
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const LOCALHOST_NAMES = new Set(["localhost", "127.0.0.1"]);

// ---------------------------------------------------------------------------
// SQL — hardcoded, read-only, never accepts arbitrary SQL from the caller.
// ---------------------------------------------------------------------------

interface SqlStep {
  label: string;
  sql: string;
}

const SQL_STEPS: readonly SqlStep[] = [
  { label: "database", sql: "SELECT DATABASE() AS db;" },
  { label: "tables", sql: "SHOW TABLES;" },
  {
    label: "post_type_status_counts",
    sql: "SELECT post_type, post_status, COUNT(*) AS count FROM wp_posts GROUP BY post_type, post_status ORDER BY post_type, post_status;",
  },
  { label: "postmeta_count", sql: "SELECT COUNT(*) AS postmeta_count FROM wp_postmeta;" },
  { label: "users_count", sql: "SELECT COUNT(*) AS users_count FROM wp_users;" },
  { label: "terms_count", sql: "SELECT COUNT(*) AS terms_count FROM wp_terms;" },
  {
    label: "voxel_index_post_columns",
    sql: "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='wp_voxel_index_post' ORDER BY ordinal_position;",
  },
  {
    label: "voxel_index_places_columns",
    sql: "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='wp_voxel_index_places' ORDER BY ordinal_position;",
  },
  {
    label: "top_postmeta_keys_post",
    sql: "SELECT meta_key, COUNT(*) AS c FROM wp_postmeta pm JOIN wp_posts p ON p.ID = pm.post_id WHERE p.post_type='post' GROUP BY meta_key ORDER BY c DESC LIMIT 30;",
  },
  {
    label: "top_postmeta_keys_places",
    sql: "SELECT meta_key, COUNT(*) AS c FROM wp_postmeta pm JOIN wp_posts p ON p.ID = pm.post_id WHERE p.post_type='places' GROUP BY meta_key ORDER BY c DESC LIMIT 30;",
  },
  {
    label: "taxonomy_counts",
    sql: "SELECT taxonomy, COUNT(*) AS c FROM wp_term_taxonomy GROUP BY taxonomy ORDER BY c DESC;",
  },
  {
    label: "sample_post_places_rows",
    sql: "SELECT ID, post_type, post_status, post_title, post_name, post_date FROM wp_posts WHERE post_type IN ('post','places') ORDER BY post_type, ID LIMIT 5;",
  },
  {
    label: "attachment_count",
    sql: "SELECT COUNT(*) AS attachment_count FROM wp_posts WHERE post_type='attachment';",
  },
  {
    label: "redirect_count",
    sql: "SELECT COUNT(*) AS redirect_count FROM wp_rank_math_redirections;",
  },
];

/** Defense-in-depth: verify nothing except SELECT/SHOW/DESCRIBE ever ships. */
export function assertReadOnlySql(statements: readonly string[]): void {
  const allowed = /^\s*(SELECT|SHOW|DESCRIBE|DESC)\b/i;
  for (const statement of statements) {
    if (!allowed.test(statement)) {
      throw new Error(
        `Refusing to run non-read-only statement: ${statement.slice(0, 80)}`,
      );
    }
  }
}

function buildSqlScript(): string {
  return SQL_STEPS.map((step) => `SELECT '${step.label}' AS section;\n${step.sql}`).join(
    "\n",
  );
}

// ---------------------------------------------------------------------------
// Output parsing — `mysql -e` prints one header+rows block per statement,
// back to back. We use `SELECT '<label>' AS section;` as an explicit
// boundary marker: a lone `section` header followed by one data row (the
// label) starts a new section; everything after belongs to it until the
// next such marker.
// ---------------------------------------------------------------------------

export interface ParsedSection {
  label: string;
  header: string[];
  rows: string[][];
}

export function parseSectionedOutput(raw: string): ParsedSection[] {
  const lines = raw.split("\n").filter((line) => line.length > 0);
  const sections: ParsedSection[] = [];

  let i = 0;
  while (i < lines.length) {
    if (lines[i] !== "section") {
      // Output before the first marker (or malformed) — skip defensively.
      i += 1;
      continue;
    }

    const label = lines[i + 1];
    i += 2;

    const header = i < lines.length ? lines[i].split("\t") : [];
    i += 1;

    const rows: string[][] = [];
    while (i < lines.length && lines[i] !== "section") {
      rows.push(lines[i].split("\t"));
      i += 1;
    }

    sections.push({ label, header, rows });
  }

  return sections;
}

function findSection(sections: ParsedSection[], label: string): ParsedSection | undefined {
  return sections.find((section) => section.label === label);
}

// ---------------------------------------------------------------------------
// Credentials / config — never logged, never passed as argv.
// ---------------------------------------------------------------------------

export interface WpDbEnv {
  sshHost: string;
  sshUser: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
}

function readEnv(): WpDbEnv {
  const required = ["WP_SSH_HOST", "WP_SSH_USER", "WP_DB_NAME", "WP_DB_USER", "WP_DB_PASSWORD"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }

  return {
    sshHost: process.env.WP_SSH_HOST!,
    sshUser: process.env.WP_SSH_USER!,
    dbName: process.env.WP_DB_NAME!,
    dbUser: process.env.WP_DB_USER!,
    dbPassword: process.env.WP_DB_PASSWORD!,
  };
}

/** `[client]` config file content for `mysql --defaults-extra-file`. */
export function buildMysqlClientConfig(env: Pick<WpDbEnv, "dbUser" | "dbPassword" | "dbName">): string {
  const escape = (value: string) => value.replace(/"/g, '\\"');
  return [
    "[client]",
    `user="${escape(env.dbUser)}"`,
    `password="${escape(env.dbPassword)}"`,
    `database="${escape(env.dbName)}"`,
    "host=127.0.0.1",
    "port=3306",
    "protocol=TCP",
    "",
  ].join("\n");
}

export function maskHost(host: string): string {
  const parts = host.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.**`;
  }
  return host.length <= 4 ? "***" : `${host.slice(0, 2)}***${host.slice(-2)}`;
}

/** The remote shell script text — contains no secrets, safe to log/show. */
function buildRemoteScript(sql: string): string {
  return [
    "set -euo pipefail",
    "umask 177",
    'CNF="$(mktemp)"',
    'trap \'rm -f "$CNF"\' EXIT',
    'cat > "$CNF"',
    `mysql --defaults-extra-file="$CNF" -e "${sql.replace(/"/g, '\\"')}"`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// SSH execution (automatic path) + manual fallback
// ---------------------------------------------------------------------------

function printManualFallback(env: WpDbEnv, remoteScript: string): void {
  console.error(
    "\nAutomatic run failed: SSH batch-mode (key/agent) auth did not succeed.\n" +
      "This script never falls back to a password prompt on purpose. Run it yourself " +
      "in your own terminal, where an interactive SSH password prompt (if needed) works normally.\n" +
      "The remote script below is safe to read/copy — it contains no secrets, only the " +
      "hardcoded read-only SQL and the mktemp/umask/trap plumbing.\n",
  );
  console.error("Remote script (pass as the ssh command argument, not via stdin):\n");
  console.error(remoteScript);
  console.error(
    "\nPipe the mysql client config via stdin (values from your own shell env, never printed " +
      "here), keeping the script itself as the ssh command argument — do not combine both " +
      "through the same stdin stream:\n\n" +
      '  printf \'[client]\\nuser="%s"\\npassword="%s"\\ndatabase="%s"\\nhost=127.0.0.1\\nport=3306\\nprotocol=TCP\\n\' \\\n' +
      '    "$WP_DB_USER" "$WP_DB_PASSWORD" "$WP_DB_NAME" \\\n' +
      `    | ssh ${env.sshUser}@${env.sshHost} "$(cat <<'REMOTE_SCRIPT'\n` +
      `${remoteScript}\n` +
      "REMOTE_SCRIPT\n)\"\n",
  );
}

async function runOverSsh(env: WpDbEnv): Promise<string> {
  // The remote script is passed as a single ssh command-line argument (it
  // contains no secrets, so this is safe) — NOT via `bash -s` fed from the
  // same stdin stream that also has to carry the mysql client config.
  // Mixing both through one stdin stream is unreliable: bash's own
  // consumption of stdin as its script source races with the script's own
  // `cat > "$CNF"` reading further from that same stream. Keeping the
  // script out of stdin entirely removes the race — stdin is then used for
  // exactly one thing: the mysql client config.
  const remoteScript = buildRemoteScript(buildSqlScript());
  const cnfContent = buildMysqlClientConfig(env);

  return new Promise((resolve, reject) => {
    const child = spawn(
      "ssh",
      [
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=15",
        `${env.sshUser}@${env.sshHost}`,
        remoteScript,
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );

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

    // stdin carries only the mysql client config, read remotely by `cat > "$CNF"`.
    child.stdin.on("error", () => {
      /* EPIPE if ssh already failed — surfaced via the close handler instead */
    });
    child.stdin.write(cnfContent);
    child.stdin.end();
  });
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const MVP_POST_TYPE_LABELS: Record<string, string> = {
  post: "Article",
  places: "Place",
  events: "Event",
  "hb-programs": "Program",
  routes: "Route",
};

function categorizeTable(name: string): "core" | "rankmath" | "voxel" | "custom" {
  if (name.startsWith("wp_rank_math")) return "rankmath";
  if (name.startsWith("wp_voxel")) return "voxel";
  const core = new Set([
    "wp_posts",
    "wp_postmeta",
    "wp_terms",
    "wp_term_taxonomy",
    "wp_term_relationships",
    "wp_users",
    "wp_usermeta",
  ]);
  return core.has(name) ? "core" : "custom";
}

export function buildHumanReport(sections: ParsedSection[], env: WpDbEnv): string {
  const lines: string[] = [];
  const push = (line = "") => lines.push(line);

  push(`WordPress DB inspection — ${maskHost(env.sshHost)} / ${env.dbName}`);
  push("(read-only; nothing imported, nothing written)");
  push();

  const postTypeCounts = findSection(sections, "post_type_status_counts");
  push("POSTS");
  push("--------");
  if (postTypeCounts) {
    for (const [postType, status, count] of postTypeCounts.rows) {
      const label = MVP_POST_TYPE_LABELS[postType];
      const suffix = label ? ` (${label})` : "";
      push(`${count}\t${postType}${suffix}\t${status}`);
    }
  }
  push();

  push("USERS");
  push("--------");
  push(findSection(sections, "users_count")?.rows[0]?.[0] ?? "unknown");
  push();

  push("MEDIA");
  push("--------");
  push(findSection(sections, "attachment_count")?.rows[0]?.[0] ?? "unknown");
  push();

  const tables = findSection(sections, "tables");
  const byCategory: Record<string, string[]> = { core: [], rankmath: [], voxel: [], custom: [] };
  for (const row of tables?.rows ?? []) {
    const name = row[0];
    byCategory[categorizeTable(name)].push(name);
  }

  push("TABLES (core)");
  push("--------");
  for (const name of byCategory.core) push(name);
  push();

  push("VOXEL");
  push("--------");
  for (const name of byCategory.voxel) push(name);
  push();
  push("wp_voxel_index_post columns:");
  for (const [col, type] of findSection(sections, "voxel_index_post_columns")?.rows ?? []) {
    push(`  ${col} (${type})`);
  }
  push("wp_voxel_index_places columns:");
  for (const [col, type] of findSection(sections, "voxel_index_places_columns")?.rows ?? []) {
    push(`  ${col} (${type})`);
  }
  push();

  push("RANKMATH");
  push("--------");
  for (const name of byCategory.rankmath) push(name);
  push(`redirects: ${findSection(sections, "redirect_count")?.rows[0]?.[0] ?? "unknown"}`);
  push();

  push("CUSTOM TABLES");
  push("--------");
  for (const name of byCategory.custom) push(name);
  push();

  push("TOP postmeta KEYS — post");
  push("--------");
  for (const [key, count] of findSection(sections, "top_postmeta_keys_post")?.rows ?? []) {
    push(`${count}\t${key}`);
  }
  push();

  push("TOP postmeta KEYS — places");
  push("--------");
  for (const [key, count] of findSection(sections, "top_postmeta_keys_places")?.rows ?? []) {
    push(`${count}\t${key}`);
  }
  push();

  push("TAXONOMIES");
  push("--------");
  for (const [taxonomy, count] of findSection(sections, "taxonomy_counts")?.rows ?? []) {
    push(`${count}\t${taxonomy}`);
  }
  push();

  push("RECOMMENDATIONS (already confirmed, see docs/migration/wordpress-to-mamago.md)");
  push("--------");
  push("- Place coordinates -> wp_voxel_index_places._location via ST_X()/ST_Y().");
  push("- Place phone/work_hours/description/unp/gallery/cover -> wp_postmeta.");
  push("- Place categories/tags -> wp_terms + wp_term_taxonomy + wp_term_relationships.");
  push("- Article base fields -> wp_posts; SEO/featured image/old slugs -> wp_postmeta + RankMath.");
  push("- wp_voxel_index_post._keywords is a search blob, not a field source.");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv: readonly string[]): { allowRemoteReadonly: boolean; out?: string } {
  const allowRemoteReadonly = argv.includes("--allow-remote-readonly");
  const outIndex = argv.indexOf("--out");
  const out = outIndex !== -1 ? argv[outIndex + 1] : undefined;
  return { allowRemoteReadonly, out };
}

async function main(): Promise<void> {
  assertReadOnlySql(SQL_STEPS.map((step) => step.sql));

  const env = readEnv();
  const { allowRemoteReadonly, out } = parseArgs(process.argv.slice(2));

  if (!LOCALHOST_NAMES.has(env.sshHost) && !allowRemoteReadonly) {
    throw new Error(
      `WP_SSH_HOST (${maskHost(env.sshHost)}) is not localhost. Pass --allow-remote-readonly to confirm you intend to run read-only SELECT/SHOW queries against a remote host.`,
    );
  }

  let stdout: string;
  try {
    stdout = await runOverSsh(env);
  } catch (error) {
    printManualFallback(env, buildRemoteScript(buildSqlScript()));
    throw error;
  }

  const sections = parseSectionedOutput(stdout);
  const humanReport = buildHumanReport(sections, env);
  console.log(humanReport);

  if (out) {
    writeFileSync(
      out,
      JSON.stringify({ generatedAt: new Date().toISOString(), sections }, null, 2),
    );
    console.log(`\nJSON report written to ${out}`);
  }
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error) => {
    console.error(`\nmigration:inspect:wordpress-db failed: ${error.message}`);
    process.exitCode = 1;
  });
}
