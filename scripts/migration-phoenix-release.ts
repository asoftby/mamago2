import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

import {
  JsonLinesPhoenixReportStore,
  loadPhoenixEnvironment,
  loadPhoenixReleaseManifest,
  runPhoenixRelease,
  verifyArtifactHashes,
  type PhoenixEnvironment,
  type PhoenixMode,
  type PhoenixPhaseName,
  type PhoenixPhaseReport,
  type PhoenixReleaseManifest,
  createLiveStateCheckpoint,
  loadAndValidateLiveStateCheckpoint,
  type LiveCheckpointEvidenceRequest,
} from "../src/lib/migration/release";
import { buildPhoenixAdapterRegistry } from "../src/lib/migration/release/adapters/registry";
import {
  applyReleaseActionExceptions,
  buildContinuationEvidence,
  extractFailedKey,
  loadCrossShaContinuationChain,
  resolveChainOriginCodeSha,
  runContinuationAwarePlan,
  type CrossShaContinuationChain,
} from "../src/lib/migration/release/continuation";
import { exactExecutableKeys } from "../src/lib/migration/release/manifest";

interface Args {
  environment: PhoenixEnvironment;
  manifestPath: string;
  mode: PhoenixMode;
  confirmProduction: boolean;
  resumeFrom?: PhoenixPhaseName;
  reportPath: string;
  continueFromReport?: string;
  continueFromReportSha256?: string;
  continueFromCodeSha?: string;
  createLiveCheckpoint?: string;
  checkpointEvidence?: LiveCheckpointEvidenceRequest;
  continueFromLiveCheckpoint?: string;
  continueFromLiveCheckpointSha256?: string;
  continueFromLiveCheckpointCodeSha?: string;
}

function value(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index < 0 ? undefined : argv[index + 1];
}

export function parseArgs(argv: readonly string[]): Args {
  const environment = value(argv, "--environment") as PhoenixEnvironment | undefined;
  if (!environment || !["LOCAL", "DEV", "PROD"].includes(environment)) {
    throw new Error("--environment LOCAL|DEV|PROD is required.");
  }
  const manifestPath = value(argv, "--manifest");
  if (!manifestPath) throw new Error("--manifest <path> is required.");
  const modes = [
    argv.includes("--plan") && "PLAN",
    argv.includes("--apply") && "APPLY",
    argv.includes("--rerun") && "RERUN",
  ].filter(Boolean) as PhoenixMode[];
  if (modes.length !== 1) throw new Error("Exactly one of --plan|--apply|--rerun is required.");

  const continueFromReport = value(argv, "--continue-from-report");
  const continueFromReportSha256 = value(argv, "--continue-from-report-sha256");
  const continueFromCodeSha = value(argv, "--continue-from-code-sha");
  const continuationFlags = [continueFromReport, continueFromReportSha256, continueFromCodeSha];
  if (continuationFlags.some(Boolean)) {
    if (!continuationFlags.every(Boolean)) {
      throw new Error(
        "--continue-from-report requires --continue-from-report-sha256 and --continue-from-code-sha together (all three or none).",
      );
    }
    if (argv.includes("--resume-from")) throw new Error("--continue-from-report cannot be combined with --resume-from.");
    if (modes[0] !== "APPLY" && modes[0] !== "PLAN") {
      throw new Error("--continue-from-report/--continue-from-report-sha256/--continue-from-code-sha are only valid with --plan or --apply.");
    }
  }

  const createLiveCheckpoint = value(argv, "--create-live-checkpoint");
  const checkpointEvidenceValues = {
    anchorReportPath: value(argv, "--checkpoint-anchor-report"),
    anchorReportSha256: value(argv, "--checkpoint-anchor-report-sha256"),
    anchorReportCodeSha: value(argv, "--checkpoint-anchor-report-code-sha"),
    partialReportPath: value(argv, "--checkpoint-partial-report"),
    partialReportSha256: value(argv, "--checkpoint-partial-report-sha256"),
    partialReportCodeSha: value(argv, "--checkpoint-partial-report-code-sha"),
    protectedManifestPath: value(argv, "--checkpoint-protected-manifest"),
    protectedManifestSha256: value(argv, "--checkpoint-protected-manifest-sha256"),
  };
  const checkpointEvidenceList = Object.values(checkpointEvidenceValues);
  if (createLiveCheckpoint || checkpointEvidenceList.some(Boolean)) {
    if (!createLiveCheckpoint || !checkpointEvidenceList.every(Boolean)) {
      throw new Error("--create-live-checkpoint requires the complete anchor, partial-report and protected-manifest evidence flag set.");
    }
    if (modes[0] !== "PLAN") throw new Error("--create-live-checkpoint is only valid with --plan.");
    if (continuationFlags.some(Boolean)) throw new Error("--create-live-checkpoint cannot combine with report continuation.");
  }
  const checkpointEvidence = createLiveCheckpoint ? checkpointEvidenceValues as LiveCheckpointEvidenceRequest : undefined;

  const continueFromLiveCheckpoint = value(argv, "--continue-from-live-checkpoint");
  const continueFromLiveCheckpointSha256 = value(argv, "--continue-from-live-checkpoint-sha256");
  const continueFromLiveCheckpointCodeSha = value(argv, "--continue-from-live-checkpoint-code-sha");
  const liveContinuationFlags = [continueFromLiveCheckpoint, continueFromLiveCheckpointSha256, continueFromLiveCheckpointCodeSha];
  if (liveContinuationFlags.some(Boolean)) {
    if (!liveContinuationFlags.every(Boolean)) throw new Error("--continue-from-live-checkpoint requires path, SHA-256 and code SHA together (all three or none).");
    if (modes[0] !== "PLAN" && modes[0] !== "APPLY") throw new Error("--continue-from-live-checkpoint is only valid with --plan or --apply.");
    if (continuationFlags.some(Boolean) || createLiveCheckpoint || argv.includes("--resume-from")) throw new Error("Live-checkpoint continuation cannot combine with report continuation, checkpoint creation or --resume-from.");
  }

  return {
    environment,
    manifestPath,
    mode: modes[0],
    confirmProduction: argv.includes("--confirm-production"),
    resumeFrom: value(argv, "--resume-from") as PhoenixPhaseName | undefined,
    reportPath: value(argv, "--report") ?? `.phoenix-reports/${environment.toLowerCase()}.jsonl`,
    continueFromReport,
    continueFromReportSha256,
    continueFromCodeSha,
    createLiveCheckpoint,
    checkpointEvidence,
    continueFromLiveCheckpoint,
    continueFromLiveCheckpointSha256,
    continueFromLiveCheckpointCodeSha,
  };
}

async function queryDatabaseFingerprint(databaseUrl: string): Promise<{ currentDatabase: string; schema: string }> {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    const rows = await prisma.$queryRaw<Array<{ database: string; schema: string }>>`
      SELECT current_database() AS database, current_schema() AS schema
    `;
    if (rows.length !== 1) throw new Error("Database fingerprint query returned an unexpected row count.");
    return { currentDatabase: rows[0].database, schema: rows[0].schema };
  } finally {
    await prisma.$disconnect();
  }
}

const CODE_SHA_PATTERN = /^[0-9a-f]{40}$/;
const BAKED_CODE_SHA_PATH = "/app/.phoenix-code-sha";

function assertValidCodeSha(value: string, source: string): string {
  if (!CODE_SHA_PATTERN.test(value)) {
    throw new Error(`CODE_SHA_INVALID: ${source} did not produce exactly 40 lowercase hexadecimal characters.`);
  }
  return value;
}

export interface ResolveCodeShaDeps {
  readBakedFile?: () => string;
  gitRevParseHead?: () => string;
}

/**
 * The `phoenix-migrate` image has no Git binary and no `.git` directory
 * (see Dockerfile), so `git rev-parse HEAD` always fails there with
 * `spawnSync git ENOENT`. That image instead bakes the approved commit SHA
 * into `/app/.phoenix-code-sha` at build time (`--build-arg
 * PHOENIX_CODE_SHA=<sha>`). Git remains the source of truth for ordinary
 * local execution from a real checkout, where the baked file doesn't exist.
 */
export function resolveCodeSha(deps: ResolveCodeShaDeps = {}): string {
  const readBakedFile = deps.readBakedFile ?? (() => readFileSync(BAKED_CODE_SHA_PATH, "utf8"));
  const gitRevParseHead =
    deps.gitRevParseHead ?? (() => execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim());

  let baked: string | undefined;
  try {
    baked = readBakedFile();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code !== "ENOENT") {
      throw new Error(`CODE_SHA_BAKED_FILE_UNREADABLE: could not read baked code-SHA file (${code ?? "unknown error"}).`);
    }
    baked = undefined;
  }

  if (baked !== undefined) {
    return assertValidCodeSha(baked.trim(), "baked code-SHA file");
  }

  let gitOutput: string;
  try {
    gitOutput = gitRevParseHead();
  } catch {
    throw new Error(
      "CODE_SHA_UNAVAILABLE: no baked code-SHA file and `git rev-parse HEAD` failed — code identity could not be established.",
    );
  }
  return assertValidCodeSha(gitOutput.trim(), "git rev-parse HEAD");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { manifest, manifestHash } = loadPhoenixReleaseManifest(args.manifestPath);
  verifyArtifactHashes(args.manifestPath, manifest);
  const environment = await loadPhoenixEnvironment({
    environment: args.environment,
    confirmProduction: args.confirmProduction,
    currentDatabase: queryDatabaseFingerprint,
  });

  // Planning is intentionally useful even while some phases are blocked:
  // it verifies every frozen hash, fingerprints the deployment target, and
  // exposes the exact executable/protected scope without performing writes.
  if (args.mode === "PLAN" && !args.continueFromReport && !args.createLiveCheckpoint && !args.continueFromLiveCheckpoint) {
    const plan = {
      releaseId: manifest.releaseId,
      manifestPath: args.manifestPath,
      manifestHash,
      codeSha: resolveCodeSha(),
      environment,
      phases: manifest.phaseOrder.map((name) => {
        const phase = manifest.phases.find((item) => item.name === name)!;
        return {
          name,
          status: phase.status,
          expectedCount: phase.records.length,
          records: phase.records,
          protectedSourceRecordKeys: phase.protectedSourceRecordKeys,
          excludedSourceRecordKeys: phase.excludedSourceRecordKeys,
          exclusionReasons: phase.exclusionReasons ?? {},
          blocker: phase.blocker ?? null,
          blockerCode: phase.blockerCode ?? null,
        };
      }),
    };
    // No secrets are present: the loader returns only safe fingerprints.
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  if (args.mode === "PLAN" && args.createLiveCheckpoint) {
    const codeSha = resolveCodeSha();
    const correctedManifest: PhoenixReleaseManifest = { ...manifest, phases: manifest.phases.map(applyReleaseActionExceptions) };
    const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL! });
    try {
      const checkpoint = await createLiveStateCheckpoint({
        prisma,
        request: args.checkpointEvidence!,
        expected: { releaseId: manifest.releaseId, manifestHash, codeSha, environment, manifest: correctedManifest },
        outputPath: args.createLiveCheckpoint,
      });
      console.log(JSON.stringify(checkpoint, null, 2));
      return;
    } finally { await prisma.$disconnect(); }
  }

  if (args.mode === "PLAN" && args.continueFromLiveCheckpoint) {
    const codeSha = resolveCodeSha();
    const correctedManifest: PhoenixReleaseManifest = { ...manifest, phases: manifest.phases.map(applyReleaseActionExceptions) };
    const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL! });
    try {
      const validated = await loadAndValidateLiveStateCheckpoint({
        prisma, checkpointPath: args.continueFromLiveCheckpoint,
        checkpointSha256: args.continueFromLiveCheckpointSha256!, checkpointCodeSha: args.continueFromLiveCheckpointCodeSha!,
        expected: { releaseId: manifest.releaseId, manifestHash, codeSha, environment, manifest: correctedManifest },
      });
      console.log(JSON.stringify({ mode: "LIVE_CHECKPOINT_READ_ONLY_PLAN", status: "READY", completed: validated.checkpoint.completedCounts,
        nextPhase: validated.startPhase, firstExecutableSourceKey: validated.checkpoint.firstExecutableSourceKey, writersInvoked: 0 }, null, 2));
      return;
    } finally { await prisma.$disconnect(); }
  }

  if (args.mode === "PLAN") {
    const codeSha = resolveCodeSha();
    const correctedManifest: PhoenixReleaseManifest = {
      ...manifest,
      phases: manifest.phases.map(applyReleaseActionExceptions),
    };
    const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL! });
    try {
      const result = await runContinuationAwarePlan({
        prisma,
        request: {
          reportPath: args.continueFromReport!,
          reportSha256: args.continueFromReportSha256!,
          predecessorCodeSha: args.continueFromCodeSha!,
        },
        expected: { releaseId: manifest.releaseId, manifestHash, currentCodeSha: codeSha, environment, manifest: correctedManifest },
      });
      console.log(JSON.stringify(result, null, 2));
      if (result.status === "BLOCKED") process.exitCode = 2;
      return;
    } finally {
      await prisma.$disconnect();
    }
  }

  // Apply/rerun intentionally fail closed until every phase has a concrete
  // adapter contract. This prevents the CLI shell from becoming an ad-hoc
  // reimplementation of the proven entity runners. Note this means a full
  // 7-phase manifest never reaches `places`/`offers`/`routes`/`events`/
  // `articles` today: `businesses` sits between `users` and `places` in
  // `phaseOrder` and is BLOCKED
  // (BUSINESS_OWNERSHIP_GENERIC_CASE_SOURCE_EVIDENCE_MISSING), so
  // `runPhoenixRelease` itself throws `PHASE_BLOCKED: businesses: ...`
  // immediately after `users` completes — by design, not an oversight.
  const blocked = manifest.phases.filter((phase) => phase.status === "BLOCKED");
  if (blocked.length > 0) {
    throw new Error(`RELEASE_BLOCKED: ${blocked.map((phase) => `${phase.name}: ${phase.blocker}`).join("; ")}`);
  }

  const artifactRoot = process.env.PHOENIX_RELEASE_ARTIFACT_ROOT;
  if (!artifactRoot) throw new Error("RELEASE_BLOCKED: PHOENIX_RELEASE_ARTIFACT_ROOT is required for apply/rerun.");

  // `environment.database` is a deliberately redacted fingerprint (no
  // secrets) — the real DATABASE_URL used to construct the write client is
  // the same one `loadPhoenixEnvironment`/`queryDatabaseFingerprint` already
  // validated above, read directly from process.env.
  const databaseUrl = process.env.DATABASE_URL!;
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    const codeSha = resolveCodeSha();

    // Applies any narrow, itemized release action exceptions (currently
    // just `wordpress-db:user:38`, see `continuation.ts`) to an in-memory
    // copy of the manifest used only for execution. Never touches the
    // committed manifest file or `manifestHash`, which continue to refer
    // to the pristine, unmodified manifest for every hash/identity check
    // below — this is a runtime data correction, not a manifest edit.
    // Applied unconditionally to every apply/rerun, continuation or not:
    // it corrects a stale manifest record, independent of continuation.
    const correctedManifest: PhoenixReleaseManifest = {
      ...manifest,
      phases: manifest.phases.map(applyReleaseActionExceptions),
    };

    let continuationChain: CrossShaContinuationChain | undefined;
    let continuationEvidence: Record<string, string> | undefined;
    let liveCheckpointContinuation: Awaited<ReturnType<typeof loadAndValidateLiveStateCheckpoint>> | undefined;
    if (args.continueFromReport) {
      // Presence of any one continuation flag already implies all three
      // (parseArgs enforces this), so these are always defined here.
      const chain = loadCrossShaContinuationChain(
        {
          reportPath: args.continueFromReport,
          reportSha256: args.continueFromReportSha256!,
          predecessorCodeSha: args.continueFromCodeSha!,
        },
        { releaseId: manifest.releaseId, manifestHash, currentCodeSha: codeSha, environment, manifest: correctedManifest },
      );
      const phase = correctedManifest.phases.find((item) => item.name === chain.failureReport.phase);
      if (!phase) throw new Error(`RELEASE_BLOCKED:CONTINUATION_PHASE_NOT_IN_MANIFEST:${chain.failureReport.phase}`);
      const failedKey = extractFailedKey(chain.failureReport);
      const skippedCompletedPrefixCount = exactExecutableKeys(phase).indexOf(failedKey);
      if (skippedCompletedPrefixCount < 0) throw new Error("RELEASE_BLOCKED:CONTINUATION_FAILED_KEY_NOT_IN_MANIFEST");

      continuationChain = chain;
      continuationEvidence = buildContinuationEvidence({
        predecessorCodeSha: args.continueFromCodeSha!,
        predecessorReportSha256: args.continueFromReportSha256!,
        predecessorTerminalFailedKey: failedKey,
        skippedCompletedPrefixCount,
        continuationStartKey: failedKey,
        chainOriginCodeSha: resolveChainOriginCodeSha(chain.failureReport, args.continueFromCodeSha!),
      });
    }

    if (args.continueFromLiveCheckpoint) {
      liveCheckpointContinuation = await loadAndValidateLiveStateCheckpoint({
        prisma, checkpointPath: args.continueFromLiveCheckpoint,
        checkpointSha256: args.continueFromLiveCheckpointSha256!, checkpointCodeSha: args.continueFromLiveCheckpointCodeSha!,
        expected: { releaseId: manifest.releaseId, manifestHash, codeSha, environment, manifest: correctedManifest },
      });
      continuationEvidence = {
        liveCheckpointSha256: args.continueFromLiveCheckpointSha256!,
        liveCheckpointCodeSha: args.continueFromLiveCheckpointCodeSha!,
        liveCheckpointStartKey: liveCheckpointContinuation.checkpoint.firstExecutableSourceKey,
      };
    }

    const adapters = await buildPhoenixAdapterRegistry({ prisma, artifactRoot, manifest: correctedManifest, continuationChain,
      continuationReportSha256: args.continueFromReportSha256,
      liveCheckpointPhaseSkipSets: liveCheckpointContinuation?.phaseSkipSets });
    const reportStore = new JsonLinesPhoenixReportStore(args.reportPath);
    const previousReports: PhoenixPhaseReport[] = args.resumeFrom
      ? [...((await reportStore.readCompletedPrefix?.()) ?? [])]
      : [];

    const reports = await runPhoenixRelease({
      manifest: correctedManifest,
      manifestPath: args.manifestPath,
      manifestHash,
      environment,
      mode: args.mode,
      codeSha,
      adapters,
      reportStore,
      resumeFrom: args.resumeFrom,
      previousReports,
      continuationEvidence,
      liveCheckpointStartPhase: liveCheckpointContinuation?.startPhase,
    });
    console.log(JSON.stringify(reports, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectRun = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(`migration:phoenix-release failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

export function readPlanOutput(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}
