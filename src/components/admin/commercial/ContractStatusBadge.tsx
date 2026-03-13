import type { ContractStatus } from "@prisma/client";

interface ContractStatusBadgeProps {
  status: ContractStatus;
  className?: string;
}

export function ContractStatusBadge({ status, className = "" }: ContractStatusBadgeProps) {
  const styles = {
    DRAFT: "bg-gray-100 text-gray-700",
    ACTIVE: "bg-green-100 text-green-700",
    EXPIRING: "bg-orange-100 text-orange-700",
    EXPIRED: "bg-red-100 text-red-700",
    TERMINATED: "bg-gray-100 text-gray-500",
  };

  const labels = {
    DRAFT: "Черновик",
    ACTIVE: "Активен",
    EXPIRING: "Истекает",
    EXPIRED: "Истек",
    TERMINATED: "Расторгнут",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]} ${className}`}
    >
      {labels[status]}
    </span>
  );
}
