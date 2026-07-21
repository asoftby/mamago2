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
import NodeModule from "node:module";
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
import { runAtomicEventCreate } from "../src/lib/migration/commit/event/runAtomicEventCreate";
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
import {
  parseEventPostIdFromSourceRecordKey,
  runEventMediaOnlyReprocess,
  validateEventMediaOnlyReprocessArgs,
  validateEventMediaOnlyReprocessRuntime,
} from "../src/lib/migration/runtime/eventMediaOnlyReprocess";
import {
  parseArticlePostIdFromSourceRecordKey,
  validateArticleMediaReplayArgs,
  validateArticleMediaReplayRuntime,
} from "../src/lib/migration/runtime/articleMediaOnlyReplay";
import { runStrictArticleMediaReplay } from "../src/lib/migration/runtime/strictArticleMediaReplay";
import { ArticleMediaReplaySyncer } from "../src/lib/migration/commit/article/ArticleMediaReplaySyncer";
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
  forceMediaReprocess: boolean;
  forceArticleMediaReplay: boolean;
  mediaOwnerUserId?: string;
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
  const forceMediaReprocess = argv.includes("--force-media-reprocess");
  const forceArticleMediaReplay = argv.includes("--force-article-media-replay");

  const mediaOwnerUserIdIndex = argv.indexOf("--media-owner-user-id");
  const mediaOwnerUserId = mediaOwnerUserIdIndex !== -1 ? argv[mediaOwnerUserIdIndex + 1] : undefined;

  const sourceRecordKeyIndex = argv.indexOf("--source-record-key");
  const sourceRecordKey =
    sourceRecordKeyIndex !== -1 ? argv[sourceRecordKeyIndex + 1] : undefined;
  if (sourceRecordKeyIndex !== -1 && !sourceRecordKey) {
    throw new Error("Missing value for --source-record-key.");
  }
  const sourceRecordKeyCount = argv.filter((token) => token === "--source-record-key").length;

  if (forceReprocess) {
    if (entity !== "article" && entity !== "place") {
      throw new Error("--force-reprocess is only supported with --entity article|place.");
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

  if (forceMediaReprocess) {
    const guard = validateEventMediaOnlyReprocessArgs({
      entity,
      sourceRecordKeyCount,
      mediaPolicyName: mediaPolicyName ?? undefined,
      forceReprocess,
    });
    if (!guard.ok) {
      throw new Error(guard.reason);
    }
  }

  if (forceArticleMediaReplay) {
    const guard = validateArticleMediaReplayArgs({
      entity,
      sourceRecordKeyCount,
      mediaPolicyName: mediaPolicyName ?? undefined,
      forceReprocess,
      forceMediaReprocess,
      mediaOwnerUserId,
    });
    if (!guard.ok) {
      throw new Error(guard.reason);
    }
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
    forceMediaReprocess,
    forceArticleMediaReplay,
    mediaOwnerUserId,
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

let serverOnlyStubInstalled = false;

/**
 * Patches Node's CJS loader (`Module._load`) to resolve the bare specifier
 * `"server-only"` to an empty stub instead of the real
 * `node_modules/server-only/index.js`, which throws unconditionally
 * outside Next.js's bundler (see the long comment at the call site).
 * Deliberately narrower than the global `--conditions=react-server` flag
 * this replaced: only the exact string `"server-only"` is special-cased,
 * so `react`, `@radix-ui/*`, and everything else this CLI's import graph
 * happens to touch still resolve completely normally. Idempotent — safe
 * to call more than once (e.g. from a test).
 */
export function installServerOnlyStub(): void {
  if (serverOnlyStubInstalled) return;
  serverOnlyStubInstalled = true;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patchable = NodeModule as any;
  const originalLoad = patchable._load;
  patchable._load = function (request: string, ...rest: unknown[]) {
    if (request === "server-only") {
      return {};
    }
    return originalLoad.apply(this, [request, ...rest]);
  };
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

/**
 * Flips a single `SKIP_UNCHANGED` plan item (identified by
 * `args.sourceRecordKey`) to `UPDATE`, in place, on both the persisted
 * `plan.items` and the `executionCandidates` that still carry the real
 * normalized candidate a `SKIP_UNCHANGED` item was never dropped for (see
 * `runCommitExecutionPlan.ts`'s own doc comment on that). Entity-agnostic —
 * it only ever matches by `sourceRecordKey` + `SKIP_UNCHANGED`, never by
 * `targetType` — so the same function already served `--entity article`
 * and now also serves `--entity place`, without any Place-specific branch.
 *
 * Originally article-only in `parseArgs()`'s validation. Widened to Place
 * to close a real gap: `PlaceMediaSyncer` never crashes on a partial media
 * failure (the Place commit still reaches `LINKED`), but a *plain* re-run
 * of an unchanged source record classifies `SKIP_UNCHANGED` and is
 * intercepted before `dispatchCommitRunner()` — so `PlaceCommitRunner`,
 * and therefore `mediaSyncer.sync()`, is never invoked again, and any
 * attachment that failed to import on the first run would stay missing
 * forever. Forcing the plan item to `UPDATE` gives it a real second pass
 * through `PlaceCommitRunner`, which invokes `mediaSyncer.sync()` again on
 * `UPDATE_SAFE` — `PlaceMediaSyncer` is already idempotent (existing
 * `MigrationLineage(MEDIA_ASSET)`/`PlaceImage` rows are reused, never
 * re-downloaded or duplicated — see `PlaceMediaSyncer.test.ts`), so this
 * genuinely retries only what's missing.
 *
 * This does **not** bypass Place's own UPDATE safety check: forcing the
 * plan item's *action* has no effect on `PlaceCommitRunner.classifyUpdate()`,
 * which independently re-derives safety from `MigrationLineage`/the target
 * `Place` row's own `updatedAt` regardless of how the action was decided.
 * A Place that was manually edited since its last import still correctly
 * comes back `UPDATE_CONFLICT`/`QUARANTINED`, forced or not.
 */
export function applyForcedReprocess(
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
    applyForcedReprocess(executionPlan, args);

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
    //
    // Confirmed 2026-07-15 (first real golden-write attempt): laziness
    // alone does not make a *FULL* run work — the module still throws the
    // moment it's actually loaded. The first fix attempted here was a
    // global `NODE_OPTIONS`/`--conditions=react-server` flag, matching
    // `server-only`'s own conditional package.json export
    // (`"react-server": "./empty.js"` vs `"default": "./index.js"`) — this
    // was REJECTED after testing: `--conditions` is process-global, so it
    // also changes how `react` itself resolves for every other package in
    // this CLI's much larger import graph (this script transitively pulls
    // in a lot more than just the media pipeline), and several UI
    // dependencies (e.g. `@radix-ui/react-*`) crashed with
    // `React.createContext is not a function` — the "react-server" build
    // of React doesn't have it. `installServerOnlyStub()` below is the
    // safe fix instead: it patches Node's CJS loader to special-case only
    // the exact bare specifier `"server-only"`, so nothing else in the
    // process resolves any differently (verified directly: `react` and
    // `@radix-ui/*` still resolve to their normal builds with this patch
    // applied).
    let createMamagoMediaImporter: typeof import("../src/lib/migration/media")["createMamagoMediaImporter"] | undefined;
    if (profile.mediaPolicy.name === "FULL" || samplingActive) {
      installServerOnlyStub();
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

    const innerEventMediaSyncer = new EventMediaSyncer({
      prisma,
      attachmentResolver: wordpressRepository,
      mediaImporterFactory,
      lineageWriter,
    });
    const eventMediaSyncer = new MediaPolicyGatedEventMediaSyncer({
      inner: innerEventMediaSyncer,
      mediaPolicy: samplingActive
        ? (sourceRecordKey: string) =>
            resolveSampledMediaPolicy({ environment: profile.environment, sourceRecordKey })
        : profile.mediaPolicy,
    });

    // `--force-media-reprocess`: a narrow, separate replay path for a single
    // Event's media only (see eventMediaOnlyReprocess.ts/strictEventMediaReplay.ts
    // doc comments for why this exists instead of widening the unsafe
    // `--force-reprocess` to events, and why it uses the fail-closed strict
    // replay rather than plain `EventMediaSyncer.sync()`). This branch never
    // reaches `createMigrationRunExecutionPlan`/`runCommitExecutionPlan`/
    // `EventCommitRunner` at all.
    if (args.forceMediaReprocess && args.sourceRecordKey) {
      const wpPostId = parseEventPostIdFromSourceRecordKey(args.sourceRecordKey);
      if (wpPostId === null) {
        throw new Error(`--force-media-reprocess: invalid Event sourceRecordKey "${args.sourceRecordKey}".`);
      }
      const bundle = await wordpressRepository.getPublishedEventById(wpPostId);
      const lineage = await prisma.migrationLineage.findFirst({
        where: { sourceRecordKey: args.sourceRecordKey, targetType: "ACTIVITY", isActive: true },
      });
      const target = lineage?.targetId
        ? await prisma.activity.findUnique({
            where: { id: lineage.targetId },
            select: { id: true, ownerUserId: true, coverImageId: true },
          })
        : null;

      const runtimeGuard = validateEventMediaOnlyReprocessRuntime({
        bundle,
        lineage: lineage
          ? { sourceId: lineage.sourceId, isActive: lineage.isActive, targetId: lineage.targetId, lastSourceHash: lineage.lastSourceHash }
          : null,
        targetExists: target !== null,
      });
      if (!runtimeGuard.ok) {
        throw new Error(`--force-media-reprocess refused: ${runtimeGuard.reason}`);
      }

      const currentImages = await prisma.activityImage.findMany({
        where: { activityId: target!.id },
        orderBy: { sortOrder: "asc" },
        select: { mediaAssetId: true },
      });

      const result = await runEventMediaOnlyReprocess({
        sourceId: lineage!.sourceId,
        sourceRecordKey: args.sourceRecordKey,
        activityId: target!.id,
        ownerUserId: target!.ownerUserId,
        candidate: runtimeGuard.candidate,
        freshHash: runtimeGuard.freshHash,
        current: {
          coverImageId: target!.coverImageId,
          galleryMediaAssetIds: currentImages.map((image) => image.mediaAssetId),
        },
        mediaImporter: innerEventMediaSyncer,
        prisma,
      });

      console.log("Event media-only reprocess");
      console.log();
      console.log(`sourceRecordKey: ${args.sourceRecordKey}`);
      console.log(`activityId: ${target!.id}`);
      console.log(`hash (unchanged): ${runtimeGuard.freshHash}`);
      console.log(`result: ${result.status}`);

      if (args.out) {
        writeFileSync(args.out, JSON.stringify({ sourceRecordKey: args.sourceRecordKey, activityId: target!.id, result }, null, 2));
        console.log(`\nJSON report written to ${args.out}`);
      }

      if (result.status === "REFUSED") {
        throw new Error(`--force-media-reprocess refused: ${result.code}: ${result.message}`);
      }
      if (result.status === "FAILED") {
        throw new Error(
          `--force-media-reprocess failed: ${result.code}: ${result.message} — failures: ${JSON.stringify(result.failures)}`,
        );
      }
      if (result.status === "APPLIED") {
        console.log(`coverMediaId: ${result.coverMediaId ?? "(none)"}`);
        console.log(`galleryMediaIds: ${JSON.stringify(result.galleryMediaIds)}`);
        console.log(`reused: ${JSON.stringify(result.reusedAttachmentIds)}, imported: ${JSON.stringify(result.importedAttachmentIds)}`);
      } else {
        console.log(`coverMediaId (unchanged): ${result.coverMediaId ?? "(none)"}`);
      }
      return;
    }

    // `--force-article-media-replay`: a narrow, separate replay path for a
    // single Article's inline/cover media only (see
    // articleMediaOnlyReplay.ts/strictArticleMediaReplay.ts doc comments).
    // Never reaches `createMigrationRunExecutionPlan`/`runCommitExecutionPlan`/
    // `ArticleCommitRunner` at all — the normal Article commit path stays
    // content-only, unchanged.
    if (args.forceArticleMediaReplay && args.sourceRecordKey) {
      const wpPostId = parseArticlePostIdFromSourceRecordKey(args.sourceRecordKey);
      if (wpPostId === null) {
        throw new Error(`--force-article-media-replay: invalid Article sourceRecordKey "${args.sourceRecordKey}".`);
      }
      const bundle = await wordpressRepository.getPublishedArticleById(wpPostId);
      const activeLineageCount = await prisma.migrationLineage.count({
        where: { sourceRecordKey: args.sourceRecordKey, targetType: "ARTICLE", isActive: true },
      });
      const lineage = await prisma.migrationLineage.findFirst({
        where: { sourceRecordKey: args.sourceRecordKey, targetType: "ARTICLE", isActive: true },
      });
      const target = lineage?.targetId
        ? await prisma.article.findUnique({
            where: { id: lineage.targetId },
            select: { id: true, contentJson: true, coverImageId: true },
          })
        : null;
      // Read-only existence check — see articleMediaOnlyReplay.ts's doc
      // comment on `ownerUserExists` (PR #68 review, P1 #2): must happen
      // before any media download/storage write is even attempted.
      const ownerUser = await prisma.user.findUnique({
        where: { id: args.mediaOwnerUserId! },
        select: { id: true },
      });

      const runtimeGuard = validateArticleMediaReplayRuntime({
        bundle,
        lineage: lineage
          ? { sourceId: lineage.sourceId, isActive: lineage.isActive, targetId: lineage.targetId, lastSourceHash: lineage.lastSourceHash }
          : null,
        activeLineageCount,
        targetExists: target !== null,
        targetContentJson: target?.contentJson,
        ownerUserExists: ownerUser !== null,
      });
      if (!runtimeGuard.ok) {
        throw new Error(`--force-article-media-replay refused: ${runtimeGuard.reason}`);
      }

      const candidate = runtimeGuard.candidate;
      // Deliberately kept separate from featuredAttachmentId — see
      // strictArticleMediaReplay.ts's doc comment (PR #68 review, P1 #1):
      // the featured/cover image is frequently absent from post_content
      // entirely, so it must never be required to also appear inline.
      const inlineAttachmentAllowlist = [...new Set(candidate.inlineImageAttachmentIds)];

      const articleMediaSyncer = new ArticleMediaReplaySyncer({
        prisma,
        attachmentResolver: wordpressRepository,
        mediaImporterFactory,
        lineageWriter,
      });

      const result = await runStrictArticleMediaReplay({
        articleId: target!.id,
        sourceId: lineage!.sourceId,
        sourceHash: runtimeGuard.freshHash,
        rawContent: candidate.content,
        featuredAttachmentId: candidate.featuredImageAttachmentId,
        inlineAttachmentAllowlist,
        ownerUserId: args.mediaOwnerUserId!,
        current: {
          contentJson: runtimeGuard.targetContentJson,
          coverImageId: target!.coverImageId,
        },
        mediaImporter: articleMediaSyncer,
        prisma,
      });

      console.log("Article media replay");
      console.log();
      console.log(`sourceRecordKey: ${args.sourceRecordKey}`);
      console.log(`articleId: ${target!.id}`);
      console.log(`hash (unchanged): ${runtimeGuard.freshHash}`);
      console.log(`featuredAttachmentId: ${candidate.featuredImageAttachmentId ?? "(none)"}`);
      console.log(`inlineAttachmentAllowlist: ${JSON.stringify(inlineAttachmentAllowlist)}`);
      console.log(`result: ${result.status}`);

      if (args.out) {
        writeFileSync(
          args.out,
          JSON.stringify(
            { sourceRecordKey: args.sourceRecordKey, articleId: target!.id, featuredAttachmentId: candidate.featuredImageAttachmentId, inlineAttachmentAllowlist, result },
            null,
            2,
          ),
        );
        console.log(`\nJSON report written to ${args.out}`);
      }

      if (result.status === "REFUSED") {
        throw new Error(`--force-article-media-replay refused: ${result.code}: ${result.message}`);
      }
      if (result.status === "FAILED") {
        throw new Error(
          `--force-article-media-replay failed: ${result.code}: ${result.message} — failures: ${JSON.stringify(result.failures)}`,
        );
      }
      if (result.status === "APPLIED") {
        console.log(`coverMediaId: ${result.coverMediaId ?? "(none)"}`);
        console.log(`imageBlockCount: ${result.imageBlockCount}`);
        console.log(`reused: ${JSON.stringify(result.reusedAttachmentIds)}, imported: ${JSON.stringify(result.importedAttachmentIds)}`);
      } else {
        console.log(`coverMediaId (unchanged): ${result.coverMediaId ?? "(none)"}`);
        console.log(`imageBlockCount (unchanged): ${result.imageBlockCount}`);
      }
      return;
    }

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
        runAtomicCreate: runAtomicEventCreate,
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
