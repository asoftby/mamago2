import { MediaAssetStatus } from "@prisma/client";

interface MediaStatusBadgeProps {
  status: MediaAssetStatus;
}

export function MediaStatusBadge({ status }: MediaStatusBadgeProps) {
  const config = {
    TEMP: {
      label: "Временный",
      className: "bg-yellow-100 text-yellow-700",
    },
    ACTIVE: {
      label: "Активен",
      className: "bg-green-100 text-green-700",
    },
    ORPHANED: {
      label: "Не используется",
      className: "bg-gray-100 text-gray-700",
    },
    ARCHIVED: {
      label: "Архив",
      className: "bg-blue-100 text-blue-700",
    },
    DELETED: {
      label: "Удален",
      className: "bg-red-100 text-red-700",
    },
    BLOCKED: {
      label: "Заблокирован",
      className: "bg-orange-100 text-orange-700",
    },
  };

  const { label, className } = config[status];

  return (
    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${className}`}>
      {label}
    </span>
  );
}
