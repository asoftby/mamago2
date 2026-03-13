import type { PlacementStatus } from "@prisma/client";

interface PlacementStatusBadgeProps {
  status: PlacementStatus;
  className?: string;
}

export function PlacementStatusBadge({ status, className = "" }: PlacementStatusBadgeProps) {
  const styles = {
    ACTIVE: "bg-green-100 text-green-700",
    EXPIRING: "bg-orange-100 text-orange-700",
    EXPIRED: "bg-red-100 text-red-700",
    PAUSED: "bg-yellow-100 text-yellow-700",
    CANCELED: "bg-gray-100 text-gray-500",
  };

  const labels = {
    ACTIVE: "Активно",
    EXPIRING: "Заканчивается",
    EXPIRED: "Завершено",
    PAUSED: "Приостановлено",
    CANCELED: "Отменено",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]} ${className}`}
    >
      {labels[status]}
    </span>
  );
}
