import { ContentStatus } from "@prisma/client";
import { BusinessChip } from "@/components/business/ui/BusinessChip";
import { CONTENT_STATUS_META } from "@/lib/content-status-meta";

interface OfferStatusBadgeProps {
  status: ContentStatus;
  className?: string;
}

export function OfferStatusBadge({ status, className = "" }: OfferStatusBadgeProps) {
  const config = CONTENT_STATUS_META[status];

  return (
    <BusinessChip tone={config.badgeTone} className={className}>
      {config.label}
    </BusinessChip>
  );
}
