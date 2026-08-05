import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { SearchResultItem, SearchResultType } from "@/lib/search/types";
import { logSearchQuery } from "@/lib/search/logSearchQuery";
import { getCurrentUser } from "@/lib/auth/server";
import { activityAddressLine, activityMetaLine, resolveActivityAgeLabel } from "@/lib/search/metaLines";

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
  const q = searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "8", 10), 1), 20);
  const cityId = searchParams.get("cityId") || undefined;

  if (q.length < 2) {
    return NextResponse.json({ results: [] satisfies SearchResultItem[] });
  }

  try {
    // Get current user for logging (optional)
    const user = await getCurrentUser().catch(() => null);

    const docs = await prisma.searchDocument.findMany({
      where: {
        isPublished: true,
        searchText: { contains: q, mode: "insensitive" },
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

    const results: SearchResultItem[] = docs.map((d) => {
      const type = entityTypeToResultType(d.entityType);
      const live = type === "activity" ? activityById.get(d.entityId) : undefined;
      return {
        id: d.entityId,
        type,
        title: d.title,
        url: d.urlPath,
        imageUrl: d.imageUrl,
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
      cityId,
      userId: user?.id,
      // sessionId can be added later from cookies/headers
    }).catch((err) => console.error("Search logging failed:", err));

    return NextResponse.json({ results });
  } catch (e) {
    console.error("[api/search]", e);
    return NextResponse.json({ results: [] satisfies SearchResultItem[] });
  }
}
