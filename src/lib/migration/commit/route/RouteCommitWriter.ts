import type { Prisma, PrismaClient, Route } from "@prisma/client";

import type { RouteCreateDraft } from "./buildRouteCreateDraft";

export interface RouteCommitWriterPrismaClient {
  route: Pick<PrismaClient["route"], "create" | "findUnique" | "update">;
  routeStop: Pick<PrismaClient["routeStop"], "deleteMany" | "createMany">;
  routeSlugHistory: Pick<PrismaClient["routeSlugHistory"], "findUnique">;
  $transaction: PrismaClient["$transaction"];
}

export interface RouteCommitResult {
  routeId: string;
  status: "CREATED" | "UPDATED";
  slug: string;
}

function assertDraftIsUsable(draft: RouteCreateDraft): void {
  if (!draft.title.trim()) {
    throw new Error("RouteCreateDraft.title is required.");
  }
  if (!draft.slug.trim()) {
    throw new Error("RouteCreateDraft.slug is required.");
  }
  if (draft.status !== "DRAFT") {
    throw new Error(`RouteCreateDraft.status must be "DRAFT", got "${draft.status}".`);
  }
  if (draft.visibility !== "PRIVATE") {
    throw new Error(`RouteCreateDraft.visibility must be "PRIVATE", got "${draft.visibility}".`);
  }
  if (draft.authorId !== null) {
    throw new Error("RouteCreateDraft.authorId must be null for imported editorial-review drafts.");
  }
  if (draft.stops.length === 0) {
    throw new Error("RouteCreateDraft.stops must contain at least one stop.");
  }
}

function slugVariant(baseSlug: string, suffix: number): string {
  return suffix === 0 ? baseSlug : `${baseSlug}-${suffix + 1}`;
}

async function resolveUniqueRouteSlug(
  routeDelegate: Pick<PrismaClient["route"], "findUnique">,
  routeSlugHistoryDelegate: Pick<PrismaClient["routeSlugHistory"], "findUnique">,
  baseSlug: string,
): Promise<string> {
  const cleanBase = baseSlug.trim();
  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const candidate = slugVariant(cleanBase, suffix);
    const [existingRoute, existingHistory] = await Promise.all([
      routeDelegate.findUnique({ where: { slug: candidate }, select: { id: true } }),
      routeSlugHistoryDelegate.findUnique({ where: { slug: candidate }, select: { routeId: true } }),
    ]);
    if (!existingRoute && !existingHistory) return candidate;
  }
  throw new Error(`Could not resolve a unique Route slug for "${baseSlug}" after 1000 attempts.`);
}

function buildRouteCreateData(draft: RouteCreateDraft, slug: string): Prisma.RouteUncheckedCreateInput {
  return {
    title: draft.title,
    slug,
    cityId: draft.cityId,
    status: draft.status,
    visibility: draft.visibility,
    authorId: draft.authorId,
    seoTitle: draft.seoTitle,
    stops: {
      create: draft.stops.map((stop) => ({
        order: stop.order,
        placeId: stop.placeId,
        customTitle: stop.customTitle,
        note: stop.note,
      })),
    },
  };
}

function buildRouteUpdateData(draft: RouteCreateDraft): Prisma.RouteUncheckedUpdateInput {
  return {
    title: draft.title,
    cityId: draft.cityId,
    status: draft.status,
    visibility: draft.visibility,
    authorId: draft.authorId,
    seoTitle: draft.seoTitle,
  };
}

function buildRouteStopCreateManyData(routeId: string, draft: RouteCreateDraft): Prisma.RouteStopCreateManyInput[] {
  return draft.stops.map((stop) => ({
    routeId,
    order: stop.order,
    placeId: stop.placeId,
    customTitle: stop.customTitle,
    note: stop.note,
  }));
}

/**
 * Writes the Route entity and its ordered RouteStop children only. Stop
 * media (`images-location-*`), redirect maps, and route-level location JSON
 * are intentionally outside this writer. Slug resolution reads
 * RouteSlugHistory to avoid hijacking a redirect reserved by another route,
 * but this writer never creates RouteSlugHistory rows itself.
 */
export class RouteCommitWriter {
  constructor(private readonly prisma: RouteCommitWriterPrismaClient) {}

  async createRouteFromDraft(draft: RouteCreateDraft): Promise<RouteCommitResult> {
    assertDraftIsUsable(draft);
    const slug = await resolveUniqueRouteSlug(this.prisma.route, this.prisma.routeSlugHistory, draft.slug);

    const route: Route = await this.prisma.route.create({
      data: buildRouteCreateData(draft, slug),
    });

    return { routeId: route.id, status: "CREATED", slug: route.slug };
  }

  async updateRouteFromDraft(routeId: string, draft: RouteCreateDraft): Promise<RouteCommitResult> {
    assertDraftIsUsable(draft);
    if (!routeId.trim()) {
      throw new Error("routeId is required for Route update.");
    }

    const route: Route = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.route.update({
        where: { id: routeId },
        data: buildRouteUpdateData(draft),
      });
      await tx.routeStop.deleteMany({ where: { routeId } });
      await tx.routeStop.createMany({ data: buildRouteStopCreateManyData(routeId, draft) });
      return updated;
    });

    return { routeId: route.id, status: "UPDATED", slug: route.slug };
  }
}
