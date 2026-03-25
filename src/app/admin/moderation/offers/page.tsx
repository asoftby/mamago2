import { Suspense } from "react";
import Link from "next/link";
import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { OfferStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { ModerationListFilters } from "@/components/admin/moderation/ModerationListFilters";
import { MODERATION_OFFER_STATUS_CONFIG } from "@/lib/admin/moderationOfferStatusBadges";
import { getModerationFilterCities } from "@/lib/admin/moderationAdminQueries";

function parseOfferStatusFilter(raw: string | undefined): OfferStatus | undefined {
  if (!raw) return undefined;
  return Object.values(OfferStatus).includes(raw as OfferStatus)
    ? (raw as OfferStatus)
    : undefined;
}

interface SearchParams {
  status?: string;
  cityId?: string;
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
          city: { select: { name: true } },
          owner: {
            select: {
              email: true,
              business: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

function OffersTable({ offers }: { offers: Awaited<ReturnType<typeof getOffers>> }) {
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
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {offers.map((offer) => {
            const statusConfig =
              MODERATION_OFFER_STATUS_CONFIG[offer.status] ||
              MODERATION_OFFER_STATUS_CONFIG.DRAFT;
            return (
              <tr key={offer.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{offer.title}</td>
                <td className="px-4 py-3 text-gray-600">{offer.place.title}</td>
                <td className="px-4 py-3 text-gray-600">{offer.place.city?.name || "—"}</td>
                <td className="px-4 py-3 text-gray-600">
                  {offer.place.owner.business?.name || offer.place.owner.email}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusConfig.variant} className={statusConfig.className}>
                    {statusConfig.label}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {formatDistanceToNow(offer.createdAt, { addSuffix: true, locale: ru })}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/editor/offer/${offer.id}/edit?returnTo=${encodeURIComponent("/admin/moderation/offers")}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Открыть в редакторе
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
        basePath="/admin/moderation/offers"
        statusFilter="offer"
      />

      <Suspense fallback={<div>Загрузка…</div>}>
        <OffersTable offers={offers} />
      </Suspense>
    </div>
  );
}
