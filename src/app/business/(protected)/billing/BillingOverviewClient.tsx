"use client";

import { useState, useEffect } from "react";
import { formatPrice } from "@/lib/formatters/format-price";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Mail, AlertCircle } from "lucide-react";

interface BillingData {
  businessId: string;
  businessName: string;
  status: string;
  depositBalance: number;
  currency: string;
  lowBalanceThreshold: number;
  creditLimit: number;
  availableBalance: number;
  currentPlan: {
    name: string;
    status: string;
    currentPeriodEnd: string;
  } | null;
  canTopUpOnline: boolean;
  topUpInstruction: string;
}

interface Transaction {
  id: string;
  createdAt: string;
  occurredAt: string;
  type: string;
  status: string;
  amount: number;
  currency: string;
  publicDescription: string;
  referenceType: string;
  subscription: {
    planName: string;
  } | null;
}

interface Props {
  businessId: string;
  initialBillingData: BillingData | null;
}

type FilterType = "all" | "topup" | "debit" | "promotion" | "subscription";

export function BillingOverviewClient({ businessId, initialBillingData }: Props) {
  const [billingData, setBillingData] = useState<BillingData | null>(initialBillingData);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  console.log("[BillingOverviewClient] initialBillingData:", initialBillingData);
  console.log("[BillingOverviewClient] billingData state:", billingData);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch billing info if not provided
        if (!initialBillingData) {
          console.log("[BillingOverviewClient] Fetching billing data from API...");
          const billingResponse = await fetch("/api/business/billing");
          if (billingResponse.ok) {
            const data = await billingResponse.json();
            console.log("[BillingOverviewClient] API response:", data);
            setBillingData(data.billing);
          }
        } else {
          console.log("[BillingOverviewClient] Using initial billing data");
        }

        // Fetch transactions
        const txResponse = await fetch("/api/business/billing/transactions?limit=50");
        if (txResponse.ok) {
          const data = await txResponse.json();
          setTransactions(data.transactions || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки данных");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [businessId, initialBillingData]); // Changed: use initialBillingData instead of billingData

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      ACTIVE: { label: "Активен", className: "bg-green-100 text-green-700" },
      SUSPENDED: { label: "Приостановлен", className: "bg-red-100 text-red-700" },
      CLOSED: { label: "Закрыт", className: "bg-gray-100 text-gray-700" },
    };
    const { label, className } = config[status] || config.ACTIVE;
    return (
      <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${className}`}>
        {label}
      </span>
    );
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      DEPOSIT_TOPUP: "Пополнение",
      MANUAL_ADJUSTMENT: "Корректировка",
      PROMOTION_CHARGE: "Продвижение",
      SUBSCRIPTION_CHARGE: "Подписка",
      REFUND: "Возврат",
      BONUS_CREDIT: "Бонус",
    };
    return labels[type] || type;
  };

  const getTransactionStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      SUCCEEDED: { label: "Успешно", className: "bg-green-100 text-green-700" },
      PENDING: { label: "В обработке", className: "bg-yellow-100 text-yellow-700" },
      FAILED: { label: "Ошибка", className: "bg-red-100 text-red-700" },
      CANCELED: { label: "Отменено", className: "bg-gray-100 text-gray-700" },
    };
    const { label, className } = config[status] || config.PENDING;
    return (
      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${className}`}>
        {label}
      </span>
    );
  };

  const filterTransactions = (txs: Transaction[]) => {
    if (filter === "all") return txs;
    
    const filterMap: Record<FilterType, string[]> = {
      all: [],
      topup: ["DEPOSIT_TOPUP", "BONUS_CREDIT", "REFUND"],
      debit: ["MANUAL_ADJUSTMENT"],
      promotion: ["PROMOTION_CHARGE"],
      subscription: ["SUBSCRIPTION_CHARGE"],
    };

    const types = filterMap[filter] || [];
    return txs.filter(tx => types.includes(tx.type));
  };

  const filteredTransactions = filterTransactions(transactions);

  const isLowBalance = billingData && billingData.depositBalance < billingData.lowBalanceThreshold;

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Загрузка...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!billingData) {
    return (
      <div className="p-8 bg-gray-50 border border-gray-200 rounded-lg text-center">
        <p className="text-gray-600">Billing-аккаунт не найден</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Balance Card */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Balance */}
          <div>
            <p className="text-sm text-gray-600 mb-2">Текущий баланс</p>
            <p className={`text-4xl font-bold mb-4 ${isLowBalance ? "text-orange-600" : "text-gray-900"}`}>
              {formatPrice(billingData.depositBalance)}
            </p>
            {isLowBalance && (
              <div className="flex items-center gap-2 text-sm text-orange-600 mb-4">
                <AlertCircle className="w-4 h-4" />
                <span>Низкий баланс (порог: {formatPrice(billingData.lowBalanceThreshold)})</span>
              </div>
            )}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Кредитный лимит:</span>
                <span className="font-medium text-gray-900">
                  {formatPrice(billingData.creditLimit)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Доступно всего:</span>
                <span className="font-medium text-gray-900">
                  {formatPrice(billingData.availableBalance)}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Status & Plan */}
          <div>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Статус аккаунта</p>
              {getStatusBadge(billingData.status)}
            </div>
            {billingData.currentPlan && (
              <div>
                <p className="text-sm text-gray-600 mb-2">Текущий тариф</p>
                <p className="font-medium text-gray-900">{billingData.currentPlan.name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Действует до:{" "}
                  {format(new Date(billingData.currentPlan.currentPeriodEnd), "dd MMM yyyy", {
                    locale: ru,
                  })}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top-Up Info Block */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-gray-900 mb-1">Пополнение баланса</h3>
            <p className="text-sm text-gray-700 mb-3">
              {billingData.topUpInstruction}
            </p>
            <a
              href="mailto:support@mamago.by?subject=Пополнение баланса"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              <Mail className="w-4 h-4" />
              Связаться с поддержкой
            </a>
          </div>
        </div>
      </div>

      {/* Transactions Section */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Tabs */}
        <div className="border-b border-gray-200 bg-gray-50">
          <div className="flex gap-1 p-2">
            {[
              { key: "all" as FilterType, label: "Все" },
              { key: "topup" as FilterType, label: "Пополнения" },
              { key: "debit" as FilterType, label: "Списания" },
              { key: "promotion" as FilterType, label: "Продвижение" },
              { key: "subscription" as FilterType, label: "Подписка" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  filter === tab.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          {filteredTransactions.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-600">Нет операций</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Дата</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Тип</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">Сумма</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-700">Статус</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Описание</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 text-gray-700">
                      {format(new Date(tx.occurredAt), "dd MMM yyyy, HH:mm", {
                        locale: ru,
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-gray-900">
                        {getTypeLabel(tx.type)}
                      </span>
                      {tx.subscription && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {tx.subscription.planName}
                        </p>
                      )}
                    </td>
                    <td className={`py-3 px-4 text-right font-medium ${
                      tx.amount >= 0 ? "text-green-600" : "text-red-600"
                    }`}>
                      {tx.amount >= 0 ? "+" : ""}
                      {formatPrice(tx.amount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {getTransactionStatusBadge(tx.status)}
                    </td>
                    <td className="py-3 px-4 text-gray-700">
                      {tx.publicDescription}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
