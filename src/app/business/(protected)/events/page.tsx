import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { ActivityType } from "@prisma/client";
import { excludeDeletedEvents, excludeGhostEventDrafts } from "@/lib/business/eventListWhere";
import { EventsList } from "./EventsList";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";

interface SearchParams {
  view?: "active" | "archived";
}

export default async function EventsPage({
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

  // Fetch activities (events) for this user
  // Note: Using Activity model as data source, but presenting as "Events" in UI
  const activities = await prisma.activity.findMany({
    where: {
      ownerUserId: user.id,
      type: ActivityType.EVENT,
      ...excludeDeletedEvents(),
      ...excludeGhostEventDrafts(),
    },
    include: {
      place: {
        select: {
          id: true,
          title: true,
        },
      },
      images: {
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Мои события</h1>
        <p className="text-gray-600 mt-2">
          Управляйте вашими событиями и отслеживайте их статус
        </p>
      </div>

      <EventsList activities={activities} currentView={view} />
    </div>
  );
}
