"use client";

import { useState } from "react";
import { HeroBalanceCard } from "@/components/business/billing/HeroBalanceCard";
import { QuickTopUpBlock } from "@/components/business/billing/QuickTopUpBlock";
import { BalanceStats } from "@/components/business/billing/BalanceStats";
import { RecentTransactions } from "@/components/business/billing/RecentTransactions";
import { FirstTopUpModal } from "@/components/business/billing/FirstTopUpModal";
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
  actionPrices: Array<{
    actionType: string;
    title: string;
    displayPrice: string;
    isIndividual: boolean;
  }>;
  hasBillingProfile: boolean;
}

export function BalancePage({
  balance,
  stats,
  transactions,
  actionPrices,
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
        `Счет на сумму ${amount} BYN будет сформирован после подключения invoice API`,
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
          При положительном балансе вам доступны все возможности mamaGo. Средства списываются только за полезные действия.
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
        <h3 className="text-lg font-semibold text-stone-950">Стоимость действий</h3>
        <p className="mt-2 text-sm text-stone-600">
          Вы платите только за полезные действия клиентов. Если для вашего бизнеса настроены индивидуальные условия, они уже учтены в этом прайсе.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {actionPrices.length === 0 ? (
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
              Сейчас активных правил тарификации нет.
            </div>
          ) : (
            actionPrices.map((price) => (
              <div key={price.actionType} className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-stone-950">{price.title}</p>
                    <p className="mt-1 text-base font-semibold text-stone-950">{price.displayPrice}</p>
                  </div>
                  {price.isIndividual && (
                    <span className="inline-flex rounded-full bg-stone-900 px-2.5 py-1 text-xs font-medium text-white">
                      Индивидуальные условия
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
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
