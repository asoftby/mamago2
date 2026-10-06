import type {
  GeoScope,
  SeoContentPlanPriority,
  SeoContentPlanSource,
  SeoContentPlanStatus,
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  allocateGeoMixTargets,
  DEFAULT_GEO_CONTENT_MIX,
} from "@/lib/admin/seo/geo";
import type { SeoMarketFilter } from "@/lib/admin/seo/geo/seoMarket";
import { normalizeSearchQueryKey } from "@/lib/admin/seo/geo/seoMarket";

const ACTIVE_PLAN_STATUSES: SeoContentPlanStatus[] = [
  "IDEA",
  "PLANNED",
  "IN_PROGRESS",
];

export function isActivePlanStatus(status: SeoContentPlanStatus): boolean {
  return ACTIVE_PLAN_STATUSES.includes(status);
}

/** PUBLISHED → IDEA|PLANNED|IN_PROGRESS may collide with the unique active index. */
export function isPublishedToActiveTransition(
  from: SeoContentPlanStatus,
  to: SeoContentPlanStatus,
): boolean {
  return from === "PUBLISHED" && isActivePlanStatus(to);
}

function isPrismaUniqueConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export type CreateSeoContentPlanItemInput = {
  title: string;
  targetQuery?: string | null;
  geoScope: GeoScope;
  cityId?: string | null;
  regionId?: string | null;
  scheduledFor?: Date | null;
  priority?: SeoContentPlanPriority;
  source?: SeoContentPlanSource;
  sourceQuery?: string | null;
  notes?: string | null;
  articleId?: string | null;
  status?: SeoContentPlanStatus;
  createdByUserId: string;
};

export class SeoContentPlanValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeoContentPlanValidationError";
  }
}

export class SeoContentPlanDuplicateError extends Error {
  constructor(message = "Тема с таким запросом уже есть в активном плане") {
    super(message);
    this.name = "SeoContentPlanDuplicateError";
  }
}

export function validatePlanItemGeo(input: {
  geoScope: GeoScope;
  cityId?: string | null;
  regionId?: string | null;
}): void {
  if (input.geoScope === "CITY") {
    if (!input.cityId) {
      throw new SeoContentPlanValidationError("CITY требует cityId");
    }
  } else if (input.geoScope === "REGION") {
    if (!input.regionId) {
      throw new SeoContentPlanValidationError("REGION требует regionId");
    }
    if (input.cityId) {
      throw new SeoContentPlanValidationError(
        "REGION не должен содержать cityId",
      );
    }
  } else if (input.geoScope === "COUNTRY") {
    if (input.cityId || input.regionId) {
      throw new SeoContentPlanValidationError(
        "COUNTRY не должен содержать cityId/regionId",
      );
    }
  }
}

function marketWhere(filter: SeoMarketFilter) {
  if (filter.kind === "all") return {};
  if (filter.kind === "city") {
    return {
      OR: [
        { geoScope: "CITY" as const, cityId: filter.cityId },
        { cityId: filter.cityId },
      ],
    };
  }
  if (filter.kind === "region") {
    return {
      OR: [
        { geoScope: "REGION" as const, regionId: filter.regionId },
        { regionId: filter.regionId },
        ...(filter.cityIds.length
          ? [{ cityId: { in: filter.cityIds } }]
          : []),
      ],
    };
  }
  if (filter.kind === "market") {
    return {
      OR: [
        ...(filter.cityIds.length
          ? [
              {
                AND: [
                  { cityId: { in: filter.cityIds } },
                  { NOT: { geoScope: "COUNTRY" as const } },
                  { NOT: { geoScope: "REGION" as const } },
                ],
              },
            ]
          : []),
        ...(filter.regionId
          ? [
              { geoScope: "REGION" as const, regionId: filter.regionId },
              { regionId: filter.regionId },
            ]
          : []),
      ],
    };
  }
  return { geoScope: "COUNTRY" as const };
}

export async function listSeoContentPlanItems(input: {
  filter: SeoMarketFilter;
  from: Date;
  to: Date;
}) {
  return prisma.seoContentPlanItem.findMany({
    where: {
      AND: [
        marketWhere(input.filter),
        {
          OR: [
            {
              scheduledFor: {
                gte: input.from,
                lt: input.to,
              },
            },
            {
              scheduledFor: null,
              createdAt: {
                gte: input.from,
                lt: input.to,
              },
            },
          ],
        },
      ],
    },
    orderBy: [{ scheduledFor: "asc" }, { createdAt: "desc" }],
    include: {
      city: { select: { id: true, name: true, slug: true } },
      region: { select: { id: true, name: true, slug: true } },
      article: { select: { id: true, title: true, slug: true } },
    },
  });
}

export function computePlanMix(items: Array<{ geoScope: GeoScope }>) {
  const cityCount = items.filter((i) => i.geoScope === "CITY").length;
  const regionCount = items.filter((i) => i.geoScope === "REGION").length;
  const nationalCount = items.filter((i) => i.geoScope === "COUNTRY").length;
  const plannedTotal = items.length;
  const targets = allocateGeoMixTargets(plannedTotal, DEFAULT_GEO_CONTENT_MIX);
  const cityShare =
    plannedTotal === 0 ? 0 : Math.round((cityCount / plannedTotal) * 100);
  const regionShare =
    plannedTotal === 0 ? 0 : Math.round((regionCount / plannedTotal) * 100);
  const belowRegionTarget =
    plannedTotal > 0 && regionCount < targets.region;
  return {
    plannedTotal,
    cityCount,
    regionCount,
    nationalCount,
    targets,
    cityShare,
    regionShare,
    belowRegionTarget,
  };
}

export async function createSeoContentPlanItem(
  input: CreateSeoContentPlanItemInput,
) {
  validatePlanItemGeo(input);

  if (input.geoScope === "CITY" && input.cityId) {
    const city = await prisma.city.findUnique({
      where: { id: input.cityId },
      select: { regionId: true },
    });
    if (!city) {
      throw new SeoContentPlanValidationError("Город не найден");
    }
    // Optionally derive regionId for CITY items for reporting — store only if empty
  }

  if (input.geoScope === "REGION" && input.regionId) {
    const region = await prisma.region.findUnique({
      where: { id: input.regionId },
      select: { id: true },
    });
    if (!region) {
      throw new SeoContentPlanValidationError("Регион не найден");
    }
  }

  const targetQuery = input.targetQuery?.trim() || null;
  const targetQueryKey = targetQuery
    ? normalizeSearchQueryKey(targetQuery)
    : null;

  if (targetQueryKey) {
    const existing = await prisma.seoContentPlanItem.findFirst({
      where: {
        targetQueryKey,
        geoScope: input.geoScope,
        cityId: input.cityId ?? null,
        regionId: input.regionId ?? null,
        status: { in: ACTIVE_PLAN_STATUSES },
      },
      select: { id: true },
    });
    if (existing) {
      throw new SeoContentPlanDuplicateError();
    }
  }

  try {
    return await prisma.seoContentPlanItem.create({
      data: {
        title: input.title.trim(),
        targetQuery,
        targetQueryKey,
        geoScope: input.geoScope,
        cityId: input.cityId ?? null,
        regionId: input.regionId ?? null,
        scheduledFor: input.scheduledFor ?? null,
        priority: input.priority ?? "MEDIUM",
        source: input.source ?? "MANUAL",
        sourceQuery: input.sourceQuery?.trim() || null,
        notes: input.notes?.trim() || null,
        articleId: input.articleId ?? null,
        status: input.status ?? "IDEA",
        createdByUserId: input.createdByUserId,
      },
      include: {
        city: { select: { id: true, name: true, slug: true } },
        region: { select: { id: true, name: true, slug: true } },
        article: { select: { id: true, title: true, slug: true } },
      },
    });
  } catch (error) {
    if (isPrismaUniqueConflict(error)) {
      throw new SeoContentPlanDuplicateError();
    }
    throw error;
  }
}

/**
 * True when reactivating a PUBLISHED item into an active status would collide
 * with another active plan row for the same normalized query + geo.
 */
export async function findActivePlanDuplicate(input: {
  excludeId: string;
  targetQueryKey: string | null;
  geoScope: GeoScope;
  cityId: string | null;
  regionId: string | null;
}): Promise<{ id: string } | null> {
  if (!input.targetQueryKey) return null;
  return prisma.seoContentPlanItem.findFirst({
    where: {
      id: { not: input.excludeId },
      targetQueryKey: input.targetQueryKey,
      geoScope: input.geoScope,
      cityId: input.cityId,
      regionId: input.regionId,
      status: { in: ACTIVE_PLAN_STATUSES },
    },
    select: { id: true },
  });
}

export async function updateSeoContentPlanItemStatus(
  id: string,
  status: SeoContentPlanStatus,
) {
  const current = await prisma.seoContentPlanItem.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      targetQueryKey: true,
      geoScope: true,
      cityId: true,
      regionId: true,
    },
  });
  if (!current) {
    throw new SeoContentPlanValidationError("Тема плана не найдена");
  }

  const reactivatingFromPublished = isPublishedToActiveTransition(
    current.status,
    status,
  );

  if (reactivatingFromPublished) {
    const duplicate = await findActivePlanDuplicate({
      excludeId: current.id,
      targetQueryKey: current.targetQueryKey,
      geoScope: current.geoScope,
      cityId: current.cityId,
      regionId: current.regionId,
    });
    if (duplicate) {
      throw new SeoContentPlanDuplicateError();
    }
  }

  try {
    return await prisma.seoContentPlanItem.update({
      where: { id },
      data: { status },
      include: {
        city: { select: { id: true, name: true, slug: true } },
        region: { select: { id: true, name: true, slug: true } },
        article: { select: { id: true, title: true, slug: true } },
      },
    });
  } catch (error) {
    if (isPrismaUniqueConflict(error)) {
      throw new SeoContentPlanDuplicateError();
    }
    throw error;
  }
}

export function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, 1);
}
