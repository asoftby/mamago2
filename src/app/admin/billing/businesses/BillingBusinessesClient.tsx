"use client";

import { useState } from "react";
import { BillingAccountStatusBadge } from "@/components/admin/billing/BillingAccountStatusBadge";
import { AlertTriangle, TrendingDown, Plus, Minus, History, Ban, CheckCircle, Wallet } from "lucide-react";
import { formatPrice } from "@/lib/formatters/format-price";
import { TopUpModal } from "./TopUpModal";
import { DebitModal } from "./DebitModal";
import { HistoryModal } from "./HistoryModal";
import { SuspendModal } from "./SuspendModal";
import { ReactivateModal } from "./ReactivateModal";
import { FirstTopUpModal } from "./FirstTopUpModal";

interface BillingAccount {
  id: string;
  businessId: string;
  status: string;
  depositBalance: number;
  currency: string;
  lowBalanceThreshold: number;
  creditLimit: number;
  business: {
    name: string;
    owner?: {
      email: string;
    } | null;
  };
  subscriptions: Array<{
    plan: {
      name: string;
      price: number;
    };
    status: string;
  }>;
  _count: {
    transactions: number;
  };
  attention: string[];
}

interface Props {
  accounts: BillingAccount[];
}

export function BillingBusinessesClient({ accounts: initialAccounts }: Props) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [selectedAccount, setSelectedAccount] = useState<BillingAccount | null>(null);
  const [modalType, setModalType] = useState<"topup" | "debit" | "history" | "suspend" | "reactivate" | null>(null);
  const [showFirstTopUpModal, setShowFirstTopUpModal] = useState(false);

  const handleOpenModal = (account: BillingAccount, type: typeof modalType) => {
    setSelectedAccount(account);
    setModalType(type);
  };

  const handleCloseModal = () => {
    setSelectedAccount(null);
    setModalType(null);
  };

  const handleSuccess = () => {
    // Refresh the page to get updated data
    window.location.reload();
  };

  // Calculate summary stats
  const totalAccounts = accounts.length;
  const lowBalanceCount = accounts.filter(a => a.attention.includes("low_balance")).length;
  const suspendedCount = accounts.filter(a => a.attention.includes("suspended")).length;
  const pastDueCount = accounts.filter(a => a.attention.includes("past_due")).length;

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-xl font-bold text-gray-900">Балансы бизнесов</h1>
            <p className="text-sm text-gray-600 mt-1">Обзор billing-аккаунтов и проблемных состояний</p>
          </div>
          <button
            onClick={() => setShowFirstTopUpModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#EF8759] text-white rounded-md hover:bg-[#EF8759]/90 transition-colors shadow-sm"
          >
            <Wallet className="w-4 h-4" />
            Пополнить баланс
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Всего аккаунтов</p>
            <p className="text-2xl font-bold text-gray-900">{totalAccounts}</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-sm text-orange-700 mb-1">Низкий баланс</p>
            <p className="text-2xl font-bold text-orange-900">{lowBalanceCount}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-700 mb-1">Приостановлено</p>
            <p className="text-2xl font-bold text-red-900">{suspendedCount}</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-700 mb-1">Просрочено</p>
            <p className="text-2xl font-bold text-yellow-900">{pastDueCount}</p>
          </div>
        </div>

        {/* Accounts Table */}
        {accounts.length === 0 ? (
          <div className="border border-gray-200 rounded-lg bg-white p-12 text-center">
            <p className="text-lg font-medium text-gray-900 mb-2">Billing-аккаунтов пока нет</p>
            <p className="text-sm text-gray-600">Используйте кнопку &quot;Пополнить баланс&quot; выше для создания первого аккаунта</p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Бизнес</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-700">Статус</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Тариф</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">Депозит</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-700">Транзакций</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-700">Внимание</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-700">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {accounts.map((account) => {
                    const subscription = account.subscriptions[0];
                    const isLowBalance = account.attention.includes("low_balance");
                    const isSuspended = account.status === "SUSPENDED";

                    return (
                      <tr key={account.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900">{account.business.name}</p>
                            <p className="text-xs text-gray-500">{account.business.owner?.email || "—"}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <BillingAccountStatusBadge status={account.status as "ACTIVE" | "SUSPENDED" | "CLOSED"} />
                        </td>
                        <td className="py-3 px-4 text-gray-700">
                          {subscription ? (
                            <div>
                              <p className="font-medium">{subscription.plan.name}</p>
                              <p className="text-xs text-gray-500">
                                {formatPrice(subscription.plan.price)}/мес
                              </p>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className={`py-3 px-4 text-right font-medium ${
                          isLowBalance ? "text-orange-600" : "text-gray-900"
                        }`}>
                          {formatPrice(account.depositBalance)}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-700">
                          {account._count.transactions}
                        </td>
                        <td className="py-3 px-4">
                          {account.attention.length > 0 ? (
                            <div className="flex flex-col items-center gap-1">
                              {account.attention.includes("suspended") && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
                                  <AlertTriangle className="w-3 h-3" />
                                  Приостановлен
                                </span>
                              )}
                              {account.attention.includes("past_due") && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
                                  <TrendingDown className="w-3 h-3" />
                                  Просрочено
                                </span>
                              )}
                              {account.attention.includes("low_balance") && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
                                  <AlertTriangle className="w-3 h-3" />
                                  Низкий баланс
                                </span>
                              )}
                              {account.attention.includes("no_subscription") && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                                  Нет подписки
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleOpenModal(account, "topup")}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-md transition-colors"
                              title="Пополнить"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Пополнить
                            </button>
                            <button
                              onClick={() => handleOpenModal(account, "debit")}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                              title="Списать"
                            >
                              <Minus className="w-3.5 h-3.5" />
                              Списать
                            </button>
                            <button
                              onClick={() => handleOpenModal(account, "history")}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                              title="История"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                            {isSuspended ? (
                              <button
                                onClick={() => handleOpenModal(account, "reactivate")}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-md transition-colors"
                                title="Активировать"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOpenModal(account, "suspend")}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                                title="Приостановить"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedAccount && modalType === "topup" && (
        <TopUpModal
          account={selectedAccount}
          onClose={handleCloseModal}
          onSuccess={handleSuccess}
        />
      )}
      {selectedAccount && modalType === "debit" && (
        <DebitModal
          account={selectedAccount}
          onClose={handleCloseModal}
          onSuccess={handleSuccess}
        />
      )}
      {selectedAccount && modalType === "history" && (
        <HistoryModal
          account={selectedAccount}
          onClose={handleCloseModal}
        />
      )}
      {selectedAccount && modalType === "suspend" && (
        <SuspendModal
          account={selectedAccount}
          onClose={handleCloseModal}
          onSuccess={handleSuccess}
        />
      )}
      {selectedAccount && modalType === "reactivate" && (
        <ReactivateModal
          account={selectedAccount}
          onClose={handleCloseModal}
          onSuccess={handleSuccess}
        />
      )}
      {showFirstTopUpModal && (
        <FirstTopUpModal
          onClose={() => setShowFirstTopUpModal(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
