/**
 * One-off WordPress JSON fixture -> Phoenix commit CLI.
 *
 * This intentionally bypasses the SSH/mysql executor while keeping the same
 * Phoenix commit pipeline underneath:
 * JSON fixture -> fake WordPressQueryExecutor -> wordpress-db adapter ->
 * createMigrationRunExecutionPlan -> runCommitExecutionPlan.
 *
 * Safety:
 * - No SSH, no WP env vars, no remote reads.
 * - `--fixture`, `--context-config`, and `--confirm-writes` are required.
 * - Supports only Place smoke fixtures.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

import { getMigrationAdapter } from "../src/lib/migration/adapters/registry";
import {
  PLACE_ENTITY_TYPE,
  WORDPRESS_DB_ADAPTER_KEY,
  registerWordPressDbAdapter,
} from "../src/lib/migration/adapters/wordpress-db/wordpressDbAdapter";
import type { WordPressQueryExecutor } from "../src/lib/migration/adapters/wordpress-db/WordPressRepository";
import type {
  WordPressPlaceIndexRow,
  WordPressPostMetaRow,
  WordPressPostRow,
  WordPressTermRow,
} from "../src/lib/migration/adapters/wordpress-db/types";
import { ArticleCommitOrchestrator } from "../src/lib/migration/commit/article/ArticleCommitOrchestrator";
import { ArticleCommitRunner } from "../src/lib/migration/commit/article/ArticleCommitRunner";
import { ArticleCommitWriter } from "../src/lib/migration/commit/article/ArticleCommitWriter";
import { parseCommitContextConfig } from "./migration-commit-wordpress-db";
import type { MigrationCommitContextConfig } from "../src/lib/migration/commit/context/resolveCommitContextConfig";
import { EventCommitOrchestrator } from "../src/lib/migration/commit/event/EventCommitOrchestrator";
import { EventCommitRunner } from "../src/lib/migration/commit/event/EventCommitRunner";
import { EventCommitWriter } from "../src/lib/migration/commit/event/EventCommitWriter";
import { runCommitExecutionPlan } from "../src/lib/migration/commit/harness/runCommitExecutionPlan";
import type { RunCommitExecutionPlanSummary } from "../src/lib/migration/commit/harness/runCommitExecutionPlan";
import { PlaceCommitOrchestrator } from "../src/lib/migration/commit/place/PlaceCommitOrchestrator";
import { PlaceCommitRunner } from "../src/lib/migration/commit/place/PlaceCommitRunner";
import { PlaceCommitWriter } from "../src/lib/migration/commit/place/PlaceCommitWriter";
import { createMigrationRunExecutionPlan } from "../src/lib/migration/core/orchestrator";
import type { MigrationLineageLookup, MigrationRunPlanInput } from "../src/lib/migration/core/orchestrator";
import { MigrationLedgerRepository } from "../src/lib/migration/ledger/MigrationLedgerRepository";
import { MigrationLineageWriter } from "../src/lib/migration/lineage/MigrationLineageWriter";
import { MigrationRunWriter } from "../src/lib/migration/writer/MigrationRunWriter";

export interface JsonFixtureCommitCliArgs {
  fixturePath: string;
  contextConfigPath: string;
  confirmWrites: boolean;
}

export interface WordPressJsonFixture {
  posts: readonly WordPressPostRow[];
  postmeta: readonly WordPressPostMetaRow[];
  terms: readonly WordPressTermRow[];
  placeIndex: readonly WordPressPlaceIndexRow[];
}

function requireFlagValue(argv: readonly string[], flag: string): string {
  const index = argv.indexOf(flag);
  const value = index !== -1 ? argv[index + 1] : undefined;
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing required ${flag} <path>.`);
  }
  return value;
}

export function parseArgs(argv: readonly string[]): JsonFixtureCommitCliArgs {
  const fixturePath = requireFlagValue(argv, "--fixture");
  const contextConfigPath = requireFlagValue(argv, "--context-config");
  const confirmWrites = argv.includes("--confirm-writes");
  if (!confirmWrites) {
    throw new Error("Missing required --confirm-writes. Refusing to perform commit-mode writes without explicit confirmation.");
  }
  return { fixturePath, contextConfigPath, confirmWrites };
}

function assertArrayProperty(value: Record<string, unknown>, key: keyof WordPressJsonFixture): void {
  if (!Array.isArray(value[key])) {
    throw new Error(`Fixture "${key}" must be an array.`);
  }
}

export function parseFixture(raw: string, sourcePath: string): WordPressJsonFixture {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`--fixture file at "${sourcePath}" is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`--fixture file at "${sourcePath}" must be a JSON object.`);
  }

  const fixture = parsed as Record<string, unknown>;
  assertArrayProperty(fixture, "posts");
  assertArrayProperty(fixture, "postmeta");
  assertArrayProperty(fixture, "terms");
  assertArrayProperty(fixture, "placeIndex");

  return fixture as unknown as WordPressJsonFixture;
}

function loadFixture(path: string): WordPressJsonFixture {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    throw new Error(`Could not read --fixture file at "${path}": ${error instanceof Error ? error.message : String(error)}`);
  }
  return parseFixture(raw, path);
}

function loadCommitContextConfig(path: string): MigrationCommitContextConfig {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (error) {
    throw new Error(
      `Could not read --context-config file at "${path}": ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return parseCommitContextConfig(raw, path);
}

function toNumberSet(params: readonly unknown[]): Set<number> {
  return new Set(params.map((value) => Number(value)).filter((value) => Number.isFinite(value)));
}

function limitFromParams(params: readonly unknown[]): number | undefined {
  const rawLimit = params[2];
  const limit = typeof rawLimit === "number" ? rawLimit : Number(rawLimit);
  return Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : undefined;
}

export function createJsonFixtureExecutor(fixture: WordPressJsonFixture): WordPressQueryExecutor {
  return async <T>(sql: string, params: readonly unknown[] = []): Promise<T[]> => {
    if (sql.includes("FROM wp_posts") && sql.includes("post_type = ?")) {
      const [postType, postStatus] = params;
      const limit = limitFromParams(params);
      const rows = fixture.posts
        .filter((row) => row.post_type === postType && row.post_status === postStatus)
        .sort((a, b) => a.ID - b.ID);
      return (limit === undefined ? rows : rows.slice(0, limit)) as T[];
    }

    if (sql.includes("FROM wp_postmeta")) {
      const ids = toNumberSet(params);
      return fixture.postmeta.filter((row) => ids.has(row.post_id)) as T[];
    }

    if (sql.includes("FROM wp_term_relationships")) {
      const ids = toNumberSet(params);
      return fixture.terms.filter((row) => ids.has(row.post_id)) as T[];
    }

    if (sql.includes("FROM wp_voxel_index_places")) {
      const ids = toNumberSet(params);
      return fixture.placeIndex.filter((row) => ids.has(row.post_id)) as T[];
    }

    throw new Error(`Unexpected query for JSON fixture executor: ${sql}`);
  };
}

export function buildExecutionPlanInputFromJsonFixture(input: {
  executor: WordPressQueryExecutor;
  ledger: MigrationLineageLookup;
}): MigrationRunPlanInput {
  return {
    adapterKey: WORDPRESS_DB_ADAPTER_KEY,
    sourceNamespace: "wordpress-db",
    sourceConfig: { executor: input.executor },
    filters: { entityTypes: [PLACE_ENTITY_TYPE], limit: 1 },
    ledger: input.ledger,
  };
}

function printSummary(summary: RunCommitExecutionPlanSummary, fixturePath: string): void {
  console.log("Migration Commit From JSON Fixture");
  console.log();
  console.log("entity: place");
  console.log(`fixture: ${fixturePath}`);
  console.log();
  console.log(`Total: ${summary.total}`);
  console.log(`Linked: ${summary.linked}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Skipped: ${summary.skipped}`);
  console.log();
  for (const result of summary.results) {
    const target = result.targetId ? ` targetId=${result.targetId}` : "";
    const lineage = result.lineageId ? ` lineageId=${result.lineageId}` : "";
    const detail = result.errorMessage ? ` — ${result.errorCode}: ${result.errorMessage}` : "";
    console.log(`- ${result.sourceRecordKey}: ${result.outcome}${target}${lineage}${detail}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const fixture = loadFixture(args.fixturePath);
  const contextConfig = loadCommitContextConfig(args.contextConfigPath);
  const executor = createJsonFixtureExecutor(fixture);

  if (!getMigrationAdapter(WORDPRESS_DB_ADAPTER_KEY)) {
    registerWordPressDbAdapter();
  }

  const prisma = new PrismaClient();
  try {
    const ledger = new MigrationLedgerRepository(prisma);
    const executionPlan = await createMigrationRunExecutionPlan(
      buildExecutionPlanInputFromJsonFixture({ executor, ledger }),
    );

    const runWriter = new MigrationRunWriter(prisma);
    const lineageWriter = new MigrationLineageWriter(prisma);
    const runners = {
      place: new PlaceCommitRunner({
        orchestrator: new PlaceCommitOrchestrator(new PlaceCommitWriter(prisma)),
        lineageWriter,
        prisma,
      }),
      event: new EventCommitRunner({
        orchestrator: new EventCommitOrchestrator(new EventCommitWriter(prisma)),
        lineageWriter,
        prisma,
      }),
      article: new ArticleCommitRunner({
        orchestrator: new ArticleCommitOrchestrator(new ArticleCommitWriter(prisma)),
        lineageWriter,
        prisma,
      }),
    };

    const summary = await runCommitExecutionPlan({
      executionPlan,
      contextConfig,
      runWriter,
      prisma,
      runners,
    });

    printSummary(summary, args.fixturePath);
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error) => {
    console.error(`\nmigration:commit:wordpress-db-from-json failed: ${error.message}`);
    process.exitCode = 1;
  });
}
