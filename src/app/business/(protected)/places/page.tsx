import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { PlacesList } from "./PlacesList";
import { getBusinessPlaces } from "@/server/services/place.service";
import { canCreateBusinessContent, canManageOwnedContent } from "@/lib/auth/businessContentAccess";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";

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
  
  if (!user || !canCreateBusinessContent(user.role)) {
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "public",
        targetPath: "/login",
        ...routing,
      }),
    );
  }

  // Verify user has a business
  const business = await prisma.business.findUnique({
    where: { ownerUserId: user.id },
  });

  if (!business) {
    // User is BUSINESS_OWNER but has no Business entity
    // This shouldn't happen in production, but handle gracefully
    console.warn(`User ${user.email} has BUSINESS_OWNER role but no Business entity`);
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

  // Map revisions and improvement requests to places
  const placesWithRevisions = places.map(place => ({
    ...place,
    activeRevision: activeRevisions.find(r => r.placeId === place.id) || null,
    improvementRequests: improvementRequests.filter(ir => ir.entityId === place.id),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Мои места</h1>
        <p className="text-gray-600 mt-2">
          Управляйте вашими местами и отслеживайте их статус
        </p>
      </div>

      <PlacesList places={placesWithRevisions} currentView={view} />
    </div>
  );
}
