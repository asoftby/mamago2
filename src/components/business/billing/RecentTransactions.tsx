"use client";

import { formatPrice } from "@/lib/formatters/format-price";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { BUSINESS_BILLING_HISTORY_HREF } from "@/lib/business/navigation";

interface Transaction {
  id: string;
  type: string;
  typeLabel: string;
  status: "completed" | "pending" | "failed" | "refunded";
  amount: number;
  description: string;
  occurredAt: Date;
}

interface RecentTransactionsProps {
  transactions: Transaction[];
}

const statusConfig = {
  completed: { label: "Успешно", className: "bg-green-100 text-green-700" },
  pending: { label: "В обработке", className: "bg-yellow-100 text-yellow-700" },
  failed: { label: "Ошибка", className: "bg-red-100 text-red-700" },
  refunded: { label: "Возвращено", className: "bg-gray-100 text-gray-700" },
};

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-3xl border border-stone-200 bg-white p-8 text-center">
        <p className="text-stone-600 mb-2">Операций пока нет</p>
        <p className="text-sm text-stone-500">
          После пополнения баланса здесь появится история операций
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-stone-950">Последние операции</h3>
        <Link
          href={BUSINESS_BILLING_HISTORY_HREF}
          className="
            inline-flex items-center gap-1 text-sm font-medium text-[#EF8759]
            hover:text-[#EF8759]/80 transition-colors
          "
        >
          Все операции
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="space-y-3">
        {transactions.map((transaction) => {
          const statusInfo = statusConfig[transaction.status];

          return (
            <div
              key={transaction.id}
              className="
                flex items-center justify-between p-4 rounded-2xl
                border border-stone-200 bg-stone-50/50
                hover:bg-white hover:border-stone-300 transition-colors
              "
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-stone-950">
                    {transaction.typeLabel}
                  </span>
                  <span
                    className={`
                      inline-flex px-2 py-0.5 text-xs font-medium rounded-full
                      ${statusInfo.className}
                    `}
                  >
                    {statusInfo.label}
                  </span>
                </div>
                <p className="text-sm text-stone-600 truncate">{transaction.description}</p>
                <p className="text-xs text-stone-500 mt-1">
                  {format(transaction.occurredAt, "d MMMM yyyy, HH:mm", { locale: ru })}
                </p>
              </div>
              <div className="ml-4 text-right flex-shrink-0">
                <p
                  className={`
                    text-lg font-bold
                    ${transaction.amount > 0 ? "text-green-600" : "text-stone-950"}
                  `}
                >
                  {transaction.amount > 0 ? "+" : ""}
                  {formatPrice(Math.abs(transaction.amount))}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
