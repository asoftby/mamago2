import { Suspense } from "react";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { ActivityType } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { FileText, RefreshCw, Calendar, Tag } from "lucide-react";

const QUEUE_RETURN = "/admin/moderation/queue";

interface QueueItem {
  id: string;
  kind: "PLACE" | "PLACE_UPDATE" | "EVENT" | "OFFER";
  title: string;
  cityName: string | null;
  businessName: string;
  submittedAt: Date;
  reviewHref: string;
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
          owner: {
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
              owner: {
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
              owner: {
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
    kind: "EVENT" as const,
    title: ev.title,
    cityName:
      ev.place?.city?.name ??
      (ev.cityId ? eventCityNameById.get(ev.cityId) ?? null : null),
    businessName: ev.owner.business?.name || ev.owner.email,
    submittedAt: ev.createdAt,
    reviewHref: `/editor/event/${ev.id}/edit?returnTo=${encodeURIComponent(QUEUE_RETURN)}`,
  }));

  const offerItems: QueueItem[] = pendingOffers.map((offer) => ({
    id: offer.id,
    kind: "OFFER",
    title: offer.title,
    cityName: offer.place.city?.name ?? null,
    businessName:
      offer.place.owner.business?.name || offer.place.owner.email,
    submittedAt: offer.createdAt,
    reviewHref: `/editor/offer/${offer.id}/edit?returnTo=${encodeURIComponent(QUEUE_RETURN)}`,
  }));

  const placeItems: QueueItem[] = pendingPlaces.map((place) => ({
    id: place.id,
    kind: "PLACE",
    title: place.title,
    cityName: place.city?.name || null,
    businessName: place.owner.business?.name || place.owner.email,
    submittedAt: place.createdAt,
    reviewHref: `/admin/content/places/${place.id}`,
  }));

  const revisionItems: QueueItem[] = pendingRevisions.map((revision) => ({
    id: revision.place.id,
    kind: "PLACE_UPDATE",
    title: revision.title || "Без названия",
    cityName: revision.place.city?.name || null,
    businessName:
      revision.place.owner.business?.name || revision.place.owner.email,
    submittedAt: revision.submittedAt || new Date(),
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

function TypeCell({ kind }: { kind: QueueItem["kind"] }) {
  if (kind === "PLACE") {
    return (
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-blue-600" />
        <span className="font-medium text-blue-600">Место</span>
      </div>
    );
  }
  if (kind === "PLACE_UPDATE") {
    return (
      <div className="flex items-center gap-2">
        <RefreshCw className="w-4 h-4 text-amber-600" />
        <span className="font-medium text-amber-600">Изменение</span>
      </div>
    );
  }
  if (kind === "EVENT") {
    return (
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-violet-600" />
        <span className="font-medium text-violet-600">Событие</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Tag className="w-4 h-4 text-emerald-600" />
      <span className="font-medium text-emerald-600">Предложение</span>
    </div>
  );
}

function QueueTable({ items }: { items: QueueItem[] }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 border border-gray-200 rounded-lg bg-white">
        <p className="text-lg font-medium mb-2">Очередь пуста</p>
        <p className="text-sm">
          Нет сущностей, ожидающих модерации (места, события, предложения)
        </p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Тип</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Название</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Город</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Автор</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Подано</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Действия</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {items.map((item) => (
            <tr key={`${item.kind}-${item.id}`} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <TypeCell kind={item.kind} />
              </td>
              <td className="px-4 py-3 font-medium text-gray-900">{item.title}</td>
              <td className="px-4 py-3 text-gray-600">{item.cityName || "—"}</td>
              <td className="px-4 py-3 text-gray-600">{item.businessName}</td>
              <td className="px-4 py-3 text-gray-600">
                {formatDistanceToNow(item.submittedAt, { addSuffix: true, locale: ru })}
              </td>
              <td className="px-4 py-3">
                <Link
                  href={item.reviewHref}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Открыть
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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

      <Suspense fallback={<div className="text-sm text-gray-500">Загрузка…</div>}>
        <QueueTable items={items} />
      </Suspense>
    </div>
  );
}
