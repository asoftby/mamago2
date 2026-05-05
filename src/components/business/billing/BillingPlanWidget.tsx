import Link from "next/link";
import { CreditCard } from "lucide-react";

export function BillingPlanWidget({ href }: { href: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Тариф не подключён</h3>
            <p className="text-sm text-gray-500">Тарифный план</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <p className="text-sm text-gray-600">
          Реальная биллинговая интеграция ещё не подключена.
        </p>
      </div>

      <Link
        href={href}
        className="block w-full text-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
      >
        Управлять тарифом
      </Link>
    </div>
  );
}
