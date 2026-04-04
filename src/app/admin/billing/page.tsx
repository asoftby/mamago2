import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { getBillingOverview, getBusinessesRequiringAttention } from "@/server/services/billing/billingAdmin.service";
import { DollarSign, TrendingUp, CheckCircle, XCircle, Users, AlertTriangle } from "lucide-react";
import { BillingKpiCard } from "@/components/admin/billing/BillingKpiCard";
import Link from "next/link";
import { formatCurrency, formatDateTime } from "@/lib/mocks/businessBilling";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

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
    error = e instanceof Error ? e.message : 'Unknown error';
    console.error("Billing overview error:", e);
  }

  // Show error state if Prisma client not generated
  if (error) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Billing Overview</h1>
          <p className="text-gray-600 mt-1">Финансовое состояние системы</p>
        </div>

        <div className="space-y-6">

        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-red-900 mb-2">
                Prisma Client Not Generated
              </h3>
              <p className="text-sm text-red-800 mb-4">
                The billing system requires the Prisma client to be regenerated after schema changes.
              </p>
              <div className="bg-white rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-gray-900 mb-2">Run this command:</p>
                <code className="block bg-gray-900 text-green-400 p-3 rounded text-sm font-mono">
                  npm run db:generate && npm run dev
                </code>
              </div>
              <p className="text-xs text-red-700">
                Error: {error}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Setup Instructions</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>Stop the dev server (Ctrl+C)</li>
            <li>Run: <code className="bg-blue-100 px-2 py-1 rounded">npm run db:generate</code></li>
            <li>Run: <code className="bg-blue-100 px-2 py-1 rounded">npm run db:migrate</code> (if needed)</li>
            <li>Run: <code className="bg-blue-100 px-2 py-1 rounded">npm run db:seed</code> (for test data)</li>
            <li>Start dev server: <code className="bg-blue-100 px-2 py-1 rounded">npm run dev</code></li>
          </ol>
        </div>
      </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-4 space-y-6">
      <AdminPageHeader
        title="Billing Overview"
        subtitle="Финансовое состояние системы"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <BillingKpiCard
          icon={DollarSign}
          label="Revenue Today"
          value={formatCurrency(overview?.revenueToday || 0, "BYN")}
        />
        <BillingKpiCard
          icon={TrendingUp}
          label="Revenue This Month"
          value={formatCurrency(overview?.revenueThisMonth || 0, "BYN")}
        />
        <BillingKpiCard
          icon={CheckCircle}
          label="Successful Charges"
          value={overview?.successfulChargesMonth || 0}
          subtitle="This month"
        />
        <BillingKpiCard
          icon={XCircle}
          label="Failed Payments"
          value={overview?.failedPayments || 0}
          alert={(overview?.failedPayments || 0) > 0}
        />
        <BillingKpiCard
          icon={Users}
          label="Active Businesses"
          value={overview?.activePaidBusinesses || 0}
        />
        <BillingKpiCard
          icon={AlertTriangle}
          label="Low Balance"
          value={overview?.lowBalanceBusinesses || 0}
          alert={(overview?.lowBalanceBusinesses || 0) > 0}
        />
      </div>

      {/* Recent Transactions */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg md:text-base font-semibold text-gray-900">Recent Transactions</h2>
            <Link href="/admin/billing/transactions" className="text-sm text-blue-600 hover:text-blue-700">
              View all →
            </Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Business</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Type</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Amount</th>
                <th className="px-4 py-3 text-center font-medium text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(overview?.recentTransactions || []).map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 text-gray-900">{formatDateTime(tx.occurredAt.toISOString())}</td>
                  <td className="py-3 px-4 text-gray-700">{tx.billingAccount.business.name}</td>
                  <td className="py-3 px-4 text-gray-700">{tx.type}</td>
                  <td className={`py-3 px-4 text-right font-medium ${
                    tx.amount.toNumber() > 0 ? "text-green-600" : "text-gray-900"
                  }`}>
                    {tx.amount.toNumber() > 0 ? "+" : ""}{formatCurrency(Math.abs(tx.amount.toNumber()), tx.currency)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      tx.status === "SUCCEEDED" ? "bg-green-100 text-green-700" :
                      tx.status === "FAILED" ? "bg-red-100 text-red-700" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>
                      {tx.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Businesses Requiring Attention */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">Low Balance ({attention?.lowBalance?.length || 0})</h3>
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
                  {formatCurrency(account.depositBalance.toNumber(), account.currency)}
                </span>
              </Link>
            ))}
          </div>
        </div>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">Past Due ({attention?.pastDue?.length || 0})</h3>
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
          <h3 className="text-sm font-semibold text-gray-900 mb-1">All Transactions</h3>
          <p className="text-xs text-gray-600">View complete transaction history</p>
        </Link>
        <Link href="/admin/billing/plans" className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Plans</h3>
          <p className="text-xs text-gray-600">Manage subscription plans</p>
        </Link>
        <Link href="/admin/billing/businesses" className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Business Balances</h3>
          <p className="text-xs text-gray-600">View all billing accounts</p>
        </Link>
      </div>
    </div>
  );
}
