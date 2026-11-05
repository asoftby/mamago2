"use client";

import Link from "next/link";
import { useDiscoveryFilters } from "@/features/filters/discovery/filters.store";

export type HomeQuickChip = { label: string; href: string };

/** Navigational chips: open a filtered catalog; do not refilter the home carousel. */
export function HomeSectionQuickChips({ chips, label }: { chips: HomeQuickChip[]; label: string }) {
  const { applied } = useDiscoveryFilters();
  if (chips.length === 0) return null;
  return (
    <nav aria-label={label} className="no-scrollbar mb-[23px] flex max-w-full gap-2 overflow-x-auto overflow-y-hidden px-1 pb-1 pt-1 [scrollbar-width:none]">
      {chips.map(chip => {
        const [path, query] = chip.href.split("?");
        const params = new URLSearchParams(query ?? "");
        // Preserve only the global audience. The destination chip owns the local category/date.
        if (applied.age.length && !params.has("age")) params.set("age", applied.age.join(","));
        return (
          <Link key={chip.href} href={`${path}${params.size ? `?${params.toString()}` : ""}`}
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary">
            {chip.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function HomeEventsQuickChips({ citySlug }: { citySlug: string }) {
  return <HomeSectionQuickChips label="Быстрый переход к событиям" chips={[
    { label: "Сегодня", href: `/${citySlug}/events?preset=TODAY` },
    { label: "Завтра", href: `/${citySlug}/events?preset=TOMORROW` },
    { label: "На выходных", href: `/${citySlug}/events?preset=WEEKEND` },
  ]} />;
}
