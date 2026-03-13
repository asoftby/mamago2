"use client";

import { X } from "lucide-react";
import { TransactionStatusBadge } from "./TransactionStatusBadge";
import { TransactionTypeBadge } from "./TransactionTypeBadge";
import { TransactionAmount } from "./TransactionAmount";

interface TransactionDetailsDrawerProps {
  transaction: {
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
    metadata: any;
    createdAt: string;
    updatedAt: string;
    billingAccount: {
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
      plan: {
        name: string;
      };
    } | null;
  };
  onClose: () => void;
}

export function TransactionDetailsDrawer({ transaction, onClose }: TransactionDetailsDrawerProps) {
  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      {/* Drawer */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-2xl bg-white shadow-xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Детали транзакции</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <TransactionTypeBadge type={transaction.type as any} />
              </div>
              <TransactionStatusBadge status={transaction.status as any} />
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-2">
              <TransactionAmount amount={transaction.amount} currency={transaction.currency} />
            </p>
            <p className="text-sm text-gray-600">{transaction.description}</p>
          </div>

          {/* Business */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Бизнес</h3>
            <p className="text-sm text-gray-900">{transaction.billingAccount.business.name}</p>
            <p className="text-xs text-gray-500">ID: {transaction.billingAccount.business.id}</p>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Дата операции</h3>
              <p className="text-sm text-gray-900">
                {new Date(transaction.occurredAt).toLocaleString("ru-RU")}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Создано</h3>
              <p className="text-sm text-gray-900">
                {new Date(transaction.createdAt).toLocaleString("ru-RU")}
              </p>
            </div>
          </div>

          {/* Payment Method */}
          {transaction.paymentMethod && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Способ оплаты</h3>
              <p className="text-sm text-gray-900">
                {transaction.paymentMethod.cardBrand} •••• {transaction.paymentMethod.cardLast4}
              </p>
            </div>
          )}

          {/* Subscription */}
          {transaction.subscription && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Подписка</h3>
              <p className="text-sm text-gray-900">{transaction.subscription.plan.name}</p>
            </div>
          )}

          {/* Reference */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Ссылка</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                {transaction.referenceType}
              </span>
              {transaction.referenceId && (
                <span className="text-xs text-gray-500">{transaction.referenceId}</span>
              )}
            </div>
          </div>

          {/* Parent Transaction */}
          {transaction.parentTransactionId && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Родительская транзакция</h3>
              <p className="text-xs text-gray-500 font-mono">{transaction.parentTransactionId}</p>
            </div>
          )}

          {/* Failure Details */}
          {transaction.status === "FAILED" && (transaction.failureReason || transaction.failureCode) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-red-900 mb-2">Причина ошибки</h3>
              {transaction.failureReason && (
                <p className="text-sm text-red-700 mb-1">{transaction.failureReason}</p>
              )}
              {transaction.failureCode && (
                <p className="text-xs text-red-600 font-mono">{transaction.failureCode}</p>
              )}
            </div>
          )}

          {/* Metadata */}
          {transaction.metadata && Object.keys(transaction.metadata).length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Метаданные</h3>
              <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-x-auto">
                {JSON.stringify(transaction.metadata, null, 2)}
              </pre>
            </div>
          )}

          {/* Transaction ID */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">ID транзакции</h3>
            <p className="text-xs text-gray-500 font-mono break-all">{transaction.id}</p>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Действия</h3>
            <div className="flex flex-wrap gap-2">
              <button className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                Создать возврат
              </button>
              <button className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                Открыть бизнес
              </button>
              <button className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                Создать спор
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
