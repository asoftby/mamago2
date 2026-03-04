import { getCurrentUser } from "@/lib/auth/server";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  PUBLISHED: "bg-blue-100 text-blue-800",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  PENDING: "На проверке",
  APPROVED: "Одобрено",
  REJECTED: "Отклонено",
  PUBLISHED: "Опубликовано",
};

const OFFER_KIND_LABELS: Record<string, string> = {
  EVENT: "Событие",
  SERVICE: "Услуга",
};

export default async function PartnerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "ADMIN" && user.role !== "MODERATOR") {
    redirect("/admin");
  }

  const business = await prisma.business.findUnique({
    where: { id: params.id },
    include: {
      owner: {
        select: {
          email: true,
          phoneE164: true,
        },
      },
      places: {
        include: {
          city: {
            select: {
              name: true,
            },
          },
          offers: {
            select: {
              id: true,
              title: true,
              kind: true,
              status: true,
              publishedAt: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      verificationLogs: {
        include: {
          reviewedBy: {
            select: {
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
      },
    },
  });

  if (!business) {
    notFound();
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/admin/b2b/partners">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад к списку
          </Button>
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{business.name}</h1>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            STATUS_COLORS[business.verificationStatus]
          }`}
        >
          {STATUS_LABELS[business.verificationStatus] ||
            business.verificationStatus}
        </span>
      </div>

      <div className="space-y-6">
        {/* Основная информация */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Основная информация</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">УНП</div>
              <div className="text-base">{business.unp || "—"}</div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">
                Юридическое название
              </div>
              <div className="text-base">{business.legalName || "—"}</div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">
                Телефон бизнеса
              </div>
              <div className="text-base">{business.phone || "—"}</div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">
                Email владельца
              </div>
              <div className="text-base">{business.owner.email}</div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">
                Телефон владельца
              </div>
              <div className="text-base">
                {business.owner.phoneE164 || "—"}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">
                Дата создания
              </div>
              <div className="text-base">
                {new Date(business.createdAt).toLocaleString("ru-RU")}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">
                Последнее обновление
              </div>
              <div className="text-base">
                {new Date(business.updatedAt).toLocaleString("ru-RU")}
              </div>
            </div>
          </div>
        </div>

        {/* Верификация */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Верификация</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">
                Статус верификации
              </div>
              <div className="text-base">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    STATUS_COLORS[business.verificationStatus]
                  }`}
                >
                  {STATUS_LABELS[business.verificationStatus] ||
                    business.verificationStatus}
                </span>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">
                Дата подачи заявки
              </div>
              <div className="text-base">
                {business.submittedAt
                  ? new Date(business.submittedAt).toLocaleString("ru-RU")
                  : "—"}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">
                Дата проверки
              </div>
              <div className="text-base">
                {business.reviewedAt
                  ? new Date(business.reviewedAt).toLocaleString("ru-RU")
                  : "—"}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">
                Дата одобрения
              </div>
              <div className="text-base">
                {business.approvedAt
                  ? new Date(business.approvedAt).toLocaleString("ru-RU")
                  : "—"}
              </div>
            </div>

            {business.rejectedAt && (
              <div>
                <div className="text-sm font-medium text-gray-500 mb-1">
                  Дата отклонения
                </div>
                <div className="text-base">
                  {new Date(business.rejectedAt).toLocaleString("ru-RU")}
                </div>
              </div>
            )}

            {business.reviewNote && (
              <div className="col-span-2">
                <div className="text-sm font-medium text-gray-500 mb-1">
                  Комментарий проверки
                </div>
                <div className="text-base bg-gray-50 p-3 rounded">
                  {business.reviewNote}
                </div>
              </div>
            )}
          </div>

          {/* Verification Logs */}
          {business.verificationLogs.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold mb-3">История изменений</h3>
              <div className="space-y-2">
                {business.verificationLogs.map((log) => (
                  <div
                    key={log.id}
                    className="text-sm bg-gray-50 p-3 rounded flex justify-between items-start"
                  >
                    <div>
                      <span className="font-medium">
                        {STATUS_LABELS[log.statusFrom] || log.statusFrom}
                      </span>
                      {" → "}
                      <span className="font-medium">
                        {STATUS_LABELS[log.statusTo] || log.statusTo}
                      </span>
                      {log.note && (
                        <div className="text-gray-600 mt-1">{log.note}</div>
                      )}
                      {log.reviewedBy && (
                        <div className="text-gray-500 text-xs mt-1">
                          Проверил: {log.reviewedBy.email}
                        </div>
                      )}
                    </div>
                    <div className="text-gray-500 text-xs whitespace-nowrap ml-4">
                      {new Date(log.createdAt).toLocaleString("ru-RU")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Places */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">
            Места ({business.places.length})
          </h2>
          {business.places.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Нет мест</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Название
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Город
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Адрес
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Предложений
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Создано
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {business.places.map((place) => (
                    <tr key={place.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {place.title}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {place.city.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {place.address}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {place.offers.length}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(place.createdAt).toLocaleDateString("ru-RU")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Offers */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">
            Предложения (
            {business.places.reduce(
              (sum, place) => sum + place.offers.length,
              0
            )}
            )
          </h2>
          {business.places.every((place) => place.offers.length === 0) ? (
            <div className="text-center py-8 text-gray-500">
              Нет предложений
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Название
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Тип
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Статус
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Опубликовано
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Создано
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {business.places.map((place) =>
                    place.offers.map((offer) => (
                      <tr key={offer.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {offer.title}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {OFFER_KIND_LABELS[offer.kind] || offer.kind}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              STATUS_COLORS[offer.status]
                            }`}
                          >
                            {STATUS_LABELS[offer.status] || offer.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {offer.publishedAt
                            ? new Date(offer.publishedAt).toLocaleDateString(
                                "ru-RU"
                              )
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(offer.createdAt).toLocaleDateString(
                            "ru-RU"
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
