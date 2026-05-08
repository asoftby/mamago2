"use client";

import { BillingTabs } from "@/components/business/billing/BillingTabs";

export default function BillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="px-6 pt-6">
        <h1 className="text-2xl font-bold text-stone-950 tracking-tight">Финансы</h1>
        <p className="text-sm text-stone-600 mt-1">
          Управление балансом, тарифами и документами
        </p>
      </div>

      {/* Tabs Navigation */}
      <BillingTabs />

      {/* Page Content */}
      <div className="px-6 pb-6">
        {children}
      </div>
    </div>
  );
}
