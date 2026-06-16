"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { formatPrice } from "@/lib/formatters/format-price";
import { renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Transaction {
  id: string;
  createdAt: string;
  occurredAt: string;
  type: string;
  status: string;
  amount: number;
  currency: string;
  description: string;
  adminId: string | null;
  adminEmail: string | null;
  reason: string | null;
  note: string | null;
}

interface Props {
  account: {
    id: string;
    businessId: string;
    business: {
      name: string;
    };
  };
  onClose: () => void;
}

export function HistoryModal({ account, onClose }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await fetch(
          `/api/admin/billing/businesses/${account.businessId}/transactions?limit=20`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch transactions");
        }

        const data = await response.json();
        setTransactions(data.transactions || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки истории");
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [account.businessId]);

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      DEPOSIT_TOPUP: "Пополнение",
      MANUAL_ADJUSTMENT: "Ручная корректировка",
      PROMOTION_CHARGE: "Продвижение",
      SUBSCRIPTION_CHARGE: "Подписка",
      REFUND: "Возврат",
      BONUS_CREDIT: "Бонус",
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">История операций</h2>
            <p className="text-sm text-gray-600 mt-1">{account.business.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-600">Загрузка...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">Нет операций</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">
                          {getTypeLabel(tx.type)}
                        </span>
                        {getStatusBadge(tx.status)}
                      </div>
                      <p className="text-sm text-gray-600">{tx.description}</p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-lg font-bold ${
                          tx.amount >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {tx.amount >= 0 ? "+" : ""}
                        {renderCurrencyText(formatPrice(tx.amount, { hideZero: true }))}
                      </p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(tx.occurredAt), "dd MMM yyyy, HH:mm", {
                          locale: ru,
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Admin metadata (internal) */}
                  {(tx.adminEmail || tx.reason || tx.note) && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs font-medium text-gray-500 mb-1">
                        Внутренняя информация:
                      </p>
                      {tx.adminEmail && (
                        <p className="text-xs text-gray-600">
                          Администратор: {tx.adminEmail}
                        </p>
                      )}
                      {tx.reason && (
                        <p className="text-xs text-gray-600">Причина: {tx.reason}</p>
                      )}
                      {tx.note && (
                        <p className="text-xs text-gray-600">Комментарий: {tx.note}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
