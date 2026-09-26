"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  formatDateTime,
  getTransactionTypeLabel,
  type TransactionStatus,
  type TransactionType,
} from "@/lib/business/billing";
import { formatPrice } from "@/lib/formatters/format-price";
import { ChevronDown, ExternalLink, Filter } from "lucide-react";
import { FilterSelect } from "@/components/ui/filter-select";
import { TransactionStatusBadge } from "@/components/business/billing/TransactionStatusBadge";
import { BusinessSectionHeader } from "@/components/business/sections/BusinessSectionHeader";
import { BusinessSurfaceCard } from "@/components/business/ui/BusinessSurfaceCard";
import { BusinessEmptyState } from "@/components/business/ui/BusinessEmptyState";
import { BusinessChip } from "@/components/business/ui/BusinessChip";
import { TableContainer } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type ApiTransaction = {
  id: string;
  occurredAt: string;
  type: string;
  status: string;
  amount: number;
  currency: string;
  publicDescription: string;
  referenceType: string;
  referenceId: string | null;
};

export default function BillingTransactionsPage() {
  const [selectedType, setSelectedType] = useState<TransactionType | "all">("all");
  const [selectedStatus, setSelectedStatus] = useState<TransactionStatus | "all">("all");
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<
    Array<{
      id: string;
      date: string;
      type: TransactionType;
      description: string;
      amount: number;
      currency: string;
      status: TransactionStatus;
      paymentMethod?: string;
      relatedEntity?: {
        type: string;
        id: string;
        name: string;
      };
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadTransactions() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetch("/api/business/billing/transactions?limit=100", {
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Не удалось загрузить историю операций");
        }

        if (!isActive) return;

        setTransactions(
          (data.transactions as ApiTransaction[]).map((transaction) => ({
            id: transaction.id,
            date: transaction.occurredAt,
            type: mapApiTransactionType(transaction.type),
            description: transaction.publicDescription,
            amount: transaction.amount,
            currency: transaction.currency,
            status: mapApiTransactionStatus(transaction.status),
            paymentMethod: undefined,
            relatedEntity:
              transaction.referenceType !== "NONE" && transaction.referenceId
                ? {
                    type: transaction.referenceType,
                    id: transaction.referenceId,
                    name: transaction.referenceId,
                  }
                : undefined,
          })),
        );
      } catch (error) {
        console.error("Failed to load business billing history:", error);
        if (isActive) {
          setLoadError("Не удалось загрузить историю операций");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadTransactions();

    return () => {
      isActive = false;
    };
  }, []);

  const filteredTransactions = transactions.filter((transaction) => {
    if (selectedType !== "all" && transaction.type !== selectedType) return false;
    if (selectedStatus !== "all" && transaction.status !== selectedStatus) return false;
    return true;
  });
  const countLabel = useMemo(() => filteredTransactions.length, [filteredTransactions.length]);

  const transactionTypes: Array<{ value: TransactionType | "all"; label: string }> = [
    { value: "all", label: "Все типы" },
    { value: "plan_renewal", label: "Продление тарифа" },
    { value: "deposit_topup", label: "Пополнение баланса" },
    { value: "lead_charge", label: "Списание за лид" },
    { value: "promotion_charge", label: "Списание за продвижение" },
    { value: "refund", label: "Возврат" },
    { value: "adjustment", label: "Корректировка" },
  ];

  const statuses: Array<{ value: TransactionStatus | "all"; label: string }> = [
    { value: "all", label: "Все статусы" },
    { value: "completed", label: "Выполнено" },
    { value: "pending", label: "В обработке" },
    { value: "failed", label: "Ошибка" },
    { value: "refunded", label: "Возвращено" },
  ];

  return (
    <div className="space-y-6">
      <BusinessSectionHeader
        eyebrow="Billing"
        title="История операций"
        description="Все пополнения, списания и продления в одном месте. Это финансовая лента бизнеса, а не технический журнал."
      />

      <BusinessSurfaceCard className="p-4 md:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-stone-500" />
            <span className="text-sm font-medium text-stone-700">Фильтры</span>
          </div>

          <div className="flex min-w-0 flex-col gap-2 sm:min-w-[220px] sm:flex-row sm:items-center">
            <label className="shrink-0 text-sm text-stone-600">Тип:</label>
            <FilterSelect
              value={selectedType}
              options={transactionTypes.map((type) => ({
                value: String(type.value),
                label: type.label,
              }))}
              onChange={(value) => setSelectedType(value as TransactionType | "all")}
              className="w-full min-w-0 sm:min-w-[180px]"
            />
          </div>

          <div className="flex min-w-0 flex-col gap-2 sm:min-w-[220px] sm:flex-row sm:items-center">
            <label className="shrink-0 text-sm text-stone-600">Статус:</label>
            <FilterSelect
              value={selectedStatus}
              options={statuses.map((status) => ({
                value: String(status.value),
                label: status.label,
              }))}
              onChange={(value) =>
                setSelectedStatus(value as TransactionStatus | "all")
              }
              className="w-full min-w-0 sm:min-w-[180px]"
            />
          </div>

          <div className="sm:ml-auto">
            <BusinessChip tone="muted">
              Найдено: {countLabel}
            </BusinessChip>
          </div>
        </div>
      </BusinessSurfaceCard>

      {isLoading ? (
        <BusinessSurfaceCard className="p-6 text-sm text-stone-500">
          Загружаем историю операций…
        </BusinessSurfaceCard>
      ) : loadError ? (
        <BusinessEmptyState
          icon={<Filter className="h-7 w-7" />}
          title="Не удалось загрузить операции"
          description={loadError}
        />
      ) : null}

      {!isLoading && !loadError && filteredTransactions.length === 0 ? (
        <BusinessEmptyState
          icon={<Filter className="h-7 w-7" />}
          title="Операции не найдены"
          description="Попробуйте изменить фильтры или вернуться позже. Когда появятся новые списания, пополнения или продления, они отобразятся здесь."
        />
      ) : !isLoading && !loadError ? (
        <BusinessSurfaceCard className="overflow-hidden p-0">
          <div className="divide-y divide-stone-100 md:hidden">
            {filteredTransactions.map((transaction) => (
              <div key={transaction.id} className="p-4">
                <button
                  type="button"
                  className="flex min-h-11 w-full items-start justify-between gap-3 text-left"
                  onClick={() => setSelectedTransaction(selectedTransaction === transaction.id ? null : transaction.id)}
                  aria-expanded={selectedTransaction === transaction.id}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-stone-950">{getTransactionTypeLabel(transaction.type)}</span>
                      <TransactionStatusBadge status={transaction.status} />
                    </div>
                    <p className="mt-2 break-words text-sm text-stone-600">{transaction.description}</p>
                    <p className="mt-2 text-xs text-stone-500">{formatDateTime(transaction.date)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={transaction.amount > 0 ? "font-semibold text-green-600" : "font-semibold text-stone-950"}>
                      {transaction.amount > 0 ? "+" : ""}{formatPrice(Math.abs(transaction.amount))}
                    </div>
                    <ChevronDown className={cn("ml-auto mt-2 h-5 w-5 text-stone-400 transition-transform", selectedTransaction === transaction.id && "rotate-180")} />
                  </div>
                </button>
                {selectedTransaction === transaction.id ? (
                  <div className="mt-4 rounded-2xl bg-stone-50 p-4 text-sm">
                    <p className="text-stone-500">ID транзакции</p>
                    <p className="mt-1 break-all font-mono text-stone-950">{transaction.id}</p>
                    {transaction.relatedEntity ? (
                      <><p className="mt-3 text-stone-500">Связанная сущность</p><p className="mt-1 break-words text-stone-950">{transaction.relatedEntity.name}</p></>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          <div className="hidden md:block">
          <TableContainer minWidthClassName="min-w-[760px]" scrollLabel="История операций, таблица">
            <table className="w-full">
              <thead className="bg-stone-50/90">
                <tr className="border-b border-stone-200">
                  <th className="px-5 py-3 text-left text-sm font-medium text-stone-500">
                    Дата
                  </th>
                  <th className="px-5 py-3 text-left text-sm font-medium text-stone-500">
                    Тип операции
                  </th>
                  <th className="px-5 py-3 text-left text-sm font-medium text-stone-500">
                    Описание
                  </th>
                  <th className="px-5 py-3 text-right text-sm font-medium text-stone-500">
                    Сумма
                  </th>
                  <th className="px-5 py-3 text-center text-sm font-medium text-stone-500">
                    Статус
                  </th>
                  <th className="px-5 py-3 text-center text-sm font-medium text-stone-500">
                    Действие
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((transaction) => (
                  <React.Fragment key={transaction.id}>
                    <tr
                      className="cursor-pointer border-b border-stone-100 transition-colors hover:bg-stone-50/70"
                      onClick={() =>
                        setSelectedTransaction(
                          selectedTransaction === transaction.id ? null : transaction.id,
                        )
                      }
                    >
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-stone-950">
                        {formatDateTime(transaction.date)}
                      </td>
                      <td className="px-5 py-4 text-sm text-stone-700">
                        {getTransactionTypeLabel(transaction.type)}
                      </td>
                      <td className="px-5 py-4 text-sm text-stone-700">
                        {transaction.description}
                      </td>
                      <td
                        className={`whitespace-nowrap px-5 py-4 text-right text-sm font-medium ${
                          transaction.amount > 0 ? "text-green-600" : "text-stone-950"
                        }`}
                      >
                        {transaction.amount > 0 ? "+" : ""}
                        {formatPrice(Math.abs(transaction.amount))}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <TransactionStatusBadge status={transaction.status} />
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button className="rounded-xl p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700">
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              selectedTransaction === transaction.id ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      </td>
                    </tr>

                    {selectedTransaction === transaction.id ? (
                      <tr className="bg-stone-50/70">
                        <td colSpan={6} className="px-5 py-4">
                          <div className="rounded-[22px] border border-stone-200 bg-white p-4">
                            <h4 className="mb-3 text-sm font-semibold text-stone-950">
                              Детали транзакции
                            </h4>
                            <div className="grid gap-4 text-sm md:grid-cols-2">
                              <div>
                                <p className="mb-1 text-stone-500">ID транзакции</p>
                                <p className="font-mono text-stone-950">{transaction.id}</p>
                              </div>
                              <div>
                                <p className="mb-1 text-stone-500">Дата и время</p>
                                <p className="text-stone-950">
                                  {formatDateTime(transaction.date)}
                                </p>
                              </div>
                              <div>
                                <p className="mb-1 text-stone-500">Сумма</p>
                                <p className="font-medium text-stone-950">
                                  {formatPrice(Math.abs(transaction.amount))}
                                </p>
                              </div>
                              {transaction.paymentMethod ? (
                                <div>
                                  <p className="mb-1 text-stone-500">Метод оплаты</p>
                                  <p className="text-stone-950">
                                    {transaction.paymentMethod}
                                  </p>
                                </div>
                              ) : null}
                              {transaction.relatedEntity ? (
                                <div className="md:col-span-2">
                                  <p className="mb-1 text-stone-500">
                                    Связанная сущность
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <p className="text-stone-950">
                                      {transaction.relatedEntity.name}
                                    </p>
                                    <button className="rounded-xl p-1 text-blue-600 transition hover:bg-blue-50 hover:text-blue-700">
                                      <ExternalLink className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </TableContainer>
          </div>
        </BusinessSurfaceCard>
      ) : null}
    </div>
  );
}

function mapApiTransactionType(type: string): TransactionType {
  const mapping: Record<string, TransactionType> = {
    SUBSCRIPTION_CHARGE: "plan_renewal",
    SUBSCRIPTION_RENEWAL: "plan_renewal",
    DEPOSIT_TOPUP: "deposit_topup",
    LEAD_CHARGE: "lead_charge",
    PROMOTION_CHARGE: "promotion_charge",
    REFUND: "refund",
    MANUAL_ADJUSTMENT: "adjustment",
    CORRECTION: "adjustment",
  };

  return mapping[type] || "adjustment";
}

function mapApiTransactionStatus(status: string): TransactionStatus {
  const mapping: Record<string, TransactionStatus> = {
    SUCCEEDED: "completed",
    PENDING: "pending",
    FAILED: "failed",
    CANCELED: "failed",
  };

  return mapping[status] || "pending";
}
