import { Suspense } from "react";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { ContentStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { PlacesFilters } from "./PlacesFilters";

const STATUS_CONFIG = {
  DRAFT: { label: "Черновик", variant: "secondary" as const, className: "" },
  PENDING: { label: "На модерации", variant: "outline" as const, className: "bg-gray-100 text-gray-700 border-gray-200" },
  PUBLISHED: { label: "Опубликовано", variant: "default" as const, className: "" },
  NEEDS_REVISION: { label: "Требует правок", variant: "destructive" as const, className: "" },
  REJECTED: { label: "Отклонено", variant: "destructive" as const, className: "" },
};

interface SearchParams {
  status?: ContentStatus;
  cityId?: string;
}

async function getPlaces(params: SearchParams) {
  const where: any = {};

  if (params.status) {
    where.status = params.status;
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
      owner: {
        select: {
          id: true,
          email: true,
          business: {
            select: {
              name: true,
            },
          },
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

async function getCities() {
  return prisma.city.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });
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
            const statusConfig = STATUS_CONFIG[place.status] || STATUS_CONFIG.DRAFT;
            
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
                  {place.owner.business?.name || place.owner.email}
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
                    href={`/admin/moderation/places/${place.id}`}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Review
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
    getCities(),
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
