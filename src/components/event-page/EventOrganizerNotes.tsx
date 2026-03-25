"use client";

import { Section } from "@/components/ui/Section";
import { cn } from "@/lib/utils";

export function EventOrganizerNotes({
  note,
  className,
}: {
  note?: string;
  className?: string;
}) {
  if (!note?.trim()) return null;
  return (
    <Section
      title="От редакции mamaGo"
      className={cn("py-8 md:py-10", className)}
    >
      <div className="rounded-2xl border border-border/50 bg-muted/30 px-5 py-4 text-[14px] leading-relaxed text-muted-foreground">
        {note}
      </div>
    </Section>
  );
}
