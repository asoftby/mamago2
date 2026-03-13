import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { 
  mockDeposit, 
  mockUsageStats,
  mockTransactions,
  formatCurrency,
  formatDate,
  formatDateTime,
  getTransactionTypeLabel,
} from "@/lib/mocks/businessBilling";
import { Wallet, TrendingDown, Receipt, DollarSign, AlertCircle, Info } from "lucide-react";
import { BillingStatCard } from "@/components/business/billing/BillingStatCard";
import { TransactionStatusBadge } from "@/components/business/billing/TransactionStatusBadge";

export default async function BillingDepositPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/login?from=business");
  }

  const deposit = mockDeposit;
  const stats = mockUsageStats;
  const isLowBalance = deposit.balance < deposit.lowBalanceThreshold;

  // Get recent deposit-related transactions
  const recentTransactions = mockTransactions
    .filter(t => ["deposit_topup", "lead_charge", "promotion_charge", "refund"].includes(t.type))
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Депозит</h1>
        <p className="text-gray-600 mt-2">
          Баланс для списаний за лиды и продвижение
        </p>
      </div>

      {/* Balance Hero Card */}
      <div className={`rounded-lg shadow p-6 ${isLowBalance ? "bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200" : "bg-gradient-to-br from-green-50 to-green-100 border border-green-200"}`}>
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${isLowBalance ? "bg-orange-200" : "bg-green-200"}`}>
              <Wallet className={`w-6 h-6 ${isLowBalance ? "text-orange-700" : "text-green-700"}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Текущий баланс</p>
              <p className={`text-4xl font-bold ${isLowBalance ? "text-orange-900" : "text-green-900"}`}>
                {formatCurrency(deposit.balance, deposit.currency)}
              </p>
            </div>
          </div>

          {isLowBalance && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-200 rounded-full">
              <AlertCircle className="w-4 h-4 text-orange-700" />
              <span className="text-sm font-medium text-orange-900">Низкий баланс</span>
            </div>
          )}
        </div>

        {isLowBalance && (
          <div className="bg-white/80 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-700 mb-2">
              Рекомендуем пополнить депозит на <span className="font-semibold">{formatCurrency(deposit.recommendedTopup, deposit.currency)}</span>
            </p>
            <p className="text-xs text-gray-600">
              При балансе ниже {formatCurrency(deposit.lowBalanceThreshold, deposit.currency)} списания могут быть приостановлены
            </p>
          </div>
        )}

        <button className={`w-full md:w-auto px-6 py-3 rounded-lg font-medium transition-colors ${
          isLowBalance 
            ? "bg-orange-600 text-white hover:bg-orange-700" 
            : "bg-green-700 text-white hover:bg-green-800"
        }`}>
          Пополнить депозит
        </button>
      </div>

      {/* Month Usage Summary */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Статистика за месяц</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <BillingStatCard
            icon={TrendingDown}
            label="Потрачено"
            value={formatCurrency(stats.monthSpent, deposit.currency)}
            subtitle="В текущем месяце"
          />
          <BillingStatCard
            icon={Receipt}
            label="Списаний"
            value={stats.chargesCount.toString()}
            subtitle="Операций"
          />
          <BillingStatCard
            icon={DollarSign}
            label="Средний чек"
            value={formatCurrency(stats.averageCharge, deposit.currency)}
            subtitle="За списание"
          />
          <BillingStatCard
            icon={Wallet}
            label="Последнее списание"
            value={formatCurrency(stats.lastCharge.amount, deposit.currency)}
            subtitle={formatDate(stats.lastCharge.date)}
          />
        </div>
      </div>

      {/* Recent Usage */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Последние операции</h2>
        <div className="space-y-3">
          {recentTransactions.map((transaction) => (
            <div 
              key={transaction.id} 
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-sm font-medium text-gray-900">
                    {getTransactionTypeLabel(transaction.type)}
                  </span>
                  <TransactionStatusBadge status={transaction.status} size="sm" />
                </div>
                <p className="text-sm text-gray-600">{transaction.description}</p>
                <p className="text-xs text-gray-500 mt-1">{formatDateTime(transaction.date)}</p>
              </div>
              <div className="text-right ml-4">
                <p className={`text-lg font-semibold ${
                  transaction.amount > 0 ? "text-green-600" : "text-gray-900"
                }`}>
                  {transaction.amount > 0 ? "+" : ""}{formatCurrency(Math.abs(transaction.amount), transaction.currency)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rules/Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 space-y-2">
            <div>
              <p className="font-medium mb-1">За что списывается депозит?</p>
              <ul className="list-disc list-inside text-blue-700 space-y-1">
                <li>Заявки и лиды от пользователей на ваши места</li>
                <li>Продвижение предложений и событий</li>
                <li>Размещение в приоритетных позициях</li>
                <li>Stories и промо-материалы</li>
              </ul>
            </div>
            <div>
              <p className="font-medium mb-1">Что произойдет при низком балансе?</p>
              <p className="text-blue-700">
                При балансе ниже {formatCurrency(deposit.lowBalanceThreshold, deposit.currency)} новые списания будут приостановлены. 
                Ваши места останутся видимыми, но продвижение и получение лидов будет ограничено.
              </p>
            </div>
            <div>
              <p className="font-medium mb-1">История всех операций</p>
              <p className="text-blue-700">
                Полную историю транзакций можно посмотреть на странице{" "}
                <a href="/business/billing/transactions" className="underline hover:text-blue-800">
                  История операций
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
