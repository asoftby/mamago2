import { Suspense } from "react";
import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { ContentStatus, Prisma } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { MODERATION_CONTENT_STATUS_CONFIG } from "@/lib/admin/moderationContentStatusBadges";
import { getModerationFilterCities } from "@/lib/admin/moderationAdminQueries";
import { PlacesFilters } from "./PlacesFilters";
import { getAbsolutePlacePublicUrl } from "@/lib/placePublicUrl";
import { getPlacePreviewPath } from "@/lib/content-preview/paths";
import { getPlaceDetailHref } from "@/lib/admin/placeDetailNavigation";
import { AdminContentRowActions } from "@/components/admin/content/AdminContentRowActions";

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
  [key: string]: string | undefined;
}

function buildReturnTo(params: SearchParams): string {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === "string" && value.length > 0) {
      query.set(key, value);
    }
  });

  const search = query.toString();
  return `/admin/content/places${search ? `?${search}` : ""}`;
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

function PlacesTable({
  places,
  returnTo,
}: {
  places: Awaited<ReturnType<typeof getPlaces>>;
  returnTo: string;
}) {
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
              Название
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">
              Город
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">
              Бизнес
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">
              Статус
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">
              Создано
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">
              Действия
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {places.map((place) => {
            const statusConfig =
              MODERATION_CONTENT_STATUS_CONFIG[place.status] ||
              MODERATION_CONTENT_STATUS_CONFIG.DRAFT;
            const isArchived = Boolean(place.archivedAt);
            const hasPreviewVersion =
              isArchived ||
              place.status !== "PUBLISHED" ||
              place.revisions.some((revision) =>
                ["DRAFT", "PENDING", "NEEDS_REVISION"].includes(revision.status),
              );
            const editHref = `/editor/place/${place.id}/edit?returnTo=${encodeURIComponent(returnTo)}`;
            const publicPlaceHref = !hasPreviewVersion
              ? getAbsolutePlacePublicUrl({ slug: place.slug, id: place.id })
              : null;
            const viewPlaceHref = publicPlaceHref ?? getPlacePreviewPath(place.id);
            
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
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={statusConfig.variant} className={statusConfig.className}>
                      {statusConfig.label}
                    </Badge>
                    {isArchived ? (
                      <Badge
                        variant="outline"
                        className="border-stone-300 bg-stone-100 text-stone-700"
                      >
                        В архиве
                      </Badge>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {formatDistanceToNow(place.createdAt, { addSuffix: true, locale: ru })}
                </td>
                <td className="px-4 py-3">
                  <AdminContentRowActions
                    editAction={{
                      icon: "edit",
                      href: editHref,
                      label: "Открыть в редакторе",
                      title: "Открыть в редакторе",
                    }}
                    viewAction={{
                      icon: "view",
                      href: viewPlaceHref,
                      newTab: true,
                      label: publicPlaceHref
                        ? "Открыть публичную страницу"
                        : "Открыть предпросмотр",
                      title: publicPlaceHref
                        ? "Открыть публичную страницу"
                        : "Открыть предпросмотр",
                    }}
                    reviewAction={{
                      icon: "review",
                      href: getPlaceDetailHref(place.id, returnTo),
                      label: "Открыть модерацию",
                      title: "Открыть модерацию",
                    }}
                    destructiveAction={
                      place.status !== ContentStatus.DRAFT
                        ? isArchived
                          ? {
                              kind: "restore",
                              label: "Восстановить",
                              title: "Восстановить место из архива?",
                              description:
                                "Место снова станет доступно в рабочих списках. Если оно опубликовано и не заблокировано другими правилами, публичная страница снова откроется пользователям.",
                              request: {
                                url: `/api/admin/places/${place.id}/archive`,
                                method: "DELETE",
                              },
                              confirmLabel: "Восстановить",
                              successMessage: "Место восстановлено из архива",
                              errorMessage: "Не удалось восстановить место",
                            }
                          : {
                              kind: "archive",
                              label: "Архивировать",
                              title: "Архивировать место?",
                              description:
                                "Место будет скрыто с публичной страницы и из поиска. Действие можно отменить позже.",
                              request: {
                                url: `/api/admin/places/${place.id}/archive`,
                                method: "POST",
                              },
                              confirmLabel: "Архивировать",
                              successMessage: "Место перемещено в архив",
                              errorMessage: "Не удалось архивировать место",
                            }
                        : null
                    }
                  />
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
  const returnTo = buildReturnTo(params);

  return (
    <div className="p-6 md:p-4 space-y-6">
      {/* AdminPageHeader */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-xl font-bold">Места</h1>
          <p className="text-sm text-gray-600 mt-1">
            Все места, добавленные бизнесами
          </p>
        </div>
      </div>

      {/* AdminPageToolbar */}
      <PlacesFilters cities={cities} />

      {/* AdminPageContent */}
      <Suspense fallback={<div>Загрузка...</div>}>
        <PlacesTable places={places} returnTo={returnTo} />
      </Suspense>
    </div>
  );
}
