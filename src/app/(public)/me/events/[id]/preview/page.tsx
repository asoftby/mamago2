import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { ActivityType, ContentStatus } from "@prisma/client";
import { activityStatusesExcludingDeleted } from "@/lib/business/eventListWhere";
import { getCurrentUser } from "@/lib/auth/server";
import { canCreateBusinessContent } from "@/lib/auth/businessContentAccess";
import { canManageActivityById } from "@/lib/auth/activityAccess";
import prisma from "@/lib/prisma";
import { EventPageView } from "@/components/event-page/EventPageView";
import { buildEventPageDataFromPrismaActivity } from "@/lib/event/buildEventPageDataFromPrisma";
import { editorEventEditHref } from "@/lib/content-editor/types";

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

  if (!activity || !(await canManageActivityById(user, activity.id))) {
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
    activity.status === ContentStatus.PENDING_UPDATE
      ? "Изменения на проверке"
      : activity.status === ContentStatus.PENDING
        ? "На модерации"
        : undefined;

  const data = buildEventPageDataFromPrismaActivity(activity, {
    citySlug,
    previewBannerLabel,
    hidePublicationStats: true,
    ownerEditHref: editorEventEditHref(activity.id),
  });

  return (
    <Suspense fallback={<EventPageView data={data} />}>
      <EventPageView data={data} />
    </Suspense>
  );
}
