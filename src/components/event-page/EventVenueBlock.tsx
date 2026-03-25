"use client";

import { ExternalLink, MapPin, Navigation } from "lucide-react";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EventPageVenue } from "@/lib/event/eventPageTypes";
import { EventVenueLocationRows } from "./EventVenueLocationRows";

export function EventVenueBlock({
  venue,
  className,
}: {
  venue?: EventPageVenue;
  className?: string;
}) {
  if (!venue) return null;

  return (
    <Section title="Место проведения" className={cn("py-8 md:py-10", className)}>
      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,220px)] lg:items-start">
        <div className="space-y-4 rounded-2xl border border-border/60 bg-card/50 p-5 shadow-sm">
          <div className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
              <MapPin className="size-5 text-foreground/80" />
            </span>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold leading-tight">{venue.name}</h3>
            </div>
          </div>

          <EventVenueLocationRows venue={venue} />

          {venue.landmark && (
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {venue.landmark}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {venue.mapUrl && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                asChild
              >
                <a href={venue.mapUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4" />
                  На карте
                </a>
              </Button>
            )}
            {venue.routeUrl && (
              <Button variant="outline" size="sm" className="rounded-xl" asChild>
                <a href={venue.routeUrl} target="_blank" rel="noopener noreferrer">
                  <Navigation className="size-4" />
                  Маршрут
                </a>
              </Button>
            )}
          </div>
        </div>

        <div
          className={cn(
            "flex h-[140px] items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/30 text-center text-xs text-muted-foreground lg:h-full lg:min-h-[160px]"
          )}
          aria-hidden
        >
          Карта
          <br />
          (превью)
        </div>
      </div>
    </Section>
  );
}
