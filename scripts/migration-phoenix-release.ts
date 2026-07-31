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
} from "../src/lib/migration/release";
import { buildPhoenixAdapterRegistry } from "../src/lib/migration/release/adapters/registry";

interface Args {
  environment: PhoenixEnvironment;
  manifestPath: string;
  mode: PhoenixMode;
  confirmProduction: boolean;
  resumeFrom?: PhoenixPhaseName;
  reportPath: string;
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
  return {
    environment,
    manifestPath,
    mode: modes[0],
    confirmProduction: argv.includes("--confirm-production"),
    resumeFrom: value(argv, "--resume-from") as PhoenixPhaseName | undefined,
    reportPath: value(argv, "--report") ?? `.phoenix-reports/${environment.toLowerCase()}.jsonl`,
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

function codeSha(): string {
  return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
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
  if (args.mode === "PLAN") {
    const plan = {
      releaseId: manifest.releaseId,
      manifestPath: args.manifestPath,
      manifestHash,
      codeSha: codeSha(),
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
    const adapters = await buildPhoenixAdapterRegistry({ prisma, artifactRoot, manifest });
    const reportStore = new JsonLinesPhoenixReportStore(args.reportPath);
    const previousReports: PhoenixPhaseReport[] = args.resumeFrom
      ? [...((await reportStore.readCompletedPrefix?.()) ?? [])]
      : [];

    const reports = await runPhoenixRelease({
      manifest,
      manifestPath: args.manifestPath,
      manifestHash,
      environment,
      mode: args.mode,
      codeSha: codeSha(),
      adapters,
      reportStore,
      resumeFrom: args.resumeFrom,
      previousReports,
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
