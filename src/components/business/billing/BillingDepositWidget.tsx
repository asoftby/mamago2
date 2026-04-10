import Link from "next/link";
import { Wallet, TrendingDown, AlertCircle } from "lucide-react";
import { mockDeposit, formatCurrency } from "@/lib/mocks/businessBilling";

export function BillingDepositWidget({ href }: { href: string }) {
  const deposit = mockDeposit;
  const isLowBalance = deposit.balance < deposit.lowBalanceThreshold;

  return (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            isLowBalance ? "bg-orange-50" : "bg-green-50"
          }`}>
            <Wallet className={`w-5 h-5 ${isLowBalance ? "text-orange-600" : "text-green-600"}`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Депозит</h3>
            <p className="text-sm text-gray-500">Баланс для списаний</p>
          </div>
        </div>
        
        {isLowBalance && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50">
            <AlertCircle className="w-3.5 h-3.5 text-orange-600" />
            <span className="text-xs font-medium text-orange-600">
              Низкий баланс
            </span>
          </div>
        )}
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex items-baseline gap-2">
          <span className={`text-3xl font-bold ${isLowBalance ? "text-orange-600" : "text-gray-900"}`}>
            {formatCurrency(deposit.balance, deposit.currency).split(" ")[0]}
          </span>
          <span className="text-sm text-gray-500">{deposit.currency}</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <TrendingDown className="w-4 h-4 text-gray-400" />
          <span>
            Потрачено в этом месяце: <span className="font-medium text-gray-900">
              {formatCurrency(deposit.monthSpent, deposit.currency)}
            </span>
          </span>
        </div>

        <p className="text-xs text-gray-500">
          Используется для списаний за лиды и продвижение
        </p>
      </div>

      <Link
        href={href}
        className={`block w-full text-center px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
          isLowBalance
            ? "bg-orange-600 text-white hover:bg-orange-700"
            : "bg-gray-900 text-white hover:bg-gray-800"
        }`}
      >
        {isLowBalance ? "Пополнить депозит" : "Открыть депозит"}
      </Link>
    </div>
  );
}
