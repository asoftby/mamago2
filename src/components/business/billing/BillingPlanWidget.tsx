import Link from "next/link";
import { CreditCard, CheckCircle, Clock, XCircle } from "lucide-react";
import { mockCurrentPlan, formatDate } from "@/lib/mocks/businessBilling";
import { formatPrice } from "@/lib/formatters/format-price";

export function BillingPlanWidget({ href }: { href: string }) {
  const plan = mockCurrentPlan;
  
  const statusConfig = {
    active: {
      icon: CheckCircle,
      color: "text-green-600",
      bg: "bg-green-50",
      label: "Активен",
    },
    expiring: {
      icon: Clock,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
      label: "Заканчивается",
    },
    inactive: {
      icon: XCircle,
      color: "text-gray-600",
      bg: "bg-gray-50",
      label: "Неактивен",
    },
  };

  const config = statusConfig[plan.status];
  const StatusIcon = config.icon;

  return (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
            <p className="text-sm text-gray-500">Тарифный план</p>
          </div>
        </div>
        
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${config.bg}`}>
          <StatusIcon className={`w-3.5 h-3.5 ${config.color}`} />
          <span className={`text-xs font-medium ${config.color}`}>
            {config.label}
          </span>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-900">
            {formatPrice(plan.price)}
          </span>
          <span className="text-sm text-gray-500">
            / {plan.period === "month" ? "мес" : "год"}
          </span>
        </div>

        <div className="text-sm text-gray-600">
          <p>Следующее списание: <span className="font-medium text-gray-900">{formatDate(plan.nextBillingDate)}</span></p>
          {plan.autoRenewal && (
            <p className="text-xs text-gray-500 mt-1">Автопродление включено</p>
          )}
        </div>
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
