"use client";

import { useState } from "react";
import { HeroBalanceCard } from "@/components/business/billing/HeroBalanceCard";
import { QuickTopUpBlock } from "@/components/business/billing/QuickTopUpBlock";
import { BalanceStats } from "@/components/business/billing/BalanceStats";
import { RecentTransactions } from "@/components/business/billing/RecentTransactions";
import { FirstTopUpModal } from "@/components/business/billing/FirstTopUpModal";
import { formatPrice } from "@/lib/formatters/format-price";
import { toast } from "sonner";

interface BalancePageProps {
  balance: {
    balance: number;
    currency: string;
    lowBalanceThreshold: number;
    lastTopUpDate: Date | null;
    lastTopUpAmount: number | null;
    monthlySpend: number;
    status: "ACTIVE" | "LOW_BALANCE" | "ZERO_BALANCE" | "SUSPENDED";
  };
  stats: {
    monthSpent: number;
    chargesCount: number;
    averageCharge: number;
    leadsCount: number;
    lastChargeDate: Date | null;
    lastChargeAmount: number | null;
  };
  transactions: Array<{
    id: string;
    type: string;
    typeLabel: string;
    status: "completed" | "pending" | "failed" | "refunded";
    amount: number;
    description: string;
    occurredAt: Date;
  }>;
  hasBillingProfile: boolean;
}

export function BalancePage({
  balance,
  stats,
  transactions,
  hasBillingProfile,
}: BalancePageProps) {
  const [showFirstTopUpModal, setShowFirstTopUpModal] = useState(false);

  const isLowBalance = balance.balance < balance.lowBalanceThreshold;

  const handleTopUp = () => {
    if (!hasBillingProfile) {
      setShowFirstTopUpModal(true);
    } else {
      // TODO: Open top-up flow when requisites are filled
      toast.info("Функция пополнения будет доступна после подключения invoice API");
    }
  };

  const handleGenerateInvoice = (amount: number) => {
    if (!hasBillingProfile) {
      setShowFirstTopUpModal(true);
    } else {
      // TODO: Generate invoice when backend is ready
      toast.success(
        `Счет на сумму ${formatPrice(amount, { hideZero: true })} будет сформирован после подключения invoice API`,
        {
          description: "Мы работаем над этой функцией",
        }
      );
    }
  };

  const handleDownloadInvoice = () => {
    // TODO: Download unpaid invoice when backend is ready
    toast.info("Функция скачивания счета будет доступна после подключения invoice API");
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-stone-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-stone-950">Баланс и расходы</h1>
        <p className="mt-2 text-sm text-stone-600">
          Баланс хранится в BYN и не сгорает. Лиды, заявки и контакты бесплатны; средства списываются только после явного подтверждения Boost.
        </p>
      </div>

      {/* Hero Balance Card */}
      <HeroBalanceCard
        balance={balance.balance}
        status={balance.status}
        isLowBalance={isLowBalance}
        lastTopUpDate={balance.lastTopUpDate || undefined}
        lastTopUpAmount={balance.lastTopUpAmount || undefined}
        monthlySpend={balance.monthlySpend}
        hasUnpaidInvoice={false} // TODO: Check for unpaid invoices when backend is ready
        onTopUp={handleTopUp}
        onDownloadInvoice={handleDownloadInvoice}
      />

      {/* Quick Top-Up Block */}
      <QuickTopUpBlock onGenerateInvoice={handleGenerateInvoice} />

      {/* Balance Stats */}
      <BalanceStats
        monthSpent={stats.monthSpent}
        chargesCount={stats.chargesCount}
        averageCharge={stats.averageCharge}
        leadsCount={stats.leadsCount}
        lastChargeDate={stats.lastChargeDate}
        lastChargeAmount={stats.lastChargeAmount}
      />

      <div className="rounded-3xl border border-stone-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-stone-950">First-PROD правила</h3>
        <p className="mt-2 text-sm text-stone-600">
          Базовое присутствие и MVP-объём публикаций сохраняются при нулевом балансе.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
            <p className="font-semibold text-stone-950">Бесплатно</p>
            <p className="mt-1">Лиды, заявки, контакты и базовые публикации.</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
            <p className="font-semibold text-stone-950">Платно</p>
            <p className="mt-1">Только явная покупка Boost по цене, показанной перед подтверждением.</p>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <RecentTransactions transactions={transactions} />

      {/* First Top-Up Modal */}
      {showFirstTopUpModal && (
        <FirstTopUpModal onClose={() => setShowFirstTopUpModal(false)} />
      )}
    </div>
  );
}
