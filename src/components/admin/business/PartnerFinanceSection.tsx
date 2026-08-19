"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Landmark, RefreshCcw, Wallet } from "lucide-react";
import { BillingAccountStatusBadge } from "@/components/admin/billing/BillingAccountStatusBadge";
import { TransactionStatusBadge } from "@/components/admin/billing/TransactionStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BILLING_ACTION_TITLES,
  BILLING_PRICING_TYPE_LABELS,
  BILLING_SCOPE_LABELS,
  formatBillingActionPeriod,
  formatBillingActionPrice,
} from "@/lib/billing/actionPricing";
import { formatPrice, formatTransactionAmount } from "@/lib/formatters/format-price";
import { cn } from "@/lib/utils";
import { TableContainer } from "@/components/ui/table";

type PeriodPreset = "today" | "7d" | "30d" | "currentMonth" | "previousMonth" | "custom";

type FinanceAccount = {
  id: string;
  businessId: string;
  status: "ACTIVE" | "SUSPENDED" | "CLOSED";
  depositBalance: number;
  currency: string;
  lowBalanceThreshold: number;
  creditLimit: number;
};

type FinanceSummary = {
  totalTopups: number;
  totalCharges: number;
  totalRefunds: number;
  netChange: number;
  transactionsCount: number;
};

type FinanceTransaction = {
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
};

type FinancePagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
};

type FinanceBusinessRate = {
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
};

type FinanceResolvedPrice = {
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
};

type FinancePayload = {
  account: FinanceAccount;
  summary: FinanceSummary;
  transactions: FinanceTransaction[];
  pagination: FinancePagination;
  pricing?: {
    businessRates: FinanceBusinessRate[];
    resolvedPrices: FinanceResolvedPrice[];
  };
};

type FinanceInitialState = {
  account: FinanceAccount | null;
  summary: FinanceSummary | null;
  transactions: FinanceTransaction[];
  pagination: FinancePagination | null;
  pricing: {
    businessRates: FinanceBusinessRate[];
    resolvedPrices: FinanceResolvedPrice[];
  };
};

const PERIOD_OPTIONS: Array<{ value: PeriodPreset; label: string }> = [
  { value: "today", label: "Сегодня" },
  { value: "7d", label: "7 дней" },
  { value: "30d", label: "30 дней" },
  { value: "currentMonth", label: "Текущий месяц" },
  { value: "previousMonth", label: "Прошлый месяц" },
  { value: "custom", label: "Период" },
];

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  DEPOSIT_TOPUP: "Пополнение",
  LEAD_CHARGE: "Списание за лид",
  SUBSCRIPTION_CHARGE: "Подписка",
  SUBSCRIPTION_RENEWAL: "Продление подписки",
  REFUND: "Возврат",
  MANUAL_ADJUSTMENT: "Ручная корректировка",
  PROMOTION_CHARGE: "Продвижение",
  FEATURE_CHARGE: "Доп. функция",
  BONUS_CREDIT: "Бонус",
  CORRECTION: "Корректировка",
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(23, 59, 59, 999);
  return next;
}

function getPresetRange(period: PeriodPreset) {
  const now = new Date();

  switch (period) {
    case "today":
      return {
        dateFrom: startOfDay(now),
        dateTo: endOfDay(now),
      };
    case "7d": {
      const from = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
      return { dateFrom: from, dateTo: endOfDay(now) };
    }
    case "30d": {
      const from = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29));
      return { dateFrom: from, dateTo: endOfDay(now) };
    }
    case "currentMonth": {
      const from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
      return { dateFrom: from, dateTo: endOfDay(now) };
    }
    case "previousMonth": {
      const from = startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      const to = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
      return { dateFrom: from, dateTo: to };
    }
    default:
      return null;
  }
}

function getTransactionTypeLabel(type: string) {
  return TRANSACTION_TYPE_LABELS[type] ?? type;
}

function getAmountTone(transaction: FinanceTransaction) {
  if (transaction.type === "REFUND") return "text-emerald-700";
  if (transaction.amount > 0) return "text-emerald-700";
  return "text-gray-900";
}

function buildReferenceLabel(transaction: FinanceTransaction) {
  if (transaction.referenceType === "REQUEST" && transaction.referenceId) {
    return "Открыть заказ";
  }

  if (transaction.referenceType === "NONE" || !transaction.referenceId) {
    return "—";
  }

  return `${transaction.referenceType} / ${transaction.referenceId}`;
}

export function PartnerFinanceSection({
  businessId,
  initialState,
}: {
  businessId: string;
  initialState: FinanceInitialState;
}) {
  const [period, setPeriod] = useState<PeriodPreset>("30d");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<FinanceInitialState>(initialState);

  useEffect(() => {
    if (!initialState.account) {
      return;
    }

    const controller = new AbortController();
    const presetRange = getPresetRange(period);
    const dateFrom = period === "custom" ? customDateFrom : presetRange ? formatDateInput(presetRange.dateFrom) : "";
    const dateTo = period === "custom" ? customDateTo : presetRange ? formatDateInput(presetRange.dateTo) : "";

    if (period === "custom" && (!dateFrom || !dateTo)) {
      return;
    }

    const fetchFinance = async () => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "10",
        });

        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);

        const response = await fetch(
          `/api/admin/billing/businesses/${businessId}/transactions?${params.toString()}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          const text = await response.text().catch(() => "");
          throw new Error(text || `HTTP ${response.status}`);
        }

        const payload = (await response.json()) as FinancePayload & { success: boolean };
        setData({
          account: payload.account,
          summary: payload.summary,
          transactions: payload.transactions,
          pagination: payload.pagination,
          pricing: payload.pricing ?? initialState.pricing,
        });
      } catch (fetchError) {
        if ((fetchError as Error).name === "AbortError") {
          return;
        }
        setError("Не удалось загрузить финансовые данные");
      } finally {
        setLoading(false);
      }
    };

    const isInitialThirtyDaysPage =
      period === "30d" && page === 1 && !customDateFrom && !customDateTo;

    if (isInitialThirtyDaysPage) {
      return;
    }

    void fetchFinance();

    return () => controller.abort();
  }, [businessId, customDateFrom, customDateTo, initialState.account, initialState.pricing, page, period]);

  const account = data.account;
  const summary = data.summary;
  const pagination = data.pagination;

  if (!account) {
    return (
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-muted p-2 text-muted-foreground">
            <Wallet className="h-5 w-5" />
          </div>
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Финансы</h2>
              <p className="mt-1 text-sm text-gray-600">
                Биллинг для этого контрагента ещё не настроен.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/billing/businesses">
                Открыть раздел биллинга
              </Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex flex-col gap-4 border-b border-gray-100 pb-5 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Финансы</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Текущий баланс
              </p>
              <p className="mt-1 text-3xl font-semibold text-gray-900">
                {formatPrice(account.depositBalance)}
              </p>
            </div>
            <BillingAccountStatusBadge status={account.status} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-500">Кредитный лимит</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {formatPrice(account.creditLimit)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-500">Мин. порог баланса</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {formatPrice(account.lowBalanceThreshold)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-500">Валюта счёта</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {account.currency}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500">Пополнения за период</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {summary ? formatPrice(summary.totalTopups) : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500">Списания за период</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {summary ? formatPrice(summary.totalCharges) : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500">Возвраты за период</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {summary ? formatPrice(summary.totalRefunds) : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500">Итоговое изменение</p>
          <p
            className={cn(
              "mt-1 text-lg font-semibold",
              summary && summary.netChange > 0 ? "text-emerald-700" : "text-gray-900",
            )}
          >
            {summary ? formatTransactionAmount(summary.netChange) : "—"}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-gray-200">
          <div className="border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">Применяемые цены</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {data.pricing.resolvedPrices.length === 0 ? (
              <div className="px-4 py-5 text-sm text-gray-600">
                Нет активных правил. Если правило не найдено или выключено, действие не тарифицируется.
              </div>
            ) : (
              data.pricing.resolvedPrices.map((item) => (
                <div key={item.actionType} className="px-4 py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {BILLING_ACTION_TITLES[item.actionType as keyof typeof BILLING_ACTION_TITLES] ?? item.actionType}
                      </p>
                      <p className="mt-1 text-sm text-gray-600">
                        {item.rule
                          ? formatBillingActionPrice({
                              pricingType: item.rule.pricingType as never,
                              fixedAmount: item.rule.fixedAmount,
                              percentRate: item.rule.percentRate,
                              minimumAmount: item.rule.minimumAmount,
                              maximumAmount: item.rule.maximumAmount,
                              currency: item.rule.currency,
                            })
                          : "Не тарифицируется"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {item.source && (
                        <Badge variant="outline" className="border-gray-200 text-gray-700">
                          {BILLING_SCOPE_LABELS[item.source as keyof typeof BILLING_SCOPE_LABELS] ?? item.source}
                        </Badge>
                      )}
                      {item.rule && (
                        <span className="text-xs text-gray-500">
                          {formatBillingActionPeriod({
                            startsAt: item.rule.startsAt ? new Date(item.rule.startsAt) : null,
                            endsAt: item.rule.endsAt ? new Date(item.rule.endsAt) : null,
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900">Индивидуальные условия</h3>
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/billing/plans?businessId=${businessId}`}>
                Настроить индивидуальные цены
              </Link>
            </Button>
          </div>
          {data.pricing.businessRates.length === 0 ? (
            <div className="px-4 py-5 text-sm text-gray-600">
              Индивидуальные цены не настроены. Применяются глобальные правила.
            </div>
          ) : (
            <TableContainer minWidthClassName="min-w-[720px]" scrollLabel="Индивидуальные условия, таблица">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Действие</th>
                    <th className="px-4 py-3 text-left font-medium">Цена</th>
                    <th className="px-4 py-3 text-left font-medium">Тип цены</th>
                    <th className="px-4 py-3 text-left font-medium">Период</th>
                    <th className="px-4 py-3 text-left font-medium">Статус</th>
                    <th className="px-4 py-3 text-left font-medium">Причина</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.pricing.businessRates.map((rate) => (
                    <tr key={rate.id}>
                      <td className="px-4 py-3 text-gray-900">
                        {BILLING_ACTION_TITLES[rate.actionType as keyof typeof BILLING_ACTION_TITLES] ?? rate.actionType}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {formatBillingActionPrice({
                          pricingType: rate.pricingType as never,
                          fixedAmount: rate.fixedAmount,
                          percentRate: rate.percentRate,
                          minimumAmount: rate.minimumAmount,
                          maximumAmount: rate.maximumAmount,
                          currency: rate.currency,
                        })}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {BILLING_PRICING_TYPE_LABELS[rate.pricingType as keyof typeof BILLING_PRICING_TYPE_LABELS] ?? rate.pricingType}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {formatBillingActionPeriod({
                          startsAt: rate.startsAt ? new Date(rate.startsAt) : null,
                          endsAt: rate.endsAt ? new Date(rate.endsAt) : null,
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={rate.isActive ? "border-emerald-200 text-emerald-700" : "border-gray-200 text-gray-500"}
                        >
                          {rate.isActive ? "Активно" : "Выключено"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{rate.reason || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableContainer>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-900">Период</p>
            <div className="flex flex-wrap gap-2">
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setPage(1);
                    setPeriod(option.value);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    period === option.value
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {period === "custom" && (
              <>
                <div className="relative min-w-[150px]">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    type="date"
                    value={customDateFrom}
                    onChange={(event) => {
                      setPage(1);
                      setCustomDateFrom(event.target.value);
                    }}
                    className="pl-9"
                  />
                </div>
                <div className="relative min-w-[150px]">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    type="date"
                    value={customDateTo}
                    onChange={(event) => {
                      setPage(1);
                      setCustomDateTo(event.target.value);
                    }}
                    className="pl-9"
                  />
                </div>
              </>
            )}

            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/businesses/${businessId}/billing`}>
                Открыть биллинг
              </Link>
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="rounded-lg border border-gray-200">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">История операций</h3>
              <p className="mt-1 text-xs text-gray-500">
                {summary?.transactionsCount ?? 0} операций за выбранный период
              </p>
            </div>
            {loading && (
              <div className="inline-flex items-center gap-2 text-xs text-gray-500">
                <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
                Обновляем
              </div>
            )}
          </div>

          <TableContainer minWidthClassName="min-w-[820px]" scrollLabel="Транзакции партнёра, таблица">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Дата</th>
                  <th className="px-4 py-3 text-left font-medium">Тип операции</th>
                  <th className="px-4 py-3 text-left font-medium">Статус</th>
                  <th className="px-4 py-3 text-right font-medium">Сумма</th>
                  <th className="px-4 py-3 text-left font-medium">Описание</th>
                  <th className="px-4 py-3 text-left font-medium">Связанная сущность</th>
                  <th className="px-4 py-3 text-right font-medium">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">
                      За выбранный период операций не найдено.
                    </td>
                  </tr>
                ) : (
                  data.transactions.map((transaction) => (
                    <tr key={transaction.id} className="align-top hover:bg-gray-50/70">
                      <td className="px-4 py-3 text-gray-700">
                        {formatDateTime(transaction.occurredAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="w-fit text-gray-700">
                            {getTransactionTypeLabel(transaction.type)}
                          </Badge>
                          {transaction.hasRefund && (
                            <Badge variant="outline" className="w-fit border-emerald-200 bg-emerald-50 text-emerald-700">
                              Есть возврат
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <TransactionStatusBadge status={transaction.status} />
                      </td>
                      <td className={cn("px-4 py-3 text-right font-medium", getAmountTone(transaction))}>
                        {formatTransactionAmount(transaction.amount)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <div className="space-y-1">
                          <p>{transaction.description || "—"}</p>
                          {transaction.referenceType === "REQUEST" && (
                            <p className="text-xs text-gray-500">Списание за заявку</p>
                          )}
                          {transaction.refunds.length > 0 && (
                            <p className="text-xs text-gray-500">
                              Возвратов: {transaction.refunds.length}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {transaction.referenceType === "REQUEST" && transaction.referenceId ? (
                          <Link
                            href={`/admin/orders/${transaction.referenceId}`}
                            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                          >
                            Открыть заказ
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        ) : (
                          <span className="break-all text-sm">{buildReferenceLabel(transaction)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/admin/businesses/${businessId}/billing`}>
                              Открыть в биллинге
                            </Link>
                          </Button>
                          {transaction.referenceType === "REQUEST" && transaction.referenceId && (
                            <Button asChild variant="ghost" size="sm">
                              <Link href={`/admin/orders/${transaction.referenceId}`}>
                                Открыть заказ
                              </Link>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableContainer>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
              <p className="text-xs text-gray-500">
                Страница {pagination.page} из {pagination.totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={pagination.page <= 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Назад
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={!pagination.hasMore || loading}
                >
                  Вперёд
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
