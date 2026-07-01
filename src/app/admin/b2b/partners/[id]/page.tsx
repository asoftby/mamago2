import { BYN_SYMBOL } from "@/lib/formatters/format-price";
import { renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";
import { getCurrentUser } from "@/lib/auth/server";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { BusinessVisibilityControl } from "@/components/admin/business/BusinessVisibilityControl";
import { UnpVerificationSection } from "@/components/admin/business/UnpVerificationSection";
import { normalizeBusinessVisibilityStatus } from "@/lib/business/businessStatusModel";
import { BusinessDangerZonePlaceholder } from "@/components/admin/business/BusinessDangerZonePlaceholder";
import { PartnerFinanceSection } from "@/components/admin/business/PartnerFinanceSection";
import { getBillingAccountByBusinessId } from "@/server/services/billing/billingAccount.service";
import {
  getBillingTransactions,
  getBillingTransactionsSummary,
} from "@/server/services/billing/billingTransaction.service";
import {
  getBusinessResolvedBillingActionPrices,
  listBillingActionRates,
} from "@/server/services/billing/billingActionRateResolver.service";

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

function getLastThirtyDaysRange() {
  const dateTo = new Date();
  dateTo.setHours(23, 59, 59, 999);

  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - 29);
  dateFrom.setHours(0, 0, 0, 0);

  return { dateFrom, dateTo };
}

export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "ADMIN" && user.role !== "MODERATOR") {
    redirect("/admin");
  }

  const { id } = await params;

  const business = await prisma.business.findUnique({
    where: { id },
    include: {
      owner: {
        select: {
          email: true,
          phoneE164: true,
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
    } ,
  });

  if (!business) {
    notFound();
  }

  // Get places for this business owner
  const places = await prisma.place.findMany({
    where: {
      ownerBusinessId: business.id,
    },
    include: {
      city: {
        select: {
          name: true,
        },
      },
      activities: {
        select: {
          id: true,
          title: true,
          status: true,
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
  });

  // Get events for this business owner
  const visibility = normalizeBusinessVisibilityStatus(
    business.operationalStatus,
  );

  const events = business.ownerUserId
    ? await prisma.activity.findMany({
        where: {
          ownerUserId: business.ownerUserId,
          type: "EVENT",
        },
        select: {
          id: true,
          title: true,
          status: true,
          scheduleMode: true,
          nextOccurrenceAt: true,
          priceFrom: true,
          priceTo: true,
          priceText: true,
          createdAt: true,
          place: {
            select: { title: true },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      })
    : [];

  let financeInitialState = {
    account: null,
    summary: null,
    transactions: [],
    pagination: null,
    pricing: {
      businessRates: [],
      resolvedPrices: [],
    },
  } as {
    account: {
      id: string;
      businessId: string;
      status: "ACTIVE" | "SUSPENDED" | "CLOSED";
      depositBalance: number;
      currency: string;
      lowBalanceThreshold: number;
      creditLimit: number;
    } | null;
    summary: {
      totalTopups: number;
      totalCharges: number;
      totalRefunds: number;
      netChange: number;
      transactionsCount: number;
    } | null;
    transactions: Array<{
      id: string;
      type: string;
      status: "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELED" | "REVERSED";
      amount: number;
      currency: string;
      description: string | null;
      occurredAt: string;
      referenceType: string;
      referenceId: string | null;
      parentTransactionId: string | null;
      hasRefund: boolean;
      refunds: Array<{
        id: string;
        amount: number;
        occurredAt: string;
        parentTransactionId: string | null;
      }>;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore: boolean;
    } | null;
    pricing: {
      businessRates: Array<{
        id: string;
        actionType: string;
        scopeType: string;
        pricingType: string;
        fixedAmount: number | null;
        percentRate: number | null;
        minimumAmount: number | null;
        maximumAmount: number | null;
        currency: string;
        isActive: boolean;
        startsAt: string | null;
        endsAt: string | null;
        reason: string | null;
      }>;
      resolvedPrices: Array<{
        actionType: string;
        source: string | null;
        rule: {
          id: string;
          pricingType: string;
          fixedAmount: number | null;
          percentRate: number | null;
          minimumAmount: number | null;
          maximumAmount: number | null;
          currency: string;
          startsAt: string | null;
          endsAt: string | null;
          reason: string | null;
        } | null;
      }>;
    };
  };

  if (user.role === "ADMIN") {
    const account = await getBillingAccountByBusinessId(business.id);
    const [businessActionRates, resolvedActionPrices] = await Promise.all([
      listBillingActionRates({
        scopeType: "BUSINESS",
        scopeId: business.id,
        includeInactive: true,
      }),
      getBusinessResolvedBillingActionPrices({ businessId: business.id }),
    ]);
    type BusinessActionRateRow = (typeof businessActionRates)[number];
    type ResolvedActionPriceRow = (typeof resolvedActionPrices)[number];

    if (account) {
      const { dateFrom, dateTo } = getLastThirtyDaysRange();
      const [{ transactions, total }, summary] = await Promise.all([
        getBillingTransactions({
          businessId: business.id,
          dateFrom,
          dateTo,
          limit: 10,
          offset: 0,
        }),
        getBillingTransactionsSummary({
          businessId: business.id,
          dateFrom,
          dateTo,
        }),
      ]);

      financeInitialState = {
        account: {
          id: account.id,
          businessId: account.businessId,
          status: account.status,
          depositBalance: account.depositBalance.toNumber(),
          currency: account.currency,
          lowBalanceThreshold: account.lowBalanceThreshold.toNumber(),
          creditLimit: account.creditLimit.toNumber(),
        },
        summary,
        transactions: transactions.map((tx) => ({
          id: tx.id,
          type: tx.type,
          status: tx.status,
          amount: tx.amount.toNumber(),
          currency: tx.currency,
          description: tx.description,
          occurredAt: tx.occurredAt.toISOString(),
          referenceType: tx.referenceType,
          referenceId: tx.referenceId,
          parentTransactionId: tx.parentTransactionId,
          hasRefund: tx.childTransactions.length > 0,
          refunds: tx.childTransactions.map((refund) => ({
            id: refund.id,
            amount: refund.amount.toNumber(),
            occurredAt: refund.occurredAt.toISOString(),
            parentTransactionId: refund.parentTransactionId,
          })),
        })),
        pagination: {
          page: 1,
          limit: 10,
          total,
          totalPages: Math.max(1, Math.ceil(total / 10)),
          hasMore: total > 10,
        },
        pricing: {
          businessRates: businessActionRates.map((rate: BusinessActionRateRow) => ({
            id: rate.id,
            actionType: rate.actionType,
            scopeType: rate.scopeType,
            pricingType: rate.pricingType,
            fixedAmount: rate.fixedAmount?.toNumber() ?? null,
            percentRate: rate.percentRate?.toNumber() ?? null,
            minimumAmount: rate.minimumAmount?.toNumber() ?? null,
            maximumAmount: rate.maximumAmount?.toNumber() ?? null,
            currency: rate.currency,
            isActive: rate.isActive,
            startsAt: rate.startsAt?.toISOString() ?? null,
            endsAt: rate.endsAt?.toISOString() ?? null,
            reason: rate.reason ?? null,
          })),
          resolvedPrices: resolvedActionPrices.map((item: ResolvedActionPriceRow) => ({
            actionType: item.actionType,
            source: item.source,
            rule: item.rule
              ? {
                  id: item.rule.id,
                  pricingType: item.rule.pricingType,
                  fixedAmount: item.rule.fixedAmount?.toNumber() ?? null,
                  percentRate: item.rule.percentRate?.toNumber() ?? null,
                  minimumAmount: item.rule.minimumAmount?.toNumber() ?? null,
                  maximumAmount: item.rule.maximumAmount?.toNumber() ?? null,
                  currency: item.rule.currency,
                  startsAt: item.rule.startsAt?.toISOString() ?? null,
                  endsAt: item.rule.endsAt?.toISOString() ?? null,
                  reason: item.rule.reason ?? null,
                }
              : null,
          })),
        },
      };
    } else {
      financeInitialState = {
        ...financeInitialState,
        pricing: {
          businessRates: businessActionRates.map((rate: BusinessActionRateRow) => ({
            id: rate.id,
            actionType: rate.actionType,
            scopeType: rate.scopeType,
            pricingType: rate.pricingType,
            fixedAmount: rate.fixedAmount?.toNumber() ?? null,
            percentRate: rate.percentRate?.toNumber() ?? null,
            minimumAmount: rate.minimumAmount?.toNumber() ?? null,
            maximumAmount: rate.maximumAmount?.toNumber() ?? null,
            currency: rate.currency,
            isActive: rate.isActive,
            startsAt: rate.startsAt?.toISOString() ?? null,
            endsAt: rate.endsAt?.toISOString() ?? null,
            reason: rate.reason ?? null,
          })),
          resolvedPrices: resolvedActionPrices.map((item: ResolvedActionPriceRow) => ({
            actionType: item.actionType,
            source: item.source,
            rule: item.rule
              ? {
                  id: item.rule.id,
                  pricingType: item.rule.pricingType,
                  fixedAmount: item.rule.fixedAmount?.toNumber() ?? null,
                  percentRate: item.rule.percentRate?.toNumber() ?? null,
                  minimumAmount: item.rule.minimumAmount?.toNumber() ?? null,
                  maximumAmount: item.rule.maximumAmount?.toNumber() ?? null,
                  currency: item.rule.currency,
                  startsAt: item.rule.startsAt?.toISOString() ?? null,
                  endsAt: item.rule.endsAt?.toISOString() ?? null,
                  reason: item.rule.reason ?? null,
                }
              : null,
          })),
        },
      };
    }
  }

  return (
    <div className="p-6 md:p-4 space-y-6">
      {/* Header */}
      <div>
        <Link href="/admin/b2b/partners">
          <Button variant="ghost" size="sm" className="-ml-2 mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад к списку
          </Button>
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl md:text-xl font-bold text-gray-900">{business.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                STATUS_COLORS[business.verificationStatus]
              }`}
            >
              {STATUS_LABELS[business.verificationStatus] ||
                business.verificationStatus}
            </span>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                visibility === "DISABLED"
                  ? "bg-amber-100 text-amber-900"
                  : visibility === "ARCHIVED"
                    ? "bg-neutral-200 text-neutral-800"
                    : "bg-emerald-50 text-emerald-800"
              }`}
            >
              {visibility === "DISABLED"
                ? "Отключён для пользователей"
                : visibility === "ARCHIVED"
                  ? "В архиве (не в выдаче)"
                  : "Доступен пользователям"}
            </span>
          </div>
        </div>
      </div>
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
              <div className="text-base">{business.owner?.email || "—"}</div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">
                Телефон владельца
              </div>
              <div className="text-base">
                {business.owner?.phoneE164 || "—"}
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

          {/* УНП: автоматическая сверка с ГРП */}
          <div className="mt-6 border-t pt-6">
            <h3 className="text-sm font-semibold mb-3">Автоматическая сверка УНП</h3>
            <UnpVerificationSection
              businessId={business.id}
              unp={business.unp}
              legalName={business.legalName}
              canRecheck={user.role === "ADMIN" || user.role === "MODERATOR"}
              initialState={{
                unpVerificationStatus: business.unpVerificationStatus,
                unpVerifiedAt: business.unpVerifiedAt?.toISOString() ?? null,
                unpOfficialName: business.unpOfficialName,
                unpLastCheckedAt: business.unpLastCheckedAt?.toISOString() ?? null,
              }}
            />
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

        {user.role === "ADMIN" ? (
          <PartnerFinanceSection
            businessId={business.id}
            initialState={financeInitialState}
          />
        ) : (
          <div className="rounded-lg border border-dashed border-gray-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-gray-900">Финансы</h2>
            <p className="mt-2 text-sm text-gray-600">
              Финансовые данные доступны только администраторам.
            </p>
          </div>
        )}

        {/* Places */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">
            Места ({places.length})
          </h2>
          {places.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Нет мест</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Название</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Город</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Адрес</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Предложений</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Создано</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {places.map((place) => (
                    <tr key={place.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{place.title}</td>
                      <td className="px-4 py-3 text-gray-600">{place.city?.name || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{place.formattedAddr || place.customAddress || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{place.activities.length}</td>
                      <td className="px-4 py-3 text-gray-600">{new Date(place.createdAt).toLocaleDateString("ru-RU")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Offers */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">
            Предложения ({places.reduce((sum: number, place) => sum + place.activities.length, 0)})
          </h2>
          {places.every((place) => place.activities.length === 0) ? (
            <div className="text-center py-8 text-gray-500">Нет предложений</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Название</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Создано</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {places.map((place) =>
                    place.activities.map((activity) => (
                      <tr key={activity.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{activity.title}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[activity.status]}`}>
                            {STATUS_LABELS[activity.status] || activity.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{new Date(activity.createdAt).toLocaleDateString("ru-RU")}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Events */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">
            События ({events.length})
          </h2>
          {events.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Нет событий</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Название</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Место</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ближайшая дата</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Цена</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Создано</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {events.map((event) => (
                    <tr key={event.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{event.title}</td>
                      <td className="px-4 py-3 text-gray-600">{event.place?.title || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[event.status]}`}>
                          {STATUS_LABELS[event.status] || event.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {event.nextOccurrenceAt
                          ? new Date(event.nextOccurrenceAt).toLocaleDateString("ru-RU")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {event.priceText
                          ? renderCurrencyText(event.priceText, { iconSize: "sm" })
                          : event.priceFrom != null
                            ? renderCurrencyText(`от ${event.priceFrom} ${BYN_SYMBOL}`, { iconSize: "sm" })
                            : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{new Date(event.createdAt).toLocaleDateString("ru-RU")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <BusinessVisibilityControl
            businessId={business.id}
            readOnly={user.role !== "ADMIN"}
            initialVisibilityStatus={visibility}
          />
          <BusinessDangerZonePlaceholder />
        </div>
    </div>
  );
}
