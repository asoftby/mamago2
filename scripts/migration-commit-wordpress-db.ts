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
  PLACE_ENTITY_TYPE,
  WORDPRESS_DB_ADAPTER_KEY,
  registerWordPressDbAdapter,
} from "../src/lib/migration/adapters/wordpress-db/wordpressDbAdapter";
import type { WordPressQueryExecutor } from "../src/lib/migration/adapters/wordpress-db/WordPressRepository";
import { ArticleCommitOrchestrator } from "../src/lib/migration/commit/article/ArticleCommitOrchestrator";
import { ArticleCommitRunner } from "../src/lib/migration/commit/article/ArticleCommitRunner";
import { ArticleCommitWriter } from "../src/lib/migration/commit/article/ArticleCommitWriter";
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

export type CommitEntity = "article" | "place" | "event" | "all";

/**
 * `normalizeEvent()`'s own `sourceEntityType` is `"wordpress-db:events"`
 * (see its private, unexported `SOURCE_ENTITY_TYPE` constant in
 * `normalizeEvent.ts`) — reproduced here since it isn't exported.
 * `wordpressDbAdapter.ts`'s `discoverRecords()`/`normalizeRecord()` have
 * never been wired to actually discover or normalize `events` posts (a
 * deliberate PR16 scope boundary, not revisited here). Passing
 * `--entity event` is honest about this: it's a real, valid filter value,
 * but since the adapter never discovers anything with this
 * `sourceEntityType`, the resulting execution plan will always have zero
 * records — an honestly empty run, not a thrown error. This PR does not
 * add event adapter wiring.
 */
const EVENT_ENTITY_TYPE = "wordpress-db:events";

export interface CommitCliArgs {
  entity: CommitEntity;
  contextConfigPath: string;
  confirmWrites: boolean;
  limit?: number;
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

  const outIndex = argv.indexOf("--out");
  const out = outIndex !== -1 ? argv[outIndex + 1] : undefined;

  return { entity, contextConfigPath, confirmWrites, limit, allowRemoteReadonly, out };
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
  executor: WordPressQueryExecutor;
  ledger: MigrationLineageLookup;
}): MigrationRunPlanInput {
  return {
    adapterKey: WORDPRESS_DB_ADAPTER_KEY,
    sourceNamespace: "wordpress-db",
    sourceConfig: { executor: input.executor },
    filters: { entityTypes: entityTypesFor(input.entity), limit: input.limit },
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
  console.log();
  console.log(`Total: ${summary.total}`);
  console.log(`Linked: ${summary.linked}`);
  console.log(`Failed: ${summary.failed}`);
  console.log();
  for (const result of summary.results) {
    const detail = result.errorMessage ? ` — ${result.errorCode}: ${result.errorMessage}` : "";
    console.log(`- ${result.sourceRecordKey}: ${result.outcome}${detail}`);
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
    // Same `MigrationLedgerRepository` real lineage lookup used by every
    // other Phoenix entrypoint (PR6) — without it, `createMigrationRunPlan`/
    // `createMigrationRunExecutionPlan` treat every record as CREATE on
    // every run, regardless of what was already imported. Wiring it here is
    // what makes a repeated commit run safe from duplicate creates.
    const ledger = new MigrationLedgerRepository(prisma);

    const executionPlan = await createMigrationRunExecutionPlan(
      buildExecutionPlanInput({ entity: args.entity, limit: args.limit, executor, ledger }),
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
