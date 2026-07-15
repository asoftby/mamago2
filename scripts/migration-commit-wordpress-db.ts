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
 * - `--profile FULL_IMPORT|DEV_VALIDATION|PRODUCTION` (default: derived from
 *   APP_ENV/VERCEL_ENV, see `resolveMigrationProfile()`) selects a bundle of
 *   `--media-policy FULL|METADATA|NONE`, `--seo-policy DRY_RUN|VALIDATE|PRODUCTION`
 *   and `--redirect-policy VALIDATE|APPLY`, each individually overridable.
 *   The resolved profile is printed before anything runs.
 * - When the resolved profile is `PRODUCTION`, `ProductionMigrationGuard`
 *   requires `--confirm-production` and validates the redirect manifest and
 *   global-noindex flag *before* the WordPress SSH connection or
 *   `PrismaClient` is ever opened — see `assertProductionMigrationGuard()`.
 *
 * Run:
 *   pnpm migration:commit:wordpress-db --entity place \
 *     --context-config ./commit-context.json --confirm-writes
 *   pnpm migration:commit:wordpress-db --entity all \
 *     --context-config ./commit-context.json --confirm-writes --limit 5 --out report.json
 *   pnpm migration:commit:wordpress-db --entity all --profile PRODUCTION \
 *     --context-config ./commit-context.json --confirm-writes --confirm-production
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
import type { MediaImporterLike } from "../src/lib/migration/media/types";
import {
  assertRemoteAccessAllowed,
  createWordPressSshMysqlExecutor,
  readWordPressDbConfigFromEnv,
} from "../src/lib/migration/adapters/wordpress-db/connectExecutor";
import {
  ARTICLE_ENTITY_TYPE,
  EVENT_ENTITY_TYPE,
  PLACE_ENTITY_TYPE,
  ROUTE_ENTITY_TYPE,
  WORDPRESS_DB_ADAPTER_KEY,
  fetchPublishedArticleEnvelopeBySourceRecordKey,
  fetchPublishedEventEnvelopeBySourceRecordKey,
  fetchPublishedPlaceEnvelopeBySourceRecordKey,
  fetchPublishedRouteEnvelopeBySourceRecordKey,
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
import { PlaceMediaSyncer } from "../src/lib/migration/commit/place/PlaceMediaSyncer";
import { RouteCommitOrchestrator } from "../src/lib/migration/commit/route/RouteCommitOrchestrator";
import { RouteCommitRunner } from "../src/lib/migration/commit/route/RouteCommitRunner";
import { RouteCommitWriter } from "../src/lib/migration/commit/route/RouteCommitWriter";
import { RouteStopMediaSyncer } from "../src/lib/migration/commit/route/RouteStopMediaSyncer";
import { createMigrationRunExecutionPlan } from "../src/lib/migration/core/orchestrator";
import type { MigrationLineageLookup, MigrationRunPlanInput } from "../src/lib/migration/core/orchestrator";
import { MigrationLedgerRepository } from "../src/lib/migration/ledger/MigrationLedgerRepository";
import { MigrationLineageWriter } from "../src/lib/migration/lineage/MigrationLineageWriter";
import { MigrationRunWriter } from "../src/lib/migration/writer/MigrationRunWriter";
import { MediaPolicyGatedEventMediaSyncer } from "../src/lib/migration/runtime/MediaPolicyGatedEventMediaSyncer";
import { MediaPolicyGatedPlaceMediaSyncer } from "../src/lib/migration/runtime/MediaPolicyGatedPlaceMediaSyncer";
import { MediaPolicyGatedRouteStopMediaSyncer } from "../src/lib/migration/runtime/MediaPolicyGatedRouteStopMediaSyncer";
import { resolveSampledMediaPolicy } from "../src/lib/migration/runtime/sampledMediaPolicy";
import {
  formatMigrationProfileForCli,
  parseMediaPolicyName,
  parseMigrationProfileName,
  parseRedirectPolicyName,
  parseSeoPolicyName,
  resolveMigrationProfile,
} from "../src/lib/migration/runtime/MigrationProfile";
import type {
  MediaPolicyName,
  MigrationEnvironment,
  MigrationProfile,
  MigrationProfileName,
  RedirectPolicyName,
  SeoPolicyName,
} from "../src/lib/migration/runtime/MigrationProfile";
import { assertProductionMigrationGuard } from "../src/lib/migration/runtime/ProductionMigrationGuard";

export type CommitEntity = "article" | "place" | "event" | "route" | "all";

export interface CommitCliArgs {
  entity: CommitEntity;
  contextConfigPath: string;
  confirmWrites: boolean;
  limit?: number;
  sourceRecordKey?: string;
  forceReprocess: boolean;
  allowRemoteReadonly: boolean;
  out?: string;
  profileName?: MigrationProfileName;
  mediaPolicyName?: MediaPolicyName;
  seoPolicyName?: SeoPolicyName;
  redirectPolicyName?: RedirectPolicyName;
  confirmProduction: boolean;
}

const VALID_ENTITIES: readonly CommitEntity[] = ["article", "place", "event", "route", "all"];

export function parseArgs(argv: readonly string[]): CommitCliArgs {
  const entityIndex = argv.indexOf("--entity");
  const rawEntity = entityIndex !== -1 ? argv[entityIndex + 1] : undefined;
  if (rawEntity !== undefined && !VALID_ENTITIES.includes(rawEntity as CommitEntity)) {
    throw new Error(`Invalid --entity value "${rawEntity}". Expected article|place|event|route|all.`);
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

  const profileIndex = argv.indexOf("--profile");
  const rawProfile = profileIndex !== -1 ? argv[profileIndex + 1] : undefined;
  const profileName = rawProfile !== undefined ? parseMigrationProfileName(rawProfile) : undefined;
  if (rawProfile !== undefined && profileName === null) {
    throw new Error(
      `Invalid --profile value "${rawProfile}". Expected FULL_IMPORT|DEV_VALIDATION|PRODUCTION.`,
    );
  }

  const mediaPolicyIndex = argv.indexOf("--media-policy");
  const rawMediaPolicy = mediaPolicyIndex !== -1 ? argv[mediaPolicyIndex + 1] : undefined;
  const mediaPolicyName = rawMediaPolicy !== undefined ? parseMediaPolicyName(rawMediaPolicy) : undefined;
  if (rawMediaPolicy !== undefined && mediaPolicyName === null) {
    throw new Error(`Invalid --media-policy value "${rawMediaPolicy}". Expected FULL|METADATA|NONE.`);
  }

  const seoPolicyIndex = argv.indexOf("--seo-policy");
  const rawSeoPolicy = seoPolicyIndex !== -1 ? argv[seoPolicyIndex + 1] : undefined;
  const seoPolicyName = rawSeoPolicy !== undefined ? parseSeoPolicyName(rawSeoPolicy) : undefined;
  if (rawSeoPolicy !== undefined && seoPolicyName === null) {
    throw new Error(`Invalid --seo-policy value "${rawSeoPolicy}". Expected DRY_RUN|VALIDATE|PRODUCTION.`);
  }

  const redirectPolicyIndex = argv.indexOf("--redirect-policy");
  const rawRedirectPolicy = redirectPolicyIndex !== -1 ? argv[redirectPolicyIndex + 1] : undefined;
  const redirectPolicyName =
    rawRedirectPolicy !== undefined ? parseRedirectPolicyName(rawRedirectPolicy) : undefined;
  if (rawRedirectPolicy !== undefined && redirectPolicyName === null) {
    throw new Error(`Invalid --redirect-policy value "${rawRedirectPolicy}". Expected VALIDATE|APPLY.`);
  }

  const confirmProduction = argv.includes("--confirm-production");

  return {
    entity,
    contextConfigPath,
    confirmWrites,
    limit,
    sourceRecordKey,
    forceReprocess,
    allowRemoteReadonly,
    out,
    profileName: profileName ?? undefined,
    mediaPolicyName: mediaPolicyName ?? undefined,
    seoPolicyName: seoPolicyName ?? undefined,
    redirectPolicyName: redirectPolicyName ?? undefined,
    confirmProduction,
  };
}

/**
 * Whether the sampled media policy (`resolveSampledMediaPolicy`) should be
 * consulted for this run, pulled out of `main()` as a pure function so
 * it's testable without a real profile/DB/SSH connection. An explicit
 * `--media-policy` flag is a stronger, deliberate operator signal that
 * always overrides sampling — this only ever activates for LOCAL/DEV runs
 * using their environment's own default media policy.
 */
export function shouldSampleMedia(input: {
  mediaPolicyName: MediaPolicyName | undefined;
  environment: MigrationEnvironment;
}): boolean {
  return input.mediaPolicyName === undefined && (input.environment === "LOCAL" || input.environment === "DEV");
}

function entityTypesFor(entity: CommitEntity): readonly string[] | undefined {
  if (entity === "article") return [ARTICLE_ENTITY_TYPE];
  if (entity === "place") return [PLACE_ENTITY_TYPE];
  if (entity === "event") return [EVENT_ENTITY_TYPE];
  if (entity === "route") return [ROUTE_ENTITY_TYPE];
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

  const profile: MigrationProfile = resolveMigrationProfile({
    profileName: args.profileName,
    mediaPolicyName: args.mediaPolicyName,
    seoPolicyName: args.seoPolicyName,
    redirectPolicyName: args.redirectPolicyName,
  });
  console.log(formatMigrationProfileForCli(profile));
  console.log();

  assertProductionMigrationGuard({ profile, confirmProduction: args.confirmProduction });

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
      } else if (args.entity === "place") {
        records = [await fetchPublishedPlaceEnvelopeBySourceRecordKey(executor, args.sourceRecordKey)];
      } else if (args.entity === "event") {
        records = [await fetchPublishedEventEnvelopeBySourceRecordKey(executor, args.sourceRecordKey)];
      } else if (args.entity === "route") {
        records = [await fetchPublishedRouteEnvelopeBySourceRecordKey(executor, args.sourceRecordKey)];
      } else {
        throw new Error(
          "--source-record-key is only supported with --entity article|place|event|route for golden-sample runs.",
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

    // The sampled media policy (`resolveSampledMediaPolicy`) only kicks in
    // when the operator didn't explicitly pin `--media-policy` — an
    // explicit flag is a stronger, deliberate signal that overrides
    // sampling entirely, exactly like it overrode the flat run-wide policy
    // before sampling existed. Without an explicit override, LOCAL/DEV
    // sample (3 Event + 3 Place + 3 Offer get FULL, everything else
    // METADATA); PROD's own default is already FULL, so sampling is simply
    // never invoked there — see `resolveSampledMediaPolicy`'s own
    // unconditional-FULL-for-PROD guarantee for the belt-and-braces case.
    const samplingActive = shouldSampleMedia({
      mediaPolicyName: args.mediaPolicyName,
      environment: profile.environment,
    });

    // `createMamagoMediaImporter` transitively imports `@/server/media/media-storage`,
    // which is guarded by the `server-only` package. That guard is only a
    // no-op under Next's bundler (which sets the "react-server" resolve
    // condition) — under a plain `tsx`/Node process (this CLI), `server-only`
    // throws unconditionally the moment the module is *loaded*, regardless
    // of whether it's ever called. So this import must stay lazy and must
    // only ever be reached when the run could actually produce a FULL
    // write — either the flat run-wide policy is FULL, or per-record
    // sampling is active (which can hand out FULL to the 9 allowlisted
    // records even while the run's own baseline is METADATA);
    // `MediaPolicyGated{Event,RouteStop}MediaSyncer` already guarantee
    // `mediaImporterFactory` itself is never invoked for METADATA/NONE, but
    // the previous code additionally imported the module eagerly at
    // startup regardless of policy, which crashed every non-FULL run.
    let createMamagoMediaImporter: typeof import("../src/lib/migration/media")["createMamagoMediaImporter"] | undefined;
    if (profile.mediaPolicy.name === "FULL" || samplingActive) {
      ({ createMamagoMediaImporter } = await import("../src/lib/migration/media"));
    }
    const mediaImporterFactory = (ownerUserId: string): MediaImporterLike => {
      if (!createMamagoMediaImporter) {
        throw new Error(
          "mediaImporterFactory invoked without mediaPolicy=FULL — this should be unreachable; MediaPolicyGated*Syncer is expected to gate all calls.",
        );
      }
      return createMamagoMediaImporter({ uploadedByUserId: ownerUserId });
    };

    const eventMediaSyncer = new MediaPolicyGatedEventMediaSyncer({
      inner: new EventMediaSyncer({
        prisma,
        attachmentResolver: wordpressRepository,
        mediaImporterFactory,
        lineageWriter,
      }),
      mediaPolicy: samplingActive
        ? (sourceRecordKey: string) =>
            resolveSampledMediaPolicy({ environment: profile.environment, sourceRecordKey })
        : profile.mediaPolicy,
    });
    const routeStopMediaSyncer = new MediaPolicyGatedRouteStopMediaSyncer({
      inner: new RouteStopMediaSyncer({
        prisma,
        attachmentResolver: wordpressRepository,
        mediaImporterFactory,
        lineageWriter,
      }),
      mediaPolicy: profile.mediaPolicy,
    });
    const placeMediaSyncer = new MediaPolicyGatedPlaceMediaSyncer({
      inner: new PlaceMediaSyncer({
        prisma,
        attachmentResolver: wordpressRepository,
        mediaImporterFactory,
        lineageWriter,
      }),
      mediaPolicy: samplingActive
        ? (sourceRecordKey: string) =>
            resolveSampledMediaPolicy({ environment: profile.environment, sourceRecordKey })
        : profile.mediaPolicy,
    });

    const runners = {
      place: new PlaceCommitRunner({
        orchestrator: new PlaceCommitOrchestrator(new PlaceCommitWriter(prisma)),
        lineageWriter,
        prisma,
        mediaSyncer: placeMediaSyncer,
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
      route: new RouteCommitRunner({
        orchestrator: new RouteCommitOrchestrator(new RouteCommitWriter(prisma)),
        lineageWriter,
        prisma,
        mediaSyncer: routeStopMediaSyncer,
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
