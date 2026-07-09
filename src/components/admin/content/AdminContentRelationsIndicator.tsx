"use client";

import Link from "next/link";
import { Link2 } from "lucide-react";
import type { ContentDependencySummary } from "@/lib/admin/contentDependencySummary";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Props = {
  summary: ContentDependencySummary;
  className?: string;
};

export function AdminContentRelationsIndicator({ summary, className }: Props) {
  if (summary.total === 0) {
    return <span className={cn("text-gray-400", className)}>—</span>;
  }

  const hasBlocking = summary.blockingTotal > 0;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors",
              hasBlocking
                ? "text-amber-800 bg-amber-50 hover:bg-amber-100"
                : "text-gray-600 bg-gray-50 hover:bg-gray-100",
              className,
            )}
            aria-label={`Связи: ${summary.total}`}
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{summary.total}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs bg-gray-900 text-white border-gray-800 px-3 py-2"
        >
          <p className="font-medium mb-1.5">Связи</p>
          <ul className="space-y-1">
            {summary.items.map((item) => (
              <li key={item.type} className="flex items-start justify-between gap-3">
                <span>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="underline underline-offset-2 hover:text-white/90"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    item.label
                  )}
                  : {item.count}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-[10px] uppercase tracking-wide",
                    item.blocking ? "text-amber-300" : "text-gray-400",
                  )}
                >
                  {item.blocking ? "блокирует" : "ок"}
                </span>
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
