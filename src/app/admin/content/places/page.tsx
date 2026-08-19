import { Suspense } from "react";
import prisma from "@/lib/prisma";
import { ContentStatus, Prisma } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { getModerationFilterCities } from "@/lib/admin/moderationAdminQueries";
import { PlacesFilters } from "./PlacesFilters";
import { getAbsolutePlacePublicUrl } from "@/lib/placePublicUrl";
import { getPlacePreviewPath } from "@/lib/content-preview/paths";
import { getPlaceDetailHref } from "@/lib/admin/placeDetailNavigation";
import { AdminContentRelationsIndicator } from "@/components/admin/content/AdminContentRelationsIndicator";
import {
  blockingDependencyItems,
  nonBlockingDependencyItems,
  type ContentDependencySummary,
} from "@/lib/admin/contentDependencySummary";
import {
  derivePlaceDeletePreflight,
  derivePlaceArchivedDeletePreflight,
  getPlacesDependencySummariesBatch,
} from "@/server/services/contentDependencySummary.service";
import { ContentLifecycleStatusBadge } from "@/components/contentLifecycle/ContentLifecycleStatusBadge";
import { ContentLifecycleActionsMenu } from "@/components/contentLifecycle/ContentLifecycleActionsMenu";
import {
  buildAdminLifecycleViewModel,
  buildAdminPlaceLifecycleInput,
} from "@/lib/contentLifecycle/buildAdminLifecycleViewModel";
import { TableContainer } from "@/components/ui/table";
import {
  DataCardList,
  DataCard,
  DataCardHeader,
  DataCardBody,
  DataCardRow,
  DataCardActions,
} from "@/components/ui/data-card-list";

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

const EMPTY_DEPENDENCY_SUMMARY: ContentDependencySummary = {
  total: 0,
  blockingTotal: 0,
  items: [],
};

function buildCascadeNote(summary: ContentDependencySummary): string | null {
  const items = nonBlockingDependencyItems(summary);
  if (items.length === 0) {
    return null;
  }

  const parts = items.map((item) => `${item.count} ${item.label.toLowerCase()}`);
  return `Вместе с черновиком будут удалены: ${parts.join(", ")}.`;
}

type PlaceRowMeta = {
  dependencySummary: ContentDependencySummary;
  deletePreflight: ReturnType<typeof derivePlaceDeletePreflight>;
  archivedDeletePreflight: ReturnType<typeof derivePlaceArchivedDeletePreflight>;
};

function PlacesTable({
  places,
  returnTo,
  placeMetaById,
}: {
  places: Awaited<ReturnType<typeof getPlaces>>;
  returnTo: string;
  placeMetaById: Map<string, PlaceRowMeta>;
}) {
  if (places.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>Места не найдены</p>
      </div>
    );
  }

  const rows = places.map((place) => {
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

    const fullAddress = place.formattedAddr || place.customAddress || "";
    const addressParts = fullAddress.split(",").map(p => p.trim());
    const streetAddress = addressParts[0] || "";
    const rowMeta = placeMetaById.get(place.id) ?? {
      dependencySummary: EMPTY_DEPENDENCY_SUMMARY,
      deletePreflight: {
        allowed: place.status !== ContentStatus.DRAFT,
        reasons: [],
        dependencySummary: EMPTY_DEPENDENCY_SUMMARY,
      },
      archivedDeletePreflight: {
        allowed: false,
        reasons: ["notArchived"],
        dependencySummary: EMPTY_DEPENDENCY_SUMMARY,
      },
    };
    const blockingItems = blockingDependencyItems(
      rowMeta.dependencySummary,
    );
    const lifecycleViewModel = buildAdminLifecycleViewModel({
      ...buildAdminPlaceLifecycleInput({
        status: place.status,
        archivedAt: place.archivedAt,
        deletePreflight: rowMeta.deletePreflight,
        archivedDeletePreflight: rowMeta.archivedDeletePreflight,
      }),
      navigationLinks: {
        edit: true,
        preview: true,
        review: place.status === ContentStatus.PENDING,
      },
    });

    const businessLabel =
      place.ownerBusiness?.name ||
      place.ownerBusiness?.owner?.email ||
      place.createdBy?.email || "—";

    const actionsMenu = (
      <ContentLifecycleActionsMenu
        viewModel={lifecycleViewModel}
        contentId={place.id}
        contentType="place"
        surface="admin"
        links={{
          edit: {
            href: editHref,
            label: "Открыть в редакторе",
          },
          preview: {
            href: viewPlaceHref,
            newTab: true,
            label: publicPlaceHref
              ? "Открыть публичную страницу"
              : "Открыть предпросмотр",
          },
          review:
            place.status === ContentStatus.PENDING
              ? {
                  href: getPlaceDetailHref(place.id, returnTo),
                  label: "Открыть модерацию",
                }
              : undefined,
        }}
        deletePreflight={{
          deleteDraft: {
            blockedDialog: !rowMeta.deletePreflight.allowed
              ? {
                  title: "Нельзя удалить черновик",
                  description: rowMeta.deletePreflight.message,
                  items: blockingItems,
                }
              : null,
            cascadeNote: rowMeta.deletePreflight.allowed
              ? buildCascadeNote(rowMeta.dependencySummary)
              : null,
          },
          deleteArchived: {
            blockedDialog: !rowMeta.archivedDeletePreflight.allowed
              ? {
                  title: "Нельзя удалить из архива",
                  description: rowMeta.archivedDeletePreflight.message,
                  items: blockingItems,
                }
              : null,
          },
        }}
      />
    );

    return { place, streetAddress, businessLabel, rowMeta, lifecycleViewModel, actionsMenu };
  });

  return (
    <>
      {/* Desktop: table */}
      <div className="hidden md:block border border-gray-200 rounded-lg overflow-hidden">
        <TableContainer minWidthClassName="min-w-[960px]" scrollLabel="Список мест, прокручивается по горизонтали">
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
                  Связи
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
              {rows.map(({ place, streetAddress, businessLabel, rowMeta, lifecycleViewModel, actionsMenu }) => (
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
                  <td className="px-4 py-3 text-gray-600">{businessLabel}</td>
                  <td className="px-4 py-3">
                    <ContentLifecycleStatusBadge viewModel={lifecycleViewModel} />
                  </td>
                  <td className="px-4 py-3">
                    <AdminContentRelationsIndicator
                      summary={rowMeta.dependencySummary}
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDistanceToNow(place.createdAt, { addSuffix: true, locale: ru })}
                  </td>
                  <td className="px-4 py-3">{actionsMenu}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableContainer>
      </div>

      {/* Mobile: cards — same rows, same actions menu */}
      <DataCardList>
        {rows.map(({ place, streetAddress, businessLabel, rowMeta, lifecycleViewModel, actionsMenu }) => (
          <DataCard key={place.id}>
            <DataCardHeader
              title={place.title}
              subtitle={[place.city?.name, streetAddress].filter(Boolean).join(", ") || undefined}
              badge={<ContentLifecycleStatusBadge viewModel={lifecycleViewModel} />}
            />
            <DataCardBody>
              <DataCardRow label="Бизнес" value={businessLabel === "—" ? null : businessLabel} />
              <DataCardRow
                label="Связи"
                value={<AdminContentRelationsIndicator summary={rowMeta.dependencySummary} />}
              />
              <DataCardRow
                label="Создано"
                value={formatDistanceToNow(place.createdAt, { addSuffix: true, locale: ru })}
              />
            </DataCardBody>
            <DataCardActions>{actionsMenu}</DataCardActions>
          </DataCard>
        ))}
      </DataCardList>
    </>
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
  const dependencySummaries = await getPlacesDependencySummariesBatch(
    places.map((place) => place.id),
    prisma,
  );
  const placeMetaById = new Map<string, PlaceRowMeta>(
    places.map((place) => {
      const dependencySummary =
        dependencySummaries.get(place.id) ?? EMPTY_DEPENDENCY_SUMMARY;
      return [
        place.id,
        {
          dependencySummary,
          deletePreflight: derivePlaceDeletePreflight({
            status: place.status,
            archivedAt: place.archivedAt,
            dependencySummary,
          }),
          archivedDeletePreflight: derivePlaceArchivedDeletePreflight({
            archivedAt: place.archivedAt,
            dependencySummary,
          }),
        },
      ];
    }),
  );
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
        <PlacesTable
          places={places}
          returnTo={returnTo}
          placeMetaById={placeMetaById}
        />
      </Suspense>
    </div>
  );
}
