/**
 * WordPress -> Phoenix commit CLI.
 *
 * WordPress DB (read-only, same SSH + `mysql --defaults-extra-file`
 * plumbing as `migration-preview-wordpress-db.ts`) -> Phoenix Engine
 * (`createMigrationRunExecutionPlan`, with a real `MigrationLedgerRepository`
 * wired in — PR31 — so a record already linked in a prior run plans as
 * UPDATE/SKIP_UNCHANGED, not another CREATE) -> `runCommitExecutionPlan()`
 * (`MigrationRunWriter.persistPlan` + `resolveCommitContextForExecutionCandidate`
 * + `dispatchCommitRunner` -> real `PlaceCommitRunner`/`EventCommitRunner`/
 * `ArticleCommitRunner` -> real `Place`/`Activity`/`Article` +
 * `MigrationLineage` + `MigrationRecord` rows).
 *
 * This CLI is the first place in the whole project allowed to import
 * concrete Runner classes and a real `PrismaClient` — every engine module
 * underneath it (writers, orchestrators, runners, the harness, the
 * dispatcher) is constructor-injected and deliberately knows nothing about
 * where its Prisma client or its sibling components come from. Wiring
 * concrete instances together is exactly this file's one job.
 *
 * Safety:
 * - `--confirm-writes` and `--context-config <path>` are both required —
 *   missing either throws in `parseArgs()`, before any WordPress SSH
 *   connection or `PrismaClient` is ever opened.
 * - `--allow-remote-readonly` only ever gates the WordPress *read* side
 *   (`assertRemoteAccessAllowed`, unchanged from the preview CLI) — there
 *   is no equivalent "remote write" gate here; mamaGo's own DB connection
 *   goes through whatever `DATABASE_URL` the environment already provides,
 *   the same as every other script in this repo.
 * - Uses a bare `new PrismaClient()`, never `@/lib/prisma` — that
 *   singleton is wrapped with `SearchIndexerService` and `globalThis`
 *   dev-hot-reload caching, both Next.js-app concerns a disposable,
 *   one-shot CLI process doesn't need.
 * - No production/staging distinction is made here — see the PR30-prep
 *   audit for why that's an open question, not silently decided.
 *
 * Run:
 *   pnpm migration:commit:wordpress-db --entity place \
 *     --context-config ./commit-context.json --confirm-writes
 *   pnpm migration:commit:wordpress-db --entity all \
 *     --context-config ./commit-context.json --confirm-writes --limit 5 --out report.json
 *
 * Required env vars (same as migration:preview:wordpress-db): WP_SSH_HOST,
 * WP_SSH_USER, WP_DB_NAME, WP_DB_USER, WP_DB_PASSWORD. A non-localhost
 * WP_SSH_HOST additionally requires --allow-remote-readonly. mamaGo's own
 * DATABASE_URL is read implicitly by `new PrismaClient()`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

import { getMigrationAdapter } from "../src/lib/migration/adapters/registry";
import {
  assertRemoteAccessAllowed,
  createWordPressSshMysqlExecutor,
  readWordPressDbConfigFromEnv,
} from "../src/lib/migration/adapters/wordpress-db/connectExecutor";
import {
  ARTICLE_ENTITY_TYPE,
  EVENT_ENTITY_TYPE,
  PLACE_ENTITY_TYPE,
  WORDPRESS_DB_ADAPTER_KEY,
  fetchPublishedArticleEnvelopeBySourceRecordKey,
  fetchPublishedEventEnvelopeBySourceRecordKey,
  registerWordPressDbAdapter,
} from "../src/lib/migration/adapters/wordpress-db/wordpressDbAdapter";
import { WordPressRepository, type WordPressQueryExecutor } from "../src/lib/migration/adapters/wordpress-db/WordPressRepository";
import type { SourceRecordEnvelope } from "../src/lib/migration/types";
import { ArticleCommitOrchestrator } from "../src/lib/migration/commit/article/ArticleCommitOrchestrator";
import { ArticleCommitRunner } from "../src/lib/migration/commit/article/ArticleCommitRunner";
import { ArticleCommitWriter } from "../src/lib/migration/commit/article/ArticleCommitWriter";
import type { MigrationCommitContextConfig } from "../src/lib/migration/commit/context/resolveCommitContextConfig";
import { EventCommitOrchestrator } from "../src/lib/migration/commit/event/EventCommitOrchestrator";
import { EventCommitRunner } from "../src/lib/migration/commit/event/EventCommitRunner";
import { EventCommitWriter } from "../src/lib/migration/commit/event/EventCommitWriter";
import { EventMediaSyncer } from "../src/lib/migration/commit/event/EventMediaSyncer";
import { runCommitExecutionPlan } from "../src/lib/migration/commit/harness/runCommitExecutionPlan";
import type { RunCommitExecutionPlanSummary } from "../src/lib/migration/commit/harness/runCommitExecutionPlan";
import {
  formatCommitResultLine,
  printCommitExecutionCounters,
} from "./migration-commit-summary";
import { PlaceCommitOrchestrator } from "../src/lib/migration/commit/place/PlaceCommitOrchestrator";
import { PlaceCommitRunner } from "../src/lib/migration/commit/place/PlaceCommitRunner";
import { PlaceCommitWriter } from "../src/lib/migration/commit/place/PlaceCommitWriter";
import { createMigrationRunExecutionPlan } from "../src/lib/migration/core/orchestrator";
import type { MigrationLineageLookup, MigrationRunPlanInput } from "../src/lib/migration/core/orchestrator";
import { MigrationLedgerRepository } from "../src/lib/migration/ledger/MigrationLedgerRepository";
import { MigrationLineageWriter } from "../src/lib/migration/lineage/MigrationLineageWriter";
import { MigrationRunWriter } from "../src/lib/migration/writer/MigrationRunWriter";

export type CommitEntity = "article" | "place" | "event" | "all";

export interface CommitCliArgs {
  entity: CommitEntity;
  contextConfigPath: string;
  confirmWrites: boolean;
  limit?: number;
  sourceRecordKey?: string;
  forceReprocess: boolean;
  allowRemoteReadonly: boolean;
  out?: string;
}

const VALID_ENTITIES: readonly CommitEntity[] = ["article", "place", "event", "all"];

export function parseArgs(argv: readonly string[]): CommitCliArgs {
  const entityIndex = argv.indexOf("--entity");
  const rawEntity = entityIndex !== -1 ? argv[entityIndex + 1] : undefined;
  if (rawEntity !== undefined && !VALID_ENTITIES.includes(rawEntity as CommitEntity)) {
    throw new Error(`Invalid --entity value "${rawEntity}". Expected article|place|event|all.`);
  }
  const entity: CommitEntity = (rawEntity as CommitEntity | undefined) ?? "all";

  const limitIndex = argv.indexOf("--limit");
  const rawLimit = limitIndex !== -1 ? argv[limitIndex + 1] : undefined;
  let limit: number | undefined;
  if (rawLimit !== undefined) {
    limit = Number(rawLimit);
    if (!Number.isFinite(limit) || limit <= 0) {
      throw new Error(`Invalid --limit value "${rawLimit}". Expected a positive number.`);
    }
  }

  const contextConfigIndex = argv.indexOf("--context-config");
  const contextConfigPath = contextConfigIndex !== -1 ? argv[contextConfigIndex + 1] : undefined;
  if (!contextConfigPath) {
    throw new Error(
      "Missing required --context-config <path>. Refusing to run a commit without an explicit commit context config.",
    );
  }

  const confirmWrites = argv.includes("--confirm-writes");
  if (!confirmWrites) {
    throw new Error(
      "Missing required --confirm-writes. Refusing to perform commit-mode writes without explicit confirmation.",
    );
  }

  const allowRemoteReadonly = argv.includes("--allow-remote-readonly");
  const forceReprocess = argv.includes("--force-reprocess");

  const sourceRecordKeyIndex = argv.indexOf("--source-record-key");
  const sourceRecordKey =
    sourceRecordKeyIndex !== -1 ? argv[sourceRecordKeyIndex + 1] : undefined;
  if (sourceRecordKeyIndex !== -1 && !sourceRecordKey) {
    throw new Error("Missing value for --source-record-key.");
  }

  if (forceReprocess) {
    if (entity !== "article") {
      throw new Error("--force-reprocess is only supported with --entity article.");
    }
    if (!sourceRecordKey) {
      throw new Error("--force-reprocess requires --source-record-key <key>.");
    }
    if (limit !== undefined) {
      throw new Error("--force-reprocess cannot be combined with --limit (mass mode is not allowed).");
    }
  }

  const outIndex = argv.indexOf("--out");
  const out = outIndex !== -1 ? argv[outIndex + 1] : undefined;

  return {
    entity,
    contextConfigPath,
    confirmWrites,
    limit,
    sourceRecordKey,
    forceReprocess,
    allowRemoteReadonly,
    out,
  };
}

function entityTypesFor(entity: CommitEntity): readonly string[] | undefined {
  if (entity === "article") return [ARTICLE_ENTITY_TYPE];
  if (entity === "place") return [PLACE_ENTITY_TYPE];
  if (entity === "event") return [EVENT_ENTITY_TYPE];
  return undefined;
}

/**
 * Pure assembly of `createMigrationRunExecutionPlan()`'s input — pulled
 * out of `main()` specifically so PR31's ledger wiring is testable
 * without a real DB/SSH connection: a test can pass a fake `ledger` and
 * assert it lands on the built input unchanged, without ever
 * constructing a real `MigrationLedgerRepository`/`PrismaClient`.
 */
export function buildExecutionPlanInput(input: {
  entity: CommitEntity;
  limit?: number;
  sourceRecordKey?: string;
  records?: readonly SourceRecordEnvelope[];
  executor: WordPressQueryExecutor;
  ledger: MigrationLineageLookup;
}): MigrationRunPlanInput {
  return {
    adapterKey: WORDPRESS_DB_ADAPTER_KEY,
    sourceNamespace: "wordpress-db",
    sourceConfig: { executor: input.executor },
    records: input.records,
    filters: {
      entityTypes: entityTypesFor(input.entity),
      limit: input.sourceRecordKey ? 1 : input.limit,
    },
    ledger: input.ledger,
  };
}

/**
 * Deliberately only a basic shape check (object, `defaults`/
 * `overridesBySourceRecordKey` are objects if present) — not full schema
 * validation of every `place`/`event`/`article` field. Per-target-type
 * required-field checking already happens downstream, in
 * `resolveCommitContextForExecutionCandidate()` (PR26); duplicating that
 * here would be a second copy of the same decision.
 */
export function parseCommitContextConfig(raw: string, sourcePath: string): MigrationCommitContextConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `--context-config file at "${sourcePath}" is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`--context-config file at "${sourcePath}" must be a JSON object.`);
  }

  const config = parsed as Record<string, unknown>;
  for (const key of ["defaults", "overridesBySourceRecordKey"] as const) {
    const value = config[key];
    if (value !== undefined && (typeof value !== "object" || value === null || Array.isArray(value))) {
      throw new Error(`--context-config "${key}" must be an object if present (in "${sourcePath}").`);
    }
  }

  return config as MigrationCommitContextConfig;
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

function printSummary(summary: RunCommitExecutionPlanSummary, args: CommitCliArgs): void {
  console.log("Migration Commit");
  console.log();
  console.log(`entity: ${args.entity}`);
  console.log(`limit: ${args.limit ?? "(default)"}`);
  if (args.sourceRecordKey) {
    console.log(`sourceRecordKey: ${args.sourceRecordKey}`);
  }
  if (args.forceReprocess) {
    console.log("forceReprocess: true");
  }
  console.log();
  printCommitExecutionCounters(summary);
  console.log();
  for (const result of summary.results) {
    console.log(formatCommitResultLine(result));
  }
}

function applyForcedArticleReprocess(
  executionPlan: Awaited<ReturnType<typeof createMigrationRunExecutionPlan>>,
  args: CommitCliArgs,
): void {
  if (!args.forceReprocess || !args.sourceRecordKey) {
    return;
  }
  for (const item of executionPlan.plan.items) {
    if (item.sourceRecordKey === args.sourceRecordKey && item.action === "SKIP_UNCHANGED") {
      item.action = "UPDATE";
      item.status = "PLANNED";
    }
  }
  for (const candidate of executionPlan.executionCandidates) {
    if (candidate.planItem.sourceRecordKey === args.sourceRecordKey && candidate.planItem.action === "SKIP_UNCHANGED") {
      candidate.planItem.action = "UPDATE";
      candidate.planItem.status = "PLANNED";
    }
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const contextConfig = loadCommitContextConfig(args.contextConfigPath);

  const wpConfig = readWordPressDbConfigFromEnv(process.env);
  assertRemoteAccessAllowed(wpConfig, args.allowRemoteReadonly);

  if (!getMigrationAdapter(WORDPRESS_DB_ADAPTER_KEY)) {
    registerWordPressDbAdapter();
  }

  const executor = createWordPressSshMysqlExecutor(wpConfig);

  const prisma = new PrismaClient();
  try {
    const ledger = new MigrationLedgerRepository(prisma);

    let records: readonly SourceRecordEnvelope[] | undefined;
    if (args.sourceRecordKey) {
      if (args.entity === "article") {
        records = [await fetchPublishedArticleEnvelopeBySourceRecordKey(executor, args.sourceRecordKey)];
      } else if (args.entity === "event") {
        records = [await fetchPublishedEventEnvelopeBySourceRecordKey(executor, args.sourceRecordKey)];
      } else {
        throw new Error(
          "--source-record-key is only supported with --entity article|event for golden-sample runs.",
        );
      }
    }

    const executionPlan = await createMigrationRunExecutionPlan(
      buildExecutionPlanInput({
        entity: args.entity,
        limit: args.limit,
        sourceRecordKey: args.sourceRecordKey,
        records,
        executor,
        ledger,
      }),
    );
    applyForcedArticleReprocess(executionPlan, args);

    const runWriter = new MigrationRunWriter(prisma);
    const lineageWriter = new MigrationLineageWriter(prisma);
    const wordpressRepository = new WordPressRepository(executor);
    const { createMamagoMediaImporter } = await import("../src/lib/migration/media");
    const eventMediaSyncer = new EventMediaSyncer({
      prisma,
      attachmentResolver: wordpressRepository,
      mediaImporterFactory: (ownerUserId) => createMamagoMediaImporter({ uploadedByUserId: ownerUserId }),
      lineageWriter,
    });

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
        mediaSyncer: eventMediaSyncer,
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

    printSummary(summary, args);

    if (args.out) {
      writeFileSync(args.out, JSON.stringify(summary, null, 2));
      console.log(`\nJSON report written to ${args.out}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error) => {
    console.error(`\nmigration:commit:wordpress-db failed: ${error.message}`);
    process.exitCode = 1;
  });
}
