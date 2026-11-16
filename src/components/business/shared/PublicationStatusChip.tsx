import { cn } from "@/lib/utils";
import {
  PUBLICATION_DISPLAY_TONE_CLASS,
  resolvePublicationDisplayStatus,
  type PublicationDisplayStatusInput,
} from "@/lib/publication/displayStatus";

interface PublicationStatusChipProps extends PublicationDisplayStatusInput {
  /** Причина (например, отклонения) — показывается как подсказка. */
  reason?: string | null;
  className?: string;
}

/** Единый чип статуса публикации для карточек Event / Place / Offer. */
export function PublicationStatusChip({
  reason,
  className,
  ...input
}: PublicationStatusChipProps) {
  const display = resolvePublicationDisplayStatus(input);
  const hint = reason?.trim() || undefined;
  return (
    <span
      title={hint}
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium",
        PUBLICATION_DISPLAY_TONE_CLASS[display.tone],
        className,
      )}
    >
      {display.label}
    </span>
  );
}
