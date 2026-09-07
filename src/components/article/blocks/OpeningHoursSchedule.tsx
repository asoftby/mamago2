"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  trackArticleStructuredAction,
  type ArticleStructuredAnalyticsContext,
} from "./ArticleStructuredBlockAnalytics";

export function OpeningHoursSchedule({
  children,
  analytics,
}: {
  children: ReactNode;
  analytics?: ArticleStructuredAnalyticsContext;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          trackArticleStructuredAction(analytics, open ? "hours_collapse" : "hours_expand");
          setOpen((value) => !value);
        }}
        className="flex w-full items-center justify-between gap-2 rounded-md py-2 text-left text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
      >
        <span>{open ? "Скрыть расписание на неделю" : "Показать расписание на неделю"}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      <div id={panelId} hidden={!open}>
        {children}
      </div>
    </div>
  );
}
