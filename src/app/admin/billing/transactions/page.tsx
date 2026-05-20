import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { getBillingTransactions } from "@/server/services/billing/billingTransaction.service";
import { BillingTransactionsFilters } from "@/components/admin/billing/BillingTransactionsFilters";
import { AdminBillingTransactionsClient } from "@/components/admin/billing/AdminBillingTransactionsClient";
import { BillingTransactionType, BillingTransactionStatus } from "@prisma/client";

interface PageProps {
  searchParams: Promise<{
    type?: string;
    status?: string;
    business?: string;
  }>;
}

export default async function AdminBillingTransactionsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  
  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  const params = await searchParams;
  
  const filters = {
    type: params.type as BillingTransactionType | undefined,
    status: params.status as BillingTransactionStatus | undefined,
    businessId: params.business,
    limit: 100,
  };

  const { transactions, total } = await getBillingTransactions(filters);
  const serializedTransactions = transactions.map((tx) => ({
    id: tx.id,
    occurredAt: tx.occurredAt.toISOString(),
    type: tx.type,
    status: tx.status,
    description: tx.description,
    amount: tx.amount.toNumber(),
    currency: tx.currency,
    business: {
      id: tx.billingAccount.business.id,
      name: tx.billingAccount.business.name,
    },
  }));

  return (
    <div className="p-6 md:p-4 space-y-6">
      {/* AdminPageHeader */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-xl font-bold text-gray-900">Транзакции</h1>
          <p className="text-sm text-gray-600 mt-1">Все списания, пополнения, продления и корректировки</p>
        </div>
      </div>

      {/* AdminPageToolbar - Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <Suspense
            fallback={<div className="text-sm text-gray-500 py-2">Загрузка фильтров…</div>}
          >
            <BillingTransactionsFilters />
          </Suspense>

          <div className="flex items-end pb-0.5 md:ml-auto">
            <p className="text-sm text-gray-600">
              Найдено: <span className="font-medium">{total}</span> транзакций
            </p>
          </div>
        </div>
      </div>

      {/* AdminPageContent - Transactions Table */}
      <AdminBillingTransactionsClient transactions={serializedTransactions} />
    </div>
  );
}
