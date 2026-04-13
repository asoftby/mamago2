import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import {
  formatDate,
  formatDateTime,
  getTransactionTypeLabel,
  mockDeposit,
  mockTransactions,
  mockUsageStats,
} from "@/lib/mocks/businessBilling";
import { formatPrice } from "@/lib/formatters/format-price";
import {
  AlertCircle,
  DollarSign,
  Info,
  Receipt,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { BillingStatCard } from "@/components/business/billing/BillingStatCard";
import { TransactionStatusBadge } from "@/components/business/billing/TransactionStatusBadge";
import { BusinessSectionHeader } from "@/components/business/sections/BusinessSectionHeader";
import { buildSurfaceRedirectDestination } from "@/lib/routing/surface";
import { getCurrentRequestRoutingContext } from "@/lib/routing/requestContext";
import { BusinessSurfaceCard } from "@/components/business/ui/BusinessSurfaceCard";
import { BusinessChip } from "@/components/business/ui/BusinessChip";
import { DepositTopUpTrigger } from "@/components/business/billing/DepositTopUpTrigger";

export default async function BillingDepositPage() {
  const routing = await getCurrentRequestRoutingContext();
  const user = await getCurrentUser();

  if (!user) {
    redirect(
      buildSurfaceRedirectDestination({
        targetSurface: "public",
        targetPath: "/login",
        ...routing,
      }),
    );
  }

  const deposit = mockDeposit;
  const stats = mockUsageStats;
  const isLowBalance = deposit.balance < deposit.lowBalanceThreshold;
  const recentTransactions = mockTransactions
    .filter((transaction) =>
      ["deposit_topup", "lead_charge", "promotion_charge", "refund"].includes(
        transaction.type,
      ),
    )
    .slice(0, 10);

  const transactionsHref = buildSurfaceRedirectDestination({
    targetSurface: "business",
    targetPath: "/billing/transactions",
    ...routing,
  });

  const promotionHref = buildSurfaceRedirectDestination({
    targetSurface: "business",
    targetPath: "/promotion",
    ...routing,
  });

  return (
    <div className="space-y-6">
      <BusinessSectionHeader
        eyebrow="Billing"
        title="Депозит"
        description="Депозит покрывает лиды и продвижение. Здесь видно текущий баланс, скорость списаний и когда пора пополнить счёт."
      />

      <BusinessSurfaceCard tone={isLowBalance ? "warm" : "success"} className="p-6 md:p-7">
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                isLowBalance ? "bg-orange-200" : "bg-green-200"
              }`}
            >
              <Wallet
                className={`w-6 h-6 ${
                  isLowBalance ? "text-orange-700" : "text-green-700"
                }`}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-stone-600">Текущий баланс</p>
              <p
                className={`text-4xl font-bold ${
                  isLowBalance ? "text-orange-900" : "text-green-900"
                }`}
              >
                {formatPrice(deposit.balance)}
              </p>
            </div>
          </div>

          {isLowBalance ? (
            <BusinessChip tone="warning" className="gap-2 bg-orange-200/90">
              <AlertCircle className="w-4 h-4 text-orange-700" />
              <span className="text-sm font-medium text-orange-900">
                Низкий баланс
              </span>
            </BusinessChip>
          ) : null}
        </div>

        {isLowBalance ? (
          <div className="mb-4 rounded-[24px] border border-orange-200 bg-white/80 p-4">
            <p className="mb-2 text-sm text-stone-700">
              Рекомендуем пополнить депозит на{" "}
              <span className="font-semibold">
                {formatPrice(deposit.recommendedTopup)}
              </span>
            </p>
            <p className="text-xs text-stone-600">
              При балансе ниже{" "}
              {formatPrice(deposit.lowBalanceThreshold)}
              {" "}списания могут быть приостановлены.
            </p>
          </div>
        ) : null}

        <DepositTopUpTrigger
          balance={deposit.balance}
          lowBalanceThreshold={deposit.lowBalanceThreshold}
          promotionHref={promotionHref}
          variant={isLowBalance ? "warning" : "primary"}
          label="Пополнить депозит"
          className="w-full md:w-auto"
        />
      </BusinessSurfaceCard>

      <div>
        <h2 className="mb-4 text-xl font-semibold tracking-tight text-stone-950">
          Статистика за месяц
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <BillingStatCard
            icon={TrendingDown}
            label="Потрачено"
            value={formatPrice(stats.monthSpent)}
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
            value={formatPrice(stats.averageCharge)}
            subtitle="За списание"
          />
          <BillingStatCard
            icon={Wallet}
            label="Последнее списание"
            value={formatPrice(stats.lastCharge.amount)}
            subtitle={formatDate(stats.lastCharge.date)}
          />
        </div>
      </div>

      <BusinessSurfaceCard className="p-6 md:p-7">
        <h2 className="mb-4 text-xl font-semibold tracking-tight text-stone-950">
          Последние операции
        </h2>
        <div className="space-y-3">
          {recentTransactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center justify-between rounded-[22px] border border-stone-200 bg-stone-50/70 p-4 transition-colors hover:border-stone-300 hover:bg-white"
            >
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-3">
                  <span className="text-sm font-medium text-stone-950">
                    {getTransactionTypeLabel(transaction.type)}
                  </span>
                  <TransactionStatusBadge status={transaction.status} size="sm" />
                </div>
                <p className="text-sm text-stone-600">{transaction.description}</p>
                <p className="mt-1 text-xs text-stone-500">
                  {formatDateTime(transaction.date)}
                </p>
              </div>
              <div className="ml-4 text-right">
                <p
                  className={`text-lg font-semibold ${
                    transaction.amount > 0 ? "text-green-600" : "text-stone-950"
                  }`}
                >
                  {transaction.amount > 0 ? "+" : ""}
                  {formatPrice(Math.abs(transaction.amount))}
                </p>
              </div>
            </div>
          ))}
        </div>
      </BusinessSurfaceCard>

      <BusinessSurfaceCard tone="accent" className="p-6">
        <div className="flex gap-3">
          <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
          <div className="space-y-2 text-sm text-blue-900">
            <div>
              <p className="mb-1 font-medium">За что списывается депозит?</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>Заявки и лиды от пользователей на ваши места</li>
                <li>Продвижение предложений и событий</li>
                <li>Размещение в приоритетных позициях</li>
                <li>Stories и промо-материалы</li>
              </ul>
            </div>
            <div>
              <p className="mb-1 font-medium">Что произойдет при низком балансе?</p>
              <p className="text-blue-700">
                При балансе ниже{" "}
                {formatPrice(deposit.lowBalanceThreshold)}
                {" "}новые списания будут приостановлены. Ваши места останутся
                видимыми, но продвижение и получение лидов будет ограничено.
              </p>
            </div>
            <div>
              <p className="mb-1 font-medium">История всех операций</p>
              <p className="text-blue-700">
                Полную историю транзакций можно посмотреть на странице{" "}
                <a href={transactionsHref} className="underline hover:text-blue-800">
                  История операций
                </a>
              </p>
            </div>
          </div>
        </div>
      </BusinessSurfaceCard>
    </div>
  );
}
