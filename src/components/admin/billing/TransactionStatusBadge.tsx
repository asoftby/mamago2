import { BillingTransactionStatus } from "@prisma/client";

interface TransactionStatusBadgeProps {
  status: BillingTransactionStatus;
}

export function TransactionStatusBadge({ status }: TransactionStatusBadgeProps) {
  const config = {
    SUCCEEDED: { label: "Успешно", className: "bg-green-100 text-green-700" },
    FAILED: { label: "Ошибка", className: "bg-red-100 text-red-700" },
    PENDING: { label: "В обработке", className: "bg-yellow-100 text-yellow-700" },
    CANCELED: { label: "Отменено", className: "bg-gray-100 text-gray-700" },
    REVERSED: { label: "Возврат", className: "bg-purple-100 text-purple-700" },
  };

  const { label, className } = config[status] || config.PENDING;

  return (
    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${className}`}>
      {label}
    </span>
  );
}
