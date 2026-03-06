import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { PlacesList } from "./PlacesList";
import { getBusinessPlaces } from "@/server/services/place.service";

interface SearchParams {
  view?: "active" | "archived";
}

export default async function PlacesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUser();
  
  if (!user || user.role !== "BUSINESS_OWNER") {
    redirect("/business/login");
  }

  // Verify user has a business
  const business = await prisma.business.findUnique({
    where: { ownerUserId: user.id },
  });

  if (!business) {
    // User is BUSINESS_OWNER but has no Business entity
    // This shouldn't happen in production, but handle gracefully
    console.warn(`User ${user.email} has BUSINESS_OWNER role but no Business entity`);
    redirect("/business/onboarding");
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

  // Map revisions to places
  const placesWithRevisions = places.map(place => ({
    ...place,
    activeRevision: activeRevisions.find(r => r.placeId === place.id) || null,
  }));

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Мои места</h1>
        <p className="text-gray-600 mt-2">
          Управляйте вашими местами и отслеживайте их статус
        </p>
      </div>

      <PlacesList places={placesWithRevisions} currentView={view} />
    </div>
  );
}

