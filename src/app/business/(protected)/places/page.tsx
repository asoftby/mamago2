import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { PlacesList } from "./PlacesList";
import { getBusinessPlaces } from "@/server/services/place.service";
import { getMyBusiness } from "@/server/business/getMyBusiness";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";
import { BusinessSectionHeader } from "@/components/business/sections/BusinessSectionHeader";

interface SearchParams {
  view?: "active" | "archived";
}

export default async function PlacesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const routing = await getCurrentRequestRoutingContext();
  const user = await getCurrentUser();

  if (!user) {
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "public",
        targetPath: "/login",
        ...routing,
      }),
    );
  }

  const business = await getMyBusiness(user.id);

  if (!business) {
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "business",
        targetPath: "/onboarding",
        ...routing,
      }),
    );
  }

  const params = await searchParams;
  const view = params.view || "active";

  // Fetch places using centralized service
  // SECURITY: Service ensures only user's own places are returned
  const places = await getBusinessPlaces(user.id, {
    archived: view === "archived" ? true : false,
  });

  // Fetch active revisions for published places
  const publishedPlaceIds = places
    .filter(p => p.status === "PUBLISHED")
    .map(p => p.id);

  const activeRevisions = publishedPlaceIds.length > 0
    ? await prisma.placeRevision.findMany({
        where: {
          placeId: { in: publishedPlaceIds },
          status: { in: ["DRAFT", "PENDING", "NEEDS_REVISION"] },
        },
        select: {
          id: true,
          placeId: true,
          status: true,
          moderatorComment: true,
          revisionRequestedAt: true,
        },
      })
    : [];

  // Fetch active improvement requests for all places
  const allPlaceIds = places.map(p => p.id);
  const improvementRequests = allPlaceIds.length > 0
    ? await prisma.improvementRequest.findMany({
        where: {
          entityType: "PLACE",
          entityId: { in: allPlaceIds },
          status: { in: ["OPEN", "IN_PROGRESS"] },
        },
        select: {
          id: true,
          entityId: true,
          status: true,
          severity: true,
          title: true,
          dueAt: true,
        },
      })
    : [];

  const [eventCounts, offerCounts] = allPlaceIds.length > 0
    ? await Promise.all([
        prisma.activity.groupBy({
          by: ["placeId"],
          where: {
            placeId: { in: allPlaceIds },
            type: "EVENT",
          },
          _count: { _all: true },
        }),
        prisma.offer.groupBy({
          by: ["placeId"],
          where: {
            placeId: { in: allPlaceIds },
          },
          _count: { _all: true },
        }),
      ])
    : [[], []];

  const eventCountByPlace = new Map(
    eventCounts
      .filter((row) => Boolean(row.placeId))
      .map((row) => [row.placeId as string, row._count._all])
  );
  const offerCountByPlace = new Map(
    offerCounts.map((row) => [row.placeId, row._count._all])
  );

  // Map revisions and improvement requests to places
  const placesWithRevisions = places.map(place => ({
    ...place,
    activeRevision: activeRevisions.find(r => r.placeId === place.id) || null,
    improvementRequests: improvementRequests.filter(ir => ir.entityId === place.id),
    linkedEventsCount: eventCountByPlace.get(place.id) ?? 0,
    linkedOffersCount: offerCountByPlace.get(place.id) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <BusinessSectionHeader
        eyebrow="ИНФРАСТРУКТУРА"
        title="Места"
        description="Места — инфраструктура бизнеса: какие площадки готовы к работе и сколько публикаций на них опирается."
      />

      <PlacesList places={placesWithRevisions} currentView={view} />
    </div>
  );
}
