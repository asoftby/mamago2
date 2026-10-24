import { NextResponse } from "next/server";
import { swapKeyboardLayout } from "@/lib/search/keyboardLayout";
import prisma from "@/lib/prisma";
import type { SearchResultItem, SearchResultType } from "@/lib/search/types";
import { logSearchQuery } from "@/lib/search/logSearchQuery";
import { resolveSearchLogCityId } from "@/lib/search/resolveSearchLogCityId";
import { getCurrentUser } from "@/lib/auth/server";
import { resolveActivityAgeLabel } from "@/lib/search/metaLines";
import { formatMarketplaceHeroAddress } from "@/lib/placeLocationString";
import { formatActivitySearchDates, formatSearchDateRange, formatSearchOpeningHours, formatSearchPublicationPrice } from "@/lib/search/resultCardMeta";
import { resolvePlaceLogoUrlFromDb } from "@/lib/place/resolvePlaceLogoUrlFromDb";
import { formatSearchAddress, formatSearchAgeFromTags } from "@/lib/search/compactSearchPresentation";

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

    // Prefer the literal query; only fill remaining slots from the alternate
    // physical keyboard layout. Never let a guessed layout displace exact hits.
    const findDocs = (query: string, take: number) => prisma.searchDocument.findMany({
      where: { isPublished: true, ...buildSearchTextWhere(query) },
      take,
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

    const literalDocs = await findDocs(q, limit);
    const alternate = swapKeyboardLayout(q);
    // An overlapping literal hit must not consume an alternate-result slot.
    // Fetch up to the full page size and deduplicate after ranking.
    const additionalDocs = alternate && literalDocs.length < limit
      ? await findDocs(alternate, limit)
      : [];
    const seen = new Set<string>();
    const docs = [...literalDocs, ...additionalDocs].filter((doc) => {
      const key = `${doc.entityType}:${doc.entityId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, limit);

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
          agePolicy: true,
          ageTags: true,
          ageMinMonths: true,
          ageMaxMonths: true,
          priceFrom: true,
          priceTo: true,
          priceMode: true,
          priceItems: true,
          priceText: true,
          scheduleJson: true,
          sessions: { where: { withdrawnAt: null, startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, take: 41, select: { startsAt: true } },
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
          summaryLine: formatSearchAddress(formatMarketplaceHeroAddress({
            city: cityName ? { name: cityName } : null,
            shortAddress: activity.venue?.addressLine || venuePlace?.shortAddress || activity.place?.shortAddress,
            formattedAddr: venuePlace?.formattedAddr ?? activity.place?.formattedAddr,
            customAddress: venuePlace?.customAddress ?? activity.place?.customAddress,
          }), cityName),
          metaLine: [
            resolveActivityAgeLabel({
              agePolicy: activity.agePolicy,
              ageLabel: activity.ageLabel,
              ageTags: activity.ageTags,
              ageMinMonths: activity.ageMinMonths,
              ageMaxMonths: activity.ageMaxMonths,
            }),
            formatActivitySearchDates({
              scheduleJson: activity.scheduleJson,
              sessions: activity.sessions,
              sessionsTruncated: activity.sessions.length > 40,
              nextOccurrenceAt: activity.nextOccurrenceAt,
            }),
            formatSearchPublicationPrice({
              priceMode: activity.priceMode,
              priceFrom: activity.priceFrom,
              priceTo: activity.priceTo,
              priceItems: activity.priceItems,
              priceText: activity.priceText,
            }),
          ].filter(Boolean).join(" · "),
        });
      }
    }

    const placeIds = docs.filter((d) => d.entityType === "place").map((d) => d.entityId);
    const offerIds = docs.filter((d) => d.entityType === "offer").map((d) => d.entityId);
    const placeById = new Map<string, { summaryLine: string | null; metaLine: string; imageUrl: string | null; placeCategory: string | null }>();
    const offerById = new Map<string, { summaryLine: string | null; metaLine: string }>();

    if (placeIds.length) {
      const places = await prisma.place.findMany({
        where: { id: { in: placeIds }, status: "PUBLISHED", archivedAt: null },
        select: {
          id: true, shortAddress: true, formattedAddr: true, displayAddress: true, customAddress: true,
          category: true, primaryCategory: { select: { nameRu: true } },
          ageTags: true, agePolicy: true, logoImageId: true, images: { select: { id: true, url: true, kind: true } },
          city: { select: { name: true } },
          openingHours: { select: { rules: { select: {
            dayOfWeek: true, isOpen: true, allDay: true, intervals: { orderBy: { sortOrder: "asc" }, select: { startTime: true, endTime: true, sortOrder: true } },
          } } } },
        },
      });
      for (const place of places) {
        const address = formatSearchAddress(formatMarketplaceHeroAddress({
          city: place.city,
          shortAddress: place.shortAddress,
          formattedAddr: place.formattedAddr,
          customAddress: place.customAddress ?? place.displayAddress,
        }), place.city?.name);
        const age = place.agePolicy === "ADULT_ONLY"
          ? "18+"
          : formatSearchAgeFromTags(place.ageTags);
        const hours = formatSearchOpeningHours(place.openingHours?.rules ?? []);
        placeById.set(place.id, {
          summaryLine: address,
          metaLine: [age, hours].filter(Boolean).join(" · "),
          imageUrl: (await resolvePlaceLogoUrlFromDb(place.images, place.logoImageId)) ?? null,
          placeCategory: place.primaryCategory?.nameRu ?? place.category ?? null,
        });
      }
    }

    if (offerIds.length) {
      const offers = await prisma.offer.findMany({
        where: { id: { in: offerIds }, status: "PUBLISHED", archivedAt: null },
        select: {
          id: true, ageMinMonths: true, agePolicy: true, dateFrom: true, dateTo: true,
          priceFrom: true, priceTo: true, priceItems: true, priceText: true, priceMode: true,
          place: { select: {
            shortAddress: true, formattedAddr: true, displayAddress: true, customAddress: true,
            city: { select: { name: true } },
          } },
        },
      });
      for (const offer of offers) {
        const place = offer.place;
        const address = place ? formatSearchAddress(formatMarketplaceHeroAddress({
          city: place.city,
          shortAddress: place.shortAddress,
          formattedAddr: place.formattedAddr,
          customAddress: place.customAddress ?? place.displayAddress,
        }), place.city?.name) : null;
        const age = offer.agePolicy === "ADULT_ONLY" ? "18+" :
          offer.ageMinMonths != null ? `${Math.floor(offer.ageMinMonths / 12)}+` : null;
        offerById.set(offer.id, {
          summaryLine: address,
          metaLine: [
            age,
            formatSearchDateRange(offer.dateFrom, offer.dateTo),
            formatSearchPublicationPrice({
              priceMode: offer.priceMode,
              priceFrom: offer.priceFrom,
              priceTo: offer.priceTo,
              priceItems: offer.priceItems,
              priceText: offer.priceText,
            }),
          ].filter(Boolean).join(" · "),
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
        placeCategory: type === "place" ? (placeById.get(d.entityId)?.placeCategory ?? null) : null,
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
