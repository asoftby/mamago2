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
  };
  stats: {
    monthSpent: number;
    chargesCount: number;
    averageCharge: number;
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
      {/* Hero Balance Card */}
      <HeroBalanceCard
        balance={balance.balance}
        currency={balance.currency}
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
        lastChargeDate={stats.lastChargeDate}
        lastChargeAmount={stats.lastChargeAmount}
      />

      {/* Recent Transactions */}
      <RecentTransactions transactions={transactions} />

      {/* First Top-Up Modal */}
      {showFirstTopUpModal && (
        <FirstTopUpModal onClose={() => setShowFirstTopUpModal(false)} />
      )}
    </div>
  );
}
