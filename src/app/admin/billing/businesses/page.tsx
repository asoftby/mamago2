import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { getBillingAccounts } from "@/server/services/billing/billingAccount.service";
import { BillingAccountStatusBadge } from "@/components/admin/billing/BillingAccountStatusBadge";
import { AlertTriangle, TrendingDown } from "lucide-react";
import Link from "next/link";
import { formatPrice } from "@/lib/formatters/format-price";

export default async function AdminBillingBusinessesPage() {
  const user = await getCurrentUser();
  
  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  const accounts = await getBillingAccounts();

  // Calculate attention states
  const accountsWithAttention = accounts.map((account) => {
    const balance = account.depositBalance.toNumber();
    const threshold = account.lowBalanceThreshold.toNumber();
    const subscription = account.subscriptions[0];
    
    const attention: string[] = [];
    
    if (account.status === "SUSPENDED") {
      attention.push("suspended");
    }
    if (balance < threshold) {
      attention.push("low_balance");
    }
    if (!subscription) {
      attention.push("no_subscription");
    }
    if (subscription?.status === "PAST_DUE") {
      attention.push("past_due");
    }

    return {
      ...account,
      attention,
    };
  });

  // Sort by attention level (most critical first)
  accountsWithAttention.sort((a, b) => {
    const priorityOrder = ["suspended", "past_due", "low_balance", "no_subscription"];
    const aMaxPriority = Math.min(...a.attention.map(att => priorityOrder.indexOf(att)).filter(i => i >= 0));
    const bMaxPriority = Math.min(...b.attention.map(att => priorityOrder.indexOf(att)).filter(i => i >= 0));
    return aMaxPriority - bMaxPriority;
  });

  return (
    <div className="p-6 md:p-4 space-y-6">
      {/* AdminPageHeader */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-xl font-bold text-gray-900">Балансы бизнесов</h1>
          <p className="text-sm text-gray-600 mt-1">Обзор billing-аккаунтов и проблемных состояний</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Всего аккаунтов</p>
          <p className="text-2xl font-bold text-gray-900">{accounts.length}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <p className="text-sm text-orange-700 mb-1">Низкий баланс</p>
          <p className="text-2xl font-bold text-orange-900">
            {accountsWithAttention.filter(a => a.attention.includes("low_balance")).length}
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700 mb-1">Приостановлено</p>
          <p className="text-2xl font-bold text-red-900">
            {accountsWithAttention.filter(a => a.attention.includes("suspended")).length}
          </p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-700 mb-1">Просрочено</p>
          <p className="text-2xl font-bold text-yellow-900">
            {accountsWithAttention.filter(a => a.attention.includes("past_due")).length}
          </p>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
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
              {accountsWithAttention.map((account) => {
                const subscription = account.subscriptions[0];
                const balance = account.depositBalance.toNumber();
                const isLowBalance = account.attention.includes("low_balance");

                return (
                  <tr key={account.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{account.business.name}</p>
                        <p className="text-xs text-gray-500">{account.business.owner.email}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <BillingAccountStatusBadge status={account.status} />
                    </td>
                    <td className="py-3 px-4 text-gray-700">
                      {subscription ? (
                        <div>
                          <p className="font-medium">{subscription.plan.name}</p>
                          <p className="text-xs text-gray-500">
                            {formatPrice(subscription.plan.price.toNumber())}/мес
                          </p>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className={`py-3 px-4 text-right font-medium ${
                      isLowBalance ? "text-orange-600" : "text-gray-900"
                    }`}>
                      {formatPrice(balance)}
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
                    <td className="py-3 px-4 text-center">
                      <Link
                        href={`/admin/businesses/${account.businessId}/billing`}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Открыть
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
