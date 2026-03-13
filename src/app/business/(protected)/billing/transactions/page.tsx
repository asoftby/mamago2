"use client";

import { useState } from "react";
import { 
  mockTransactions,
  formatCurrency,
  formatDateTime,
  getTransactionTypeLabel,
  type TransactionType,
  type TransactionStatus,
} from "@/lib/mocks/businessBilling";
import { Filter, ChevronDown, ExternalLink } from "lucide-react";
import { TransactionStatusBadge } from "@/components/business/billing/TransactionStatusBadge";

export default function BillingTransactionsPage() {
  const [selectedType, setSelectedType] = useState<TransactionType | "all">("all");
  const [selectedStatus, setSelectedStatus] = useState<TransactionStatus | "all">("all");
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null);

  // Filter transactions
  const filteredTransactions = mockTransactions.filter(t => {
    if (selectedType !== "all" && t.type !== selectedType) return false;
    if (selectedStatus !== "all" && t.status !== selectedStatus) return false;
    return true;
  });

  const transactionTypes: Array<{ value: TransactionType | "all"; label: string }> = [
    { value: "all", label: "Все типы" },
    { value: "plan_renewal", label: "Продление тарифа" },
    { value: "deposit_topup", label: "Пополнение депозита" },
    { value: "lead_charge", label: "Списание за лид" },
    { value: "promotion_charge", label: "Списание за продвижение" },
    { value: "refund", label: "Возврат" },
    { value: "adjustment", label: "Корректировка" },
  ];

  const statuses: Array<{ value: TransactionStatus | "all"; label: string }> = [
    { value: "all", label: "Все статусы" },
    { value: "completed", label: "Выполнено" },
    { value: "pending", label: "В обработке" },
    { value: "failed", label: "Ошибка" },
    { value: "refunded", label: "Возвращено" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">История операций</h1>
        <p className="text-gray-600 mt-2">
          Все списания, пополнения и продления
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Фильтры:</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Тип:</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as TransactionType | "all")}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {transactionTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Статус:</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as TransactionStatus | "all")}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {statuses.map(status => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </div>

          <div className="ml-auto text-sm text-gray-600">
            Найдено: <span className="font-medium text-gray-900">{filteredTransactions.length}</span>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Дата</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Тип операции</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Описание</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Сумма</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Статус</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Действие</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((transaction) => (
                <>
                  <tr 
                    key={transaction.id} 
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedTransaction(
                      selectedTransaction === transaction.id ? null : transaction.id
                    )}
                  >
                    <td className="py-3 px-4 text-sm text-gray-900 whitespace-nowrap">
                      {formatDateTime(transaction.date)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700">
                      {getTransactionTypeLabel(transaction.type)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700">
                      {transaction.description}
                    </td>
                    <td className={`py-3 px-4 text-sm text-right font-medium whitespace-nowrap ${
                      transaction.amount > 0 ? "text-green-600" : "text-gray-900"
                    }`}>
                      {transaction.amount > 0 ? "+" : ""}
                      {formatCurrency(Math.abs(transaction.amount), transaction.currency)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <TransactionStatusBadge status={transaction.status} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button className="text-gray-400 hover:text-gray-600">
                        <ChevronDown className={`w-4 h-4 transition-transform ${
                          selectedTransaction === transaction.id ? "rotate-180" : ""
                        }`} />
                      </button>
                    </td>
                  </tr>
                  
                  {/* Expandable Details */}
                  {selectedTransaction === transaction.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={6} className="py-4 px-4">
                        <div className="bg-white rounded-lg border border-gray-200 p-4">
                          <h4 className="text-sm font-semibold text-gray-900 mb-3">Детали транзакции</h4>
                          <div className="grid md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-gray-600 mb-1">ID транзакции</p>
                              <p className="font-mono text-gray-900">{transaction.id}</p>
                            </div>
                            <div>
                              <p className="text-gray-600 mb-1">Дата и время</p>
                              <p className="text-gray-900">{formatDateTime(transaction.date)}</p>
                            </div>
                            <div>
                              <p className="text-gray-600 mb-1">Сумма</p>
                              <p className="text-gray-900 font-medium">
                                {formatCurrency(Math.abs(transaction.amount), transaction.currency)}
                              </p>
                            </div>
                            {transaction.paymentMethod && (
                              <div>
                                <p className="text-gray-600 mb-1">Метод оплаты</p>
                                <p className="text-gray-900">{transaction.paymentMethod}</p>
                              </div>
                            )}
                            {transaction.relatedEntity && (
                              <div className="md:col-span-2">
                                <p className="text-gray-600 mb-1">Связанная сущность</p>
                                <div className="flex items-center gap-2">
                                  <p className="text-gray-900">{transaction.relatedEntity.name}</p>
                                  <button className="text-blue-600 hover:text-blue-700">
                                    <ExternalLink className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {filteredTransactions.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-gray-500">Транзакции не найдены</p>
          </div>
        )}
      </div>
    </div>
  );
}
