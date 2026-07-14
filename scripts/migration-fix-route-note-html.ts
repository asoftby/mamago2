/**
 * One-off fix for routes imported before `810d3254` (which added
 * `htmlToPlainText` to `buildRouteCreateDraft`): their `RouteStop.note`
 * still contains raw WP HTML (`<p>`, `<br>`, entities). This re-runs the
 * same `htmlToPlainText` against every `RouteStop` belonging to a `Route`
 * with an active `MigrationLineage targetType=ROUTE` row, and writes the
 * result back.
 *
 * Dry-run by default; pass --apply to write. `htmlToPlainText` is
 * idempotent on plain text (see buildRouteCreateDraft.test.ts), so a
 * second dry-run after --apply must report zero candidates.
 *
 * Run:
 *   pnpm tsx scripts/migration-fix-route-note-html.ts
 *   pnpm tsx scripts/migration-fix-route-note-html.ts --apply
 */
import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

import { planRouteNoteHtmlFixes } from "../src/lib/migration/commit/route/planRouteNoteHtmlFixes";

export interface FixRouteNoteHtmlPrismaClient {
  migrationLineage: {
    findMany: (args: {
      where: { targetType: "ROUTE"; isActive: true };
      select: { targetId: true };
    }) => Promise<Array<{ targetId: string | null }>>;
  };
  route: {
    findMany: (args: {
      where: { id: { in: string[] } };
      select: {
        id: true;
        title: true;
        stops: { select: { id: true; order: true; note: true }; orderBy: { order: "asc" } };
      };
    }) => Promise<Array<{ id: string; title: string; stops: Array<{ id: string; order: number; note: string }> }>>;
  };
  routeStop: {
    update: (args: { where: { id: string }; data: { note: string } }) => Promise<unknown>;
  };
}

export async function fetchImportedRouteStops(
  prisma: FixRouteNoteHtmlPrismaClient,
): Promise<Array<{ id: string; title: string; stops: Array<{ id: string; order: number; note: string }> }>> {
  const lineages = await prisma.migrationLineage.findMany({
    where: { targetType: "ROUTE", isActive: true },
    select: { targetId: true },
  });
  const routeIds = [...new Set(lineages.map((l) => l.targetId).filter((id): id is string => Boolean(id)))];
  if (routeIds.length === 0) return [];

  return prisma.route.findMany({
    where: { id: { in: routeIds } },
    select: {
      id: true,
      title: true,
      stops: { select: { id: true, order: true, note: true }, orderBy: { order: "asc" } },
    },
  });
}

function printSummary(candidates: ReturnType<typeof planRouteNoteHtmlFixes>, apply: boolean): void {
  console.log(apply ? "Route note HTML fix — apply" : "Route note HTML fix — dry-run");
  console.log(`Stops needing a fix: ${candidates.length}`);

  const byRoute = new Map<string, { title: string; count: number }>();
  for (const c of candidates) {
    const existing = byRoute.get(c.routeId);
    if (existing) existing.count += 1;
    else byRoute.set(c.routeId, { title: c.routeTitle, count: 1 });
  }
  for (const [routeId, { title, count }] of byRoute) {
    console.log(`- ${routeId} (${title}): ${count} stop(s)`);
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const prisma = new PrismaClient();

  try {
    const routes = await fetchImportedRouteStops(prisma);
    const candidates = planRouteNoteHtmlFixes(routes);
    printSummary(candidates, apply);

    if (apply) {
      for (const candidate of candidates) {
        await prisma.routeStop.update({
          where: { id: candidate.stopId },
          data: { note: candidate.after },
        });
      }
      console.log(`Applied ${candidates.length} update(s).`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error) => {
    console.error(`\nmigration-fix-route-note-html failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
