import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { getBillingOverview, getBusinessesRequiringAttention } from "@/server/services/billing/billingAdmin.service";
import { Banknote, TrendingUp, CheckCircle, XCircle, Users, AlertTriangle } from "lucide-react";
import { BillingKpiCard } from "@/components/admin/billing/BillingKpiCard";
import Link from "next/link";
import { formatDateTime } from "@/lib/business/billing";
import { formatPrice, formatTransactionAmount } from "@/lib/formatters/format-price";
import { renderCurrencyText } from "@/components/icons/BelarusianRubleIcon";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { TableContainer } from "@/components/ui/table";
import { TransactionTypeBadge } from "@/components/admin/billing/TransactionTypeBadge";
import { TransactionStatusBadge } from "@/components/admin/billing/TransactionStatusBadge";

export default async function AdminBillingPage() {
  const user = await getCurrentUser();
  
  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  let overview;
  let attention;
  let error = null;

  try {
    overview = await getBillingOverview();
    attention = await getBusinessesRequiringAttention();
  } catch (e) {
    error = e instanceof Error ? e.message : "Неизвестная ошибка";
    console.error("Billing overview error:", e);
  }

  // Show error state if Prisma client not generated
  if (error) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Финансовый обзор</h1>
          <p className="text-gray-600 mt-1">Финансовое состояние системы</p>
        </div>

        <div className="space-y-6">

        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-red-900 mb-2">
                Prisma Client не сгенерирован
              </h3>
              <p className="text-sm text-red-800 mb-4">
                Для работы финансового раздела нужно повторно сгенерировать Prisma Client после изменений схемы.
              </p>
              <div className="bg-white rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-gray-900 mb-2">Выполните команду:</p>
                <code className="block bg-gray-900 text-green-400 p-3 rounded text-sm font-mono">
                  npm run db:generate && npm run dev
                </code>
              </div>
              <p className="text-xs text-red-700">
                Ошибка: {error}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Инструкция по настройке</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>Остановите dev-сервер (Ctrl+C)</li>
            <li>Выполните: <code className="bg-blue-100 px-2 py-1 rounded">npm run db:generate</code></li>
            <li>Выполните: <code className="bg-blue-100 px-2 py-1 rounded">npm run db:migrate</code> (при необходимости)</li>
            <li>Выполните: <code className="bg-blue-100 px-2 py-1 rounded">npm run db:seed</code> (для тестовых данных)</li>
            <li>Запустите dev-сервер: <code className="bg-blue-100 px-2 py-1 rounded">npm run dev</code></li>
          </ol>
        </div>
      </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <AdminPageHeader
        title="Финансовый обзор"
        subtitle="Финансовое состояние системы"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <BillingKpiCard
          icon={Banknote}
          label="Выручка сегодня"
          value={renderCurrencyText(formatPrice(overview?.revenueToday || 0, { hideZero: true }), { iconSize: "xs" })}
        />
        <BillingKpiCard
          icon={TrendingUp}
          label="Выручка за месяц"
          value={renderCurrencyText(formatPrice(overview?.revenueThisMonth || 0, { hideZero: true }), { iconSize: "xs" })}
        />
        <BillingKpiCard
          icon={CheckCircle}
          label="Успешные списания"
          value={overview?.successfulChargesMonth || 0}
          subtitle="За текущий месяц"
        />
        <BillingKpiCard
          icon={XCircle}
          label="Ошибки платежей"
          value={overview?.failedPayments || 0}
          alert={(overview?.failedPayments || 0) > 0}
        />
        <BillingKpiCard
          icon={Users}
          label="Активные бизнесы"
          value={overview?.activePaidBusinesses || 0}
        />
        <BillingKpiCard
          icon={AlertTriangle}
          label="Низкий баланс"
          value={overview?.lowBalanceBusinesses || 0}
          alert={(overview?.lowBalanceBusinesses || 0) > 0}
        />
      </div>

      {/* Recent Transactions */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg md:text-base font-semibold text-gray-900">Последние транзакции</h2>
            <Link href="/admin/billing/transactions" className="text-sm text-blue-600 hover:text-blue-700">
              Все транзакции →
            </Link>
          </div>
        </div>
        <TableContainer minWidthClassName="min-w-[640px]" scrollLabel="Последние транзакции, таблица">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Дата</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Бизнес</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Тип</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Сумма</th>
                <th className="px-4 py-3 text-center font-medium text-gray-700">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(overview?.recentTransactions || []).map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900">{formatDateTime(tx.occurredAt.toISOString())}</td>
                  <td className="py-3 px-4 text-gray-700">{tx.billingAccount.business.name}</td>
                  <td className="py-3 px-4 text-gray-700"><TransactionTypeBadge type={tx.type} /></td>
                  <td className={`py-3 px-4 text-right font-medium ${
                    tx.amount.toNumber() > 0 ? "text-green-600" : "text-gray-900"
                  }`}>
                    {renderCurrencyText(formatTransactionAmount(tx.amount.toNumber()), { iconSize: "text" })}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <TransactionStatusBadge status={tx.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableContainer>
      </div>

      {/* Businesses Requiring Attention */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">Низкий баланс ({attention?.lowBalance?.length || 0})</h3>
          </div>
          <div className="p-4 space-y-2">
            {(attention?.lowBalance || []).slice(0, 5).map((account) => (
              <Link
                key={account.id}
                href={`/admin/businesses/${account.businessId}/billing`}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <span className="text-sm font-medium text-gray-900">{account.business.name}</span>
                <span className="text-sm text-orange-600 font-medium">
                  {renderCurrencyText(formatPrice(account.depositBalance.toNumber(), { hideZero: true }), { iconSize: "text" })}
                </span>
              </Link>
            ))}
          </div>
        </div>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">Просроченные подписки ({attention?.pastDue?.length || 0})</h3>
          </div>
          <div className="p-4 space-y-2">
            {(attention?.pastDue || []).slice(0, 5).map((sub) => (
              <Link
                key={sub.id}
                href={`/admin/businesses/${sub.billingAccount.businessId}/billing`}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <span className="text-sm font-medium text-gray-900">{sub.billingAccount.business.name}</span>
                <span className="text-sm text-red-600 font-medium">{sub.plan.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid md:grid-cols-3 gap-4">
        <Link href="/admin/billing/transactions" className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Все транзакции</h3>
          <p className="text-xs text-gray-600">Полная история транзакций</p>
        </Link>
        <Link href="/admin/billing/plans" className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Тарификация</h3>
          <p className="text-xs text-gray-600">Правила списаний за полезные действия бизнеса</p>
        </Link>
        <Link href="/admin/billing/businesses" className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Балансы бизнесов</h3>
          <p className="text-xs text-gray-600">Все счета и балансы бизнесов</p>
        </Link>
      </div>
    </div>
  );
}
