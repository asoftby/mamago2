import { Suspense } from "react";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { FileText, RefreshCw } from "lucide-react";

interface QueueItem {
  id: string;
  type: "PLACE" | "PLACE_UPDATE";
  title: string;
  cityName: string | null;
  businessName: string;
  submittedAt: Date;
  status: string;
}

async function getQueueItems(): Promise<QueueItem[]> {
  // Get pending Places
  const pendingPlaces = await prisma.place.findMany({
    where: {
      status: "PENDING",
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
      city: {
        select: {
          name: true,
        },
      },
      owner: {
        select: {
          business: {
            select: {
              name: true,
            },
          },
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  // Get pending PlaceRevisions
  const pendingRevisions = await prisma.placeRevision.findMany({
    where: {
      status: "PENDING",
    },
    select: {
      id: true,
      title: true,
      submittedAt: true,
      place: {
        select: {
          id: true,
          city: {
            select: {
              name: true,
            },
          },
          owner: {
            select: {
              business: {
                select: {
                  name: true,
                },
              },
              email: true,
            },
          },
        },
      },
    },
    orderBy: {
      submittedAt: "asc",
    },
  });

  // Combine and format
  const items: QueueItem[] = [
    ...pendingPlaces.map((place) => ({
      id: place.id,
      type: "PLACE" as const,
      title: place.title,
      cityName: place.city?.name || null,
      businessName: place.owner.business?.name || place.owner.email,
      submittedAt: place.createdAt, // Use createdAt for Places
      status: "PENDING",
    })),
    ...pendingRevisions.map((revision) => ({
      id: revision.place.id, // Use Place ID for routing
      type: "PLACE_UPDATE" as const,
      title: revision.title || "Untitled Update",
      cityName: revision.place.city?.name || null,
      businessName: revision.place.owner.business?.name || revision.place.owner.email,
      submittedAt: revision.submittedAt || new Date(),
      status: "PENDING",
    })),
  ];

  // Sort by submittedAt
  items.sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());

  return items;
}

function QueueTable({ items }: { items: QueueItem[] }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 border border-gray-200 rounded-lg bg-white">
        <p className="text-lg font-medium mb-2">Очередь пуста</p>
        <p className="text-sm">Нет мест или изменений, ожидающих модерации</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-700">
              Type
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">
              Title
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">
              City
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">
              Business
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">
              Submitted
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {items.map((item) => (
            <tr key={`${item.type}-${item.id}`} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                {item.type === "PLACE" ? (
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-blue-600">PLACE</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-amber-600" />
                    <span className="font-medium text-amber-600">UPDATE</span>
                  </div>
                )}
              </td>
              <td className="px-4 py-3 font-medium text-gray-900">
                {item.title}
              </td>
              <td className="px-4 py-3 text-gray-600">
                {item.cityName || "-"}
              </td>
              <td className="px-4 py-3 text-gray-600">
                {item.businessName}
              </td>
              <td className="px-4 py-3 text-gray-600">
                {formatDistanceToNow(item.submittedAt, { addSuffix: true, locale: ru })}
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/admin/moderation/places/${item.id}${item.type === "PLACE_UPDATE" ? "?mode=revision" : ""}`}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  Review
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
      {/* AdminPageHeader */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-xl font-bold text-gray-900">Moderation Queue</h1>
          <p className="text-sm text-gray-600 mt-1">
            Places and updates pending review ({items.length} items)
          </p>
        </div>
      </div>

      {/* AdminPageContent */}
      <Suspense fallback={<div>Loading...</div>}>
        <QueueTable items={items} />
      </Suspense>
    </div>
  );
}
