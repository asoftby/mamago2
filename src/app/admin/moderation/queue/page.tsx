import prisma from "@/lib/prisma";
import { ActivityType } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { ModerationQueueTable, type ModerationQueueTableItem } from "./_components/ModerationQueueTable";

const QUEUE_RETURN = "/admin/moderation/queue";

interface QueueItem extends ModerationQueueTableItem {
  kind: "PLACE" | "PLACE_UPDATE" | "EVENT" | "OFFER";
  submittedAt: Date;
}

async function getQueueItems(): Promise<QueueItem[]> {
  const [pendingPlaces, pendingRevisions, pendingEvents, pendingOffers] =
    await Promise.all([
      prisma.place.findMany({
        where: { status: "PENDING" },
        select: {
          id: true,
          title: true,
          createdAt: true,
          city: { select: { name: true } },
          createdBy: {
            select: {
              business: { select: { name: true } },
              email: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.placeRevision.findMany({
        where: { status: "PENDING" },
        select: {
          id: true,
          title: true,
          submittedAt: true,
          place: {
            select: {
              id: true,
              city: { select: { name: true } },
              createdBy: {
                select: {
                  business: { select: { name: true } },
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { submittedAt: "asc" },
      }),
      prisma.activity.findMany({
        where: { type: ActivityType.EVENT, status: "PENDING" },
        select: {
          id: true,
          title: true,
          createdAt: true,
          cityId: true,
          place: {
            select: {
              city: { select: { name: true } },
            },
          },
          owner: {
            select: {
              business: { select: { name: true } },
              email: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.offer.findMany({
        where: { status: "PENDING" },
        select: {
          id: true,
          title: true,
          createdAt: true,
          place: {
            select: {
              city: { select: { name: true } },
              createdBy: {
                select: {
                  business: { select: { name: true } },
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  const eventCityIds = [
    ...new Set(
      pendingEvents.map((e) => e.cityId).filter((id): id is string => Boolean(id)),
    ),
  ];
  const eventCities =
    eventCityIds.length > 0
      ? await prisma.city.findMany({
          where: { id: { in: eventCityIds } },
          select: { id: true, name: true },
        })
      : [];
  const eventCityNameById = new Map(eventCities.map((c) => [c.id, c.name]));

  const eventItems: QueueItem[] = pendingEvents.map((ev) => ({
    id: ev.id,
    moderationId: ev.id,
    kind: "EVENT" as const,
    title: ev.title,
    cityName:
      ev.place?.city?.name ??
      (ev.cityId ? eventCityNameById.get(ev.cityId) ?? null : null),
    businessName: ev.owner.business?.name || ev.owner.email,
    submittedAt: ev.createdAt,
    submittedAtLabel: formatDistanceToNow(ev.createdAt, { addSuffix: true, locale: ru }),
    reviewHref: `/editor/event/${ev.id}/edit?returnTo=${encodeURIComponent(QUEUE_RETURN)}`,
  }));

  const offerItems: QueueItem[] = pendingOffers.map((offer) => ({
    id: offer.id,
    moderationId: offer.id,
    kind: "OFFER",
    title: offer.title,
    cityName: offer.place.city?.name ?? null,
    businessName:
      offer.place.createdBy.business?.name || offer.place.createdBy.email,
    submittedAt: offer.createdAt,
    submittedAtLabel: formatDistanceToNow(offer.createdAt, { addSuffix: true, locale: ru }),
    reviewHref: `/editor/offer/${offer.id}/edit?returnTo=${encodeURIComponent(QUEUE_RETURN)}`,
  }));

  const placeItems: QueueItem[] = pendingPlaces.map((place) => ({
    id: place.id,
    moderationId: place.id,
    kind: "PLACE",
    title: place.title,
    cityName: place.city?.name || null,
    businessName: place.createdBy.business?.name || place.createdBy.email,
    submittedAt: place.createdAt,
    submittedAtLabel: formatDistanceToNow(place.createdAt, { addSuffix: true, locale: ru }),
    reviewHref: `/admin/content/places/${place.id}`,
  }));

  const revisionItems: QueueItem[] = pendingRevisions.map((revision) => ({
    id: revision.place.id,
    moderationId: revision.id,
    kind: "PLACE_UPDATE",
    title: revision.title || "Без названия",
    cityName: revision.place.city?.name || null,
    businessName:
      revision.place.createdBy.business?.name || revision.place.createdBy.email,
    submittedAt: revision.submittedAt || new Date(),
    submittedAtLabel: formatDistanceToNow(revision.submittedAt || new Date(), { addSuffix: true, locale: ru }),
    reviewHref: `/admin/content/places/${revision.place.id}?mode=revision`,
  }));

  const items = [
    ...placeItems,
    ...revisionItems,
    ...eventItems,
    ...offerItems,
  ];
  items.sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
  return items;
}

export default async function ModerationQueuePage() {
  const items = await getQueueItems();

  return (
    <div className="p-6 md:p-4 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-xl font-bold text-gray-900">Очередь модерации</h1>
          <p className="text-sm text-gray-600 mt-1">
            Единый inbox: места, изменения, события и предложения ({items.length})
          </p>
        </div>
        <Badge variant="secondary" className="w-fit">
          Публикации — на следующем этапе
        </Badge>
      </div>

      <ModerationQueueTable items={items} />
    </div>
  );
}
