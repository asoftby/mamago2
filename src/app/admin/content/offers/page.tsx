import { Suspense } from "react";
import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { OfferStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { ModerationListFilters } from "@/components/admin/moderation/ModerationListFilters";
import { MODERATION_OFFER_STATUS_CONFIG } from "@/lib/admin/moderationOfferStatusBadges";
import { getModerationFilterCities } from "@/lib/admin/moderationAdminQueries";
import { getOfferPublicUrl } from "@/lib/offers/offerPublicUrl";
import { getOfferPreviewPath } from "@/lib/content-preview/paths";
import { AdminContentRowActions } from "@/components/admin/content/AdminContentRowActions";

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
    place?: { cityId: string };
  } = {};

  const status = parseOfferStatusFilter(params.status);
  if (status) {
    where.status = status;
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

function OffersTable({
  offers,
  returnTo,
}: {
  offers: Awaited<ReturnType<typeof getOffers>>;
  returnTo: string;
}) {
  if (offers.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>Предложения не найдены</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Название</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Место</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Город</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Бизнес</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Статус</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Создано</th>
            <th className="px-4 py-3 text-left font-medium text-gray-700">Действия</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {offers.map((offer) => {
            const statusConfig =
              MODERATION_OFFER_STATUS_CONFIG[offer.status] ||
              MODERATION_OFFER_STATUS_CONFIG.DRAFT;
            const isArchived = Boolean(offer.archivedAt);
            const publicOfferHref =
              !isArchived &&
              !offer.place.archivedAt &&
              offer.status === "PUBLISHED" &&
              offer.slug &&
              offer.place.city?.slug
                ? getOfferPublicUrl(offer, offer.place.city.slug)
                : null;
            const viewOfferHref = publicOfferHref ?? getOfferPreviewPath(offer.id);
            return (
              <tr key={offer.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{offer.title}</td>
                <td className="px-4 py-3 text-gray-600">{offer.place.title}</td>
                <td className="px-4 py-3 text-gray-600">{offer.place.city?.name || "—"}</td>
                <td className="px-4 py-3 text-gray-600">
                  {offer.place.ownerBusiness?.name ||
                    offer.place.ownerBusiness?.owner?.email ||
                    "—"}
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
                  {formatDistanceToNow(offer.createdAt, { addSuffix: true, locale: ru })}
                </td>
                <td className="px-4 py-3">
                  <AdminContentRowActions
                    editAction={{
                      icon: "edit",
                      href: `/editor/offer/${offer.id}/edit?returnTo=${encodeURIComponent(returnTo)}`,
                      label: "Открыть в редакторе",
                      title: "Открыть в редакторе",
                    }}
                    viewAction={{
                      icon: "view",
                      href: viewOfferHref,
                      newTab: true,
                      label: publicOfferHref
                        ? "Открыть публичную страницу"
                        : "Открыть предпросмотр",
                      title: publicOfferHref
                        ? "Открыть публичную страницу"
                        : "Открыть предпросмотр",
                    }}
                    destructiveAction={
                      offer.status !== "DRAFT"
                        ? isArchived
                          ? {
                              kind: "restore",
                              label: "Восстановить",
                              title: "Восстановить предложение из архива?",
                              description:
                                "Предложение снова станет доступно в рабочих списках. Если оно опубликовано и место не находится в архиве, публичная страница снова откроется пользователям.",
                              request: {
                                url: `/api/admin/offers/${offer.id}/archive`,
                                method: "DELETE",
                              },
                              confirmLabel: "Восстановить",
                              successMessage: "Предложение восстановлено из архива",
                              errorMessage: "Не удалось восстановить предложение",
                            }
                          : {
                              kind: "archive",
                              label: "Архивировать",
                              title: "Архивировать предложение?",
                              description:
                                "Предложение будет скрыто с публичной страницы и из связанных блоков места. Действие можно отменить позже.",
                              request: {
                                url: `/api/admin/offers/${offer.id}/archive`,
                                method: "POST",
                              },
                              confirmLabel: "Архивировать",
                              successMessage: "Предложение перемещено в архив",
                              errorMessage: "Не удалось архивировать предложение",
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
        <OffersTable offers={offers} returnTo={returnTo} />
      </Suspense>
    </div>
  );
}
