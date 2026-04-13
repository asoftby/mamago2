import { CheckCircle, Clock, XCircle, RotateCcw } from "lucide-react";
import type { TransactionStatus } from "@/lib/mocks/businessBilling";
import { getTransactionStatusLabel } from "@/lib/mocks/businessBilling";
import { BusinessChip } from "@/components/business/ui/BusinessChip";

interface TransactionStatusBadgeProps {
  status: TransactionStatus;
  size?: "sm" | "md";
}

export function TransactionStatusBadge({ status, size = "sm" }: TransactionStatusBadgeProps) {
  const config = {
    completed: {
      icon: CheckCircle,
      color: "text-green-700",
      tone: "success" as const,
    },
    pending: {
      icon: Clock,
      color: "text-yellow-700",
      tone: "warning" as const,
    },
    failed: {
      icon: XCircle,
      color: "text-red-700",
      tone: "danger" as const,
    },
    refunded: {
      icon: RotateCcw,
      color: "text-gray-700",
      tone: "muted" as const,
    },
  };

  const statusConfig = config[status];
  const Icon = statusConfig.icon;
  const iconSize = size === "sm" ? "w-3 h-3" : "w-4 h-4";

  return (
    <BusinessChip tone={statusConfig.tone} className={size === "md" ? "px-3 py-1.5 text-sm" : ""}>
      <Icon className={`${iconSize} ${statusConfig.color}`} />
      <span className={`font-medium ${size === "sm" ? "text-xs" : "text-sm"} ${statusConfig.color}`}>
        {getTransactionStatusLabel(status)}
      </span>
    </BusinessChip>
  );
}
