import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

import {
  buildRouteEditorialReview,
  buildRouteReviewApplyPlan,
  renderRouteEditorialReviewMarkdown,
} from "../src/lib/migration/reviews/route/routeEditorialReview";

export interface RouteReviewCliArgs {
  markdownOut: string;
  jsonOut: string;
}

function flagValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
}

export function parseArgs(argv: readonly string[]): RouteReviewCliArgs {
  const markdownOut = flagValue(argv, "--markdown-out") ?? "docs/migration/reviews/route-review-2026-07.md";
  const jsonOut = flagValue(argv, "--json-out") ?? "docs/migration/reviews/route-review-2026-07.json";
  if (!markdownOut || markdownOut.startsWith("--")) {
    throw new Error("Missing value for --markdown-out.");
  }
  if (!jsonOut || jsonOut.startsWith("--")) {
    throw new Error("Missing value for --json-out.");
  }
  return { markdownOut, jsonOut };
}

function ensureParentDir(filePath: string): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();

  try {
    const report = await buildRouteEditorialReview(prisma);
    const plan = buildRouteReviewApplyPlan(report);
    ensureParentDir(args.markdownOut);
    ensureParentDir(args.jsonOut);
    writeFileSync(args.markdownOut, renderRouteEditorialReviewMarkdown(report));
    writeFileSync(args.jsonOut, `${JSON.stringify(plan, null, 2)}\n`);

    console.log("Route editorial review");
    console.log(`routes checked: ${report.actualRouteCount}`);
    console.log(`active lineages: ${report.activeLineageCount}`);
    console.log(`DRAFT/PRIVATE: ${report.draftPrivateCount}`);
    console.log(`decision counts: ${JSON.stringify(report.decisionCounts)}`);
    if (report.globalBlockers.length > 0) {
      console.log(`global blockers: ${report.globalBlockers.join("; ")}`);
    }
    console.log(`markdown: ${args.markdownOut}`);
    console.log(`json: ${args.jsonOut}`);
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error) => {
    console.error(`\nmigration-route-review failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
