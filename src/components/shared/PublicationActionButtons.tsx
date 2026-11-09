"use client";

import type { ReactNode } from "react";
import { Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared layout and share control; the caller owns its save/plan business flow. */
export const PUBLICATION_SAVE_ACTION_CLASS =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[#E86A3A]/30 bg-[#FFF0E8] px-3 text-sm font-semibold text-[#D4562B] transition-colors hover:bg-[#FFE2D3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E86A3A]";

export const PUBLICATION_SHARE_ACTION_CLASS =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[#141210]/15 px-3 text-sm font-semibold text-[#141210] transition-colors hover:bg-[#141210]/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E86A3A]";

export function PublicationActionButtons({ saveControl, onShare, className }: {
  saveControl: ReactNode;
  onShare: () => void;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-2.5 sm:gap-3", className)}>
      {saveControl}
      <button type="button" onClick={onShare} className={PUBLICATION_SHARE_ACTION_CLASS}>
        <Share2 aria-hidden="true" className="h-5 w-5 shrink-0" />
        <span>Поделиться</span>
      </button>
    </div>
  );
}
