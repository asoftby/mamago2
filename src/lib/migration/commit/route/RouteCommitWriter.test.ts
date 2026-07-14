import assert from "node:assert/strict";

import { RouteCommitWriter } from "./RouteCommitWriter";
import type { RouteCommitWriterPrismaClient } from "./RouteCommitWriter";
import type { RouteCreateDraft } from "./buildRouteCreateDraft";

function draftFixture(overrides: Partial<RouteCreateDraft> = {}): RouteCreateDraft {
  return {
    title: "Family Route",
    slug: "family-route",
    cityId: "city-1",
    status: "DRAFT",
    visibility: "PRIVATE",
    authorId: null,
    seoTitle: "SEO Route",
    stops: [
      { order: 1, placeId: null, customTitle: "First", note: "First note" },
      { order: 2, placeId: null, customTitle: "Second", note: "Second note" },
    ],
    ...overrides,
  };
}

function createFakePrisma(options: { existingSlugs?: readonly string[] } = {}) {
  const calls: { routeCreate: unknown[]; routeFindUnique: unknown[]; routeUpdate: unknown[]; stopDeleteMany: unknown[]; stopCreateMany: unknown[] } = {
    routeCreate: [],
    routeFindUnique: [],
    routeUpdate: [],
    stopDeleteMany: [],
    stopCreateMany: [],
  };
  const existingSlugs = new Set(options.existingSlugs ?? []);

  const route = {
    findUnique: async (args: { where: { slug: string } }) => {
      calls.routeFindUnique.push(args);
      return existingSlugs.has(args.where.slug) ? { id: `existing-${args.where.slug}` } : null;
    },
    create: async (args: { data: { slug: string } }) => {
      calls.routeCreate.push(args);
      return { id: "route-1", slug: args.data.slug };
    },
    update: async (args: { where: { id: string }; data: unknown }) => {
      calls.routeUpdate.push(args);
      return { id: args.where.id, slug: "family-route" };
    },
  };
  const routeStop = {
    deleteMany: async (args: unknown) => {
      calls.stopDeleteMany.push(args);
      return { count: 2 };
    },
    createMany: async (args: unknown) => {
      calls.stopCreateMany.push(args);
      return { count: 2 };
    },
  };
  const prisma: RouteCommitWriterPrismaClient = {
    route: route as unknown as RouteCommitWriterPrismaClient["route"],
    routeStop: routeStop as unknown as RouteCommitWriterPrismaClient["routeStop"],
    $transaction: (async (callback: (tx: { route: typeof route; routeStop: typeof routeStop }) => Promise<unknown>) =>
      callback({ route, routeStop })) as unknown as RouteCommitWriterPrismaClient["$transaction"],
  };

  return { prisma, calls };
}

async function testCreateWritesRouteAndOrderedStops() {
  const { prisma, calls } = createFakePrisma();
  const writer = new RouteCommitWriter(prisma);

  const result = await writer.createRouteFromDraft(draftFixture());

  assert.deepEqual(result, { routeId: "route-1", status: "CREATED", slug: "family-route" });
  assert.equal(calls.routeCreate.length, 1);
  const createCall = calls.routeCreate[0] as {
    data: {
      status: string;
      visibility: string;
      authorId: string | null;
      stops: { create: unknown[] };
    };
  };
  assert.equal(createCall.data.status, "DRAFT");
  assert.equal(createCall.data.visibility, "PRIVATE");
  assert.equal(createCall.data.authorId, null);
  assert.deepEqual(createCall.data.stops.create, [
    { order: 1, placeId: null, customTitle: "First", note: "First note" },
    { order: 2, placeId: null, customTitle: "Second", note: "Second note" },
  ]);
}

async function testCreateResolvesUniqueSlugWithSuffix() {
  const { prisma, calls } = createFakePrisma({ existingSlugs: ["family-route", "family-route-2"] });
  const writer = new RouteCommitWriter(prisma);

  const result = await writer.createRouteFromDraft(draftFixture());

  assert.equal(result.slug, "family-route-3");
  assert.deepEqual(
    calls.routeFindUnique.map((call) => (call as { where: { slug: string } }).where.slug),
    ["family-route", "family-route-2", "family-route-3"],
  );
}

async function testUpdateReplacesStopsAndKeepsSlugOutOfUpdateData() {
  const { prisma, calls } = createFakePrisma();
  const writer = new RouteCommitWriter(prisma);

  const result = await writer.updateRouteFromDraft("route-99", draftFixture({ slug: "changed-source-slug" }));

  assert.deepEqual(result, { routeId: "route-99", status: "UPDATED", slug: "family-route" });
  const updateCall = calls.routeUpdate[0] as { where: { id: string }; data: Record<string, unknown> };
  assert.equal(updateCall.where.id, "route-99");
  assert.ok(!("slug" in updateCall.data));
  assert.deepEqual(calls.stopDeleteMany[0], { where: { routeId: "route-99" } });
  assert.deepEqual(calls.stopCreateMany[0], {
    data: [
      { routeId: "route-99", order: 1, placeId: null, customTitle: "First", note: "First note" },
      { routeId: "route-99", order: 2, placeId: null, customTitle: "Second", note: "Second note" },
    ],
  });
}

async function main() {
  await testCreateWritesRouteAndOrderedStops();
  await testCreateResolvesUniqueSlugWithSuffix();
  await testUpdateReplacesStopsAndKeepsSlugOutOfUpdateData();
}

main()
  .then(() => {
    console.log("RouteCommitWriter tests: OK");
  })
  .catch((error) => {
    console.error("RouteCommitWriter tests: FAILED", error);
    process.exitCode = 1;
  });
