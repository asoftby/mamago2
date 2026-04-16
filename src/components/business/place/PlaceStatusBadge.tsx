import { ContentStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, AlertTriangle, FileText } from "lucide-react";
import { CONTENT_STATUS_META } from "@/lib/content-status-meta";

interface PlaceStatusBadgeProps {
  status: ContentStatus;
  hasActiveRevision?: boolean;
  revisionStatus?: string;
  className?: string;
}

interface PlaceStatusBadgeConfig {
  label: string;
  icon?: typeof FileText;
  variant: "default" | "secondary" | "outline" | "destructive";
  className?: string;
  tooltip?: string;
}

const REVISION_STATUS_CONFIG: Record<string, PlaceStatusBadgeConfig> = {
  PENDING: {
    label: "На модерации",
    icon: Clock,
    variant: "secondary",
    className: "",
    tooltip: "Изменения отправлены на проверку модератора. После одобрения они появятся на сайте.",
  },
  NEEDS_REVISION: {
    label: "Правки к изменениям",
    icon: AlertTriangle,
    variant: "destructive",
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

  const badgeConfig: PlaceStatusBadgeConfig = shouldShowRevisionStatus
    ? REVISION_STATUS_CONFIG[revisionStatus]
    : {
        label: CONTENT_STATUS_META[effectiveStatus].label,
        icon: FileText,
        variant: CONTENT_STATUS_META[effectiveStatus].badgeVariant || "secondary",
        className: CONTENT_STATUS_META[effectiveStatus].badgeClassName,
        tooltip: undefined,
      };

  if (!badgeConfig) {
    return null;
  }

  const Icon = badgeConfig.icon || FileText;

  return (
    <Badge
      variant={badgeConfig.variant}
      className={`${badgeConfig.className || ""} ${className || ""}`}
      title={badgeConfig.tooltip}
    >
      <Icon className="w-3 h-3 mr-1" />
      {badgeConfig.label}
    </Badge>
  );
}
