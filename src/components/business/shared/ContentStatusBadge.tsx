import { ContentStatus } from "@prisma/client";
import { BusinessChip } from "@/components/business/ui/BusinessChip";

interface ContentStatusBadgeProps {
  status: ContentStatus;
  className?: string;
}

const STATUS_CONFIG: Record<ContentStatus, { label: string; tone: "muted" | "warning" | "success" | "danger" }> = {
  DRAFT: {
    label: "Черновик",
    tone: "muted",
  },
  PENDING: {
    label: "На модерации",
    tone: "warning",
  },
  PENDING_UPDATE: {
    label: "На проверке",
    tone: "warning",
  },
  PUBLISHED: {
    label: "Опубликовано",
    tone: "success",
  },
  NEEDS_REVISION: {
    label: "Требует правок",
    tone: "warning",
  },
  REJECTED: {
    label: "Отклонено",
    tone: "danger",
  },
  DELETED: {
    label: "Удалено",
    tone: "muted",
  },
};

export function ContentStatusBadge({ status, className = "" }: ContentStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <BusinessChip tone={config.tone} className={className}>
      {config.label}
    </BusinessChip>
  );
}
