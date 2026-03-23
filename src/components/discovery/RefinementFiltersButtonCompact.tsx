"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SecondaryFiltersForm } from "@/components/discovery/SecondaryFiltersForm";
import type { Intent } from "@/lib/intent";
import { useSecondaryFiltersFromUrl } from "@/features/filters/discovery/useSecondaryFiltersFromUrl";

interface RefinementFiltersButtonCompactProps {
  className?: string;
  intent?: Intent | string | null;
}

export function RefinementFiltersButtonCompact({
  className,
  intent,
}: RefinementFiltersButtonCompactProps) {
  const [open, setOpen] = useState(false);
  const safeIntent = (intent ?? null) as Intent | null;
  const { activeCount } = useSecondaryFiltersFromUrl(safeIntent);

  if (!safeIntent) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          data-secondary-filters-trigger
          aria-label="Фильтры — нажмите, чтобы открыть"
          aria-expanded={open}
          aria-haspopup="dialog"
          className={cn(
            "inline-flex h-[64px] min-h-[64px] items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-800 shadow-sm transition-colors duration-200",
            "hover:border-gray-300 hover:bg-gray-50 hover:shadow-md",
            "active:scale-[0.98]",
            "flex-shrink-0",
            className,
          )}
        >
          <SlidersHorizontal className="h-4 w-4 flex-shrink-0" />
          <span className="whitespace-nowrap">Фильтры</span>
          {activeCount > 0 && (
            <>
              <span className="text-gray-400 mx-1">·</span>
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gray-900 px-2 text-xs font-bold text-white">
                {activeCount}
              </span>
            </>
          )}
        </button>
      </DialogTrigger>

      <DialogContent
        showCloseButton
        className="max-h-[min(90vh,800px)] max-w-[calc(100%-2rem)] gap-0 overflow-hidden p-0 sm:max-w-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="border-b border-border/60 px-6 py-4 text-left">
          <DialogTitle className="text-lg font-semibold">Фильтры</DialogTitle>
        </DialogHeader>
        <div className="max-h-[min(70vh,640px)] overflow-y-auto px-6 py-4">
          <SecondaryFiltersForm
            intent={safeIntent}
            compact
            onApply={() => setOpen(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
