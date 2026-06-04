import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { getBillingAccountByBusinessId } from "@/server/services/billing/billingAccount.service";
import { getBillingTransactions } from "@/server/services/billing/billingTransaction.service";
import { BillingAccountStatusBadge } from "@/components/admin/billing/BillingAccountStatusBadge";
import { TransactionStatusBadge } from "@/components/admin/billing/TransactionStatusBadge";
import { TransactionTypeBadge } from "@/components/admin/billing/TransactionTypeBadge";
import { TransactionAmount } from "@/components/admin/billing/TransactionAmount";
import { AdminBillingActions } from "@/components/admin/billing/AdminBillingActions";
import { AlertTriangle, CreditCard, Wallet, TrendingDown } from "lucide-react";
import Link from "next/link";
import { BYN_SYMBOL, formatPrice } from "@/lib/formatters/format-price";

export default async function AdminBusinessBillingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  
  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  const { id: businessId } = await params;
  const account = await getBillingAccountByBusinessId(businessId);

  if (!account) {
    return (
      <div className="p-12 text-center">
        <p className="text-gray-500">Billing account not found</p>
      </div>
    );
  }

  const { transactions } = await getBillingTransactions({
    businessId,
    limit: 20,
  });

  const currentSubscription = account.subscriptions[0];
  const defaultPaymentMethod = account.paymentMethods[0];
  const balance = account.depositBalance.toNumber();
  const isLowBalance = balance < account.lowBalanceThreshold.toNumber();

  // Calculate month spent
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  
  const monthSpent = transactions
    .filter((tx) => tx.occurredAt >= monthStart && tx.amount.toNumber() < 0 && tx.status === "SUCCEEDED")
    .reduce((sum: number, tx) => sum + Math.abs(tx.amount.toNumber()), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{account.business.name}</h1>
          <p className="text-gray-600 mt-1">Billing & Subscriptions</p>
          <p className="text-sm text-gray-500">{account.business.owner?.email || "—"}</p>
        </div>
        <BillingAccountStatusBadge status={account.status} />
      </div>

      {/* Warnings */}
      {(isLowBalance || account.status === "SUSPENDED") && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-orange-900">
              {isLowBalance && <p className="font-medium">Низкий баланс депозита</p>}
              {account.status === "SUSPENDED" && (
                <p className="font-medium">Аккаунт приостановлен: {account.suspendedReason}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-5 h-5 text-gray-600" />
            <p className="text-sm text-gray-600">Тариф</p>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {currentSubscription?.plan.name || "—"}
          </p>
          {currentSubscription && (
            <p className="text-sm text-gray-500 mt-1">
              {currentSubscription.plan.price.toNumber()} {BYN_SYMBOL} / мес
            </p>
          )}
        </div>

        <div className={`rounded-lg border p-4 ${
          isLowBalance ? "bg-orange-50 border-orange-200" : "bg-white border-gray-200"
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <Wallet className={`w-5 h-5 ${isLowBalance ? "text-orange-600" : "text-gray-600"}`} />
            <p className={`text-sm ${isLowBalance ? "text-orange-700" : "text-gray-600"}`}>Депозит</p>
          </div>
          <p className={`text-xl font-bold ${isLowBalance ? "text-orange-900" : "text-gray-900"}`}>
            {formatPrice(balance)}
          </p>
          {isLowBalance && (
            <p className="text-xs text-orange-600 mt-1">Ниже порога {formatPrice(account.lowBalanceThreshold.toNumber())}</p>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-5 h-5 text-gray-600" />
            <p className="text-sm text-gray-600">За месяц</p>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {formatPrice(monthSpent)}
          </p>
          <p className="text-sm text-gray-500 mt-1">Потрачено</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-5 h-5 text-gray-600" />
            <p className="text-sm text-gray-600">Подписка</p>
          </div>
          <p className="text-xl font-bold text-gray-900">
            {currentSubscription?.status === "ACTIVE" ? "Активна" : 
             currentSubscription?.status === "PAST_DUE" ? "Просрочена" : "—"}
          </p>
          {currentSubscription && (
            <p className="text-sm text-gray-500 mt-1">
              До {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString("ru-RU")}
            </p>
          )}
        </div>
      </div>

      {/* Payment Method */}
      {defaultPaymentMethod && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Способ оплаты</h2>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {defaultPaymentMethod.cardBrand} •••• {defaultPaymentMethod.cardLast4}
              </p>
              <p className="text-sm text-gray-500">
                Истекает {defaultPaymentMethod.cardExpiryMonth}/{defaultPaymentMethod.cardExpiryYear}
              </p>
            </div>
            {defaultPaymentMethod.isDefault && (
              <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                По умолчанию
              </span>
            )}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Последние транзакции</h2>
          <Link 
            href={`/admin/billing/transactions?business=${businessId}`}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Вся история →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200">
              <tr>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-600">Дата</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-600">Тип</th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-600">Описание</th>
                <th className="text-right py-2 px-3 text-xs font-medium text-gray-600">Сумма</th>
                <th className="text-center py-2 px-3 text-xs font-medium text-gray-600">Статус</th>
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 10).map((tx) => (
                <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-3 text-sm text-gray-900">
                    {new Date(tx.occurredAt).toLocaleDateString("ru-RU")}
                  </td>
                  <td className="py-2 px-3 text-sm">
                    <TransactionTypeBadge type={tx.type} />
                  </td>
                  <td className="py-2 px-3 text-sm text-gray-700">{tx.description}</td>
                  <td className="py-2 px-3 text-sm text-right">
                    <TransactionAmount amount={tx.amount.toNumber()} currency={tx.currency} />
                  </td>
                  <td className="py-2 px-3 text-center">
                    <TransactionStatusBadge status={tx.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Actions - Now Working */}
      <AdminBillingActions
        businessId={businessId}
        accountStatus={account.status}
        currentBalance={balance}
        currency={account.currency}
      />
    </div>
  );
}
