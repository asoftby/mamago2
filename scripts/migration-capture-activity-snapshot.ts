import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  assertRemoteAccessAllowed,
  createWordPressSshMysqlExecutor,
  maskHost,
  readWordPressDbConfigFromEnv,
} from "../src/lib/migration/adapters/wordpress-db/connectExecutor";
import { buildPostMetaQuery, buildPostsByAuthorsAndTypesQuery, buildPostTypeStatusBreakdownQuery, buildTermsQuery } from "../src/lib/migration/adapters/wordpress-db/sql";
import type { WordPressPostMetaRow, WordPressTermRow } from "../src/lib/migration/adapters/wordpress-db/types";

/**
 * USERS Slice 16: the first standalone immutable snapshot for the
 * Activity entity — explicitly NOT a repeat of the USERS snapshot or a
 * new USERS source-discovery pass. Captures exactly the fields needed to
 * classify why the 10 `TARGET_NOT_MIGRATED` content-author users'
 * authored Activity/Article content hasn't migrated yet: post
 * identity/status/author/dates, Place-linking postmeta, media reference
 * postmeta, and taxonomy terms.
 *
 * Never queries `wp_users` — this script has no code path that can
 * capture email, login, password, or phone. Read-only: every query is a
 * hardcoded SELECT built through sql.ts's bound-parameter builders. No
 * UPDATE/INSERT/DELETE, no temporary tables, nothing mutates source DB
 * state. Exactly one throwaway probe query runs before the real capture.
 *
 * The snapshot is written outside the repo and outside /tmp (a lesson
 * from Slice 16's blocked start: a snapshot under /tmp does not survive
 * a reboot and breaks the reproducibility this whole workflow depends
 * on) — see docs/migration/prelaunch-checklist.md's "Правила работы".
 */

const LEGACY_AUTHOR_IDS = [42, 105, 116, 142, 341, 450, 462, 567, 568, 575] as const;
const POST_TYPES = ["events", "post"] as const;

/** Only these postmeta keys are persisted — every other meta_key on these posts is discarded, not just unused. */
const RELEVANT_META_KEYS = new Set([
  "event_date",
  "event-place-name",
  "location",
  "adress-event-place",
  "event_city",
  "event-cost",
  "url-buy-ticket",
  "external_event_id",
  "external_last_updated",
  "trailer-url",
  "gallery",
  "_thumbnail_id",
  "event_place",
  "event-place",
  "event_place_id",
  "place_id",
  "age",
  "age_text",
  "ageRange",
  "age_range",
  "event_age",
]);

const QUERY_VERSION = "activity-snapshot-v1";

function sha256Hex(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

interface Args {
  outputDir: string;
}

function parseArgs(argv: readonly string[]): Args {
  if (!argv.includes("--allow-remote-readonly")) throw new Error("Refusing to run without explicit --allow-remote-readonly.");
  const outputIndex = argv.indexOf("--output-dir");
  if (outputIndex < 0 || !argv[outputIndex + 1]) throw new Error("Requires --output-dir.");
  const outputDir = argv[outputIndex + 1];
  if (outputDir.startsWith("/tmp") || outputDir.includes("/tmp/")) throw new Error("Refusing to write the immutable snapshot under /tmp — it must survive a reboot.");
  return { outputDir };
}

interface CapturedPostRow {
  ID: number;
  post_author: number;
  post_date: string;
  post_status: string;
  post_name: string;
  post_modified: string;
  post_parent: number;
  guid: string;
  post_type: string;
}

function writeJsonFile(dir: string, name: string, value: unknown): { name: string; sizeBytes: number; sha256: string } {
  const content = JSON.stringify(value, null, 2) + "\n";
  const path = join(dir, name);
  writeFileSync(path, content, { mode: 0o600 });
  chmodSync(path, 0o600);
  return { name, sizeBytes: Buffer.byteLength(content, "utf8"), sha256: sha256Hex(content) };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = readWordPressDbConfigFromEnv(process.env);
  assertRemoteAccessAllowed(config, true);

  mkdirSync(args.outputDir, { recursive: true, mode: 0o700 });
  chmodSync(args.outputDir, 0o700);

  const executor = createWordPressSshMysqlExecutor(config);

  // Gate: exactly one SSH probe before any real capture query.
  const probeRows = await executor<{ ok: number | string }>("SELECT 1 AS ok;");
  if (probeRows.length !== 1 || Number(probeRows[0].ok) !== 1) {
    throw new Error("SSH probe returned an unexpected result — stopping before any capture query.");
  }
  console.log(JSON.stringify({ probe: "OK", host: maskHost(config.sshHost), db: config.dbName }));

  // Full Activity inventory: aggregate post_status counts only, no row-level data.
  const eventStatusQuery = buildPostTypeStatusBreakdownQuery("events");
  const eventStatusBreakdown = await executor<{ post_status: string; count: number }>(eventStatusQuery.sql, eventStatusQuery.params);

  // Targeted row-level capture: only the 10 content-author users' authored posts.
  const postsQuery = buildPostsByAuthorsAndTypesQuery([...LEGACY_AUTHOR_IDS], [...POST_TYPES]);
  const posts = await executor<CapturedPostRow>(postsQuery.sql, postsQuery.params);
  const postIds = posts.map(row => row.ID);

  const metaQuery = buildPostMetaQuery(postIds);
  const allMeta = postIds.length > 0 ? await executor<WordPressPostMetaRow>(metaQuery.sql, metaQuery.params) : [];
  const relevantMeta = allMeta.filter(row => RELEVANT_META_KEYS.has(row.meta_key));

  const termsQuery = buildTermsQuery(postIds);
  const terms = postIds.length > 0 ? await executor<WordPressTermRow>(termsQuery.sql, termsQuery.params) : [];

  const rowCountsByTypeStatus: Record<string, number> = {};
  for (const post of posts) {
    const key = `${post.post_type}:${post.post_status}`;
    rowCountsByTypeStatus[key] = (rowCountsByTypeStatus[key] ?? 0) + 1;
  }

  const files: Array<{ name: string; sizeBytes: number; sha256: string }> = [];
  files.push(writeJsonFile(args.outputDir, "posts.json", posts));
  files.push(writeJsonFile(args.outputDir, "postmeta.json", relevantMeta));
  files.push(writeJsonFile(args.outputDir, "terms.json", terms));
  files.push(writeJsonFile(args.outputDir, "event-status-breakdown.json", eventStatusBreakdown));

  const manifest = {
    entity: "activity",
    isFirstStandaloneSnapshotForThisEntity: true,
    notARepeatOfUsersSnapshot: true,
    capturedAt: new Date().toISOString(),
    queryVersion: QUERY_VERSION,
    accessMode: "READ_ONLY",
    sqlStatementClassification: { allowed: ["SELECT"], forbiddenStatementsFound: false },
    sshProbeCount: 1,
    maskedSourceFingerprint: maskHost(config.sshHost),
    sourceDatabase: config.dbName,
    scope: { legacyAuthorIds: [...LEGACY_AUTHOR_IDS], postTypes: [...POST_TYPES], relevantMetaKeys: [...RELEVANT_META_KEYS].sort() },
    rowCounts: { posts: posts.length, postmetaRelevant: relevantMeta.length, postmetaTotalBeforeFilter: allMeta.length, terms: terms.length, rowCountsByTypeStatus },
    fullActivityInventory: { eventStatusBreakdown },
    files,
    excludedFromCapture: ["wp_users (never queried)", "email", "password hashes", "phone", "sessions/tokens", "post_content/post_title/post_excerpt", "any postmeta key not in scope.relevantMetaKeys"],
  };
  const canonicalSnapshotHash = sha256Hex(
    JSON.stringify(
      files
        .map(file => ({ name: file.name, sha256: file.sha256 }))
        .sort((a, b) => (a.name < b.name ? -1 : 1)),
    ),
  );
  const manifestPath = join(args.outputDir, "manifest.json");
  writeFileSync(manifestPath, JSON.stringify({ ...manifest, canonicalSnapshotHash }, null, 2) + "\n", { mode: 0o600 });
  chmodSync(manifestPath, 0o600);

  console.log(JSON.stringify({ complete: true, outputDir: args.outputDir, canonicalSnapshotHash, rowCounts: manifest.rowCounts, fullActivityInventory: manifest.fullActivityInventory }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
