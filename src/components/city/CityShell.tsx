import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { findCityBySlug } from "@/server/geo/findCityBySlug";
import { CityDiscoveryShell } from "./CityDiscoveryShell";
import { Intent } from "@/lib/intent";
import { listPublicRoutesByCity } from "@/server/services/route.service";
import { getCurrentUser } from "@/lib/auth/server";
import { getKudaDiscoveryFeed } from "@/server/discovery/kudaDiscoveryFeed";
import { getClassesDiscoveryFeed } from "@/server/discovery/classesDiscoveryFeed";
import {
  listDiscoveryClassChips,
  resolveDiscoveryClassChipSlug,
} from "@/server/discovery/classChips";
import { parseActivityFormatQuery } from "@/domain/activities/activity-format";
import type { PublicRouteCardModel } from "@/components/routes/types";
import { computeMaxBudget, getBudgetStep } from "@/lib/discovery/budgetUtils";
import { summarizeRouteBudget } from "@/lib/routes/routeBudget";
import { resolveEventDateRange } from "@/server/discovery/eventFilterSemantics";

export type BudgetConfig = { max: number; step: number } | null;

interface CityShellProps {
  citySlug: string;
  intent: Intent;
  searchParams: Record<string, string | string[] | undefined>;
}

function isSectionSystemFilterTableMissing(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021" &&
    String(error.meta?.table ?? "").includes("SectionSystemFilter")
  );
}

export async function CityShell({ citySlug, intent, searchParams }: CityShellProps) {
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

  if (intent === "kuda" || intent === "birthday") {
    // DEFECT (not a TODO): intent === "birthday" reuses getKudaDiscoveryFeed and
    // renders event/kuda discovery content (Activity/EVENT rows) — content outside
    // the birthday domain, not the intended architecture for this section. This is
    // a stand-in, not the target design: when the birthday section is activated,
    // its feed must be built on party-specific entities (PartyCategory,
    // PartyOccasion, PartyLocationType) and PARTY_SERVICE/PARTY_PACKAGE Offer rows
    // — none of which currently have a read-side consumer anywhere in the codebase.
    // Do not extend getKudaDiscoveryFeed itself with birthday-specific behavior;
    // the fix is a separate feed function, not a branch added here.
    const formatParam = Array.isArray(searchParams.format)
      ? searchParams.format[0]
      : searchParams.format;
    const nearbyParam = Array.isArray(searchParams.nearby)
      ? searchParams.nearby[0]
      : searchParams.nearby;
    const scalar = (key: string) => {
      const value = searchParams[key];
      return Array.isArray(value) ? value[0] : value;
    };
    const eventFilters = intent === "kuda"
      ? {
          dateRange: resolveEventDateRange({
            preset:
              scalar("preset") === "TODAY" ||
              scalar("preset") === "TOMORROW" ||
              scalar("preset") === "WEEKEND"
                ? (scalar("preset") as "TODAY" | "TOMORROW" | "WEEKEND")
                : null,
            from: scalar("from") ?? scalar("dateFrom") ?? null,
            to: scalar("to") ?? scalar("dateTo") ?? null,
          }),
          free: scalar("free") === "true",
          districtId: scalar("district") ?? null,
          metroId: scalar("metro") ?? null,
          adultOnly: scalar("adultOnly") === "true",
        }
      : undefined;
    discoveryActivities = await getKudaDiscoveryFeed(city.id, city.slug, user?.id ?? null, {
      format: parseActivityFormatQuery(typeof formatParam === "string" ? formatParam : null),
      nearby: intent === "kuda" ? false : nearbyParam === "true",
      eventFilters,
    });
    if (budgetEnabled && discoveryActivities) {
      const max = computeMaxBudget(discoveryActivities);
      if (max) budgetConfig = { max, step: getBudgetStep(max) };
    }
  }
  if (intent === "classes") {
    const requestedChip = Array.isArray(searchParams.chip)
      ? searchParams.chip[0]
      : searchParams.chip;
    classChips = await listDiscoveryClassChips();
    activeClassChipSlug = resolveDiscoveryClassChipSlug(requestedChip, classChips);
    discoveryActivities = await getClassesDiscoveryFeed(city.id, city.slug, {
      chipSlug: activeClassChipSlug,
      chipTitleBySlug: new Map(classChips.map((chip) => [chip.slug, chip.title])),
    });
    if (budgetEnabled && discoveryActivities) {
      const max = computeMaxBudget(discoveryActivities);
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

  return (
    <CityDiscoveryShell
      city={citySlug}
      intent={intent}
      routesData={routesData}
      discoveryActivities={discoveryActivities}
      classChips={classChips}
      activeClassChipSlug={activeClassChipSlug}
      budgetConfig={budgetConfig}
    />
  );
}
