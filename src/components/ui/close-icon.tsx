import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type CloseIconProps = {
  className?: string;
};

/**
 * Single close glyph for mamaGo overlays, pages and sheets.
 * The parent button owns the accessible label and click behavior.
 */
export function CloseIcon({ className }: CloseIconProps) {
  return (
    <X
      aria-hidden="true"
      focusable="false"
      strokeWidth={2.5}
      className={cn("h-[18px] w-[18px] shrink-0", className)}
    />
  );
}
