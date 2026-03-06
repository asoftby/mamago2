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
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              City
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Business
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Created
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {places.map((place) => {
            const statusConfig = STATUS_CONFIG[place.status] || STATUS_CONFIG.DRAFT;
            
            return (
              <tr key={place.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {place.title}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {place.city?.name || "-"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {place.owner.business?.name || place.owner.email}
                </td>
                <td className="px-4 py-3 text-sm">
                  <Badge variant={statusConfig.variant} className={statusConfig.className}>
                    {statusConfig.label}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {formatDistanceToNow(place.createdAt, { addSuffix: true, locale: ru })}
                </td>
                <td className="px-4 py-3 text-sm">
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
    <div className="max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Places</h1>
        <p className="text-gray-600 mt-1">
          All places submitted by businesses
        </p>
      </div>

      <PlacesFilters cities={cities} />

      <Suspense fallback={<div>Loading...</div>}>
        <PlacesTable places={places} />
      </Suspense>
    </div>
  );
}
