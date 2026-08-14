import { Suspense } from "react";
import prisma from "@/lib/prisma";
import { OfferStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { ModerationListFilters } from "@/components/admin/moderation/ModerationListFilters";
import { getModerationFilterCities } from "@/lib/admin/moderationAdminQueries";
import { getOfferPublicUrl } from "@/lib/offers/offerPublicUrl";
import { getOfferPreviewPath } from "@/lib/content-preview/paths";
import {
  blockingDependencyItems,
  type ContentDependencySummary,
} from "@/lib/admin/contentDependencySummary";
import {
  deriveOfferArchivedDeletePreflight,
  deriveOfferDeletePreflight,
  getOffersDependencySummariesBatch,
} from "@/server/services/contentDependencySummary.service";
import { ContentLifecycleStatusBadge } from "@/components/contentLifecycle/ContentLifecycleStatusBadge";
import { ContentLifecycleActionsMenu } from "@/components/contentLifecycle/ContentLifecycleActionsMenu";
import {
  buildAdminLifecycleViewModel,
  buildAdminOfferLifecycleInput,
} from "@/lib/contentLifecycle/buildAdminLifecycleViewModel";
import { TableContainer } from "@/components/ui/table";
import { agePolicyLabel } from "@/lib/age/agePolicy";
import { formatAgeRange } from "@/lib/config/ages";
import {
  DataCardList,
  DataCard,
  DataCardHeader,
  DataCardBody,
  DataCardRow,
  DataCardActions,
} from "@/components/ui/data-card-list";
import { AssignOfferPlaceControl } from "@/components/admin/offers/AssignOfferPlaceControl";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseOfferStatusFilter(raw: string | undefined): OfferStatus | undefined {
  if (!raw) return undefined;
  return Object.values(OfferStatus).includes(raw as OfferStatus)
    ? (raw as OfferStatus)
    : undefined;
}

interface SearchParams {
  status?: string;
  cityId?: string;
  placeId?: string;
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
  return `/admin/content/offers${search ? `?${search}` : ""}`;
}

async function getOffers(params: SearchParams) {
  const where: {
    status?: OfferStatus;
    placeId?: string;
    place?: { cityId: string };
  } = {};

  const status = parseOfferStatusFilter(params.status);
  if (status) {
    where.status = status;
  }

  if (params.placeId) {
    where.placeId = params.placeId;
  }

  if (params.cityId) {
    where.place = { cityId: params.cityId };
  }

  return prisma.offer.findMany({
    where,
    include: {
      place: {
        select: {
          title: true,
          archivedAt: true,
          city: { select: { name: true, slug: true } },
          ownerBusiness: {
            select: {
              name: true,
              owner: { select: { email: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

const EMPTY_DEPENDENCY_SUMMARY: ContentDependencySummary = {
  total: 0,
  blockingTotal: 0,
  items: [],
};

type OfferRowMeta = {
  dependencySummary: ContentDependencySummary;
  deletePreflight: ReturnType<typeof deriveOfferDeletePreflight>;
  archivedDeletePreflight: ReturnType<typeof deriveOfferArchivedDeletePreflight>;
};

function OffersTable({
  offers,
  returnTo,
  offerMetaById,
}: {
  offers: Awaited<ReturnType<typeof getOffers>>;
  returnTo: string;
  offerMetaById: Map<string, OfferRowMeta>;
}) {
  if (offers.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>Предложения не найдены</p>
      </div>
    );
  }

  const rows = offers.map((offer) => {
    const isArchived = Boolean(offer.archivedAt);
    const rowMeta = offerMetaById.get(offer.id) ?? {
      dependencySummary: EMPTY_DEPENDENCY_SUMMARY,
      deletePreflight: {
        allowed: offer.status === OfferStatus.DRAFT && !isArchived,
        reasons: [],
        message: undefined,
        dependencySummary: EMPTY_DEPENDENCY_SUMMARY,
      },
      archivedDeletePreflight: {
        allowed: false,
        reasons: ["notArchived"],
        message: undefined,
        dependencySummary: EMPTY_DEPENDENCY_SUMMARY,
      },
    };
    const blockingItems = blockingDependencyItems(rowMeta.dependencySummary);
    const lifecycleViewModel = buildAdminLifecycleViewModel({
      ...buildAdminOfferLifecycleInput({
        status: offer.status,
        archivedAt: offer.archivedAt,
        deletePreflight: rowMeta.deletePreflight,
        archivedDeletePreflight: rowMeta.archivedDeletePreflight,
      }),
      navigationLinks: {
        edit: true,
        preview: true,
        review: offer.status === "PENDING",
      },
    });
    const publicOfferHref =
      !isArchived &&
      offer.place &&
      !offer.place.archivedAt &&
      offer.status === "PUBLISHED" &&
      offer.slug &&
      offer.place.city?.slug
        ? getOfferPublicUrl(offer, offer.place.city.slug)
        : null;
    const viewOfferHref = publicOfferHref ?? getOfferPreviewPath(offer.id);

    const actionsMenu = (
      <ContentLifecycleActionsMenu
        viewModel={lifecycleViewModel}
        contentId={offer.id}
        contentType="offer"
        surface="admin"
        links={{
          edit: {
            href: `/editor/offer/${offer.id}/edit?returnTo=${encodeURIComponent(returnTo)}`,
            label: "Открыть в редакторе",
          },
          preview: {
            href: viewOfferHref,
            newTab: true,
            label: publicOfferHref ? "Открыть публичную страницу" : "Открыть предпросмотр",
          },
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

    return { offer, lifecycleViewModel, actionsMenu };
  });

  return (
    <>
      {/* Desktop: table */}
      <div className="hidden md:block border border-gray-200 rounded-lg overflow-hidden">
        <TableContainer minWidthClassName="min-w-[920px]" scrollLabel="Список предложений, прокручивается по горизонтали">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Название</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Место</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Город</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Бизнес</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Статус</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Возраст</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Создано</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map(({ offer, lifecycleViewModel, actionsMenu }) => (
                <tr key={offer.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{offer.title}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {offer.place ? (
                      offer.place.title
                    ) : (
                      <span className="flex flex-col items-start gap-1">
                        <span className="text-amber-700">Место не назначено</span>
                        <AssignOfferPlaceControl offerId={offer.id} />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{offer.place?.city?.name || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {offer.place?.ownerBusiness?.name ||
                      offer.place?.ownerBusiness?.owner?.email ||
                      "—"}
                  </td>
                  <td className="px-4 py-3">
                    <ContentLifecycleStatusBadge viewModel={lifecycleViewModel} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">{offer.agePolicy === "SPECIFIC" ? formatAgeRange(offer.ageMinMonths, offer.ageMaxMonths) : agePolicyLabel(offer.agePolicy)}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDistanceToNow(offer.createdAt, { addSuffix: true, locale: ru })}
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
        {rows.map(({ offer, lifecycleViewModel, actionsMenu }) => (
          <DataCard key={offer.id}>
            <DataCardHeader
              title={offer.title}
              badge={<ContentLifecycleStatusBadge viewModel={lifecycleViewModel} />}
            />
            <DataCardBody>
              {offer.place ? (
                <DataCardRow label="Место" value={offer.place.title} />
              ) : (
                <DataCardRow
                  label="Место"
                  value={
                    <span className="flex flex-col items-start gap-1">
                      <span className="text-amber-700">Не назначено</span>
                      <AssignOfferPlaceControl offerId={offer.id} />
                    </span>
                  }
                />
              )}
              <DataCardRow label="Возраст" value={offer.agePolicy === "SPECIFIC" ? formatAgeRange(offer.ageMinMonths, offer.ageMaxMonths) : agePolicyLabel(offer.agePolicy)} />
              <DataCardRow label="Город" value={offer.place?.city?.name} />
              <DataCardRow
                label="Бизнес"
                value={offer.place?.ownerBusiness?.name || offer.place?.ownerBusiness?.owner?.email}
              />
              <DataCardRow
                label="Создано"
                value={formatDistanceToNow(offer.createdAt, { addSuffix: true, locale: ru })}
              />
            </DataCardBody>
            <DataCardActions>{actionsMenu}</DataCardActions>
          </DataCard>
        ))}
      </DataCardList>
    </>
  );
}

export default async function ModerationOffersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const [offers, cities] = await Promise.all([
    getOffers(params),
    getModerationFilterCities(),
  ]);
  const dependencySummaries = await getOffersDependencySummariesBatch(
    offers.map((offer) => offer.id),
    prisma,
  );
  const offerMetaById = new Map<string, OfferRowMeta>(
    offers.map((offer) => {
      const dependencySummary =
        dependencySummaries.get(offer.id) ?? EMPTY_DEPENDENCY_SUMMARY;
      return [
        offer.id,
        {
          dependencySummary,
          deletePreflight: deriveOfferDeletePreflight({
            status: offer.status,
            archivedAt: offer.archivedAt,
            publishedAt: offer.publishedAt,
            dependencySummary,
          }),
          archivedDeletePreflight: deriveOfferArchivedDeletePreflight({
            archivedAt: offer.archivedAt,
            dependencySummary,
          }),
        },
      ];
    }),
  );
  const returnTo = buildReturnTo(params);

  return (
    <div className="p-6 md:p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-xl font-bold text-gray-900">Предложения</h1>
          <p className="text-sm text-gray-600 mt-1">
            Предложения (OfferStatus) — те же фильтры по городу; статусы как у мест по смыслу
          </p>
        </div>
      </div>

      <ModerationListFilters
        cities={cities}
        basePath="/admin/content/offers"
        statusFilter="offer"
      />

      <Suspense fallback={<div>Загрузка…</div>}>
        <OffersTable offers={offers} returnTo={returnTo} offerMetaById={offerMetaById} />
      </Suspense>
    </div>
  );
}
