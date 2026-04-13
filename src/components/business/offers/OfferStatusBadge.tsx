import { OfferStatus } from "@prisma/client";
import { BusinessChip } from "@/components/business/ui/BusinessChip";

interface OfferStatusBadgeProps {
  status: OfferStatus;
  className?: string;
}

const STATUS_CONFIG: Record<OfferStatus, { label: string; tone: "muted" | "warning" | "success" | "danger" }> = {
  DRAFT: {
    label: "Черновик",
    tone: "muted",
  },
  PENDING: {
    label: "На модерации",
    tone: "warning",
  },
  PUBLISHED: {
    label: "Опубликовано",
    tone: "success",
  },
  REJECTED: {
    label: "Отклонено",
    tone: "danger",
  },
};

export function OfferStatusBadge({ status, className = "" }: OfferStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <BusinessChip tone={config.tone} className={className}>
      {config.label}
    </BusinessChip>
  );
}
