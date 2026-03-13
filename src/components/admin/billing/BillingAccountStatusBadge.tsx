import { BillingAccountStatus } from "@prisma/client";

interface BillingAccountStatusBadgeProps {
  status: BillingAccountStatus;
}

export function BillingAccountStatusBadge({ status }: BillingAccountStatusBadgeProps) {
  const config = {
    ACTIVE: { label: "Активен", className: "bg-green-100 text-green-700" },
    SUSPENDED: { label: "Приостановлен", className: "bg-red-100 text-red-700" },
    CLOSED: { label: "Закрыт", className: "bg-gray-100 text-gray-700" },
  };

  const { label, className } = config[status] || config.ACTIVE;

  return (
    <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${className}`}>
      {label}
    </span>
  );
}
