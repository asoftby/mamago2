"use client";

import { ContentStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, AlertTriangle, FileText } from "lucide-react";

interface PlaceStatusBadgeProps {
  status: ContentStatus;
  hasActiveRevision?: boolean;
  revisionStatus?: string;
  className?: string;
}

const STATUS_CONFIG = {
  DRAFT: {
    label: "Черновик",
    icon: FileText,
    variant: "secondary" as const,
    className: "",
    tooltip: "Место сохранено как черновик. Завершите заполнение и отправьте на модерацию.",
  },
  PENDING: {
    label: "На модерации",
    icon: Clock,
    variant: "secondary" as const,
    className: "",
    tooltip: "Публикация проверяется модератором. После проверки она появится на сайте.",
  },
  PUBLISHED: {
    label: "Опубликовано",
    icon: CheckCircle,
    variant: "default" as const,
    className: "bg-green-100 text-green-800 border-green-200",
    tooltip: "Публикация доступна пользователям mamaGo.",
  },
  NEEDS_REVISION: {
    label: "Требуются правки",
    icon: AlertTriangle,
    variant: "destructive" as const,
    className: "bg-orange-100 text-orange-800 border-orange-200",
    tooltip: "Модератор запросил уточнение данных. Исправьте публикацию и отправьте её повторно.",
  },
  REJECTED: {
    label: "Отклонено",
    icon: AlertTriangle,
    variant: "destructive" as const,
    className: "",
    tooltip: "Публикация отклонена модератором. Проверьте комментарии и создайте новую публикацию.",
  },
};

const REVISION_STATUS_CONFIG = {
  PENDING: {
    label: "На модерации",
    icon: Clock,
    variant: "secondary" as const,
    className: "",
    tooltip: "Изменения отправлены на проверку модератора. После одобрения они появятся на сайте.",
  },
  NEEDS_REVISION: {
    label: "Правки к изменениям",
    icon: AlertTriangle,
    variant: "destructive" as const,
    className: "bg-orange-100 text-orange-800 border-orange-200",
    tooltip: "Модератор запросил правки к вашим изменениям. Исправьте и отправьте повторно.",
  },
};

export function PlaceStatusBadge({
  status,
  hasActiveRevision,
  revisionStatus,
  className,
}: PlaceStatusBadgeProps) {
  // If place is PUBLISHED but has active revision with PENDING or NEEDS_REVISION, show revision status
  // Otherwise show place status (including PUBLISHED when no active revision or revision is approved)
  const shouldShowRevisionStatus =
    status === "PUBLISHED" &&
    hasActiveRevision &&
    revisionStatus &&
    (revisionStatus === "PENDING" || revisionStatus === "NEEDS_REVISION");

  const effectiveStatus = shouldShowRevisionStatus ? revisionStatus : status;

  const config = shouldShowRevisionStatus
    ? REVISION_STATUS_CONFIG[revisionStatus as keyof typeof REVISION_STATUS_CONFIG]
    : STATUS_CONFIG[effectiveStatus as keyof typeof STATUS_CONFIG];

  if (!config) {
    return null;
  }

  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={`${config.className || ""} ${className || ""}`}
      title={config.tooltip}
    >
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
}
