import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

import { applyRouteReviewPlan } from "../src/lib/migration/reviews/route/applyRouteReviewPlan";
import type { RouteReviewApplyPlan } from "../src/lib/migration/reviews/route/routeEditorialReview";

export interface ApplyRouteReviewCliArgs {
  planPath: string;
  apply: boolean;
  sourceRecordKey?: string;
}

function flagValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
}

export function parseArgs(argv: readonly string[]): ApplyRouteReviewCliArgs {
  const planPath = flagValue(argv, "--plan") ?? "docs/migration/reviews/route-review-2026-07.json";
  if (!planPath || planPath.startsWith("--")) {
    throw new Error("Missing value for --plan.");
  }
  const sourceRecordKey = flagValue(argv, "--source-record-key");
  if (sourceRecordKey !== undefined && sourceRecordKey.startsWith("--")) {
    throw new Error("Missing value for --source-record-key.");
  }
  return {
    planPath,
    apply: argv.includes("--apply"),
    sourceRecordKey,
  };
}

export function parseRouteReviewPlan(raw: string, sourcePath: string): RouteReviewApplyPlan {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`${sourcePath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${sourcePath} must be a JSON object.`);
  }
  const plan = parsed as Partial<RouteReviewApplyPlan>;
  if (!Array.isArray(plan.routes)) {
    throw new Error(`${sourcePath} must contain a routes array.`);
  }
  return plan as RouteReviewApplyPlan;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const plan = parseRouteReviewPlan(readFileSync(args.planPath, "utf8"), args.planPath);
  const prisma = new PrismaClient();

  try {
    const result = await applyRouteReviewPlan(prisma, plan, {
      apply: args.apply,
      sourceRecordKey: args.sourceRecordKey,
    });

    console.log(args.apply ? "Route review apply" : "Route review apply dry-run");
    for (const route of result.routes) {
      const reason = route.reason ? ` (${route.reason})` : "";
      console.log(`- ${route.sourceRecordKey}: ${route.status}${reason}`);
      for (const change of route.changes) {
        console.log(`  * ${change}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error) => {
    console.error(`\nmigration-apply-route-review failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
