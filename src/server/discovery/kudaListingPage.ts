import prisma from "@/lib/prisma";
import { parseActivityFormatQuery } from "@/domain/activities/activity-format";
import { parseAppliedFromUrl } from "@/features/filters/discovery/discoveryFilterParams";
import { partitionDiscoveryFeed } from "@/lib/discovery/partitionDiscoveryFeed";
import type { AudienceSelection } from "@/lib/discovery/audienceEligibility";
import type { FamilyPersona } from "@/lib/family/familyPersonaTypes";
import { getKudaDiscoveryFeed } from "@/server/discovery/kudaDiscoveryFeed";
import { resolveEventDateRange, type EventRuntimeFilters } from "@/server/discovery/eventFilterSemantics";
import { childScopeFor } from "@/server/family/familyAccess";
import type { ActivityMock } from "@/types/activity";
import {
  KUDA_LISTING_PAGE_SIZE,
  paginateKudaFeed,
  type KudaListingPage,
} from "@/lib/discovery/kudaListingPagination";

/**
 * Candidates ranked per request. The DB query and temporal/engagement ranking
 * stay exactly as in `getKudaDiscoveryFeed`; only the pool is larger so that
 * pagination has a stable, complete order (previously 200 candidates → 80 cards).
 */
export const KUDA_LISTING_POOL = 360;

export type ListingSearchParams = Record<string, string | string[] | undefined>;

export function toUrlSearchParams(record: ListingSearchParams): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(record)) {
    if (value == null) continue;
    if (Array.isArray(value)) value.forEach((entry) => params.append(key, entry));
    else params.set(key, value);
  }
  return params;
}

export function parseListingPage(value: string | string[] | null | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return 1;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

/** Same filter semantics as the previous inline parsing in CityShell / count API. */
export function buildKudaEventFilters(
  params: Pick<URLSearchParams, "get">,
  halloweenEnabled: boolean,
): EventRuntimeFilters {
  const preset = params.get("preset");
  const free = params.get("free") === "true";
  const num = (key: string, min: (value: number) => boolean) => {
    if (free) return null;
    const raw = params.get(key);
    if (raw == null) return null;
    const value = Number(raw);
    return Number.isFinite(value) && min(value) ? value : null;
  };
  return {
    categorySlugs: params.get("category")?.split(",").filter(Boolean) ?? [],
    occasionSlug: halloweenEnabled && params.get("occasion") === "halloween" ? "halloween" : null,
    genreSlugs: params.get("genre")?.split(",").filter(Boolean) ?? [],
    dateRange: resolveEventDateRange({
      preset: preset === "TODAY" || preset === "TOMORROW" || preset === "WEEKEND" ? preset : null,
      from: params.get("from") ?? params.get("dateFrom") ?? null,
      to: params.get("to") ?? params.get("dateTo") ?? null,
    }),
    free,
    priceMin: num("priceMin", (value) => value > 0),
    priceMax: num("priceMax", (value) => value >= 0),
    districtId: params.get("district") ?? null,
    metroId: params.get("metro") ?? null,
    adultOnly: params.get("adultOnly") === "true",
  };
}

/**
 * Server-side «Для кого» audience. The client already mirrors the selected
 * family personas into the URL (`profile=<ids>`, FamilyDerivedAgeSync), so the
 * server resolves the same personas for the signed-in user and applies the
 * very same `partitionDiscoveryFeed` the client used to run — once, over the
 * whole ranked pool, before slicing pages. Guests (no personas) fall back to
 * the manual `age` chips exactly like before.
 */
export async function loadListingAudience(
  userId: string | null,
  profileParam: string | null,
): Promise<AudienceSelection | undefined> {
  if (!userId || !profileParam) return undefined;
  const requested = profileParam.split(",").filter(Boolean);
  if (requested.length === 0) return undefined;
  const children = await prisma.child.findMany({
    where: await childScopeFor(userId),
    select: { id: true, birthDate: true },
  });
  const personas: FamilyPersona[] = [
    { id: userId, kind: "adult", displayName: "Я" },
    ...children.map((child) => ({
      id: child.id,
      kind: "child" as const,
      displayName: "",
      birthDate: child.birthDate?.toISOString() ?? null,
    })),
  ];
  const known = new Set(personas.map((persona) => persona.id));
  const selectedPersonaIds = requested.filter((id) => known.has(id));
  return selectedPersonaIds.length > 0 ? { personas, selectedPersonaIds } : undefined;
}

export type KudaListingResult = KudaListingPage<ActivityMock> & {
  /** Whole partitioned pool (budget slider domain). */
  pool: ActivityMock[];
};

export async function loadKudaListingPage(input: {
  cityId: string;
  citySlug: string;
  userId: string | null;
  searchParams: Pick<URLSearchParams, "get">;
  page: number;
  halloweenEnabled: boolean;
  pageSize?: number;
}): Promise<KudaListingResult> {
  const filters = parseAppliedFromUrl(input.searchParams);
  const eventFilters = buildKudaEventFilters(input.searchParams, input.halloweenEnabled);
  const [feed, audience] = await Promise.all([
    getKudaDiscoveryFeed(input.cityId, input.citySlug, input.userId, {
      take: KUDA_LISTING_POOL,
      candidatePoolCap: KUDA_LISTING_POOL,
      format: parseActivityFormatQuery(input.searchParams.get("format")),
      nearby: false,
      eventFilters,
    }),
    loadListingAudience(input.userId, filters.profile),
  ]);
  const partition = partitionDiscoveryFeed(filters, feed, audience);
  const page = paginateKudaFeed(partition, input.page, input.pageSize ?? KUDA_LISTING_PAGE_SIZE);
  return { ...page, pool: [...partition.primary, ...partition.secondary] };
}
