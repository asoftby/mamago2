import { ContentStatus } from "@prisma/client";

interface ContentStatusBadgeProps {
  status: ContentStatus;
  className?: string;
}

const STATUS_CONFIG: Record<ContentStatus, { label: string; className: string }> = {
  DRAFT: {
    label: "Черновик",
    className: "bg-gray-100 text-gray-700",
  },
  PENDING: {
    label: "На модерации",
    className: "bg-yellow-100 text-yellow-800",
  },
  PUBLISHED: {
    label: "Опубликовано",
    className: "bg-green-100 text-green-800",
  },
  NEEDS_REVISION: {
    label: "Требует правок",
    className: "bg-orange-100 text-orange-800",
  },
  REJECTED: {
    label: "Отклонено",
    className: "bg-red-100 text-red-800",
  },
};

export function ContentStatusBadge({ status, className = "" }: ContentStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className} ${className}`}
    >
      {config.label}
    </span>
  );
}
