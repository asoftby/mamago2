import { CheckCircle, Clock, XCircle, RotateCcw } from "lucide-react";
import type { TransactionStatus } from "@/lib/mocks/businessBilling";
import { getTransactionStatusLabel } from "@/lib/mocks/businessBilling";

interface TransactionStatusBadgeProps {
  status: TransactionStatus;
  size?: "sm" | "md";
}

export function TransactionStatusBadge({ status, size = "sm" }: TransactionStatusBadgeProps) {
  const config = {
    completed: {
      icon: CheckCircle,
      color: "text-green-700",
      bg: "bg-green-50",
      border: "border-green-200",
    },
    pending: {
      icon: Clock,
      color: "text-yellow-700",
      bg: "bg-yellow-50",
      border: "border-yellow-200",
    },
    failed: {
      icon: XCircle,
      color: "text-red-700",
      bg: "bg-red-50",
      border: "border-red-200",
    },
    refunded: {
      icon: RotateCcw,
      color: "text-gray-700",
      bg: "bg-gray-50",
      border: "border-gray-200",
    },
  };

  const statusConfig = config[status];
  const Icon = statusConfig.icon;
  const iconSize = size === "sm" ? "w-3 h-3" : "w-4 h-4";
  const textSize = size === "sm" ? "text-xs" : "text-sm";
  const padding = size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1";

  return (
    <span className={`inline-flex items-center gap-1 ${padding} rounded-full border ${statusConfig.bg} ${statusConfig.border}`}>
      <Icon className={`${iconSize} ${statusConfig.color}`} />
      <span className={`${textSize} font-medium ${statusConfig.color}`}>
        {getTransactionStatusLabel(status)}
      </span>
    </span>
  );
}
