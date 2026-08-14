import assert from "node:assert/strict";
import type { Route } from "@prisma/client";
import type { NormalizedRouteCandidate } from "../../adapters/wordpress-db/normalizeRoute";
import { createRoutesTargetStateResolver, createRoutesWriter, type RawRouteSourceRepository, type RoutesWriterPrismaClient, type RoutesWriteTransactionClient } from "./routesProductionWiring";
const KEY = "wordpress-db:routes:1";
function normalized(): NormalizedRouteCandidate { return { title: "Route", slug: "route", status: "publish", publishedAt: "2026-01-01", modifiedAt: "2026-01-02", stops: [{ index: 1, title: "One", description: "First", imageAttachmentIds: [], placeId: null }, { index: 2, title: "Two", description: "Second", imageAttachmentIds: [], placeId: null }], locationRaw: null, location: null, media: { featuredAttachmentId: null }, seo: { title: null, focusKeyword: null }, sourceTerms: [], rawMeta: {} }; }
const raw: RawRouteSourceRepository = { load: () => ({ normalized: normalized(), sourceHash: "hash", warnings: [] }) };
const candidate = { sourceRecordKey: KEY, domainHash: "hash", slug: "route" };
function transactionalFake(failAt?: "stop" | "lineage") {
  const committed = { routes: [] as string[], stops: [] as string[], lineages: [] as string[] };
  const prisma: RoutesWriterPrismaClient = { $transaction: async (fn) => {
    const staged = { routes: [] as string[], stops: [] as string[], lineages: [] as string[] };
    const tx = {
      route: {
        findUnique: async () => null,
        create: async (args: { data: { slug: string; stops?: { create?: unknown[] } } }) => { staged.routes.push("route-1"); if (failAt === "stop") throw new Error("ROUTE_STOP_FAILED"); staged.stops.push(...(args.data.stops?.create ?? []).map((_, i) => `stop-${i + 1}`)); return { id: "route-1", slug: args.data.slug } as Route; },
        update: async () => { throw new Error("unused"); },
      },
      routeStop: { deleteMany: async () => ({ count: 0 }), createMany: async () => ({ count: 0 }) },
      routeSlugHistory: { findUnique: async () => null },
      migrationLineage: { updateMany: async () => ({ count: 0 }), findUnique: async () => null, findUniqueOrThrow: async () => ({ id: "l1" }), create: async () => { if (failAt === "lineage") throw new Error("LINEAGE_FAILED"); staged.lineages.push("lineage-1"); return { id: "lineage-1" }; } },
    } as unknown as RoutesWriteTransactionClient;
    const result = await fn(tx); committed.routes.push(...staged.routes); committed.stops.push(...staged.stops); committed.lineages.push(...staged.lineages); return result;
  } };
  return { prisma, committed };
}
async function main() {
  const resolver = createRoutesTargetStateResolver({ migrationLineage: { findMany: async () => [] }, route: { findMany: async () => [{ id: "natural" }], findUnique: async () => null } } as never, "source");
  assert.equal((await resolver(candidate)).targetCount, 1, "target state resolves by exact global slug");
  const happy = transactionalFake(); await createRoutesWriter(happy.prisma, raw, "source")(candidate); assert.deepEqual(happy.committed, { routes: ["route-1"], stops: ["stop-1", "stop-2"], lineages: ["lineage-1"] });
  const stopFailure = transactionalFake("stop"); await assert.rejects(() => createRoutesWriter(stopFailure.prisma, raw, "source")(candidate), /ROUTE_STOP_FAILED/); assert.deepEqual(stopFailure.committed, { routes: [], stops: [], lineages: [] });
  const lineageFailure = transactionalFake("lineage"); await assert.rejects(() => createRoutesWriter(lineageFailure.prisma, raw, "source")(candidate), /LINEAGE_FAILED/); assert.deepEqual(lineageFailure.committed, { routes: [], stops: [], lineages: [] });
  console.log("Phoenix Routes production wiring tests: PASS");
}
void main();
