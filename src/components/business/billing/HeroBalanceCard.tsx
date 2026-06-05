"use client";

import { Wallet, AlertCircle, Download } from "lucide-react";
import { formatPrice } from "@/lib/formatters/format-price";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface HeroBalanceCardProps {
  balance: number;
  status: "ACTIVE" | "LOW_BALANCE" | "ZERO_BALANCE" | "SUSPENDED";
  isLowBalance: boolean;
  lastTopUpDate?: Date;
  lastTopUpAmount?: number;
  monthlySpend?: number;
  hasUnpaidInvoice?: boolean;
  onTopUp: () => void;
  onDownloadInvoice?: () => void;
}

export function HeroBalanceCard({
  balance,
  status,
  isLowBalance,
  lastTopUpDate,
  lastTopUpAmount,
  monthlySpend,
  hasUnpaidInvoice = false,
  onTopUp,
  onDownloadInvoice,
}: HeroBalanceCardProps) {
  const statusLabel =
    status === "SUSPENDED"
      ? "Приостановлено"
      : status === "ZERO_BALANCE"
        ? "Нулевой баланс"
        : status === "LOW_BALANCE"
          ? "Низкий баланс"
          : "Активен";

  return (
    <div
      className={`
        relative overflow-hidden rounded-3xl border p-8
        ${
          isLowBalance
            ? "border-orange-200 bg-gradient-to-br from-orange-50 to-white"
            : "border-green-200 bg-gradient-to-br from-green-50 to-white"
        }
      `}
    >
      {/* Low Balance Warning */}
      {isLowBalance && (
        <div className="absolute top-4 right-4">
          <div className="flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1.5">
            <AlertCircle className="w-4 h-4 text-orange-600" />
            <span className="text-sm font-medium text-orange-900">Низкий баланс</span>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        {/* Left: Balance Info */}
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-4">
            <div
              className={`
                flex h-16 w-16 items-center justify-center rounded-2xl
                ${isLowBalance ? "bg-orange-200" : "bg-green-200"}
              `}
            >
              <Wallet
                className={`w-8 h-8 ${isLowBalance ? "text-orange-700" : "text-green-700"}`}
              />
            </div>
          <div>
            <p className="text-sm font-medium text-stone-600 mb-1">Текущий баланс</p>
            <p
                className={`
                  text-5xl font-bold tracking-tight
                  ${isLowBalance ? "text-orange-900" : "text-green-900"}
                `}
              >
                {formatPrice(balance, { hideZero: true })}
              </p>
              <p className="mt-1 text-sm font-medium text-stone-600">{statusLabel}</p>
            </div>
          </div>

          {/* Additional Info */}
          <div className="flex flex-wrap gap-4 text-sm text-stone-600">
            {lastTopUpDate && (
              <div>
                <span className="text-stone-500">Последнее пополнение:</span>{" "}
                <span className="font-medium">
                  {format(lastTopUpDate, "d MMMM yyyy", { locale: ru })}
                  {lastTopUpAmount && ` • ${formatPrice(lastTopUpAmount, { hideZero: true })}`}
                </span>
              </div>
            )}
            {monthlySpend !== undefined && monthlySpend > 0 && (
              <div>
                <span className="text-stone-500">Расход за месяц:</span>{" "}
                <span className="font-medium">{formatPrice(monthlySpend, { hideZero: true })}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-col gap-3 md:items-end">
          <button
            onClick={onTopUp}
            className="
              inline-flex items-center justify-center gap-2 px-6 py-3
              bg-[#EF8759] text-white font-medium rounded-xl
              hover:bg-[#EF8759]/90 transition-colors
              shadow-sm hover:shadow-md
            "
          >
            <Wallet className="w-5 h-5" />
            Пополнить баланс
          </button>

          {hasUnpaidInvoice && onDownloadInvoice && (
            <button
              onClick={onDownloadInvoice}
              className="
                inline-flex items-center justify-center gap-2 px-6 py-3
                bg-white text-stone-700 font-medium rounded-xl
                border border-stone-300 hover:bg-stone-50 transition-colors
              "
            >
              <Download className="w-5 h-5" />
              Скачать счет
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
