import type { OfferStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import {
  offerStatusPublicationLabel,
  offerStatusPublicationPillClass,
} from "@/lib/content-status-meta";

interface OfferStatusBadgeProps {
  status: OfferStatus;
  className?: string;
}

export function OfferStatusBadge({ status, className = "" }: OfferStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium",
        offerStatusPublicationPillClass(status),
        className,
      )}
    >
      {offerStatusPublicationLabel(status)}
    </span>
  );
}
