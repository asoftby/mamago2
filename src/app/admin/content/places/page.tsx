import { Suspense } from "react";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { ContentStatus, Prisma } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { MODERATION_CONTENT_STATUS_CONFIG } from "@/lib/admin/moderationContentStatusBadges";
import { getModerationFilterCities } from "@/lib/admin/moderationAdminQueries";
import { PlacesFilters } from "./PlacesFilters";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseContentStatusFilter(
  raw: string | undefined,
): ContentStatus | undefined {
  if (!raw) return undefined;
  return Object.values(ContentStatus).includes(raw as ContentStatus)
    ? (raw as ContentStatus)
    : undefined;
}

interface SearchParams {
  status?: string;
  cityId?: string;
}

async function getPlaces(params: SearchParams) {
  const where: Prisma.PlaceWhereInput = {};

  const status = parseContentStatusFilter(params.status);
  if (status) {
    where.status = status;
  }

  if (params.cityId) {
    where.cityId = params.cityId;
  }

  const places = await prisma.place.findMany({
    where,
    include: {
      city: {
        select: {
          name: true,
        },
      },
      ownerBusiness: {
        select: {
          name: true,
          owner: {
            select: {
              email: true,
            },
          },
        },
      },
      createdBy: {
        select: {
          email: true,
        },
      },
      revisions: {
        where: {
          status: {
            in: ["DRAFT", "PENDING", "NEEDS_REVISION"],
          },
        },
        select: {
          id: true,
          status: true,
        },
        take: 1,
        orderBy: {
          createdAt: "desc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100, // Limit for performance
  });

  return places;
}

function PlacesTable({ places }: { places: Awaited<ReturnType<typeof getPlaces>> }) {
  if (places.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>Места не найдены</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-700">
              Name
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">
              City
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">
              Business
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">
              Status
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">
              Created
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {places.map((place) => {
            const statusConfig =
              MODERATION_CONTENT_STATUS_CONFIG[place.status] ||
              MODERATION_CONTENT_STATUS_CONFIG.DRAFT;
            const hasActiveRevision =
              place.status === "PUBLISHED" &&
              place.revisions.some((revision) => revision.status === "PENDING");
            const action = (() => {
              if (place.status === "DRAFT") {
                return {
                  href: `/editor/place/${place.id}/edit?returnTo=${encodeURIComponent(`/admin/content/places/${place.id}`)}`,
                  label: "Открыть в редакторе",
                };
              }

              if (place.status === "PENDING") {
                return {
                  href: `/admin/content/places/${place.id}`,
                  label: "Модерировать",
                };
              }

              if (hasActiveRevision) {
                return {
                  href: `/admin/content/places/${place.id}`,
                  label: "Проверить изменения",
                };
              }

              return {
                href: `/admin/content/places/${place.id}`,
                label: "Открыть",
              };
            })();
            
            // Extract street and house number from formattedAddr or customAddress
            const fullAddress = place.formattedAddr || place.customAddress || "";
            const addressParts = fullAddress.split(",").map(p => p.trim());
            // Try to get street and house (usually first part before city)
            const streetAddress = addressParts[0] || "";
            
            return (
              <tr key={place.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {place.title}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  <div>
                    <div className="font-medium">{place.city?.name || "-"}</div>
                    {streetAddress && (
                      <div className="text-xs text-gray-500 mt-0.5">{streetAddress}</div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {place.ownerBusiness?.name ||
                    place.ownerBusiness?.owner?.email ||
                    place.createdBy?.email || "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusConfig.variant} className={statusConfig.className}>
                    {statusConfig.label}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {formatDistanceToNow(place.createdAt, { addSuffix: true, locale: ru })}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={action.href}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {action.label}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default async function PlacesListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  
  const [places, cities] = await Promise.all([
    getPlaces(params),
    getModerationFilterCities(),
  ]);

  return (
    <div className="p-6 md:p-4 space-y-6">
      {/* AdminPageHeader */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-xl font-bold">Places</h1>
          <p className="text-sm text-gray-600 mt-1">
            All places submitted by businesses
          </p>
        </div>
      </div>

      {/* AdminPageToolbar */}
      <PlacesFilters cities={cities} />

      {/* AdminPageContent */}
      <Suspense fallback={<div>Loading...</div>}>
        <PlacesTable places={places} />
      </Suspense>
    </div>
  );
}
