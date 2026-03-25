import { notFound, redirect } from "next/navigation";
import { ActivityType, ContentStatus } from "@prisma/client";
import { activityStatusesExcludingDeleted } from "@/lib/business/eventListWhere";
import { getCurrentUser } from "@/lib/auth/server";
import { canCreateBusinessContent, canManageOwnedContent } from "@/lib/auth/businessContentAccess";
import prisma from "@/lib/prisma";
import { EventPageView } from "@/components/event-page/EventPageView";
import { buildEventPageDataFromPrismaActivity } from "@/lib/event/buildEventPageDataFromPrisma";

type PageProps = { params: Promise<{ id: string }> };

export default async function MeEventPreviewPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user || !canCreateBusinessContent(user.role)) {
    redirect("/login");
  }

  const { id } = await params;

  const activity = await prisma.activity.findFirst({
    where: {
      id,
      type: ActivityType.EVENT,
      status: { in: activityStatusesExcludingDeleted() },
    },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      sessions: { orderBy: { startsAt: "asc" } },
      place: {
        select: {
          id: true,
          title: true,
          formattedAddr: true,
          city: { select: { slug: true, name: true } },
        },
      },
      venue: {
        include: {
          place: {
            select: { title: true, formattedAddr: true },
          },
        },
      },
      eventCategory: { select: { nameRu: true } },
    },
  });

  if (!activity || !canManageOwnedContent(user, activity.ownerUserId)) {
    notFound();
  }

  let citySlug = activity.place?.city?.slug;
  if (!citySlug && activity.cityId) {
    const city = await prisma.city.findUnique({
      where: { id: activity.cityId },
      select: { slug: true },
    });
    citySlug = city?.slug;
  }

  const previewBannerLabel =
    activity.status === ContentStatus.PENDING ? "На модерации" : undefined;

  const data = buildEventPageDataFromPrismaActivity(activity, {
    citySlug,
    previewBannerLabel,
    hidePublicationStats: true,
  });

  return <EventPageView data={data} />;
}
