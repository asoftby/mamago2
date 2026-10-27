import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { listPublicCitySelectorOptions } from "@/server/city/publicCitySelector";
import { CityDiscoveryShell } from "./CityDiscoveryShell";
import { Intent } from "@/lib/intent";
import { listPublicRoutesByCity } from "@/server/services/route.service";
import { getCurrentUser } from "@/lib/auth/server";
import { countKudaDiscoveryEvents, getKudaDiscoveryFeed } from "@/server/discovery/kudaDiscoveryFeed";
import { getClassesDiscoveryFeed } from "@/server/discovery/classesDiscoveryFeed";
import { getBirthdayDiscoveryFeed } from "@/server/discovery/birthdayDiscoveryFeed";
import {
  listDiscoveryClassChips,
  resolveDiscoveryClassChipSlug,
} from "@/server/discovery/classChips";
import { parseActivityFormatQuery } from "@/domain/activities/activity-format";
import type { PublicRouteCardModel } from "@/components/routes/types";
import { computeMaxBudget, getBudgetStep } from "@/lib/discovery/budgetUtils";
import { summarizeRouteBudget } from "@/lib/routes/routeBudget";
import {
  buildKudaEventFilters,
  loadKudaListingPage,
  parseListingPage,
  toUrlSearchParams,
} from "@/server/discovery/kudaListingPage";
import {
  discoveryFiltersSignature,
  parseAppliedFromUrl,
} from "@/features/filters/discovery/discoveryFilterParams";
import type { ActivityMock } from "@/types/activity";
import type { KudaListingProps } from "@/components/discovery/KudaMasonryListing";
import type { EventRuntimeFilters } from "@/server/discovery/eventFilterSemantics";
import { isHalloweenOccasionActive } from "@/server/discovery/activeHalloweenOccasion";

export type BudgetConfig = { max: number; step: number } | null;

const OTHER_REGION_CAPITALS = new Set(["minsk", "brest", "grodno", "vitebsk", "gomel", "mogilev"]);

interface CityShellProps {
  citySlug: string;
  intent: Intent;
  searchParams: Record<string, string | string[] | undefined>;
  pageTitleOverride?: string;
}

function isSectionSystemFilterTableMissing(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021" &&
    String(error.meta?.table ?? "").includes("SectionSystemFilter")
  );
}

export async function CityShell({ citySlug, intent, searchParams, pageTitleOverride }: CityShellProps) {
  const [city, user, systemFilters] = await Promise.all([
    findCityBySlug(citySlug),
    getCurrentUser(),
    prisma.sectionSystemFilter
      .findMany({
        where: { sectionKey: intent, enabled: true },
        select: { type: true },
      })
      .catch((error) => {
        if (isSectionSystemFilterTableMissing(error)) {
          console.warn(
            "[CityShell] SectionSystemFilter table not found, returning empty system filters",
          );
          return [];
        }
        throw error;
      }),
  ]);
  if (!city) notFound();

  const budgetEnabled = systemFilters.some((f) => f.type === "BUDGET");

  let discoveryActivities = undefined;
  let classChips = undefined;
  let activeClassChipSlug = undefined;
  let budgetConfig: BudgetConfig = null;
  let alternativeEventFilters: EventRuntimeFilters | null = null;
  const halloweenEnabled = intent === "kuda"
    ? await isHalloweenOccasionActive()
    : false;

  if (intent === "birthday") {
    // Only published party-specific offers approved for this section.
    discoveryActivities = await getBirthdayDiscoveryFeed(city.id, city.slug);
    if (budgetEnabled) {
      const max = computeMaxBudget(discoveryActivities);
      if (max) budgetConfig = { max, step: getBudgetStep(max) };
    }
  }
  let kudaListing: KudaListingProps | undefined = undefined;
  if (intent === "kuda") {
    const urlParams = toUrlSearchParams(searchParams);
    const eventFilters = buildKudaEventFilters(urlParams, halloweenEnabled);
    alternativeEventFilters = { ...eventFilters, districtId: null, metroId: null };
    const listing = await loadKudaListingPage({
      cityId: city.id,
      citySlug: city.slug,
      userId: user?.id ?? null,
      searchParams: urlParams,
      page: parseListingPage(searchParams.page),
      halloweenEnabled,
    });
    // A page past the end of a non-empty result set does not exist.
    if (listing.total > 0 && listing.page > listing.totalPages) notFound();
    discoveryActivities = listing.items;
    kudaListing = {
      page: listing.page,
      totalPages: listing.totalPages,
      total: listing.total,
      offset: listing.offset,
      items: listing.items,
      secondaryHeading: listing.secondaryHeading,
      filtersSignature: discoveryFiltersSignature(parseAppliedFromUrl(urlParams)),
    };
    if (budgetEnabled) {
      let budgetActivities: ActivityMock[] = listing.pool;
      // The slider domain must come from the same candidate pool without its own
      // ceiling, otherwise choosing 50 would collapse max to 50 and make it
      // impossible to increase the budget again.
      if (eventFilters.priceMin != null || eventFilters.priceMax != null) {
        budgetActivities = await getKudaDiscoveryFeed(city.id, city.slug, user?.id ?? null, {
          format: parseActivityFormatQuery(urlParams.get("format")),
          nearby: false,
          eventFilters: { ...eventFilters, priceMin: null, priceMax: null },
        });
      }
      const max = computeMaxBudget(budgetActivities);
      if (max) budgetConfig = { max, step: getBudgetStep(max) };
    }
  }
  if (intent === "classes") {
    const requestedChip = Array.isArray(searchParams.chip)
      ? searchParams.chip[0]
      : searchParams.chip;
    const freeParam = Array.isArray(searchParams.free)
      ? searchParams.free[0]
      : searchParams.free;
    const priceMaxParam = Array.isArray(searchParams.priceMax)
      ? searchParams.priceMax[0]
      : searchParams.priceMax;
    const classFree = freeParam === "true";
    const classPriceMax =
      classFree || priceMaxParam == null
        ? null
        : (() => {
            const value = Number(priceMaxParam);
            return Number.isFinite(value) && value >= 0 ? value : null;
          })();

    classChips = await listDiscoveryClassChips();
    activeClassChipSlug = resolveDiscoveryClassChipSlug(requestedChip, classChips);
    const chipTitleBySlug = new Map(classChips.map((chip) => [chip.slug, chip.title]));
    discoveryActivities = await getClassesDiscoveryFeed(city.id, city.slug, {
      chipSlug: activeClassChipSlug,
      chipTitleBySlug,
      free: classFree,
      priceMax: classPriceMax,
    });
    if (budgetEnabled && discoveryActivities) {
      let budgetActivities = discoveryActivities;
      if (classPriceMax != null) {
        budgetActivities = await getClassesDiscoveryFeed(city.id, city.slug, {
          chipSlug: activeClassChipSlug,
          chipTitleBySlug,
          free: false,
          priceMax: null,
        });
      }
      const max = computeMaxBudget(budgetActivities);
      if (max) budgetConfig = { max, step: getBudgetStep(max) };
    }
  }

  // For routes intent, load routes data server-side
  let routesData = undefined;
  if (intent === "routes") {
    const dbRoutes = await listPublicRoutesByCity(city.id).catch(() => []);
    const realRoutes: PublicRouteCardModel[] = dbRoutes.map((r) => {
      const budgetSummary = summarizeRouteBudget(r.stops);

      return {
        id: r.id,
        slug: r.slug,
        title: r.title,
        ageTags: r.ageTags,
        budgetLevel: r.budgetLevel,
        budgetLabel: budgetSummary.label,
        budgetNote: budgetSummary.note,
        cityName: r.city?.name ?? city.name,
        coverImageUrl:
          r.coverImageUrl ??
          r.stops.find((s) => s.photoUrl)?.photoUrl ??
          "https://images.unsplash.com/photo-1513884923967-4b182ef1671f?q=80&w=1200",
        authorName: r.author?.email?.split("@")[0] ?? null,
        isEditorial: r.authorId === null,
        stopsCount: r.stops.length,
        stops: r.stops.map((s) => ({
          id: s.id,
          order: s.order,
          address: s.place?.title ?? s.customTitle ?? s.address ?? "",
          note: s.note,
          photoUrl: s.photoUrl ?? "",
          lat: s.lat ?? undefined,
          lng: s.lng ?? undefined,
        })),
      };
    });

    console.log("[API] real data used", {
      endpoint: "city-shell-routes",
      city: city.slug,
      count: realRoutes.length,
    });
    routesData = realRoutes;
  }

  // Navigation to other regions is a separate, opt-in action at the end of the
  // events feed. Only show oblast capitals with currently matching events.
  const alternativeCities = intent === "kuda" && alternativeEventFilters
    ? (await Promise.all(
        (await listPublicCitySelectorOptions())
          .filter((option) => OTHER_REGION_CAPITALS.has(option.slug) && option.slug !== city.slug)
          .map(async (option) => ({
            option,
            count: await countKudaDiscoveryEvents(option.id, option.slug, {
              eventFilters: alternativeEventFilters!,
            }),
          })),
      ))
        .filter(({ count }) => count > 0)
        .map(({ option }) => option)
    : [];

  return (
    <CityDiscoveryShell
      city={citySlug}
      intent={intent}
      alternativeCities={alternativeCities}
      listingSearchParams={searchParams}
      routesData={routesData}
      discoveryActivities={discoveryActivities}
      classChips={classChips}
      activeClassChipSlug={activeClassChipSlug}
      budgetConfig={budgetConfig}
      pageTitleOverride={pageTitleOverride}
      weekendPlannerEnabled={intent === "kuda" && user?.role === "ADMIN"}
      halloweenEnabled={halloweenEnabled}
      kudaListing={kudaListing}
    />
  );
}
