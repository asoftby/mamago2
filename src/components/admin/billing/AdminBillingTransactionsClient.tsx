"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BillingTransactionStatus, BillingTransactionType } from "@prisma/client";
import { TransactionAmount } from "./TransactionAmount";
import { TransactionDetailsDrawer } from "./TransactionDetailsDrawer";
import { TransactionStatusBadge } from "./TransactionStatusBadge";
import { TransactionTypeBadge } from "./TransactionTypeBadge";

interface TransactionListItem {
  id: string;
  occurredAt: string;
  type: BillingTransactionType;
  status: BillingTransactionStatus;
  description: string;
  amount: number;
  currency: string;
  business: {
    id: string;
    name: string;
  };
}

interface TransactionDetailsResponse {
  id: string;
  type: string;
  status: string;
  amount: number;
  currency: string;
  description: string;
  occurredAt: string;
  referenceType: string;
  referenceId: string | null;
  parentTransactionId: string | null;
  failureReason: string | null;
  failureCode: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  billingAccount: {
    id: string;
    business: {
      id: string;
      name: string;
    };
  };
  paymentMethod: {
    type: string;
    cardBrand: string | null;
    cardLast4: string | null;
  } | null;
  subscription: {
    id: string;
    plan: {
      id: string;
      name: string;
    } | null;
  } | null;
  parentTransaction: {
    id: string;
    type: string;
    amount: number;
    occurredAt: string;
  } | null;
  refundSummary: {
    originalAmount: number;
    refundedAmount: number;
    availableAmount: number;
    refundCount: number;
    canRefund: boolean;
  };
  refundTransactions: Array<{
    id: string;
    amount: number;
    status: string;
    occurredAt: string;
    description: string;
    metadata: Record<string, unknown> | null;
  }>;
  auditLogs: Array<{
    id: string;
    actorId: string | null;
    actorRole: string;
    action: string;
    entityType: string;
    entityId: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    reason: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    actor: {
      id: string;
      email: string;
      role: string;
    } | null;
  }>;
}

interface Props {
  transactions: TransactionListItem[];
}

export function AdminBillingTransactionsClient({ transactions }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionDetailsResponse | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  async function openDetails(transactionId: string) {
    setSelectedId(transactionId);
    setIsLoadingDetails(true);

    try {
      const response = await fetch(`/api/admin/billing/transactions/${transactionId}`);
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Не удалось загрузить детали транзакции");
        setSelectedId(null);
        return;
      }

      setSelectedTransaction(data.transaction);
    } catch (error) {
      console.error("Load transaction details error:", error);
      alert("Не удалось загрузить детали транзакции");
      setSelectedId(null);
    } finally {
      setIsLoadingDetails(false);
    }
  }

  function closeDetails() {
    setSelectedId(null);
    setSelectedTransaction(null);
  }

  async function handleRefundSuccess(transactionId: string) {
    router.refresh();
    await openDetails(transactionId);
  }

  return (
    <>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Дата</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Бизнес</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Тип</th>
                <th className="text-left py-3 px-4 font-medium text-gray-700">Описание</th>
                <th className="text-right py-3 px-4 font-medium text-gray-700">Сумма</th>
                <th className="text-center py-3 px-4 font-medium text-gray-700">Статус</th>
                <th className="text-center py-3 px-4 font-medium text-gray-700">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900">
                    {new Date(tx.occurredAt).toLocaleDateString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                    <br />
                    <span className="text-xs text-gray-500">
                      {new Date(tx.occurredAt).toLocaleTimeString("ru-RU", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <Link
                      href={`/admin/businesses/${tx.business.id}/billing`}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {tx.business.name}
                    </Link>
                  </td>
                  <td className="py-3 px-4">
                    <TransactionTypeBadge type={tx.type} />
                  </td>
                  <td className="py-3 px-4 text-gray-700 max-w-xs truncate">
                    {tx.description}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <TransactionAmount amount={tx.amount} currency={tx.currency} />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <TransactionStatusBadge status={tx.status} />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => void openDetails(tx.id)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      Подробнее
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {transactions.length === 0 && (
          <div className="py-12 text-center text-gray-500">
            Транзакции не найдены
          </div>
        )}
      </div>

      <TransactionDetailsDrawer
        open={!!selectedId}
        transaction={selectedTransaction}
        isLoading={isLoadingDetails}
        onClose={closeDetails}
        onRefundSuccess={handleRefundSuccess}
      />
    </>
  );
}
