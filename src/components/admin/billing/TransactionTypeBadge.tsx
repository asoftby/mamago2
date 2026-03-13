import { BillingTransactionType } from "@prisma/client";

interface TransactionTypeBadgeProps {
  type: BillingTransactionType;
}

export function TransactionTypeBadge({ type }: TransactionTypeBadgeProps) {
  const config: Record<BillingTransactionType, { label: string; className: string }> = {
    SUBSCRIPTION_CHARGE: { label: "Подписка", className: "bg-blue-100 text-blue-700" },
    SUBSCRIPTION_RENEWAL: { label: "Продление", className: "bg-blue-100 text-blue-700" },
    DEPOSIT_TOPUP: { label: "Пополнение", className: "bg-green-100 text-green-700" },
    LEAD_CHARGE: { label: "Лид", className: "bg-purple-100 text-purple-700" },
    PROMOTION_CHARGE: { label: "Продвижение", className: "bg-orange-100 text-orange-700" },
    FEATURE_CHARGE: { label: "Доп. функция", className: "bg-indigo-100 text-indigo-700" },
    REFUND: { label: "Возврат", className: "bg-red-100 text-red-700" },
    BONUS_CREDIT: { label: "Бонус", className: "bg-green-100 text-green-700" },
    MANUAL_ADJUSTMENT: { label: "Корректировка", className: "bg-gray-100 text-gray-700" },
    CORRECTION: { label: "Исправление", className: "bg-gray-100 text-gray-700" },
  };

  const { label, className } = config[type] || { label: type, className: "bg-gray-100 text-gray-700" };

  return (
    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${className}`}>
      {label}
    </span>
  );
}
