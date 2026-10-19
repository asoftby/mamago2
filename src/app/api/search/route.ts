import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { SearchResultItem, SearchResultType } from "@/lib/search/types";
import { logSearchQuery } from "@/lib/search/logSearchQuery";
import { resolveSearchLogCityId } from "@/lib/search/resolveSearchLogCityId";
import { getCurrentUser } from "@/lib/auth/server";
import { activityAddressLine, activityMetaLine, resolveActivityAgeLabel } from "@/lib/search/metaLines";
import { resolvePlaceLogoUrlFromDb } from "@/lib/place/resolvePlaceLogoUrlFromDb";
import { formatPriceFrom } from "@/lib/formatters/format-price";
import { formatAgeKeysShort } from "@/lib/config/ages";

function openingHoursSummary(rules: Array<{ isOpen: boolean; allDay: boolean; intervals: Array<{startTime: string; endTime: string}> }>): string | null {
  const open = rules.filter((r) => r.isOpen);
  if (!open.length) return null;
  if (open.every((r) => r.allDay) && open.length === 7) return "Круглосуточно";
  const starts = open.flatMap((r) => r.intervals.map((i) => i.startTime)).sort();
  const ends = open.flatMap((r) => r.intervals.map((i) => i.endTime)).sort();
  if (!starts.length || !ends.length) return null;
  return `${starts[0]}–${ends[ends.length - 1]}`;
}


const MAX_QUERY_LENGTH = 200;
const MAX_QUERY_TOKENS = 10;

/** Match every whitespace-separated token independently (AND), so word order
 * doesn't matter — e.g. "балет три поросенка" must match the same document
 * as "три поросенка балет". A single-token query keeps the plain substring
 * match (identical to prior behavior). */
function buildSearchTextWhere(q: string) {
  const tokens = q.split(/\s+/).filter(Boolean).slice(0, MAX_QUERY_TOKENS);
  if (tokens.length <= 1) {
    return { searchText: { contains: q, mode: "insensitive" as const } };
  }
  return {
    AND: tokens.map((t) => ({
      searchText: { contains: t, mode: "insensitive" as const },
    })),
  };
}

function entityTypeToResultType(t: string): SearchResultType {
  if (
    t === "activity" ||
    t === "offer" ||
    t === "place" ||
    t === "route" ||
    t === "article"
  ) {
    return t;
  }
  return "article";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q")?.trim() ?? "").slice(0, MAX_QUERY_LENGTH);
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "8", 10), 1), 20);
  const citySlug = searchParams.get("citySlug");
  const legacyCityId = searchParams.get("cityId");

  if (q.length < 2) {
    return NextResponse.json({ results: [] satisfies SearchResultItem[] });
  }

  try {
    // Get current user for logging (optional)
    const user = await getCurrentUser().catch(() => null);
    // Telemetry only — does not affect ranking/results. Prefer citySlug; keep
    // legacy cityId for older callers. Unknown slug → null (never invent Minsk).
    const logCityId = await resolveSearchLogCityId({
      citySlug,
      legacyCityId,
    });

    const docs = await prisma.searchDocument.findMany({
      where: {
        isPublished: true,
        ...buildSearchTextWhere(q),
      },
      take: limit,
      orderBy: [{ boost: "desc" }, { updatedAt: "desc" }],
      select: {
        entityId: true,
        entityType: true,
        title: true,
        urlPath: true,
        imageUrl: true,
        summaryLine: true,
        metaLine: true,
      },
    });

    const activityIds = docs
      .filter((d) => d.entityType === "activity")
      .map((d) => d.entityId);

    const activityById = new Map<
      string,
      {
        summaryLine: string | null;
        metaLine: string;
      }
    >();

    if (activityIds.length > 0) {
      const activities = await prisma.activity.findMany({
        where: { id: { in: activityIds } },
        select: {
          id: true,
          cityId: true,
          ageLabel: true,
          ageTags: true,
          ageMinMonths: true,
          ageMaxMonths: true,
          priceFrom: true,
          priceText: true,
          currency: true,
          nextOccurrenceAt: true,
          place: {
            select: {
              title: true,
              shortAddress: true,
              formattedAddr: true,
              displayAddress: true,
              customAddress: true,
              city: { select: { name: true } },
            },
          },
          venue: {
            select: {
              title: true,
              addressLine: true,
              place: {
                select: {
                  title: true,
                  shortAddress: true,
                  formattedAddr: true,
                  displayAddress: true,
                  customAddress: true,
                },
              },
            },
          },
        },
      });

      const cityIds = [
        ...new Set(
          activities
            .map((a) => a.cityId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      const cities =
        cityIds.length > 0
          ? await prisma.city.findMany({
              where: { id: { in: cityIds } },
              select: { id: true, name: true },
            })
          : [];
      const cityNameById = new Map(cities.map((c) => [c.id, c.name]));

      for (const activity of activities) {
        const venuePlace = activity.venue?.place;
        const cityName =
          (activity.cityId ? cityNameById.get(activity.cityId) : null) ??
          activity.place?.city?.name ??
          null;
        activityById.set(activity.id, {
          summaryLine: activityAddressLine({
            venueTitle: activity.venue?.title,
            venueAddressLine: activity.venue?.addressLine,
            placeTitle: venuePlace?.title ?? activity.place?.title,
            placeShortAddress: venuePlace?.shortAddress ?? activity.place?.shortAddress,
            placeFormattedAddr: venuePlace?.formattedAddr ?? activity.place?.formattedAddr,
            placeDisplayAddress: venuePlace?.displayAddress ?? activity.place?.displayAddress,
            placeCustomAddress: venuePlace?.customAddress ?? activity.place?.customAddress,
            cityName,
          }),
          metaLine: activityMetaLine({
            nextOccurrenceAt: activity.nextOccurrenceAt,
            ageLabel: resolveActivityAgeLabel({
              ageLabel: activity.ageLabel,
              ageTags: activity.ageTags,
              ageMinMonths: activity.ageMinMonths,
              ageMaxMonths: activity.ageMaxMonths,
            }),
            priceFrom: activity.priceFrom,
            currency: activity.currency,
            priceText: activity.priceText,
          }),
        });
      }
    }

    const placeIds = docs.filter((d) => d.entityType === "place").map((d) => d.entityId);
    const offerIds = docs.filter((d) => d.entityType === "offer").map((d) => d.entityId);
    const placeById = new Map<string, { summaryLine: string | null; metaLine: string; imageUrl: string | null }>();
    const offerById = new Map<string, { summaryLine: string | null; metaLine: string }>();

    if (placeIds.length) {
      const places = await prisma.place.findMany({
        where: { id: { in: placeIds }, status: "PUBLISHED", archivedAt: null },
        select: {
          id: true, shortAddress: true, formattedAddr: true, displayAddress: true, customAddress: true,
          ageTags: true, logoImageId: true, images: { select: { id: true, url: true, kind: true } },
          city: { select: { name: true } },
          openingHours: { select: { rules: { select: {
            isOpen: true, allDay: true, intervals: { select: { startTime: true, endTime: true } },
          } } } },
          offers: { where: { status: "PUBLISHED", archivedAt: null },
            select: { priceFrom: true, priceMode: true, ageMinMonths: true, dateTo: true } },
        },
      });
      for (const place of places) {
        const address = activityAddressLine({
          cityName: place.city?.name, placeDisplayAddress: place.displayAddress,
          placeShortAddress: place.shortAddress, placeFormattedAddr: place.formattedAddr,
          placeCustomAddress: place.customAddress,
        });
        const validOffers = place.offers.filter((o) => !o.dateTo || o.dateTo >= new Date());
        const prices = validOffers.filter((o) => o.priceFrom != null && o.priceFrom >= 0 && o.priceMode !== "ON_REQUEST" && o.priceMode !== "NONE").map((o) => o.priceFrom!);
        const minimum = prices.length ? Math.min(...prices) : null;
        const age = formatAgeKeysShort(place.ageTags) ||
          (validOffers.some((o) => o.ageMinMonths != null)
            ? `${Math.floor(Math.min(...validOffers.filter((o) => o.ageMinMonths != null).map((o) => o.ageMinMonths!)) / 12)}+`
            : null);
        const hours = openingHoursSummary(place.openingHours?.rules ?? []);
        const price = minimum == null ? null : minimum === 0 ? "Бесплатно" : formatPriceFrom(minimum);
        placeById.set(place.id, {
          summaryLine: address,
          metaLine: [age, hours, price].filter(Boolean).join(" · "),
          imageUrl: (await resolvePlaceLogoUrlFromDb(place.images, place.logoImageId)) ?? null,
        });
      }
    }

    if (offerIds.length) {
      const offers = await prisma.offer.findMany({
        where: { id: { in: offerIds }, status: "PUBLISHED", archivedAt: null },
        select: {
          id: true, ageMinMonths: true, dateFrom: true, dateTo: true, priceFrom: true,
          priceText: true, priceMode: true, inheritPlaceOpeningHours: true,
          openingHours: { select: { rules: { select: { isOpen: true, allDay: true, intervals: { select: { startTime: true, endTime: true } } } } } },
          place: { select: {
            shortAddress: true, formattedAddr: true, displayAddress: true, customAddress: true,
            city: { select: { name: true } },
            openingHours: { select: { rules: { select: { isOpen: true, allDay: true, intervals: { select: { startTime: true, endTime: true } } } } } },
          } },
        },
      });
      for (const offer of offers) {
        const place = offer.place;
        const address = place ? activityAddressLine({
          cityName: place.city?.name, placeShortAddress: place.shortAddress,
          placeDisplayAddress: place.displayAddress, placeFormattedAddr: place.formattedAddr,
          placeCustomAddress: place.customAddress,
        }) : null;
        const date = offer.dateFrom?.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
        const age = offer.ageMinMonths == null ? null : `${Math.floor(offer.ageMinMonths / 12)}+`;
        const hours = openingHoursSummary(offer.inheritPlaceOpeningHours ? (place?.openingHours?.rules ?? []) : (offer.openingHours?.rules ?? []));
        const price = offer.priceMode === "FREE" ? "Бесплатно" :
          offer.priceFrom != null ? formatPriceFrom(offer.priceFrom) : offer.priceText;
        offerById.set(offer.id, {
          summaryLine: address,
          metaLine: [age, date, hours, price].filter(Boolean).join(" · "),
        });
      }
    }

    const results: SearchResultItem[] = docs.map((d) => {
      const type = entityTypeToResultType(d.entityType);
      const live = type === "activity" ? activityById.get(d.entityId) : type === "place" ? placeById.get(d.entityId) : type === "offer" ? offerById.get(d.entityId) : undefined;
      return {
        id: d.entityId,
        type,
        title: d.title,
        url: d.urlPath,
        imageUrl: type === "place" ? (placeById.get(d.entityId)?.imageUrl ?? null) : d.imageUrl,
        // For activities prefer live fields even if address is null — never fall back
        // to the legacy shortDesc stored in SearchDocument.summaryLine.
        summaryLine: live ? live.summaryLine : d.summaryLine,
        metaLine: live ? live.metaLine : d.metaLine,
      };
    });

    // Log search query (fire-and-forget)
    logSearchQuery({
      query: q,
      resultsCount: results.length,
      cityId: logCityId ?? undefined,
      userId: user?.id,
      // sessionId can be added later from cookies/headers
    }).catch((err) => console.error("Search logging failed:", err));

    return NextResponse.json({ results });
  } catch (e) {
    console.error("[api/search]", e);
    return NextResponse.json({ results: [] satisfies SearchResultItem[] });
  }
}
