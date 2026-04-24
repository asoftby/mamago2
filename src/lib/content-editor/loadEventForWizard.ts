import prisma from "@/lib/prisma";
import { ActivityType } from "@prisma/client";
import { activityStatusesExcludingDeleted } from "@/lib/business/eventListWhere";

/**
 * Single Prisma load for event editor + wizard mapping.
 * No ActivityRevision model — returned entity is the source of truth.
 */
export async function loadEventForWizard(eventId: string) {
  const event = await prisma.activity.findFirst({
    where: {
      id: eventId,
      type: ActivityType.EVENT,
      status: { in: activityStatusesExcludingDeleted() },
    },
    include: {
      venue: {
        include: {
          place: {
            select: {
              id: true,
              title: true,
              formattedAddr: true,
            },
          },
        },
      },
      images: {
        orderBy: { sortOrder: "asc" },
      },
      sessions: {
        orderBy: { startsAt: "asc" },
      },
      place: {
        select: {
          id: true,
          title: true,
          formattedAddr: true,
          city: { select: { id: true, name: true } },
        },
      },
      owner: {
        select: { id: true, email: true },
      },
      organizer: {
        select: {
          id: true,
          name: true,
          unp: true,
          phone: true,
          website: true,
          instagram: true,
          createdFrom: true,
        },
      },
      filterOptions: true,
    },
  });

  if (!event) {
    return { event: null, eventForWizard: null };
  }

  return { event, eventForWizard: event };
}
