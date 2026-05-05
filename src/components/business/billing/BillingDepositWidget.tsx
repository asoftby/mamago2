import Link from "next/link";
import { Wallet, TrendingDown } from "lucide-react";
import { formatPrice } from "@/lib/formatters/format-price";

export function BillingDepositWidget({ href }: { href: string }) {
  const balance = 0;

  return (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            "bg-green-50"
          }`}>
            <Wallet className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Депозит</h3>
            <p className="text-sm text-gray-500">Баланс для списаний</p>
          </div>
        </div>
        
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-900">
            {formatPrice(balance)}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <TrendingDown className="w-4 h-4 text-gray-400" />
          <span>
            Потрачено в этом месяце: <span className="font-medium text-gray-900">
              {formatPrice(0)}
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
          "bg-gray-900 text-white hover:bg-gray-800"
        }`}
      >
        Открыть депозит
      </Link>
    </div>
  );
}
