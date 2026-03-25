"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EventPageData } from "@/lib/event/eventPageTypes";

export function EventAboutSection({
  about,
  className,
}: {
  about: EventPageData["about"];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const hasMore =
    Boolean(about.full?.trim()) || Boolean(about.highlights?.length);

  return (
    <Section title="О событии" className={cn("py-8 md:py-10", className)}>
      <div className="space-y-4 rounded-2xl border border-border/50 bg-card/40 p-5">
        <p className="text-[15px] leading-relaxed text-foreground">{about.summary}</p>

        {hasMore && !open && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto gap-1 px-0 text-[14px] font-medium text-primary"
            onClick={() => setOpen(true)}
          >
            Показать полностью
            <ChevronDown className="size-4" />
          </Button>
        )}

        {open && about.full && (
          <div className="space-y-3 border-t border-border/50 pt-4">
            <p className="whitespace-pre-line text-[14px] leading-relaxed text-muted-foreground">
              {about.full}
            </p>
          </div>
        )}

        {open && about.highlights && about.highlights.length > 0 && (
          <div className="space-y-2">
            <p className="text-[13px] font-medium text-foreground">Что будет</p>
            <ul className="list-inside list-disc space-y-1 text-[14px] text-muted-foreground">
              {about.highlights.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        {open && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto px-0 text-[14px] font-medium text-muted-foreground"
            onClick={() => setOpen(false)}
          >
            Свернуть
          </Button>
        )}
      </div>
    </Section>
  );
}
