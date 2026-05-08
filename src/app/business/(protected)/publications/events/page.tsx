import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { ActivityType } from "@prisma/client";
import {
  businessEventListViewWhere,
  excludeGhostEventDrafts,
  normalizeBusinessEventListView,
} from "@/lib/business/eventListWhere";
import { EventsList } from "../../events/EventsList";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";
import { BusinessSectionHeader } from "@/components/business/sections/BusinessSectionHeader";
import { getPerformanceMetricsByEntity } from "@/server/services/business/businessWorkspace.service";
import { getMyBusiness } from "@/server/business/getMyBusiness";

interface SearchParams {
  view?: "active" | "archived" | "archive";
}

export default async function PublicationsEventsPage({
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
  const view = normalizeBusinessEventListView(params.view);

  // Fetch activities (events) for this user
  // Note: Using Activity model as data source, but presenting as "Events" in UI
  const activities = await prisma.activity.findMany({
    where: {
      OR: [
        { ownerUserId: user.id },
        { businessId: business.id },
      ],
      type: ActivityType.EVENT,
      ...businessEventListViewWhere(view),
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
  const metricsByEntity = await getPerformanceMetricsByEntity({
    events: activities.map((activity) => ({
      id: activity.id,
      title: activity.title,
      updatedAt: activity.createdAt,
      status: activity.status,
    })),
    offers: [],
  });

  const activitiesWithMetrics = activities.map((activity) => ({
    ...activity,
    metrics: metricsByEntity.get(`EVENT:${activity.id}`) ?? {
      views: 0,
      saves: 0,
      planAdds: 0,
      ctaClicks: 0,
    },
  }));

  return (
    <div className="space-y-6">
      <BusinessSectionHeader
        eyebrow="ПУБЛИКАЦИИ"
        title="События"
        description="События — это регулярный входящий спрос. Здесь важно сразу видеть статус, интерес и что стоит усилить следующим."
        eyebrowVariant="primary"
      />

      <EventsList activities={activitiesWithMetrics} currentView={view} />
    </div>
  );
}
